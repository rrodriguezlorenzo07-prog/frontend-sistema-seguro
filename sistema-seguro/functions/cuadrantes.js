/**
 * Cierre del círculo entre el cuadrante y el parte.
 *
 * La oficina planifica una asignación; el operario envía su parte desde ella. Hasta
 * aquí el cuadrante no se enteraba: `estado` se quedaba en 'planificado' para siempre y
 * la insignia «Parte enviado» que el tablero ya sabe pintar no aparecía nunca.
 *
 * POR QUÉ UNA FUNCIÓN Y NO EL CLIENTE. El operario no puede escribir en `cuadrantes`
 * —la regla solo deja crear y editar a la oficina—, y abrirle esa puerta para esto
 * sería darle permiso para reescribir su propia planificación. El Admin SDK no pasa por
 * las reglas, así que la marca se pone desde el servidor sin tocar firestore.rules.
 *
 * Va aparte de index.js para poder ejercitarlo contra el emulador sin levantar el
 * runtime de Cloud Functions, igual que logica.js y firmas.js.
 */
const { getFirestore } = require('firebase-admin/firestore');

/**
 * Marca la asignación de la que salió un parte.
 *
 * IDEMPOTENTE. Se comprueba el estado antes de escribir, así que reentregar el evento
 * —que es justo lo que hace Cloud Functions con `retry: true`— no reescribe ni cambia
 * `parteId` por el de un segundo parte. El primero que llega se queda: si un operario
 * manda dos partes desde la misma asignación, el cuadrante apunta al primero y el
 * segundo queda registrado igual en `partes_de_trabajo`, que es donde importa.
 *
 * NO FALLA SI NO PUEDE. Un parte enviado es un hecho consumado; que su cuadrante no se
 * pueda marcar —porque la oficina lo borró mientras el operario trabajaba— no debe
 * reintentarse indefinidamente ni ensuciar los registros con errores. Se devuelve el
 * motivo y quien llama decide qué anotar.
 *
 * @param {string} parteId
 * @param {{asignacionId?: string|null}} datosDelParte
 * @returns {Promise<{marcada: boolean, motivo: string, asignacionId?: string}>}
 */
async function marcarAsignacionComoEnviada(parteId, datosDelParte) {
    const asignacionId = datosDelParte?.asignacionId;

    // Parte creado por la vía libre: no hay nada que marcar y no es un error.
    if (!asignacionId || typeof asignacionId !== 'string') {
        return { marcada: false, motivo: 'sin-asignacion' };
    }

    const db = getFirestore();
    const referencia = db.collection('cuadrantes').doc(asignacionId);
    const documento = await referencia.get();

    if (!documento.exists) {
        return { marcada: false, motivo: 'asignacion-inexistente', asignacionId };
    }

    if (documento.get('estado') === 'parte_enviado') {
        return { marcada: false, motivo: 'ya-marcada', asignacionId };
    }

    // `estado` y no un booleano suelto: es lo que leen CuadranteDiario.jsx y
    // ParteTrabajo.jsx para pintar la insignia, y el modelo ya lo declara con esos dos
    // valores. Un campo nuevo se escribiría sin que nadie lo mirara.
    await referencia.update({
        estado: 'parte_enviado',
        parteId,
        parteEnviadoEn: Date.now()
    });

    return { marcada: true, motivo: 'marcada', asignacionId };
}

module.exports = { marcarAsignacionComoEnviada };
