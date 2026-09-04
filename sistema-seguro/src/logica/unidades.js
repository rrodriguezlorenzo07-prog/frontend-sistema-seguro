// @ts-check
/**
 * Unidades de obra: leer lo que la gente escribe de verdad.
 *
 * LA PIEZA COMPARTIDA POR LOS DOS FRENTES. La misma función que ayuda al operario a
 * proponer qué cerró es la que calcula cuántas unidades factura una partida. Si fueran
 * dos, acabarían discrepando: el parte diría once habitaciones y la factura una.
 *
 * POR QUÉ TEXTO GUIADO Y NO UN SELECTOR. Los datos reales dicen que los operarios
 * escriben rangos —«Habitaciones 100-110», «Habitacion 100 a la 200», «100-110»—, no
 * unidades sueltas. Un desplegable de una opción obligaría a once toques donde hoy hay
 * doce teclas, y se abandonaría el primer día. Así que se sigue tecleando, pero lo
 * tecleado se interpreta al vuelo y se enseña lo entendido para que se confirme.
 *
 * NUNCA SE ADIVINA EN SILENCIO. Cuando el texto no permite leer una cantidad con
 * confianza, se dice que no y quien llama decide. Es la misma regla que ya seguimos con
 * el emparejador de habitaciones: inventar un número aquí es facturar de más.
 */

/** Palabras que preceden a un número de unidad y no son parte de él. */
const PREFIJOS = /\b(?:hab|habitacion|habitaciones|habitación|habitaciónes|nº|num|numero|número|ud|uds|unidad|unidades|puerta|puertas|ventana|ventanas)\b\.?\s*/gi;

/** "100-110", "100 a 110", "100 a la 110", "100 al 110", "100 hasta 110" */
const RANGO = /(\d+)\s*(?:-|–|—|\/|a\s+la|al|a|hasta)\s*(\d+)/gi;

/** Un rango de más de esto casi seguro es un error de tecleo, no un encargo. */
const TOPE_RANGO = 500;

/**
 * Normaliza para analizar: minúsculas, sin tildes y sin los prefijos que estorban.
 * @param {string} texto
 * @returns {string}
 */
function limpiar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD').replace(/\p{M}/gu, '')
        .replace(PREFIJOS, ' ')
        .trim();
}

/**
 * Qué unidades nombra un texto.
 *
 * Devuelve los números concretos, no una cantidad: tener la lista permite enseñarla
 * («entendido: 11 unidades, de la 100 a la 110») y permite crear un documento por
 * unidad más adelante sin volver a interpretar nada.
 *
 * `reconocido` es lo que decide si se puede confiar. Es `false` cuando el texto no
 * lleva números —«barandilla», «pasillo»— y entonces `numeros` va vacío: el trabajo
 * existe, pero no se puede contar por unidades numeradas.
 *
 * @param {string} texto lo que escribió la persona
 * @returns {{numeros: number[], cantidad: number, reconocido: boolean, motivo: string}}
 */
export function leerUnidades(texto) {
    const limpio = limpiar(texto);
    if (!limpio) return { numeros: [], cantidad: 0, reconocido: false, motivo: 'vacio' };

    /** @type {Set<number>} */
    const numeros = new Set();
    let huboRango = false;
    let rangoDemasiadoGrande = false;

    // Primero los rangos, y se borran del texto para que sus extremos no se cuenten
    // otra vez como números sueltos.
    const sinRangos = limpio.replace(RANGO, (coincidencia, a, b) => {
        const inicio = Math.min(Number(a), Number(b));
        const fin = Math.max(Number(a), Number(b));
        if (fin - inicio + 1 > TOPE_RANGO) { rangoDemasiadoGrande = true; return ' '; }
        huboRango = true;
        for (let n = inicio; n <= fin; n++) numeros.add(n);
        return ' ';
    });

    // Lo que quede: números sueltos, separados por comas, "y", espacios…
    for (const suelto of sinRangos.match(/\d+/g) || []) numeros.add(Number(suelto));

    if (rangoDemasiadoGrande) {
        return { numeros: [], cantidad: 0, reconocido: false, motivo: 'rango-inverosimil' };
    }
    if (numeros.size === 0) {
        // Texto sin números: es trabajo real ("barandilla"), pero no contable así.
        return { numeros: [], cantidad: 0, reconocido: false, motivo: 'sin-numeros' };
    }

    return {
        numeros: [...numeros].sort((a, b) => a - b),
        cantidad: numeros.size,
        reconocido: true,
        motivo: huboRango ? 'rango' : 'sueltos'
    };
}

