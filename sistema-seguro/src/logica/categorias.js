// @ts-check
/**
 * Categorías profesionales del convenio: cuánto vale un día y cuánto una hora extra.
 *
 * NI UN NOMBRE NI UNA CIFRA EN EL CÓDIGO. Las tablas del convenio se revisan cada año
 * por la cláusula del IPC, así que «Oficial 1ª» y sus tarifas se teclean desde la
 * pantalla y viven en Firestore. Poner aquí un valor por defecto sería sembrar el número
 * que alguien acabará cobrando de más o de menos cuando nadie recuerde de dónde salió.
 *
 * FASE 1: esto construye y valida el catálogo. NADIE lo usa todavía para calcular una
 * nómina — ControlNominas sigue con el modelo de horas, intacto.
 */

/** @typedef {import('../types.js').CategoriaProfesional} CategoriaProfesional */

/**
 * Un importe tal y como lo teclea una persona: admite coma decimal.
 *
 * Devuelve NaN si no es un número, y quien llama decide. No se cae a 0: un 0 silencioso
 * convertiría «me he equivocado tecleando» en «este día no se paga».
 *
 * @param {string|number|null|undefined} valor
 * @returns {number}
 */
export function normalizarTarifa(valor) {
    if (valor === null || valor === undefined || valor === '') return NaN;
    const texto = String(valor).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(texto)) return NaN;
    return Number(texto);
}

/**
 * ¿Se puede guardar esta categoría?
 *
 * Las dos tarifas pueden ser 0 —una categoría de la que aún no se sabe el importe es
 * mejor que no tenerla— pero tienen que ser números, no texto ni vacío.
 *
 * @param {{nombre?: string, tarifaDiaria?: string|number, tarifaHoraExtra?: string|number}} datos
 * @param {CategoriaProfesional[]} [existentes] para detectar nombres repetidos
 * @param {string|null} [ignorarId] al editar, su propio id no cuenta como duplicado
 * @returns {{valida: boolean, motivo: string|null}}
 */
export function validarCategoria(datos, existentes = [], ignorarId = null) {
    const nombre = String(datos?.nombre ?? '').trim();
    if (nombre === '') return { valida: false, motivo: 'La categoría necesita un nombre.' };

    const diaria = normalizarTarifa(datos?.tarifaDiaria);
    if (Number.isNaN(diaria)) return { valida: false, motivo: 'La tarifa diaria tiene que ser un número.' };

    const extra = normalizarTarifa(datos?.tarifaHoraExtra);
    if (Number.isNaN(extra)) return { valida: false, motivo: 'La tarifa de hora extra tiene que ser un número.' };

    // Dos categorías con el mismo nombre son un accidente esperando a pasar: al asignarla
    // en la ficha se elige por nombre y nadie sabría cuál de las dos cogió.
    const repetida = (existentes || []).some((c) => (
        c.id !== ignorarId
        && !c.papelera
        && String(c.nombre ?? '').trim().toLowerCase() === nombre.toLowerCase()
    ));
    if (repetida) return { valida: false, motivo: `Ya existe una categoría llamada «${nombre}».` };

    return { valida: true, motivo: null };
}

/**
 * El documento que se escribe en `categorias_profesionales`.
 *
 * @param {{nombre: string, tarifaDiaria: string|number, tarifaHoraExtra: string|number, creadoPor: string}} datos
 * @returns {CategoriaProfesional}
 */
export function construirCategoria({ nombre, tarifaDiaria, tarifaHoraExtra, creadoPor }) {
    const ahora = Date.now();
    return /** @type {CategoriaProfesional} */ ({
        nombre: String(nombre).trim(),
        tarifaDiaria: normalizarTarifa(tarifaDiaria) || 0,
        tarifaHoraExtra: normalizarTarifa(tarifaHoraExtra) || 0,
        papelera: false,
        creadoEn: ahora,
        creadoPor,
        actualizadoEn: ahora,
        actualizadoPor: creadoPor
    });
}

/** Los campos que cambian al editar, con su rastro de quién y cuándo. */
export function cambiosDeCategoria({ nombre, tarifaDiaria, tarifaHoraExtra, actualizadoPor }) {
    return {
        nombre: String(nombre).trim(),
        tarifaDiaria: normalizarTarifa(tarifaDiaria) || 0,
        tarifaHoraExtra: normalizarTarifa(tarifaHoraExtra) || 0,
        actualizadoEn: Date.now(),
        actualizadoPor
    };
}

/** Las que no están en la papelera, por nombre. */
export function categoriasActivas(categorias) {
    return (categorias || [])
        .filter((c) => !c?.papelera)
        .sort((a, b) => String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? ''), 'es'));
}

/**
 * La categoría de un trabajador, resuelta por id.
 *
 * Se busca por `categoriaId` y NO se cae al nombre: el nombre está desnormalizado en la
 * ficha para poder pintarlo sin resolver nada, pero como criterio de búsqueda
 * reintroduciría el fallo del Bloque 2 —dos categorías renombradas y el cruce por texto
 * eligiendo la equivocada—.
 *
 * @param {{categoriaId?: string|null}} trabajador
 * @param {CategoriaProfesional[]} categorias
 * @returns {CategoriaProfesional|null}
 */
export function categoriaDe(trabajador, categorias) {
    const id = trabajador?.categoriaId;
    if (!id) return null;
    return (categorias || []).find((c) => c.id === id) ?? null;
}

/** Cuántos trabajadores usan cada categoría. Para avisar antes de mandarla a la papelera. */
export function usoDeCategoria(categoriaId, trabajadores) {
    return (trabajadores || []).filter((t) => t?.categoriaId === categoriaId).length;
}
