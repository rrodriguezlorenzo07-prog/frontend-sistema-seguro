/**
 * Cloud Functions del ERP de obras y nóminas.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');

const { cambiarPermisoAdmin } = require('./logica');

if (getApps().length === 0) {
    initializeApp();
}

/**
 * Única vía para escribir en roles/{uid}.
 *
 * Recibe { uid?, email?, esAdmin } y verifica en el servidor que quien llama ya
 * es administrador antes de tocar nada.
 */
exports.asignarRolAdmin = onCall({ region: 'us-central1' }, async (peticion) => {
    if (!peticion.auth) {
        throw new HttpsError('unauthenticated', 'Debes haber iniciado sesión.');
    }

    const { uid, email, esAdmin } = peticion.data || {};

    return cambiarPermisoAdmin({
        solicitanteUid: peticion.auth.uid,
        uid,
        email,
        esAdmin
    });
});
