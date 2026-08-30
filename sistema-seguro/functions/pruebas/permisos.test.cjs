/**
 * Verifica cambiarPermisoAdmin contra los emuladores de Firestore y Auth.
 *
 *   npx firebase emulators:exec --only firestore,auth --project demo-sistema-seguro \
 *     "node functions/pruebas/permisos.test.cjs"
 *
 * No toca producción: los emuladores se detectan por FIRESTORE_EMULATOR_HOST y
 * FIREBASE_AUTH_EMULATOR_HOST, que fija el propio emulators:exec.
 */
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const { cambiarPermisoAdmin } = require('../logica');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error('Esta prueba solo corre contra los emuladores. Abortada.');
    process.exit(1);
}

initializeApp({ projectId: 'demo-sistema-seguro' });
const db = getFirestore();
const auth = getAuth();

let fallos = 0;
const comprobar = (descripcion, condicion, detalle) => {
    if (condicion) {
        console.log(`   PASA   · ${descripcion}${detalle ? ' — ' + detalle : ''}`);
    } else {
        fallos += 1;
        console.log(`   FALLA  · ${descripcion}${detalle ? ' — ' + detalle : ''}`);
    }
};

const leerRol = async (uid) => {
    const snap = await db.doc(`roles/${uid}`).get();
    return snap.exists ? snap.data() : null;
};

// El permiso vive en dos sitios desde la fase 2 de 3b: roles/{uid} es la fuente de
// verdad y el custom claim es su reflejo en el token, que es lo único que Storage
// puede leer. Que se desincronicen es exactamente el fallo que hubo que arreglar.
const leerClaims = async (uid) => (await auth.getUser(uid)).customClaims || {};

(async () => {
    // ---- Semilla ---------------------------------------------------------
    const jefe = await auth.createUser({ email: 'oficina@empresa.com', password: 'secreto123' });
    const juan = await auth.createUser({ email: 'juan@empresa.com', password: 'secreto123' });
    const ana = await auth.createUser({ email: 'ana@empresa.com', password: 'secreto123' });

    // Se siembra en los dos sitios, como deja las cosas scripts/backfill-claims-admin.cjs
    await db.doc(`roles/${jefe.uid}`).set({ admin: true });
    await auth.setCustomUserClaims(jefe.uid, { admin: true });

    console.log('Semilla:');
    console.log(`   jefe (admin) uid = ${jefe.uid}`);
    console.log(`   juan          uid = ${juan.uid}`);
    console.log(`   ana           uid = ${ana.uid}`);

    // ---- CASO 1: el botón concede permiso real ---------------------------
    console.log('\n─── CASO 1: un admin asciende a Juan (lo que hace el botón) ───');
    console.log('   roles/juan ANTES:', JSON.stringify(await leerRol(juan.uid)));

    const resultado = await cambiarPermisoAdmin({
        solicitanteUid: jefe.uid,
        email: 'juan@empresa.com',   // el cliente solo conoce el email de la ficha
        esAdmin: true
    });

    const rolJuan = await leerRol(juan.uid);
    console.log('   roles/juan DESPUÉS:', JSON.stringify({ admin: rolJuan?.admin, actualizadoPor: rolJuan?.actualizadoPor }));
    comprobar('la función devuelve el uid resuelto desde el email', resultado.uid === juan.uid, `uid = ${resultado.uid}`);
    comprobar('roles/{uid} existe y admin === true', rolJuan?.admin === true);
    comprobar('queda registrado quién lo cambió', rolJuan?.actualizadoPor === jefe.uid);
    comprobar('queda registrado cuándo', !!rolJuan?.actualizadoEn);
    comprobar('el custom claim admin queda puesto', (await leerClaims(juan.uid)).admin === true);
    comprobar('la función informa de los dos sitios', resultado.admin === true && resultado.claim === true,
              JSON.stringify({ admin: resultado.admin, claim: resultado.claim }));

    // ---- CASO 2: Juan ya puede ejercer de admin --------------------------
    console.log('\n─── CASO 2: Juan, ya admin, puede ascender a Ana ───');
    await cambiarPermisoAdmin({ solicitanteUid: juan.uid, email: 'ana@empresa.com', esAdmin: true });
    comprobar('el permiso recién concedido es efectivo', (await leerRol(ana.uid))?.admin === true);

    // ---- CASO 3: retirar el permiso --------------------------------------
    console.log('\n─── CASO 3: el jefe retira el permiso a Ana ───');
    await cambiarPermisoAdmin({ solicitanteUid: jefe.uid, uid: ana.uid, esAdmin: false });
    comprobar('roles/{uid}.admin queda en false', (await leerRol(ana.uid))?.admin === false);
    const claimsAna = await leerClaims(ana.uid);
    comprobar('el custom claim se retira entero, no se deja en false',
              !('admin' in claimsAna), JSON.stringify(claimsAna));

    // ---- CASO 4: un no-admin no puede ------------------------------------
    console.log('\n─── CASO 4: Ana (ya sin permiso) intenta ascenderse ───');
    try {
        await cambiarPermisoAdmin({ solicitanteUid: ana.uid, uid: ana.uid, esAdmin: true });
        comprobar('debería haber sido rechazada', false);
    } catch (error) {
        comprobar('rechazada con permission-denied', error.code === 'permission-denied' || String(error.code).includes('permission-denied'), error.message);
        comprobar('y roles/ana sigue en false', (await leerRol(ana.uid))?.admin === false);
    }

    // ---- CASO 5: nadie se deja a sí mismo fuera --------------------------
    console.log('\n─── CASO 5: el jefe intenta retirarse el permiso a sí mismo ───');
    try {
        await cambiarPermisoAdmin({ solicitanteUid: jefe.uid, uid: jefe.uid, esAdmin: false });
        comprobar('debería haber sido bloqueado', false);
    } catch (error) {
        comprobar('bloqueado con failed-precondition', String(error.code).includes('failed-precondition'), error.message);
        comprobar('y el jefe conserva su acceso', (await leerRol(jefe.uid))?.admin === true);
        comprobar('y conserva también su claim', (await leerClaims(jefe.uid)).admin === true);
    }

    // ---- CASO 7: los dos sitios nunca se separan -------------------------
    console.log('\n─── CASO 7: conceder y retirar deja siempre los dos sitios de acuerdo ───');
    for (const valor of [true, false, true]) {
        await cambiarPermisoAdmin({ solicitanteUid: jefe.uid, uid: ana.uid, esAdmin: valor });
        const enFirestore = (await leerRol(ana.uid))?.admin === true;
        const enToken = (await leerClaims(ana.uid)).admin === true;
        comprobar(`esAdmin=${valor} -> roles/=${enFirestore}, claim=${enToken}`, enFirestore === valor && enToken === valor);
    }

    // ---- CASO 6: email sin cuenta de acceso ------------------------------
    console.log('\n─── CASO 6: trabajador cuyo email no tiene cuenta en Auth ───');
    try {
        await cambiarPermisoAdmin({ solicitanteUid: jefe.uid, email: 'fantasma@empresa.com', esAdmin: true });
        comprobar('debería haber fallado', false);
    } catch (error) {
        comprobar('error not-found explicativo', String(error.code).includes('not-found'), error.message);
    }

    console.log(fallos === 0 ? '\n══ TODAS LAS COMPROBACIONES PASAN ══' : `\n══ ${fallos} COMPROBACIÓN(ES) FALLIDA(S) ══`);
    process.exit(fallos === 0 ? 0 : 1);
})().catch((error) => {
    console.error('\nError inesperado:', error);
    process.exit(1);
});
