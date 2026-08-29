/**
 * Generación de CSV para Excel en español.
 *
 * Convenciones, iguales en todos los exportadores de la aplicación:
 *   - BOM UTF-8 al principio, para que Excel respete tildes y ñ.
 *   - Punto y coma como separador de columnas (lo que espera Excel en español).
 *   - Coma decimal en los números, y SIN comillas, para que Excel los trate como
 *     números y no como texto.
 *   - Todo campo de texto entrecomillado y con las comillas internas duplicadas,
 *     de modo que un `;`, unas comillas o un salto de línea dentro del dato no
 *     rompan las columnas. Ya no hace falta mutilar el contenido con replace().
 *   - Fin de línea CRLF (RFC 4180), necesario para que los saltos de línea
 *     dentro de un campo entrecomillado se interpreten bien.
 */

export const SEPARADOR = ';';
const BOM = '﻿';
const FIN_DE_LINEA = '\r\n';

/**
 * Campo de texto: entrecomillado y a prueba de separadores.
 * @param {*} valor
 * @returns {string}
 */
export function textoCSV(valor) {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * Campo numérico con coma decimal y sin comillas.
 * @param {*} valor
 * @param {number} decimales
 * @returns {string} cadena vacía si no es un número
 */
export function numeroCSV(valor, decimales = 2) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '';
    return numero.toFixed(decimales).replace('.', ',');
}

/**
 * Campo numérico sin decimales (cantidades, días, unidades de stock).
 * @param {*} valor
 * @returns {string}
 */
export function enteroCSV(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '';
    return String(Math.round(numero));
}

/**
 * Monta el contenido completo del CSV.
 * @param {string[]} cabeceras  se entrecomillan automáticamente
 * @param {string[][]} filas    cada celda ya formateada con textoCSV/numeroCSV/enteroCSV
 * @returns {string}
 */
export function construirCSV(cabeceras, filas) {
    const lineas = [cabeceras.map(textoCSV).join(SEPARADOR)];
    filas.forEach((fila) => lineas.push(fila.join(SEPARADOR)));
    return BOM + lineas.join(FIN_DE_LINEA) + FIN_DE_LINEA;
}

/**
 * Lanza la descarga del archivo en el navegador.
 * @param {string} nombreArchivo
 * @param {string} contenido
 */
export function descargarCSV(nombreArchivo, contenido) {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.setAttribute('href', url);
    enlace.setAttribute('download', nombreArchivo);
    enlace.style.visibility = 'hidden';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
}

/**
 * Fecha en formato dd-mm-aaaa, para nombres de archivo (no depende del locale).
 * @param {Date} fecha
 * @returns {string}
 */
export function fechaParaNombre(fecha = new Date()) {
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${fecha.getFullYear()}`;
}
