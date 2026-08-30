/**
 * Cloud Functions del ERP de obras y nóminas.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');

const { cambiarPermisoAdmin } = require('./logica');
const { trasladarFirmaIncrustada } = require('./firmas');

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

/**
 * Mueve a Storage la firma que llegó incrustada en un parte enviado sin cobertura.
 *
 * POR QUÉ UN DISPARADOR Y NO UNA FUNCIÓN PROGRAMADA: la señal de "ha vuelto la
 * conectividad" no hay que buscarla, llega sola. Un parte escrito sin red se queda en
 * la cola local de Firestore y se envía al recuperarla; el evento de creación se
 * dispara en ese momento, no antes. Una función programada tendría que barrer la
 * colección cada N minutos preguntando por algo que casi nunca habrá pasado: coste
 * fijo, latencia añadida y una consulta recurrente para nada.
 *
 * onDocumentCreated y no onDocumentWritten por dos razones: el base64 solo puede
 * aparecer al crear el parte, y esta función escribe en el mismo documento —con
 * onDocumentWritten se dispararía a sí misma.
 *
 * retry: true deja que Cloud Functions reentregue el evento si el traslado falla por
 * algo transitorio. Es idempotente: el nombre del archivo se deriva del id del parte,
 * así que reintentar sobrescribe en vez de acumular huérfanos.
 */
exports.subirFirmaPendiente = onDocumentCreated(
    { region: 'us-central1', document: 'partes_de_trabajo/{parteId}', retry: true },
    async (evento) => {
        const datos = evento.data?.data();
        if (!datos) return;

        const resultado = await trasladarFirmaIncrustada(evento.params.parteId, datos);
        if (resultado.movida) {
            console.log(`Firma trasladada: ${evento.params.parteId} -> ${resultado.ruta} (${resultado.bytes} bytes)`);
        } else if (resultado.motivo !== 'ya-es-ruta' && resultado.motivo !== 'sin-firma') {
            // Un formato que no esperábamos. Se registra, pero no se reintenta: el
            // documento conserva la firma y reintentar daría el mismo resultado.
            console.warn(`Firma no trasladada en ${evento.params.parteId}: ${resultado.motivo}`);
        }
    }
);
