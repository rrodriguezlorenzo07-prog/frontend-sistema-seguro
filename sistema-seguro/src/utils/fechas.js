/**
 * Ayudas de fecha basadas en `timestamp` (milisegundos), no en el campo `fecha`.
 *
 * El campo `fecha` de un parte se guarda con toLocaleDateString(), así que su
 * formato depende del navegador del operario que lo envió. Sirve para mostrarlo
 * en pantalla, pero NUNCA para comparar ni filtrar.
 */

/**
 * Milisegundos del inicio (00:00:00.000) del día indicado.
 * @param {Date} fecha
 * @returns {number}
 */
export function inicioDelDia(fecha = new Date()) {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * Milisegundos del final (23:59:59.999) del día indicado.
 * @param {Date} fecha
 * @returns {number}
 */
export function finDelDia(fecha = new Date()) {
    const d = new Date(fecha);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

/**
 * ¿El timestamp cae dentro del día indicado?
 * @param {number} timestamp
 * @param {Date} dia
 * @returns {boolean}
 */
export function esDelDia(timestamp, dia = new Date()) {
    const t = Number(timestamp);
    if (!Number.isFinite(t)) return false;
    return t >= inicioDelDia(dia) && t <= finDelDia(dia);
}
