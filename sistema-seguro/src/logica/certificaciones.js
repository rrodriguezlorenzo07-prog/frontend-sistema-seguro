// @ts-check
/**
 * Qué se congela dentro de `certificaciones/{id}.albaranes[]`.
 *
 * POR QUÉ EXISTE ESTO. Una certificación guardaba una copia ENTERA del parte, y el parte
 * venía hidratado desde `validaciones/` — es decir, con la cuadrilla y las horas extra de
 * cada persona dentro. `certificaciones` la lee cualquier administrador, así que las
 * horas extra por nombre acababan al alcance de quien solo tiene permiso operativo,
 * saltándose el aislamiento que `validaciones/` existe para dar.
 *
 * Aquí se copia SOLO lo que la certificación usa de verdad: el detalle del trabajo, los
 * materiales, y los nombres de quién estuvo. Ni una hora por persona, ni la firma.
 *
 * LAS HORAS TOTALES SE CONGELAN COMO NÚMERO. Antes la vista previa las recalculaba con
 * `horasTotalesDocumento()`, que suma `cuadrilla.length * 8 + Σ horasExtra`; sin las
 * horas extra ese cálculo daría un número distinto del que se certificó. Se guarda el
 * total ya hecho para que el documento siga diciendo lo mismo que dijo el día que se
 * emitió, que es lo que se le enseñó al cliente.
 */

import { horasTotalesDocumento } from '../utils/horasDocumento.js';

/** @typedef {import('../types.js').Parte} Parte */

/**
 * Los campos de un parte que la certificación necesita, y ninguno más.
 *
 * Es una LISTA BLANCA a propósito: si mañana el parte gana un campo con datos sensibles,
 * no se cuela aquí solo, hay que añadirlo a mano.
 */
export const CAMPOS_DEL_ALBARAN = [
    'id', 'fecha', 'timestamp',
    'obra', 'obraId',
    'trabajo', 'tareasRealizadas',
    'materialesUsados',
    'nombreTrabajador'
];

/**
 * Proyecta un parte a lo que se guarda dentro de una certificación.
 *
 * @param {Parte & {cuadrilla?: Array<{nombre?: string}>}} parte parte YA hidratado
 * @returns {object}
 */
export function albaranParaCertificacion(parte) {
    const salida = {};
    for (const campo of CAMPOS_DEL_ALBARAN) {
        if (parte?.[campo] !== undefined) salida[campo] = parte[campo];
    }

    // Los NOMBRES de quién estuvo, que es lo que imprime el PDF. Sin `horasExtra` ni
    // `horas`: eso es lo que se paga y vive en validaciones/.
    salida.cuadrilla = (parte?.cuadrilla || [])
        .map((op) => ({ nombre: op?.nombre ?? '' }))
        .filter((op) => op.nombre !== '');

    // El total ya calculado, sobre el parte COMPLETO, antes de perder el detalle.
    salida.horasTotales = horasTotalesDocumento(parte);

    return salida;
}

/**
 * Las claves que NUNCA deben aparecer dentro de un albarán congelado.
 *
 * Se usa para comprobarlo en las pruebas y para limpiar los documentos que se
 * escribieron antes de esta corrección.
 */
export const CLAVES_PROHIBIDAS = ['firma', 'horasExtraAsignadas', 'horasTaller', 'horasCalle', 'creador'];

/** Claves prohibidas dentro de cada entrada de `cuadrilla`. */
export const CLAVES_PROHIBIDAS_CUADRILLA = ['horas', 'horasExtra', 'trabajadorId'];
