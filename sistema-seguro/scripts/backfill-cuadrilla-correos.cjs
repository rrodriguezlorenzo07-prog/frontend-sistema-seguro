/**
 * Rellena `operarioEmails` en las cuadrillas que no lo tienen.
 *
 *   node scripts/backfill-cuadrilla-correos.cjs            -> recuento, no escribe
 *   node scripts/backfill-cuadrilla-correos.cjs --aplicar  -> escribe
 *
 * POR QUÉ HACE FALTA. Desde la corrección de la referencia viva, de este array plano
 * cuelga quién puede LEER las asignaciones de una cuadrilla: las reglas de `cuadrantes`
 * resuelven `cuadrillas/{cuadrillaId}` con un get() y comprueban el correo contra él.
 * Las reglas no saben proyectar un campo dentro de `operarios`, que es un array de
 * objetos, así que sin este array plano la cuadrilla no deja ver nada a nadie.
 *
 * SE EJECUTA ANTES DE DESPLEGAR LAS REGLAS. Al revés dejaría una ventana en la que
 * ningún operario ve su asignación.
 *
 * Es idempotente y NO destructivo: solo añade el campo que falta, derivándolo de
 * `operarios`. Una cuadrilla que ya lo tenga se deja como está.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'sistema-seguro-dcecb';
const APLICAR = process.argv.includes('--aplicar');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
}

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }));

/** Misma normalización que correosDeCuadrilla() de src/logica/cuadrantes.js. */
const correosDe = (operarios) => [...new Set(
    (operarios || [])
        .map((o) => String(o?.email || '').toLowerCase().trim())
        .filter((c) => c.length > 0)
)];

const mismos = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR' : 'MODO: SECO — no se escribe nada');
    console.log('Proyecto:', PROJECT_ID, '\n');

    const snap = await db.collection('cuadrillas').get();
    const pendientes = [];
    let yaCorrectas = 0;

    snap.forEach((doc) => {
        const datos = doc.data();
        const esperado = correosDe(datos.operarios);
        const actual = Array.isArray(datos.operarioEmails)
            ? datos.operarioEmails.map((e) => String(e || '').toLowerCase().trim())
            : null;

        if (actual !== null && mismos(actual, esperado)) {
            yaCorrectas += 1;
            console.log(`   OK      ${doc.id}  «${datos.nombre}»  ${esperado.length} correo(s)`);
            return;
        }
        pendientes.push({ id: doc.id, nombre: datos.nombre, esperado, actual });
        console.log(`   FALTA   ${doc.id}  «${datos.nombre}»  ${actual === null ? 'sin el campo' : 'descuadrado'} -> ${esperado.length} correo(s)`);
    });

    console.log(`\nCuadrillas: ${snap.size} · ya correctas: ${yaCorrectas} · por rellenar: ${pendientes.length}`);

    if (pendientes.length === 0) { console.log('\nNada que hacer.\n'); process.exit(0); }
    if (!APLICAR) { console.log('\nRepite con --aplicar para escribirlo.\n'); process.exit(0); }

    for (const c of pendientes) {
        await db.doc(`cuadrillas/${c.id}`).set({ operarioEmails: c.esperado }, { merge: true });
        console.log(`   escrito ${c.id}: [${c.esperado.join(', ')}]`);
    }

    // Lectura de vuelta: se informa de lo que quedó, no de lo que se pidió.
    let verificadas = 0;
    for (const c of pendientes) {
        const doc = await db.doc(`cuadrillas/${c.id}`).get();
        if (mismos(doc.get('operarioEmails') || [], c.esperado)) verificadas += 1;
        else console.error(`   ✖ ${c.id} no quedó como se esperaba`);
    }
    console.log(`\nVerificadas de vuelta: ${verificadas}/${pendientes.length}\n`);
    process.exit(verificadas === pendientes.length ? 0 : 1);
})();
