// @ts-check
/**
 * Obras, sus habitaciones y lo que se ha hecho en ellas. Sin Firestore y sin React.
 */

/** @typedef {import('../types.js').Parte} Parte */
/** @typedef {import('../types.js').Obra} Obra */
/** @typedef {import('../types.js').Tarea} Tarea */

import { horasTotalesDocumento } from '../utils/horasDocumento.js';

/** ¿El texto contiene alguna letra, o es solo números y signos? */
const TIENE_LETRAS = /[a-záéíóúüñ]/i;

/**
 * Qué habitación nombra un texto.
 *
 * Si dice "hab" —"Hab 101", "habitación 101"— la habitación es el número que va detrás,
 * y los demás son ruido: en "P1 - Hab 101" el 1 es la planta, no una habitación. Si no
 * lo dice, cuentan todos los números que aparezcan.
 *
 * Se aplica igual a los dos lados de la comparación, que es lo que hace que "P1 - Hab
 * 101" no case con una tarea llamada "planta 1".
 *
 * @param {string} texto ya en minúsculas
 * @returns {number[]}
 */
function habitacionesQueNombra(texto) {
    const porHab = [...texto.matchAll(/hab\w*\.?\s*(\d+)/g)].map((m) => Number(m[1]));
    if (porHab.length > 0) return porHab;
    return texto.match(/\d+/g)?.map(Number) || [];
}

/**
 * ¿La ubicación que escribió el operario se refiere a esta habitación?
 *
 * Acepta el nombre entero, un número suelto, varios, o un rango escrito de cualquiera
 * de las formas que usa la gente en obra: "101-105", "101 al 105", "101 a 105".
 *
 * PRIORIDAD DEL NÚMERO DE HABITACIÓN. La coincidencia de texto solo se considera cuando
 * la ubicación tiene letras. Antes se comprobaba siempre y primero, así que "1" casaba
 * con "P1 - Hab 101" por subcadena y el número de habitación no llegaba a mirarse: la
 * prioridad de `numeroHabitacion` era nominal, no real, y marcaba habitaciones que el
 * operario no había tocado.
 *
 * Réplica del emparejador de GestionProyectos.jsx (abrirModalHabitacion), que sigue
 * viviendo en línea dentro de aquel componente. Unificarlos es tarea pendiente.
 *
 * @param {Tarea} tarea
 * @param {string} ubicacion
 * @returns {boolean}
 */
export function ubicacionCoincideConTarea(tarea, ubicacion) {
    const nombreHab = (tarea.nombre || '').toLowerCase().trim();
    const ubic = (ubicacion || '').toLowerCase().trim();
    if (!ubic || !nombreHab) return false;

    // Un número suelto se resuelve SIEMPRE por número, nunca por subcadena.
    if (TIENE_LETRAS.test(ubic) && (ubic.includes(nombreHab) || nombreHab.includes(ubic))) return true;

    const numerosCaja = tarea.numeroHabitacion !== undefined
        ? [Number(tarea.numeroHabitacion)]
        : habitacionesQueNombra(nombreHab);
    const numerosInput = habitacionesQueNombra(ubic);
    // Los rangos se leen del texto completo: "hab 101 a 105" nombra la 101 pero abarca
    // hasta la 105.
    const rangos = [...ubic.matchAll(/(\d+)\s*(?:-|al|a)\s*(\d+)/g)];

    for (const numCaja of numerosCaja) {
        if (numerosInput.includes(numCaja)) return true;
        for (const rango of rangos) {
            const inicio = Math.min(Number(rango[1]), Number(rango[2]));
            const fin = Math.max(Number(rango[1]), Number(rango[2]));
            if (numCaja >= inicio && numCaja <= fin) return true;
        }
    }
    return false;
}

/**
 * Genera las habitaciones de un hotel a partir de su número de plantas y de cuántas
 * habitaciones hay en cada una.
 *
 * `configHabitaciones` es una lista separada por comas: un número por planta. Si faltan
 * valores se repite el de la primera planta, y si tampoco lo hay se asumen 10.
 *
 * @param {number} numPlantas
 * @param {string} configHabitaciones "12, 14, 14"
 * @param {number} [semilla] parte del id de cada tarea; parametrizado para poder probarlo
 * @returns {Tarea[]}
 */
export function generarTareasDeHotel(numPlantas, configHabitaciones, semilla = Date.now()) {
    const configs = String(configHabitaciones).split(',').map((s) => parseInt(s.trim()) || 0);
    const tareasGeneradas = [];
    for (let p = 1; p <= numPlantas; p++) {
        const habsEnEstaPlanta = configs[p - 1] || configs[0] || 10;
        for (let h = 1; h <= habsEnEstaPlanta; h++) {
            const numHab = p * 100 + h;
            tareasGeneradas.push({
                id: `T-${p}-${h}-${semilla}`,
                nombre: `P${p} - Hab ${numHab}`,
                numeroHabitacion: numHab,
                completada: false
            });
        }
    }
    return tareasGeneradas;
}

/**
 * Invierte el estado de las tareas indicadas. Acepta un id o una lista.
 * @param {Tarea[]} tareas
 * @param {string|string[]} tareaIdOArray
 * @returns {Tarea[]}
 */
export function alternarTareas(tareas, tareaIdOArray) {
    const idsAModificar = Array.isArray(tareaIdOArray) ? tareaIdOArray : [tareaIdOArray];
    return (tareas || []).map((t) => (idsAModificar.includes(t.id) ? { ...t, completada: !t.completada } : t));
}

/**
 * Avance global sobre todas las obras.
 * @param {Obra[]} obras
 * @returns {{totalTareas: number, completadas: number, porcentaje: number}}
 */
export function progresoDeObras(obras) {
    let totalTareas = 0;
    let completadas = 0;
    (obras || []).forEach((obra) => {
        totalTareas += (obra.tareas?.length || 0);
        completadas += (obra.tareas?.filter((t) => t.completada).length || 0);
    });
    return {
        totalTareas,
        completadas,
        porcentaje: totalTareas === 0 ? 0 : Math.round((completadas / totalTareas) * 100)
    };
}

/**
 * Horas y materiales acumulados de una obra.
 *
 * Cruza por `obraId` cuando el parte lo trae y por nombre cuando no. Ese cruce por
 * nombre es el que hacía que dos obras homónimas se mezclaran; se mantiene solo como
 * respaldo para los partes anteriores al Bloque 2.
 *
 * @param {Parte[]} partes
 * @param {string} nombreObra
 * @param {string|null} [obraId]
 * @returns {{horas: number, materiales: Array<[string, number]>}}
 */
export function estadisticasDeObra(partes, nombreObra, obraId = null) {
    const partesDeLaObra = (partes || []).filter((p) => ((obraId && p.obraId) ? p.obraId === obraId : p.obra === nombreObra));
    let horasTotal = 0;
    /** @type {Record<string, number>} */
    const materialesMap = {};
    partesDeLaObra.forEach((p) => {
        horasTotal += horasTotalesDocumento(p);
        if (p.materialesUsados && p.materialesUsados.length > 0) {
            p.materialesUsados.forEach((m) => {
                materialesMap[m.nombre] = (materialesMap[m.nombre] || 0) + (Number(m.cantidad) || 0);
            });
        }
    });
    return { horas: horasTotal, materiales: Object.entries(materialesMap) };
}
