/**
 * La agregación de horas extra del periodo. Sin red: se prueba la parte pura.
 *
 *   node tests/horas-periodo.test.mjs
 *
 * Lo que importa aquí es que un parte aprobado y luego mandado a la papelera NO cuente,
 * porque su documento en validaciones/ sigue existiendo. Agregar solo sobre
 * validaciones/ —que sería lo barato— metería en la nómina albaranes descartados.
 */
import { agregarCuadrillas } from '../src/utils/horasPeriodo.js';

let fallos = 0;
const comprobar = (desc, ok, detalle) => {
    if (!ok) fallos += 1;
    console.log(`   ${ok ? 'PASA  ' : 'FALLA '} · ${desc}${detalle ? ' — ' + detalle : ''}`);
};

const horasDe = (resumen, clave) => (resumen.find(([k]) => k === clave) || [null, { horasExtra: 0 }])[1].horasExtra;

console.log('\n─── CASO 1: suma por trabajadorId a través de varios albaranes ───');
{
    const validaciones = [
        { id: 'p1', cuadrilla: [{ trabajadorId: 't1', nombre: 'Julian', horasExtra: 2 }, { trabajadorId: 't2', nombre: 'Ana', horasExtra: 1 }] },
        { id: 'p2', cuadrilla: [{ trabajadorId: 't1', nombre: 'Julian', horasExtra: 3.5 }] }
    ];
    const { resumen, validacionesUsadas } = agregarCuadrillas(validaciones, new Set(['p1', 'p2']));
    comprobar('Julian acumula de los dos partes', horasDe(resumen, 't1') === 5.5, `${horasDe(resumen, 't1')} h`);
    comprobar('Ana solo del suyo', horasDe(resumen, 't2') === 1);
    comprobar('se contaron los dos albaranes', validacionesUsadas === 2);
    comprobar('ordenado de más a menos horas', resumen[0][0] === 't1');
}

console.log('\n─── CASO 2: un parte fuera de los computables no suma ───');
{
    const validaciones = [
        { id: 'aprobado', cuadrilla: [{ trabajadorId: 't1', nombre: 'Julian', horasExtra: 4 }] },
        { id: 'en-papelera', cuadrilla: [{ trabajadorId: 't1', nombre: 'Julian', horasExtra: 99 }] },
        { id: 'pendiente', cuadrilla: [{ trabajadorId: 't1', nombre: 'Julian', horasExtra: 50 }] }
    ];
    const { resumen, validacionesUsadas } = agregarCuadrillas(validaciones, new Set(['aprobado']));
    comprobar('solo cuenta el aprobado y activo', horasDe(resumen, 't1') === 4, `${horasDe(resumen, 't1')} h`);
    comprobar('la validación del descartado no se usa', validacionesUsadas === 1);
}

console.log('\n─── CASO 3: cuadrillas antiguas sin trabajadorId ───');
{
    const validaciones = [
        { id: 'viejo', cuadrilla: [{ nombre: 'Julian', horasExtra: 2 }] },
        { id: 'nuevo', cuadrilla: [{ trabajadorId: 't1', nombre: 'Julian', horasExtra: 3 }] }
    ];
    const { resumen } = agregarCuadrillas(validaciones, new Set(['viejo', 'nuevo']));
    comprobar('la entrada sin id se agrupa por nombre', horasDe(resumen, 'Julian') === 2);
    comprobar('la que tiene id va por id', horasDe(resumen, 't1') === 3);
    comprobar('quedan como dos entradas distintas, no se inventan cruces', resumen.length === 2);
}

console.log('\n─── CASO 4: datos incompletos no rompen ───');
{
    const validaciones = [
        { id: 'a', cuadrilla: [] },
        { id: 'b' },
        { id: 'c', cuadrilla: [{ nombre: 'Ana' }] },
        { id: 'd', cuadrilla: [{ horasExtra: 5 }] },
        { id: 'e', cuadrilla: [{ trabajadorId: 't9', nombre: 'Luis', horasExtra: '2.5' }] }
    ];
    const { resumen } = agregarCuadrillas(validaciones, new Set(['a', 'b', 'c', 'd', 'e']));
    comprobar('una cuadrilla vacía no aporta', horasDe(resumen, 'a') === 0);
    comprobar('sin horasExtra cuenta como 0', horasDe(resumen, 'Ana') === 0);
    comprobar('una entrada sin nombre ni id se descarta', !resumen.some(([k]) => k === 'undefined'));
    comprobar('las horas en texto se convierten', horasDe(resumen, 't9') === 2.5);
}

console.log('\n─── CASO 5: periodo sin nada ───');
{
    const { resumen, validacionesUsadas } = agregarCuadrillas([], new Set());
    comprobar('devuelve lista vacía, no null', Array.isArray(resumen) && resumen.length === 0);
    comprobar('cero albaranes usados', validacionesUsadas === 0);
}

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
process.exit(fallos === 0 ? 0 : 1);
