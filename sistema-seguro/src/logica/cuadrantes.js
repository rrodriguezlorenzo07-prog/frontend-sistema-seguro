// @ts-check
/**
 * Cuadrantes: quién va, con qué furgoneta y a dónde, en qué franja del día.
 * Sin Firestore y sin React, como todo lo de esta carpeta.
 *
 * LOS BLOQUES SON LIBRES (D6). La oficina teclea inicio y fin exactos, no elige entre
 * turnos cerrados. Eso hace que el solape sea posible, y por tanto que haya que
 * detectarlo: es la única lógica de verdad que tiene este módulo.
 */

/** @typedef {import('../types.js').Cuadrante} Cuadrante */
/** @typedef {import('../types.js').Cuadrilla} Cuadrilla */

/**
 * Minutos desde medianoche de una hora "HH:MM".
 *
 * Devuelve NaN si el texto no es una hora, y quien llama decide qué hacer: aquí no se
 * inventa un valor por defecto porque un 0 silencioso convertiría "hora mal escrita" en
 * "medianoche", que es peor que un error visible.
 *
 * @param {string} hhmm
 * @returns {number}
 */
export function minutosDe(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return NaN;
    const horas = Number(m[1]);
    const minutos = Number(m[2]);
    if (horas > 23 || minutos > 59) return NaN;
    return horas * 60 + minutos;
}

/**
 * ¿Es válida la franja? Fin tiene que ir estrictamente después de inicio.
 *
 * No se admiten franjas que cruzan la medianoche: en esta empresa no se trabaja de
 * noche, y admitirlas obligaría a que todo lo demás razonara sobre dos días a la vez.
 *
 * @param {string} horaInicio
 * @param {string} horaFin
 * @returns {{valida: boolean, motivo: string|null}}
 */
export function franjaValida(horaInicio, horaFin) {
    const ini = minutosDe(horaInicio);
    const fin = minutosDe(horaFin);
    if (Number.isNaN(ini)) return { valida: false, motivo: 'La hora de inicio no es una hora válida.' };
    if (Number.isNaN(fin)) return { valida: false, motivo: 'La hora de fin no es una hora válida.' };
    if (fin <= ini) return { valida: false, motivo: 'La hora de fin tiene que ser posterior a la de inicio.' };
    return { valida: true, motivo: null };
}

/**
 * ¿Se pisan dos franjas?
 *
 * Tocarse no es pisarse: una cuadrilla que termina a las 14:00 puede empezar otra
 * asignación a las 14:00. Por eso la comparación es estricta en los dos extremos.
 *
 * @param {{horaInicio: string, horaFin: string}} a
 * @param {{horaInicio: string, horaFin: string}} b
 * @returns {boolean}
 */
export function franjasSePisan(a, b) {
    const iniA = minutosDe(a.horaInicio);
    const finA = minutosDe(a.horaFin);
    const iniB = minutosDe(b.horaInicio);
    const finB = minutosDe(b.horaFin);
    if ([iniA, finA, iniB, finB].some(Number.isNaN)) return false;
    return iniA < finB && iniB < finA;
}

/**
 * Solapes que provocaría una asignación nueva sobre las que ya hay ese día.
 *
 * Comprueba las dos cosas que no pueden estar en dos sitios a la vez: la cuadrilla y el
 * vehículo. La obra no cuenta: dos cuadrillas en la misma obra a la misma hora es
 * normal y deseable.
 *
 * Al editar una asignación existente hay que pasar su id en `ignorarId`, o se detecta
 * a sí misma como solape.
 *
 * @param {Cuadrante} candidata
 * @param {Cuadrante[]} existentes ya filtradas por fecha
 * @param {string|null} [ignorarId]
 * @returns {Array<{tipo: 'cuadrilla'|'vehiculo', con: Cuadrante, mensaje: string}>}
 */
