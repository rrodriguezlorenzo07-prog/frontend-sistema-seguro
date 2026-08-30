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

/** La clave con la que se identifica a un trabajador: su id, o su nombre si no lo tiene. */
export const claveDeTrabajador = (trab) => trab?.id || trab?.nombre || '';

/**
 * Quién entra en la nómina de un periodo.
 *
 * La plantilla activa, MÁS cualquiera que tenga actividad en el periodo aunque esté
 * en la papelera. Un trabajador dado de baja a mitad de mes trabajó ese mes y hay que
 * pagarle: que desapareciera de la liquidación por estar de baja sería un error caro y
 * difícil de detectar, porque lo que se ve es una lista con una persona menos, no un
 * error.
 *
 * Los de baja vienen marcados con `enPapelera: true` para que la interfaz lo enseñe y
 * el snapshot lo congele.
 *
 * @param {Array} activos plantilla sin papelera
 * @param {Array} todas todas las fichas, incluida la papelera
 * @param {Array<[string, {trabajadorId: ?string, nombre: string, horasExtra: number}]>} resumenHoras
 * @returns {Array} fichas a liquidar, sin repetidos
 */
export function plantillaDelPeriodo(activos, todas, resumenHoras) {
    const base = (activos || []).map((t) => ({ ...t, enPapelera: false }));
    const yaEstan = new Set(base.map(claveDeTrabajador));
    const fichas = todas || [];

    const conActividad = (resumenHoras || [])
        // Si ya está en la plantilla activa no hay nada que añadir, y resolverlo
        // otra vez solo daría ocasión de confundirlo con otro.
        .filter(([clave, datos]) => !yaEstan.has(datos.trabajadorId || datos.nombre || clave))
        .map(([clave, datos]) => {
            // Con id se busca SOLO por id. Caer al nombre cuando el id no aparece
            // reintroduciría el fallo del Bloque 2: un homónimo en la papelera se
            // colaría en la nómina en lugar de la persona correcta.
            const ficha = datos.trabajadorId
                ? fichas.find((t) => t.id === datos.trabajadorId)
                : fichas.find((t) => t.nombre === datos.nombre);
            return ficha
                ? { ...ficha, enPapelera: true }
                : { id: datos.trabajadorId || null, nombre: datos.nombre || clave, enPapelera: true };
        })
        .filter((t) => !yaEstan.has(claveDeTrabajador(t)));

    // Dos entradas del resumen pueden resolver a la misma ficha (una con id y otra
    // solo con nombre): la persona debe aparecer una vez, no dos.
    const vistos = new Set();
    return [...base, ...conActividad].filter((t) => {
        const c = claveDeTrabajador(t);
        if (!c || vistos.has(c)) return false;
        vistos.add(c);
        return true;
    });
}
