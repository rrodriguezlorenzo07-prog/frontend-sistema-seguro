/**
 * Invocación real de asignarRolAdmin en producción, para confirmar que sigue viva tras
 * subir el runtime a Node 22.
 *
 *   node scripts/invocar-funcion-real.cjs
 *
 * CASO DELIBERADAMENTE INOFENSIVO: rrodriguezlorenzo02 (admin) confirma que
 * rrodriguezlorenzo07 es admin, que YA LO ES. No hay cambio de permisos en ningún
 * sentido; lo único que se mueve es la marca actualizadoEn del propio documento.
 *
 * Se fotografía el estado antes y después y se comparan, para demostrar que no cambió
 * nada más. Aborta antes de llamar si el destinatario no fuese ya admin.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const PROYECTO = 'sistema-seguro-dcecb';
const REGION = 'us-central1';
const API_KEY = 'AIzaSyCW1nxHPHriIFbQauj6JunxdEalBvTFct8'; // clave web pública del cliente
const QUIEN_LLAMA = 'rrodriguezlorenzo02@gmail.com';
const DESTINATARIO = 'rrodriguezlorenzo07@gmail.com';

const app = initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
const auth = getAuth(app);
const db = getFirestore(app);

const foto = async (uid) => {
    const d = await db.doc(`roles/${uid}`).get();
    const u = await auth.getUser(uid);
    const r = d.exists ? d.data() : null;
    return {
        admin: r?.admin ?? null,
        actualizadoPor: r?.actualizadoPor ?? null,
        actualizadoEn: r?.actualizadoEn?.toDate ? r.actualizadoEn.toDate().toISOString() : null,
        claims: u.customClaims ?? null
    };
};

(async () => {
    const llamante = await auth.getUserByEmail(QUIEN_LLAMA);
    const destino = await auth.getUserByEmail(DESTINATARIO);

    console.log('═══ ANTES ═══');
    const antes = await foto(destino.uid);
    console.log(`  destinatario: ${DESTINATARIO} (${destino.uid})`);
    console.log('   ', JSON.stringify(antes, null, 2).replace(/\n/g, '\n    '));

    if (antes.admin !== true) {
        console.log('\n  ABORTADO: el destinatario NO es admin ahora mismo, así que la');
        console.log('  llamada SÍ cambiaría su permiso. No es el caso inofensivo. Nada hecho.');
        process.exit(1);
    }

    // ── Token del llamante ─────────────────────────────────────────────────
    const custom = await auth.createCustomToken(llamante.uid);
    const canje = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: custom, returnSecureToken: true })
    })).json();
    if (!canje.idToken) throw new Error('no se pudo canjear el token: ' + JSON.stringify(canje).slice(0, 200));

    // ── Llamada, por el protocolo callable ─────────────────────────────────
    console.log('\n═══ INVOCACIÓN ═══');
    console.log(`  quien llama : ${QUIEN_LLAMA} (${llamante.uid})`);
    console.log(`  petición    : { email: "${DESTINATARIO}", esAdmin: true }  <- ya lo es`);
    const inicio = Date.now();
    const res = await fetch(`https://${REGION}-${PROYECTO}.cloudfunctions.net/asignarRolAdmin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canje.idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { email: DESTINATARIO, esAdmin: true } })
    });
    const cuerpo = await res.text();
    console.log(`  -> HTTP ${res.status} en ${Date.now() - inicio} ms`);
    console.log('  respuesta:', cuerpo.slice(0, 400));

    if (!res.ok) {
        console.log('\n  LA FUNCIÓN NO RESPONDIÓ CORRECTAMENTE.');
        process.exit(1);
    }
    const datos = JSON.parse(cuerpo).result;

    // ── Después ────────────────────────────────────────────────────────────
    console.log('\n═══ DESPUÉS ═══');
    const despues = await foto(destino.uid);
    console.log('   ', JSON.stringify(despues, null, 2).replace(/\n/g, '\n    '));

    console.log('\n═══ QUÉ CAMBIÓ ═══');
    for (const campo of ['admin', 'actualizadoPor', 'claims']) {
        const a = JSON.stringify(antes[campo]), d = JSON.stringify(despues[campo]);
        console.log(`  ${campo.padEnd(15)}: ${a === d ? 'sin cambios' : `${a} -> ${d}`}  ${a === d ? '' : '<-- CAMBIÓ'}`);
    }
    console.log(`  actualizadoEn  : ${antes.actualizadoEn} -> ${despues.actualizadoEn}  <-- se esperaba que cambiara`);

    console.log('\n═══ VEREDICTO ═══');
    const permisoIntacto = antes.admin === despues.admin && JSON.stringify(antes.claims) === JSON.stringify(despues.claims);
    const escribeAmbos = datos?.admin === true && datos?.claim === true;
    console.log('  la función responde                     :', res.ok ? 'sí' : 'NO');
    console.log('  devuelve admin Y claim (versión nueva)  :', escribeAmbos ? 'sí' : 'NO', JSON.stringify(datos));
    console.log('  el permiso quedó intacto                :', permisoIntacto ? 'sí' : 'NO');
    process.exit(res.ok && escribeAmbos && permisoIntacto ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