export function solapesDe(candidata, existentes, ignorarId = null) {
    const choques = [];
    for (const otra of existentes || []) {
        if (!otra || otra.id === ignorarId) continue;
        if (!franjasSePisan(candidata, otra)) continue;

        if (candidata.cuadrillaId && otra.cuadrillaId === candidata.cuadrillaId) {
            choques.push({
                tipo: 'cuadrilla',
                con: otra,
                mensaje: `${otra.cuadrillaNombre || 'Esa cuadrilla'} ya está asignada de ${otra.horaInicio} a ${otra.horaFin} en ${otra.obraNombre || 'el taller'}.`
            });
        }
        if (candidata.vehiculoId && otra.vehiculoId === candidata.vehiculoId) {
            choques.push({
                tipo: 'vehiculo',
                con: otra,
                mensaje: `${otra.vehiculoNombre || 'Ese vehículo'} ya está asignado de ${otra.horaInicio} a ${otra.horaFin}.`
            });
        }
    }
    return choques;
}

/**
 * Ordena las asignaciones de un día por hora de inicio, y a igual hora por cuadrilla,
 * para que el tablero no baile entre recargas.
 *
 * @param {Cuadrante[]} asignaciones
 * @returns {Cuadrante[]}
 */
export function ordenarPorHora(asignaciones) {
    return [...(asignaciones || [])].sort((a, b) => {
        const d = (minutosDe(a.horaInicio) || 0) - (minutosDe(b.horaInicio) || 0);
        if (d !== 0) return d;
        return String(a.cuadrillaNombre || '').localeCompare(String(b.cuadrillaNombre || ''));
    });
}

/**
 * Las asignaciones agrupadas por cuadrilla, para pintar una fila por cuadrilla.
 *
 * Devuelve TODAS las cuadrillas activas, también las que no tienen nada asignado: una
 * cuadrilla sin trabajo es justo lo que la oficina necesita ver de un vistazo.
 *
 * @param {Cuadrilla[]} cuadrillas
 * @param {Cuadrante[]} asignaciones del día
 * @returns {Array<{cuadrilla: Cuadrilla, asignaciones: Cuadrante[]}>}
 */
export function filasDelTablero(cuadrillas, asignaciones) {
    const porCuadrilla = new Map();
    for (const a of asignaciones || []) {
        const lista = porCuadrilla.get(a.cuadrillaId) || [];
        lista.push(a);
        porCuadrilla.set(a.cuadrillaId, lista);
    }
    return (cuadrillas || []).map((cuadrilla) => ({
        cuadrilla,
        asignaciones: ordenarPorHora(porCuadrilla.get(cuadrilla.id) || [])
    }));
}

/**
 * El array plano de correos que exigen las reglas de Firestore.
 *
 * Las reglas no saben recorrer un array de objetos, así que `operarios` no les sirve y
 * hace falta esta copia redundante. Se normaliza a minúsculas porque `correo()` en las
 * reglas devuelve el token ya en minúsculas, y una mayúscula suelta dejaría al operario
 * sin ver su propia asignación.
 *
 * @param {Array<{email?: string}>} operarios
 * @returns {string[]}
 */
export function correosDeCuadrilla(operarios) {
    const correos = (operarios || [])
        .map((o) => String(o?.email || '').toLowerCase().trim())
        .filter((c) => c.length > 0);
    return [...new Set(correos)];
}

/**
 * Prepara el documento que se va a escribir en `cuadrantes`.
 *
 * Denormaliza los nombres junto a los ids —mismo criterio que en D.2— para que el
 * tablero y la vista del operario pinten sin resolver referencias, y para que una
 * asignación pasada siga diciendo a qué obra fue aunque la obra se renombre después.
 *
 * @param {object} datos
 * @param {string} datos.fecha `YYYY-MM-DD`
 * @param {string} datos.horaInicio
 * @param {string} datos.horaFin
 * @param {Cuadrilla} datos.cuadrilla
 * @param {{id: string, nombre: string}|null} [datos.vehiculo]
 * @param {'obra'|'taller'} datos.destinoTipo
 * @param {{id: string, nombre: string}|null} [datos.obra]
 * @param {string} datos.creadoPor
 * @returns {Cuadrante}
 */
