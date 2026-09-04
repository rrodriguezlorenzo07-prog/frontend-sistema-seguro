/**
 * Cloud Functions del ERP de obras y nóminas.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');

const { cambiarPermisoAdmin } = require('./logica');
const { trasladarFirmaIncrustada } = require('./firmas');
const { marcarAsignacionComoEnviada } = require('./cuadrantes');

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

/**
 * Marca la asignación del cuadrante de la que salió un parte.
 *
 * DISPARADOR PROPIO Y NO UN AÑADIDO A subirFirmaPendiente, aunque escuchen el mismo
 * evento: son dos cosas que fallan por separado y deben poder reintentarse por
 * separado. Si el traslado de la firma falla y comparten función, el reintento volvería
 * a marcar el cuadrante; y al revés, un cuadrante borrado no debe impedir que la firma
 * llegue a Storage. Cloud Functions permite varios disparadores sobre el mismo
 * documento precisamente para esto.
 *
 * SIN retry. Marcar el cuadrante es cosmético —hace aparecer una insignia en el
 * tablero— y el parte ya está guardado pase lo que pase. Reintentar indefinidamente
 * algo que no cambia el resultado del trabajo no compensa el ruido.
 */
exports.marcarCuadranteDelParte = onDocumentCreated(
    { region: 'us-central1', document: 'partes_de_trabajo/{parteId}' },
    async (evento) => {
        const datos = evento.data?.data();
        if (!datos) return;

        const parteId = evento.params.parteId;
        try {
            const resultado = await marcarAsignacionComoEnviada(parteId, datos);
            if (resultado.marcada) {
                console.log(`Cuadrante marcado: ${resultado.asignacionId} <- parte ${parteId}`);
            } else if (resultado.motivo === 'asignacion-inexistente') {
                console.warn(`El parte ${parteId} apunta a un cuadrante que ya no existe: ${resultado.asignacionId}`);
            }
            // 'sin-asignacion' y 'ya-marcada' son normales y no se registran.
        } catch (error) {
            // Que el parte esté guardado es lo que importa; la insignia del tablero no.
            console.error(`No se pudo marcar el cuadrante del parte ${parteId}:`, error);
        }
    }
);
