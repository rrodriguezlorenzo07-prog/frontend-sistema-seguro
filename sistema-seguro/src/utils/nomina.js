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

// ============================ MODELO DE DÍAS (esquema 2) ====================
//
// El modelo viejo, de arriba, sigue intacto: las liquidaciones ya cerradas con él se
// leen tal cual y NUNCA se recalculan. Lo de aquí abajo es lo que se aplica de ahora en
// adelante a quien tenga categoría profesional asignada.
//
// El trabajador cobra POR DÍA según su categoría del convenio, no por horas de contrato.

/**
 * Días trabajables de un mes: SIEMPRE 30.
 *
 * No son los días naturales reales del mes. Es la convención de la nómina española
 * —salario mensual dividido entre 30— y es lo que hace que febrero y marzo paguen igual
 * con la misma tarifa. Contar los días reales (28, 29, 30 o 31) haría que el sueldo
 * variase de un mes a otro sin que nadie lo hubiera decidido.
 *
 * Va como constante y no como cálculo a propósito: no hay nada que derivar del
 * calendario, y una función que devolviera `new Date(...).getDate()` invitaría a
 * "arreglarla" más adelante.
 */
export const DIAS_TRABAJABLES_MES = 30;

/**
 * Días que se pagan: los trabajables menos las ausencias. Nunca negativo.
 *
 * @param {number} diasTrabajables
 * @param {number} diasAusencia
 * @returns {number}
 */
export function diasPagadosDelPeriodo(diasTrabajables, diasAusencia) {
    const trabajables = Number(diasTrabajables) || 0;
    const ausencias = Number(diasAusencia) || 0;
    return Math.max(0, trabajables - ausencias);
}

/**
 * El importe base del periodo: días pagados por la tarifa diaria de su categoría.
 *
 * @param {number} diasPagados
 * @param {number} tarifaDiaria
 * @returns {number}
 */
export function importeBaseDelPeriodo(diasPagados, tarifaDiaria) {
    return (Number(diasPagados) || 0) * (Number(tarifaDiaria) || 0);
}

/**
 * ¿Tiene este trabajador una categoría asignada?
 *
 * Sin ella no hay tarifa diaria, y sin tarifa no hay nómina que calcular. NO se aplica
 * ningún valor por defecto: pagar 0 € a alguien porque falta rellenar un campo sería un
 * error caro y silencioso, así que el cierre se bloquea y se dice a quién le falta.
 *
 * @param {{categoriaId?: string|null}} trabajador
 * @returns {boolean}
 */
export function tieneCategoria(trabajador) {
    return typeof trabajador?.categoriaId === 'string' && trabajador.categoriaId !== '';
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
