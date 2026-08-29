/**
 * Horas de jornada que se asume que cubre cada operario asignado a una cuadrilla.
 */
export const HORAS_JORNADA = 8;

/**
 * Horas totales de un parte para MOSTRARLAS EN UN DOCUMENTO
 * (certificación, factura, resumen de obra).
 *
 * Fórmula: cada operario asignado a la cuadrilla cuenta como una jornada completa
 * (8 h), más las horas extra concretas que se le asignaron en ese parte.
 *
 *     horas = (nº operarios de la cuadrilla) * 8 + Σ horasExtra de cada operario
 *
 * Es un total agregado del documento, no un desglose por operario.
 *
 * ⚠️ NUNCA usar para calcular una nómina. Las horas normales de un trabajador son una
 * base mensual fija menos las ausencias, y no se derivan jamás de partes ni albaranes
 * (ver ControlNominas.jsx). Este dato es puramente informativo para el papel.
 *
 * @param {{ cuadrilla?: Array<{ horasExtra?: number|string }> }} parte
 * @returns {number} horas totales del documento (0 si el parte no tiene cuadrilla)
 */
export function horasTotalesDocumento(parte) {
    const cuadrilla = parte?.cuadrilla;
    if (!Array.isArray(cuadrilla) || cuadrilla.length === 0) return 0;

    const horasExtra = cuadrilla.reduce((suma, op) => suma + (Number(op?.horasExtra) || 0), 0);
    return cuadrilla.length * HORAS_JORNADA + horasExtra;
}
