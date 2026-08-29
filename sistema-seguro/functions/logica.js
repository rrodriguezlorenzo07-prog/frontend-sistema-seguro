/**
 * Núcleo de la asignación de permisos. Va aparte de index.js para poder
 * ejercitarlo contra el emulador sin levantar el runtime de Cloud Functions.
 *
 * roles/{uid} es la fuente de verdad de los permisos y está cerrada a los
 * clientes por reglas (allow read, write: if false). Solo el Admin SDK, que no
 * pasa por las reglas, puede escribirla — y solo a través de aquí.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/** ¿El uid indicado tiene permiso de administrador según roles/{uid}? */
async function esAdministrador(uid) {
    const snap = await getFirestore().doc(`roles/${uid}`).get();
    return snap.exists && snap.data().admin === true;
}

/**
 * Concede o retira el permiso de administrador.
 *
 * @param {object} peticion
 * @param {string} peticion.solicitanteUid  uid autenticado de quien pide el cambio
 * @param {string} [peticion.uid]           uid del destinatario
 * @param {string} [peticion.email]         alternativa al uid: se resuelve en el servidor
 * @param {boolean} peticion.esAdmin        true concede, false retira
 * @returns {Promise<{ok: true, uid: string, admin: boolean}>}
 */
async function cambiarPermisoAdmin({ solicitanteUid, uid, email, esAdmin }) {
    if (!solicitanteUid) {
        throw new HttpsError('unauthenticated', 'Debes haber iniciado sesión.');
    }
    if (typeof esAdmin !== 'boolean') {
        throw new HttpsError('invalid-argument', 'esAdmin debe ser true o false.');
    }
    if (!uid && !email) {
        throw new HttpsError('invalid-argument', 'Indica el uid o el email del trabajador.');
    }

    // La verificación es del lado servidor y no depende de las reglas de Firestore.
    if (!(await esAdministrador(solicitanteUid))) {
        throw new HttpsError('permission-denied', 'Solo un administrador puede cambiar permisos.');
    }

    // La ficha de trabajadores usa ID autogenerado, así que el cliente solo conoce el
    // email: el uid real de Auth se resuelve aquí.
    let uidDestino = uid;
    if (!uidDestino) {
        try {
            const usuario = await getAuth().getUserByEmail(String(email).toLowerCase().trim());
            uidDestino = usuario.uid;
        } catch {
            throw new HttpsError('not-found', `No hay ninguna cuenta de acceso con el correo ${email}. Vincula una cuenta antes de darle permisos.`);
        }
    }

    // Salvaguarda: que nadie se deje a sí mismo sin acceso y bloquee la oficina.
    if (uidDestino === solicitanteUid && esAdmin === false) {
        throw new HttpsError('failed-precondition', 'No puedes retirarte a ti mismo el permiso de administrador.');
    }

    const ref = getFirestore().doc(`roles/${uidDestino}`);
    await ref.set({
        admin: esAdmin,
        actualizadoPor: solicitanteUid,
        actualizadoEn: FieldValue.serverTimestamp()
    }, { merge: true });

    // Lectura de vuelta: se devuelve lo que quedó escrito, no lo que se pidió.
    const confirmacion = await ref.get();
    return {
        ok: true,
        uid: uidDestino,
        admin: confirmacion.exists && confirmacion.data().admin === true
    };
}

module.exports = { cambiarPermisoAdmin, esAdministrador };