/**
 * Cuántas unidades factura una línea de trabajo.
 *
 * CAE A 1 CUANDO NO SABE, igual que hacía antes de este cambio. Un texto que no se
 * entiende no debe convertirse en una cantidad inventada: facturar de más por un error
 * de lectura es peor que facturar de menos, porque lo descubre el cliente.
 *
 * `revisar` es lo que la interfaz debe destacar: dice «esto lo he contado yo solo, y no
 * estoy seguro» y pide que alguien lo mire antes de emitir.
 *
 * @param {string} texto la ubicación escrita en el parte
 * @returns {{cantidad: number, revisar: boolean, detalle: string}}
 */
export function cantidadDeLinea(texto) {
    const leido = leerUnidades(texto);

    if (!leido.reconocido) {
        return {
            cantidad: 1,
            revisar: true,
            detalle: leido.motivo === 'sin-numeros'
                ? 'Sin números que contar: se factura como 1 unidad.'
                : 'No se ha entendido la cantidad: se factura como 1 unidad.'
        };
    }

    if (leido.cantidad === 1) {
        return { cantidad: 1, revisar: false, detalle: 'Una unidad.' };
    }

    return {
        cantidad: leido.cantidad,
        revisar: false,
        detalle: `${leido.cantidad} unidades: ${resumirNumeros(leido.numeros)}.`
    };
}

/**
 * Resume una lista de números volviendo a plegar los tramos seguidos.
 * [100,101,102,105] → "100–102, 105"
 *
 * @param {number[]} numeros ya ordenados
 * @returns {string}
 */
export function resumirNumeros(numeros) {
    if (!numeros || numeros.length === 0) return '';
    const tramos = [];
    let inicio = numeros[0];
    let previo = numeros[0];

    for (let i = 1; i <= numeros.length; i++) {
        const actual = numeros[i];
        if (actual === previo + 1) { previo = actual; continue; }
        tramos.push(inicio === previo ? `${inicio}` : `${inicio}–${previo}`);
        inicio = actual;
        previo = actual;
    }
    return tramos.join(', ');
}

/**
 * Lo que se enseña al operario mientras teclea, para que confirme lo entendido.
 *
 * @param {string} texto
 * @returns {{valido: boolean, resumen: string, cantidad: number}}
 */
export function previsualizarPropuesta(texto) {
    const leido = leerUnidades(texto);
    if (!String(texto || '').trim()) {
        return { valido: false, resumen: '', cantidad: 0 };
    }
    if (!leido.reconocido) {
        return {
            valido: true,   // se admite igual: "barandilla" es trabajo real
            resumen: 'Sin numerar — se propondrá como una unidad suelta.',
            cantidad: 1
        };
    }
    return {
        valido: true,
        resumen: leido.cantidad === 1
            ? `1 unidad: la ${leido.numeros[0]}.`
            : `${leido.cantidad} unidades: ${resumirNumeros(leido.numeros)}.`,
        cantidad: leido.cantidad
    };
}

/**
 * Documentos de `unidades_obra` a crear desde una línea del parte.
 *
 * UNA UNIDAD, UN DOCUMENTO, también cuando vienen de un rango. Es lo que permite
 * confirmar la 101 y dejar la 102 pendiente, que es como se trabaja de verdad: la
 * cuadrilla termina ocho de las once que llevaba.
 *
 * @param {object} datos
 * @param {string} datos.obraId
 * @param {string} datos.obraNombre
 * @param {string} datos.parteId
 * @param {string} datos.ubicacion texto tal cual lo escribió el operario
 * @param {string} [datos.descripcion]
 * @param {string} datos.propuestaPor correo del operario
 * @returns {Array<object>}
 */
export function unidadesDesdeLinea({ obraId, obraNombre, parteId, ubicacion, descripcion = '', propuestaPor }) {
    const leido = leerUnidades(ubicacion);
    const ahora = Date.now();
    const comun = {
        obraId: obraId ?? null,
        obraNombre: obraNombre ?? null,
        parteId,
        descripcion,
        textoOriginal: String(ubicacion || '').trim(),
        estado: 'propuesta',
        propuestaPor: String(propuestaPor || '').toLowerCase().trim(),
        propuestaEn: ahora,
        confirmadaPor: null,
        confirmadaEn: null
    };

    // Sin números no hay nada que desglosar: una unidad con el texto tal cual.
    if (!leido.reconocido) {
        return [{ ...comun, nombre: comun.textoOriginal, numero: null, orden: 0 }];
    }

    return leido.numeros.map((numero) => ({
        ...comun,
        nombre: `Unidad ${numero}`,
        numero,
        orden: numero
    }));
}
