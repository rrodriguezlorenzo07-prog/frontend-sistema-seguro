// @ts-check
/**
 * Ausencias: los días que un trabajador no vino.
 *
 * POR QUÉ UNA COLECCIÓN Y NO UN NÚMERO TECLEADO AL CERRAR. Hasta ahora los días de
 * ausencia se escribían a mano en la pantalla de nóminas y se perdían al cambiar de mes:
 * lo único que quedaba era el número congelado dentro del cierre. Con el modelo de horas
 * un error costaba 8 h; con el de tarifa diaria cuesta una jornada entera, y nadie podía
 * responder en octubre por qué a alguien se le descontaron tres días en julio.
 *
 * NO SE PUEDE REGISTRAR UNA AUSENCIA EN SÁBADO NI EN DOMINGO. Es la pieza que hace
 * viable el modelo de días naturales sin un calendario laboral: si el mes se paga como
 * 30 días fijos, faltar un sábado no debería descontar nada, y admitirlo abriría la
 * puerta a descuentos que nadie sabe justificar. Los festivos entre semana siguen sin
 * distinguirse —eso necesitaría el calendario que no tenemos— y por eso esto es una
 * restricción del FORMULARIO, no de las reglas: cierra el error honesto, no al
 * malintencionado, que no gana nada saltándosela.
 *
 * FASE 1: esto registra ausencias. NADIE las usa todavía para calcular una nómina —
 * ControlNominas sigue con su contador tecleado a mano, intacto.
 */

/** @typedef {import('../types.js').Ausencia} Ausencia */

/** Los tipos que ofrece el desplegable. La lista se amplía sin tocar nada más. */
export const TIPOS = ['falta', 'vacaciones', 'baja', 'permiso', 'otro'];

/** Cómo se llaman en pantalla. */
export const NOMBRES_TIPO = {
    falta: 'Falta',
    vacaciones: 'Vacaciones',
    baja: 'Baja',
    permiso: 'Permiso',
    otro: 'Otro'
};

/**
 * Partes de una fecha "AAAA-MM-DD" en hora LOCAL.
 *
 * `new Date('2026-09-05')` se interpreta como medianoche UTC, no local, y en España eso
 * puede caer en el día anterior. Para decidir si algo es sábado, un día de diferencia lo
 * cambia todo, así que se construye la fecha a mano.
 *
 * @param {string} iso
 * @returns {Date|null}
 */
export function fechaLocal(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return null;
    const [, a, mes, d] = m.map(Number);
    const fecha = new Date(a, mes - 1, d);
    // Rechaza un 31 de febrero, que JavaScript desplazaría alegremente a marzo.
    if (fecha.getFullYear() !== a || fecha.getMonth() !== mes - 1 || fecha.getDate() !== d) return null;
    return fecha;
}

/**
 * ¿Cae en sábado o domingo?
 * @param {string} iso "AAAA-MM-DD"
 * @returns {boolean} false también si la fecha no es válida; eso lo dice validarAusencia
 */
export function esFinDeSemana(iso) {
    const fecha = fechaLocal(iso);
    if (!fecha) return false;
    const dia = fecha.getDay();
    return dia === 0 || dia === 6;
}

/** Nombre del día, para explicar el rechazo en lugar de solo negarse. */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function nombreDelDia(iso) {
    const fecha = fechaLocal(iso);
    return fecha ? DIAS[fecha.getDay()] : '';
}

/**
 * ¿Se puede registrar esta ausencia?
 *
 * @param {{trabajadorId?: string, fecha?: string, tipo?: string}} datos
 * @param {Ausencia[]} [existentes] para no repetir trabajador+fecha
 * @returns {{valida: boolean, motivo: string|null}}
 */
export function validarAusencia(datos, existentes = []) {
    if (!datos?.trabajadorId) return { valida: false, motivo: 'Elige el trabajador.' };

    const fecha = String(datos?.fecha ?? '').trim();
    if (!fechaLocal(fecha)) return { valida: false, motivo: 'La fecha no es válida.' };

    if (esFinDeSemana(fecha)) {
        return {
            valida: false,
            motivo: `El ${fecha} es ${nombreDelDia(fecha)}. Los fines de semana no se trabajan, así que no hay nada que descontar.`
        };
    }

    if (datos?.tipo && !TIPOS.includes(datos.tipo)) {
        return { valida: false, motivo: 'Ese tipo de ausencia no existe.' };
    }

    // La misma persona, el mismo día, dos veces: descontaría dos jornadas por una.
    const repetida = (existentes || []).some((a) => a?.trabajadorId === datos.trabajadorId && a?.fecha === fecha);
    if (repetida) return { valida: false, motivo: 'Ese trabajador ya tiene una ausencia registrada ese día.' };

    return { valida: true, motivo: null };
}

/**
 * El documento que se escribe en `ausencias`.
 *
 * @param {{trabajadorId: string, trabajadorNombre?: string, fecha: string, tipo?: string, motivo?: string, creadoPor: string}} datos
 * @returns {Ausencia}
 */
export function construirAusencia({ trabajadorId, trabajadorNombre = '', fecha, tipo = 'falta', motivo = '', creadoPor }) {
    return /** @type {Ausencia} */ ({
        trabajadorId,
        // Desnormalizado, mismo criterio que obraNombre junto a obraId: una ausencia de
        // hace ocho meses debe seguir diciendo de quién era aunque se renombre la ficha.
        trabajadorNombre: String(trabajadorNombre ?? '').trim(),
        fecha,
        tipo: TIPOS.includes(tipo) ? tipo : 'falta',
        motivo: String(motivo ?? '').trim(),
        creadoPor,
        creadoEn: Date.now()
    });
}

/**
 * Cuántas ausencias tiene cada trabajador dentro de un rango de fechas.
 *
 * Se compara por CADENA "AAAA-MM-DD", que ordena igual que la fecha y evita meter husos
 * horarios donde no hacen falta.
 *
 * @param {Ausencia[]} ausencias
 * @param {string} desde inclusive
 * @param {string} hasta inclusive
 * @returns {Record<string, number>} indexado por trabajadorId
 */
export function contarPorTrabajador(ausencias, desde, hasta) {
    const cuenta = {};
    for (const a of ausencias || []) {
        if (!a?.trabajadorId || !a?.fecha) continue;
        if (desde && a.fecha < desde) continue;
        if (hasta && a.fecha > hasta) continue;
        cuenta[a.trabajadorId] = (cuenta[a.trabajadorId] || 0) + 1;
    }
    return cuenta;
}

/** Las de un trabajador, de la más reciente a la más antigua. */
export function ausenciasDe(ausencias, trabajadorId) {
    return (ausencias || [])
        .filter((a) => a?.trabajadorId === trabajadorId)
        .sort((a, b) => String(b?.fecha ?? '').localeCompare(String(a?.fecha ?? '')));
}
