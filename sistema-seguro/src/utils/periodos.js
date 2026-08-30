/**
 * Periodos de nómina. Un periodo es SIEMPRE un mes natural completo.
 *
 * La fórmula de la nómina es base mensual menos ausencias: cerrar diez días aplicando
 * una base de 160 h no daría un número discutible, daría uno sin sentido. Y dos rangos
 * solapados podrían cerrarse los dos, pagando dos veces las mismas horas. Por eso el
 * periodo no es un rango libre, y las reglas de Firestore lo exigen igual que esta
 * pantalla: `^[0-9]{4}-(0[1-9]|1[0-2])$`.
 *
 * LOS LÍMITES SON HORA LOCAL, no UTC. Un mes de nómina española empieza a medianoche
 * en España. Calcularlo con `new Date('2026-08-01')` —que JavaScript interpreta como
 * medianoche UTC— metería en agosto los partes de las primeras horas del 1 de
 * septiembre, y dejaría fuera los del 1 de agosto de madrugada.
 */

/** ¿Tiene la forma "AAAA-MM" con un mes que existe? */
export function esPeriodoValido(periodo) {
    return typeof periodo === 'string' && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(periodo);
}

/** Id del periodo al que pertenece una fecha. @returns {string} "2026-08" */
export function idDePeriodo(fecha = new Date()) {
    const d = new Date(fecha);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** El periodo de una fecha en formato de input date ("2026-08-15" -> "2026-08"). */
export function periodoDeFechaISO(iso) {
    return typeof iso === 'string' && iso.length >= 7 ? iso.slice(0, 7) : '';
}

/** Año y mes (1-12) de un periodo. */
function partes(periodo) {
    const [anio, mes] = periodo.split('-').map(Number);
    return { anio, mes };
}

/**
 * Milisegundos del primer y el último instante del mes, en hora local.
 * @returns {{inicio: number, fin: number}}
 */
export function limitesDelMes(periodo) {
    if (!esPeriodoValido(periodo)) return { inicio: NaN, fin: NaN };
    const { anio, mes } = partes(periodo);
    return {
        inicio: new Date(anio, mes - 1, 1, 0, 0, 0, 0).getTime(),
        // Día 0 del mes siguiente = último día de este.
        fin: new Date(anio, mes, 0, 23, 59, 59, 999).getTime()
    };
}

/** Primer día del mes en formato de input date. */
export function primerDiaISO(periodo) {
    return esPeriodoValido(periodo) ? `${periodo}-01` : '';
}

/** Último día del mes en formato de input date. */
export function ultimoDiaISO(periodo) {
    if (!esPeriodoValido(periodo)) return '';
    const { anio, mes } = partes(periodo);
    return `${periodo}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;
}

/**
 * ¿Este periodo es anterior al mes en curso?
 *
 * Es lo que dispara el aviso de D3: cerrar un mes pasado usa las fichas, las bases y
 * las tarifas de HOY, no las que hubiera entonces.
 */
export function esPeriodoPasado(periodo, hoy = new Date()) {
    return esPeriodoValido(periodo) && periodo < idDePeriodo(hoy);
}

/** Nombre legible: "agosto de 2026". */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function nombreDelPeriodo(periodo) {
    if (!esPeriodoValido(periodo)) return '(periodo no válido)';
    const { anio, mes } = partes(periodo);
    return `${MESES[mes - 1]} de ${anio}`;
}

/**
 * Id del documento de un cierre. Lleva dentro el periodo y la versión, y las reglas
 * comprueban que cuadren: es lo que hace imposible sobrescribir un cierre existente.
 */
export function idDeCierre(periodo, version) {
    return `${periodo}-v${version}`;
}

/** La versión siguiente a la más alta ya emitida. Sin cierres previos, 1. */
export function siguienteVersion(cierres) {
    const versiones = (cierres || []).map((c) => Number(c?.version) || 0);
    return versiones.length === 0 ? 1 : Math.max(...versiones) + 1;
}

/** El cierre vigente de un periodo: el de versión más alta. */
export function cierreVigente(cierres) {
    if (!cierres || cierres.length === 0) return null;
    return [...cierres].sort((a, b) => (Number(b?.version) || 0) - (Number(a?.version) || 0))[0];
}