export function construirAsignacion({ fecha, horaInicio, horaFin, cuadrilla, vehiculo = null, destinoTipo, obra = null, creadoPor }) {
    const operarios = (cuadrilla?.operarios || []).map((o) => ({
        trabajadorId: o.trabajadorId ?? null,
        nombre: o.nombre ?? '',
        email: String(o.email || '').toLowerCase().trim()
    }));

    return /** @type {Cuadrante} */ ({
        fecha,
        horaInicio,
        horaFin,
        cuadrillaId: cuadrilla.id,
        cuadrillaNombre: cuadrilla.nombre ?? '',
        operarios,
        operarioEmails: correosDeCuadrilla(operarios),
        vehiculoId: vehiculo?.id ?? null,
        vehiculoNombre: vehiculo?.nombre ?? null,
        destinoTipo,
        // El taller no es una obra del catálogo: obraId queda en null a propósito,
        // igual que cuando el operario escribe una obra a mano en su parte.
        obraId: destinoTipo === 'obra' ? (obra?.id ?? null) : null,
        obraNombre: destinoTipo === 'obra' ? (obra?.nombre ?? null) : null,
        estado: 'planificado',
        parteId: null,
        creadoPor,
        creadoEn: Date.now()
    });
}

/**
 * La asignación que le toca a un operario en un momento dado.
 *
 * Si tiene varias ese día devuelve la que está en curso, y si ninguna lo está, la
 * siguiente que empieza. Es lo que necesita la vista móvil para abrir directamente en
 * lo que el operario está haciendo ahora sin obligarle a elegir.
 *
 * @param {Cuadrante[]} asignaciones ya filtradas por operario y fecha
 * @param {number} [minutosAhora] minutos desde medianoche; parametrizado para poder probarlo
 * @returns {Cuadrante|null}
 */
export function asignacionVigente(asignaciones, minutosAhora) {
    const lista = ordenarPorHora(asignaciones);
    if (lista.length === 0) return null;

    const ahora = Number.isFinite(minutosAhora)
        ? /** @type {number} */ (minutosAhora)
        : (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();

    const enCurso = lista.find((a) => {
        const ini = minutosDe(a.horaInicio);
        const fin = minutosDe(a.horaFin);
        return !Number.isNaN(ini) && !Number.isNaN(fin) && ahora >= ini && ahora < fin;
    });
    if (enCurso) return enCurso;

    const siguiente = lista.find((a) => minutosDe(a.horaInicio) > ahora);
    // Si ya pasaron todas, la última: el operario que ficha tarde sigue viendo dónde
    // estuvo, en vez de una pantalla vacía.
    return siguiente || lista[lista.length - 1];
}

/**
 * Qué obra escribe en el parte una asignación.
 *
 * Un destino de TALLER no tiene obra del catálogo, pero el parte sí necesita un valor
 * en `obra`: las reglas lo exigen y sin él no se puede crear. Se escribe "Taller" como
 * nombre y `obraId` en null — la misma forma que ya tiene un parte de obra escrita a
 * mano, así que nada de lo que lee partes aguas abajo necesita un caso nuevo.
 *
 * @param {Cuadrante} asignacion
 * @returns {{obra: string, obraId: string|null}}
 */
export function destinoDeAsignacion(asignacion) {
    if (!asignacion) return { obra: '', obraId: null };
    if (asignacion.destinoTipo === 'taller') return { obra: 'Taller', obraId: null };
    return { obra: asignacion.obraNombre || '', obraId: asignacion.obraId || null };
}

/**
 * Normaliza una hora reportada por el operario.
 *
 * Son informativas (D5): no tocan la nómina, que sigue calculando la base mensual fija
 * y las horas extra asignadas en validación. Aun así se limpian, porque acaban en un
 * documento y un "" o un negativo ensuciarían cualquier suma posterior.
 *
 * Se admiten medias horas y se corta en 24: más de un día en una jornada es un error de
 * tecleo, no un dato.
 *
 * @param {string|number} valor
 * @returns {number}
 */
export function normalizarHorasReportadas(valor) {
    const n = Number(String(valor ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(Math.round(n * 2) / 2, 24);
}

/**
 * ¿Suman una jornada creíble?
 *
 * No bloquea nada: devuelve un aviso para enseñarlo, porque una jornada de 14 h puede
 * ser real y no le corresponde a la aplicación llamar mentiroso al operario.
 *
 * @param {number} horasTaller
 * @param {number} horasCalle
 * @returns {{total: number, aviso: string|null}}
 */
export function contrasteDeJornada(horasTaller, horasCalle) {
    const total = normalizarHorasReportadas(horasTaller) + normalizarHorasReportadas(horasCalle);
    if (total === 0) return { total, aviso: null };
    if (total > 12) return { total, aviso: `Has apuntado ${total} h en total. Compruébalo antes de enviar.` };
    return { total, aviso: null };
}
