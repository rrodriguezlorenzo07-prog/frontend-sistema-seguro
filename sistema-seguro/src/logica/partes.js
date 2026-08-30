// @ts-check
/**
 * Transformaciones sobre listas de partes. Sin Firestore y sin React.
 *
 * Todo esto vivía dentro de PanelOficina.jsx leyendo el estado por clausura. Aquí
 * recibe sus entradas como argumentos, que es lo único que ha cambiado: la lógica es
 * la misma, incluidas sus rarezas, que están anotadas donde las hay.
 */

/** @typedef {import('../types.js').Parte} Parte */
/** @typedef {import('../types.js').Validacion} Validacion */

import { horasTotalesDocumento } from '../utils/horasDocumento.js';
import { esDelDia } from '../utils/fechas.js';

/**
 * Fusiona en cada parte la cuadrilla y las horas extra que viven en validaciones/.
 *
 * La cuadrilla está fuera del parte para que el operario no vea las de sus compañeros
 * al leer el suyo. Aguas abajo el objeto tiene la forma de siempre.
 *
 * @param {Parte[]} partes
 * @param {Map<string, Validacion>} [validaciones] indexadas por id de parte
 * @returns {Parte[]}
 */
export function hidratarPartes(partes, validaciones) {
    if (!validaciones || validaciones.size === 0) return partes;
    return partes.map((p) => {
        const v = validaciones.get(p.id ?? '');
        return v ? { ...p, cuadrilla: v.cuadrilla, horasExtraAsignadas: v.horasExtraAsignadas } : p;
    });
}

/**
 * Límites en milisegundos de un rango de fechas de los inputs `date`.
 *
 * OJO: `new Date('2026-08-01')` se interpreta como medianoche UTC, no local. Se
 * mantiene tal cual porque es lo que hacía el historial hasta ahora y cambiarlo movería
 * qué partes entran en cada búsqueda. El cierre de nómina NO usa esto: utils/periodos.js
 * calcula los límites del mes en hora local, que es lo correcto para una liquidación.
 *
 * @param {string} fechaInicio "AAAA-MM-DD"
 * @param {string} fechaFin
 * @returns {{start: number, end: number}}
 */
export function rangoDeFechas(fechaInicio, fechaFin) {
    const start = new Date(fechaInicio).getTime();
    const end = new Date(fechaFin).getTime() + 86399999;
    return { start, end };
}

/**
 * Los partes cuyo timestamp cae dentro del rango.
 * @param {Parte[]} partes
 * @param {number} start
 * @param {number} end
 * @returns {Parte[]}
 */
export function filtrarPorRango(partes, start, end) {
    return partes.filter((parte) => parte.timestamp >= start && parte.timestamp <= end);
}

/**
 * Búsqueda de texto libre sobre obra, persona y trabajo, con orden.
 * @param {Parte[]} partes
 * @param {string} filtro
 * @param {'antiguos'|'recientes'|string} orden
 * @returns {Parte[]}
 */
export function buscarPartes(partes, filtro, orden) {
    const texto = (filtro || '').toLowerCase();
    return partes
        .filter((parte) => {
            const nombrePersona = parte.nombreTrabajador || parte.creador || '';
            return (parte.obra?.toLowerCase().includes(texto)
                 || nombrePersona.toLowerCase().includes(texto)
                 || parte.trabajo?.toLowerCase().includes(texto));
        })
        .sort((a, b) => {
            if (orden === 'antiguos') return a.timestamp - b.timestamp;
            return b.timestamp - a.timestamp;
        });
}

/**
 * Marca como facturados los elementos cuyo id está en la lista.
 *
 * Sirve igual para partes y para certificaciones: solo toca el campo `facturado` y
 * devuelve una lista nueva, sin releer la colección entera.
 *
 * @template {{id?: string}} T
 * @param {T[]} items
 * @param {string[]} ids
 * @returns {T[]}
 */
export function marcarFacturados(items, ids) {
    return (items || []).map((item) => ((ids || []).includes(item.id ?? '') ? { ...item, facturado: true } : item));
}

/**
 * Resumen del día para el panel de métricas.
 *
 * `horas` es el total de documento —cuadrilla × 8 h más extras—, informativo. NUNCA
 * sirve para una nómina: las horas normales son base mensual fija.
 *
 * @param {Parte[]} partes
 * @param {Date} [dia]
 * @returns {{partes: Parte[], horas: number, trabajadores: number}}
 */
export function resumenDelDia(partes, dia = new Date()) {
    const partesDeHoy = partes.filter((p) => esDelDia(p.timestamp, dia));
    return {
        partes: partesDeHoy,
        horas: partesDeHoy.reduce((total, p) => total + horasTotalesDocumento(p), 0),
        trabajadores: new Set(partesDeHoy.map((p) => p.creador)).size
    };
}
