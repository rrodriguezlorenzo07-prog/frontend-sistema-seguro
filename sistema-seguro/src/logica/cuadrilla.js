// @ts-check
/**
 * Composición de la cuadrilla de un parte durante la validación.
 *
 * Todas las funciones devuelven una cuadrilla nueva: ninguna muta la que recibe, igual
 * que hacían las versiones que vivían dentro de PanelOficina.jsx.
 *
 * REGLA DE NEGOCIO: de aquí solo salen HORAS EXTRA. Las horas normales de un trabajador
 * son una base mensual fija de su contrato y no se derivan jamás de un parte.
 */

/** @typedef {import('../types.js').Parte} Parte */
/** @typedef {import('../types.js').Trabajador} Trabajador */
/** @typedef {import('../types.js').OperarioCuadrilla} OperarioCuadrilla */

/**
 * La cuadrilla con la que se abre la validación: solo el autor del parte.
 *
 * El id se toma del parte cuando lo trae —desde el Bloque 2— y si no se resuelve por
 * el email del creador. El nombre se guarda igualmente: es el registro histórico del
 * albarán, y debe seguir diciendo lo que decía aunque luego se renombre a la persona.
 *
 * @param {Parte} parte
 * @param {Trabajador[]} trabajadores
 * @returns {OperarioCuadrilla[]}
 */
export function cuadrillaInicial(parte, trabajadores) {
    return [{
        trabajadorId: parte.trabajadorId ?? (trabajadores || []).find((t) => t.email === parte.creador)?.id ?? null,
        nombre: parte.nombreTrabajador || parte.creador,
        horasExtra: 0
    }];
}

/**
 * Añade un operario por su id. No hace nada si ya está o si no existe la ficha.
 * @param {OperarioCuadrilla[]} cuadrilla
 * @param {string} trabajadorId
 * @param {Trabajador[]} trabajadores
 * @returns {OperarioCuadrilla[]} la misma cuadrilla si no había nada que añadir
 */
export function agregarOperario(cuadrilla, trabajadorId, trabajadores) {
    if (!trabajadorId) return cuadrilla;
    if (cuadrilla.some((op) => op.trabajadorId === trabajadorId)) return cuadrilla;
    const trabajador = (trabajadores || []).find((t) => t.id === trabajadorId);
    if (!trabajador) return cuadrilla;
    return [...cuadrilla, { trabajadorId: trabajador.id ?? null, nombre: trabajador.nombre, horasExtra: 0 }];
}

/**
 * Suma (o resta) horas extra a un operario. Nunca baja de cero.
 * @param {OperarioCuadrilla[]} cuadrilla
 * @param {number} index
 * @param {number} cantidad
 * @returns {OperarioCuadrilla[]}
 */
export function ajustarHorasExtra(cuadrilla, index, cantidad) {
    const nueva = [...cuadrilla];
    const actual = Number(nueva[index].horasExtra) || 0;
    nueva[index] = { ...nueva[index], horasExtra: Math.max(0, actual + cantidad) };
    return nueva;
}

/**
 * Fija las horas extra desde el input.
 *
 * La cadena vacía se conserva a propósito: si se convirtiera a 0 en cuanto se borra el
 * contenido, el campo se repoblaría solo mientras se teclea.
 *
 * @param {OperarioCuadrilla[]} cuadrilla
 * @param {number} index
 * @param {string|number} valor
 * @returns {OperarioCuadrilla[]}
 */
export function fijarHorasExtra(cuadrilla, index, valor) {
    const nueva = [...cuadrilla];
    nueva[index] = { ...nueva[index], horasExtra: valor === '' ? '' : Math.max(0, parseFloat(String(valor)) || 0) };
    return nueva;
}

/**
 * Quita al operario de esa posición.
 * @param {OperarioCuadrilla[]} cuadrilla
 * @param {number} index
 * @returns {OperarioCuadrilla[]}
 */
export function quitarOperario(cuadrilla, index) {
    const nueva = [...cuadrilla];
    nueva.splice(index, 1);
    return nueva;
}

/**
 * Deja la cuadrilla lista para guardarse: horas numéricas y el total.
 *
 * Es lo que se escribe en validaciones/{parteId}, así que aquí desaparecen las cadenas
 * vacías que el input necesitaba.
 *
 * @param {OperarioCuadrilla[]} cuadrilla
 * @returns {{cuadrilla: OperarioCuadrilla[], horasExtraAsignadas: number}}
 */
export function normalizarCuadrilla(cuadrilla) {
    const cuadrillaNumerica = (cuadrilla || []).map((op) => ({
        trabajadorId: op.trabajadorId ?? null,
        nombre: op.nombre,
        horasExtra: Number(op.horasExtra) || 0
    }));
    return {
        cuadrilla: cuadrillaNumerica,
        horasExtraAsignadas: cuadrillaNumerica.reduce((sum, op) => sum + op.horasExtra, 0)
    };
}
