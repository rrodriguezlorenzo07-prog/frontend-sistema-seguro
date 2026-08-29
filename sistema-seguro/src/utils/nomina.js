/**
 * Reglas de cálculo de la nómina mensual.
 *
 * REGLA DE NEGOCIO INVIOLABLE: las horas normales de un trabajador son una base
 * mensual fija de su contrato, menos 8 h por cada día de ausencia. NUNCA se suman
 * ni se derivan de partes de trabajo ni de albaranes. Las horas extra sí vienen de
 * los albaranes validados, pero se calculan aparte.
 */

/** Base mensual que se aplica a un trabajador que aún no la tiene configurada. */
export const HORAS_BASE_POR_DEFECTO = 160;

/** Horas que descuenta cada día de ausencia. */
export const HORAS_POR_DIA_LIBRE = 8;

/**
 * ¿Este trabajador tiene una base mensual propia configurada en su ficha?
 * @param {{ horasBaseMensuales?: number|string }} trabajador
 */
export function tieneBaseConfigurada(trabajador) {
    const valor = Number(trabajador?.horasBaseMensuales);
    return Number.isFinite(valor) && valor > 0;
}

/**
 * Base mensual del trabajador, con el valor por defecto como red de seguridad
 * para las fichas que aún no lo tienen.
 * @param {{ horasBaseMensuales?: number|string }} trabajador
 * @returns {number}
 */
export function baseMensualDe(trabajador) {
    return tieneBaseConfigurada(trabajador)
        ? Number(trabajador.horasBaseMensuales)
        : HORAS_BASE_POR_DEFECTO;
}

/**
 * Horas normales del periodo: base mensual − 8 h por día de ausencia.
 * @param {number} baseMensual
 * @param {number} diasLibres
 * @returns {number} nunca negativo
 */
export function horasNormalesDelPeriodo(baseMensual, diasLibres) {
    const base = Number(baseMensual) || 0;
    const dias = Number(diasLibres) || 0;
    return Math.max(0, base - dias * HORAS_POR_DIA_LIBRE);
}
