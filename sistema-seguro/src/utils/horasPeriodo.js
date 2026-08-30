/**
 * Horas extra de un periodo, agregadas sobre el PERIODO COMPLETO.
 *
 * Antes esto se calculaba filtrando en memoria la página de partes que hubiera
 * cargada, y esa página venía con limit(300). El total de la nómina salía por tanto
 * de como mucho 300 partes, sin que nada en pantalla lo dijera: el mismo número se
 * mostraba con la misma seguridad tuviera el periodo 12 albaranes o 400. Aquí se
 * recorre el rango entero con cursores, en lotes, hasta agotarlo.
 *
 * REGLA DE NEGOCIO: de aquí solo salen HORAS EXTRA. Las horas normales son una base
 * mensual fija menos las ausencias y no se derivan jamás de partes ni albaranes
 * (ver utils/nomina.js).
 */
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';

/** Documentos por lote al recorrer el periodo. */
export const TAMANO_LOTE = 500;

/**
 * Lee TODOS los documentos de una colección cuyo `timestamp` cae en el rango.
 * Pagina con cursores hasta agotar; no hay tope artificial.
 *
 * La desigualdad y el orderBy van sobre el mismo campo, así que no hace falta
 * ningún índice compuesto.
 */
async function leerRangoCompleto(db, nombreColeccion, inicio, fin, tamanoLote) {
    const documentos = [];
    let cursor = null;

    for (;;) {
        const partes = [
            where('timestamp', '>=', inicio),
            where('timestamp', '<=', fin),
            orderBy('timestamp', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(tamanoLote)
        ];
        const snap = await getDocs(query(collection(db, nombreColeccion), ...partes));
        snap.docs.forEach((d) => documentos.push({ id: d.id, ...d.data() }));

        if (snap.docs.length < tamanoLote) break;
        cursor = snap.docs[snap.docs.length - 1];
    }
    return documentos;
}

/**
 * Suma las horas extra de las cuadrillas, sin tocar la red. Separado del acceso a
 * datos para poder probarlo solo.
 *
 * Se agrupa por `trabajadorId` cuando existe y por nombre cuando no, igual que
 * antes: las cuadrillas anteriores al Bloque 2 no llevan id y deben seguir contando.
 *
 * @param {Array<{id: string, cuadrilla?: Array}>} validaciones
 * @param {Set<string>} idsComputables partes aprobados y fuera de la papelera
 */
export function agregarCuadrillas(validaciones, idsComputables) {
    const resumen = {};
    let validacionesUsadas = 0;

    validaciones.forEach((v) => {
        if (!idsComputables.has(v.id)) return;
        if (!Array.isArray(v.cuadrilla) || v.cuadrilla.length === 0) return;
        validacionesUsadas += 1;

        v.cuadrilla.forEach((op) => {
            const clave = op?.trabajadorId || op?.nombre;
            if (!clave) return;
            if (!resumen[clave]) {
                resumen[clave] = { trabajadorId: op.trabajadorId || null, nombre: op.nombre, horasExtra: 0 };
            }
            resumen[clave].horasExtra += Number(op.horasExtra) || 0;
        });
    });

    return {
        resumen: Object.entries(resumen).sort((a, b) => b[1].horasExtra - a[1].horasExtra),
        validacionesUsadas
    };
}

/**
 * Horas extra por trabajador en el rango indicado.
 *
 * Recorre dos colecciones porque hacen falta las dos: `validaciones` tiene las horas
 * pero no el estado, y un parte aprobado puede haberse mandado después a la papelera
 * sin que su validación desaparezca. Contar solo validaciones incluiría partes
 * descartados, que es justo lo que el cálculo en memoria no hacía.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {number} inicio milisegundos, inclusive
 * @param {number} fin milisegundos, inclusive
 * @returns {Promise<{resumen: Array, partesLeidos: number, albaranesComputados: number, validacionesUsadas: number}>}
 */
export async function agregarHorasExtraDelPeriodo(db, inicio, fin, tamanoLote = TAMANO_LOTE) {
    const partes = await leerRangoCompleto(db, 'partes_de_trabajo', inicio, fin, tamanoLote);

    const idsComputables = new Set(
        partes.filter((p) => p.estado === 'aprobado' && !p.papelera).map((p) => p.id)
    );

    const validaciones = await leerRangoCompleto(db, 'validaciones', inicio, fin, tamanoLote);
    const { resumen, validacionesUsadas } = agregarCuadrillas(validaciones, idsComputables);

    return {
        resumen,
        partesLeidos: partes.length,
        albaranesComputados: idsComputables.size,
        validacionesUsadas
    };
}
