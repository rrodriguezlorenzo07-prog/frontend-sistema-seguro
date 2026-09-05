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

/** Los únicos permisos que existen. Cualquier otro nombre se rechaza. */
const PERMISOS = ['admin', 'veNominas'];

/**
 * Concede o retira UN permiso.
 *
 * DOS PERMISOS INDEPENDIENTES, no una jerarquía:
 *   admin      administración operativa — validar partes, planificar, catálogos
 *   veNominas  ver lo que se paga — validaciones/ y nominas/
 *
 * Se cambian de uno en uno, y el `merge: true` de abajo es lo que permite tocar uno sin
 * pisar el otro.
 *
 * @param {object} peticion
 * @param {string} peticion.solicitanteUid  uid autenticado de quien pide el cambio
 * @param {string} [peticion.uid]           uid del destinatario
 * @param {string} [peticion.email]         alternativa al uid: se resuelve en el servidor
 * @param {'admin'|'veNominas'} peticion.permiso
 * @param {boolean} peticion.valor          true concede, false retira
 * @returns {Promise<{ok: true, uid: string, permiso: string, valor: boolean, claim: boolean}>}
 */
async function cambiarPermisoAdmin({ solicitanteUid, uid, email, permiso, valor }) {
    if (!solicitanteUid) {
        throw new HttpsError('unauthenticated', 'Debes haber iniciado sesión.');
    }
    if (!PERMISOS.includes(permiso)) {
        throw new HttpsError('invalid-argument', `permiso debe ser uno de: ${PERMISOS.join(', ')}.`);
    }
    if (typeof valor !== 'boolean') {
        throw new HttpsError('invalid-argument', 'valor debe ser true o false.');
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
    //
    // SOLO PARA `admin`, a propósito. Retirarse `veNominas` a uno mismo es recuperable
    // —otro administrador se lo devuelve— mientras que quedarse sin `admin` puede dejar
    // la oficina sin nadie que pueda arreglarlo. Proteger el permiso equivocado sería
    // estorbar sin ganar seguridad.
    if (uidDestino === solicitanteUid && permiso === 'admin' && valor === false) {
        throw new HttpsError('failed-precondition', 'No puedes retirarte a ti mismo el permiso de administrador.');
    }

    const ref = getFirestore().doc(`roles/${uidDestino}`);
    const estadoPrevio = await ref.get();

    // merge: true — se toca el permiso pedido y el otro se queda como estaba.
    await ref.set({
        [permiso]: valor,
        actualizadoPor: solicitanteUid,
        actualizadoEn: FieldValue.serverTimestamp()
    }, { merge: true });

    // El mismo permiso, también como custom claim del token. Storage lo necesita:
    // storage.rules no puede resolver roles/{uid} porque la llamada entre servicios
    // funciona en el emulador y NO en producción (comprobado el 30/08/2026). El claim
    // se evalúa en local, sin depender de Firestore.
    //
    // roles/{uid} sigue siendo la fuente de verdad y por eso se escribe primero. Si el
    // claim falla, se deshace la escritura anterior: es preferible no conceder nada a
    // dejar los dos sitios diciendo cosas distintas, que es justo lo que nos costó
    // una mañana de incidente.
    try {
        const usuario = await getAuth().getUser(uidDestino);
        const claims = { ...(usuario.customClaims || {}) };
        if (valor) claims[permiso] = true;
        else delete claims[permiso];   // se retira la llave entera, no se deja en false
        await getAuth().setCustomUserClaims(uidDestino, claims);
    } catch (error) {
        if (estadoPrevio.exists) {
            await ref.set(estadoPrevio.data());
        } else {
            await ref.delete();
        }
        throw new HttpsError('internal', `No se pudo actualizar el token de acceso (${error.message}). No se ha cambiado nada.`);
    }

    // Lectura de vuelta de LOS DOS sitios: se devuelve lo que quedó escrito, no lo
    // que se pidió.
    const confirmacion = await ref.get();
    const usuarioFinal = await getAuth().getUser(uidDestino);
    const datos = confirmacion.exists ? confirmacion.data() : {};
    return {
        ok: true,
        uid: uidDestino,
        permiso,
        valor: datos[permiso] === true,
        claim: usuarioFinal.customClaims?.[permiso] === true,
        // El estado completo de vuelta: la pantalla pinta dos interruptores y necesita
        // saber cómo quedaron los dos, no solo el que se acaba de tocar.
        admin: datos.admin === true,
        veNominas: datos.veNominas === true
    };
}

module.exports = { cambiarPermisoAdmin, esAdministrador, PERMISOS };
