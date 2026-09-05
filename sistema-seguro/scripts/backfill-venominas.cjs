/**
 * Pone `veNominas: true` a los administradores que YA existen, en roles/{uid} y en el
 * custom claim, igual que hace la Cloud Function.
 *
 *   node scripts/backfill-venominas.cjs            -> recuento, no escribe
 *   node scripts/backfill-venominas.cjs --aplicar  -> escribe
 *
 * SE EJECUTA ANTES DE DESPLEGAR LAS REGLAS. `veNominas()` lee el permiso con
 * `.get('veNominas', false)`: un administrador que no lo tenga escrito vale false. Si
 * las reglas entran primero, TODOS los administradores actuales se quedan sin poder
 * abrir las nóminas ni validar un parte el mismo día del despliegue.
 *
 * SE LO PONE A TODOS LOS QUE HOY SON ADMIN, a propósito: hoy cualquier admin ve las
 * nóminas, así que dárselo a todos deja el sistema exactamente como estaba. Quitárselo
 * después a quien no deba tenerlo es una decisión de negocio, se hace desde la pantalla
 * de Plantilla y queda con autor y fecha. Un script no debe decidir quién cobra el
 * privilegio de ver lo que cobran los demás.
 *
 * Idempotente: quien ya lo tenga se deja como está.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const PROJECT_ID = 'sistema-seguro-dcecb';
const APLICAR = process.argv.includes('--aplicar');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR' : 'MODO: SECO — no se escribe nada');
    console.log('Proyecto:', PROJECT_ID, '\n');

    const snap = await db.collection('roles').get();

    const pendientes = [];
    const yaLoTienen = [];
    const noAdmin = [];

    for (const doc of snap.docs) {
        const datos = doc.data();
        let correo = '(cuenta no encontrada)';
        let claim = null;
        try {
            const usuario = await getAuth().getUser(doc.id);
            correo = usuario.email || '(sin correo)';
            claim = usuario.customClaims || {};
        } catch { /* la cuenta pudo borrarse y el documento quedarse */ }

        const fila = {
            uid: doc.id,
            correo,
            admin: datos.admin === true,
            veNominas: datos.veNominas === true,
            claimAdmin: claim ? claim.admin === true : null,
            claimVeNominas: claim ? claim.veNominas === true : null
        };

        if (!fila.admin) noAdmin.push(fila);
        else if (fila.veNominas && fila.claimVeNominas) yaLoTienen.push(fila);
        else pendientes.push(fila);
    }

    const pinta = (f) => `   ${f.uid.slice(0, 8)}…  ${String(f.correo).padEnd(34)} admin=${f.admin}  veNominas=${f.veNominas}  claim.veNominas=${f.claimVeNominas}`;

    console.log(`Documentos en roles/: ${snap.size}\n`);
    if (pendientes.length) { console.log('POR RELLENAR (admin sin veNominas):'); pendientes.forEach((f) => console.log(pinta(f))); console.log(''); }
    if (yaLoTienen.length) { console.log('YA LO TIENEN:'); yaLoTienen.forEach((f) => console.log(pinta(f))); console.log(''); }
    if (noAdmin.length) { console.log('NO SON ADMIN (no se tocan):'); noAdmin.forEach((f) => console.log(pinta(f))); console.log(''); }

    console.log(`Resumen: ${pendientes.length} por rellenar · ${yaLoTienen.length} ya correctos · ${noAdmin.length} no-admin intactos`);

    // EL ESPEJO DE LA FICHA. roles/ está cerrada a los clientes, así que la pantalla de
    // Plantilla pinta los interruptores desde `trabajadores.veNominas`. Sin actualizarlo
    // aquí, los cuatro tendrían el permiso pero la pantalla diría «Sin nóminas»: quien
    // vaya a retirárselo a alguien estaría leyendo algo que no es verdad.
    const fichas = await db.collection('trabajadores').get();
    const espejo = [];
    for (const f of [...pendientes, ...yaLoTienen]) {
        const ficha = fichas.docs.find((d) => String(d.get('email') || '').toLowerCase() === String(f.correo).toLowerCase());
        if (!ficha) { console.log(`   (sin ficha en trabajadores: ${f.correo})`); continue; }
        if (ficha.get('veNominas') === true) continue;
        espejo.push({ id: ficha.id, nombre: ficha.get('nombre'), correo: f.correo });
    }
    console.log(`Espejo en trabajadores/: ${espejo.length} ficha(s) por marcar`);
    espejo.forEach((e) => console.log(`   ${e.id}  ${e.nombre} <${e.correo}>`));

    if (pendientes.length === 0 && espejo.length === 0) { console.log('\nNada que hacer.\n'); process.exit(0); }
    if (!APLICAR) { console.log('\nRepite con --aplicar para escribirlo.\n'); process.exit(0); }

    // Mismo orden que la Cloud Function: primero roles/ (fuente de verdad), luego el
    // claim. Si el claim falla se deshace lo anterior, para que los dos no digan cosas
    // distintas — que es justo lo que costó una mañana de incidente en su día.
    let hechos = 0;
    for (const f of pendientes) {
        const ref = db.doc(`roles/${f.uid}`);
        const previo = await ref.get();
        await ref.set({
            veNominas: true,
            actualizadoPor: 'backfill-venominas',
            actualizadoEn: FieldValue.serverTimestamp()
        }, { merge: true });

        try {
            const usuario = await getAuth().getUser(f.uid);
            await getAuth().setCustomUserClaims(f.uid, { ...(usuario.customClaims || {}), veNominas: true });
            hechos += 1;
            console.log(`   escrito ${f.uid.slice(0, 8)}… (${f.correo})`);
        } catch (error) {
            if (previo.exists) await ref.set(previo.data()); else await ref.delete();
            console.error(`   ✖ ${f.uid.slice(0, 8)}…: ${error.message} — deshecho, no se ha cambiado nada`);
        }
    }

    for (const e of espejo) {
        await db.doc(`trabajadores/${e.id}`).set({ veNominas: true }, { merge: true });
        console.log(`   espejo escrito en trabajadores/${e.id} (${e.nombre})`);
    }

    // Lectura de vuelta de LOS DOS sitios.
    console.log('\nVerificación:');
    let correctos = 0;
    for (const f of pendientes) {
        const doc = await db.doc(`roles/${f.uid}`).get();
        let claim = false;
        try { claim = (await getAuth().getUser(f.uid)).customClaims?.veNominas === true; } catch { /* sin cuenta */ }
        const bien = doc.get('veNominas') === true && claim;
        if (bien) correctos += 1;
        console.log(`   ${bien ? 'OK ' : '✖  '} ${f.uid.slice(0, 8)}…  roles=${doc.get('veNominas')}  claim=${claim}`);
    }

    console.log(`\nEscritos ${hechos}/${pendientes.length} · verificados ${correctos}/${pendientes.length}\n`);
    process.exit(correctos === pendientes.length ? 0 : 1);
})();
