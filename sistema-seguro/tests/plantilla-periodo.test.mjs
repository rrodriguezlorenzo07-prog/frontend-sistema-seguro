/**
 * D4: quién entra en la nómina de un periodo.
 *
 *   node tests/plantilla-periodo.test.mjs
 *
 * Lo que se protege aquí: que un trabajador dado de baja a mitad de mes NO desaparezca
 * de su última liquidación. Ese fallo no se ve —lo que se ve es una lista con una
 * persona menos, no un error— y se traduce en una nómina sin pagar.
 */
import { plantillaDelPeriodo, claveDeTrabajador } from '../src/utils/nomina.js';

let fallos = 0;
const comprobar = (desc, ok, detalle) => {
    if (!ok) fallos += 1;
    console.log(`   ${ok ? 'PASA  ' : 'FALLA '} · ${desc}${detalle ? ' — ' + detalle : ''}`);
};

const ACTIVOS = [
    { id: 't1', nombre: 'Julian', horasBaseMensuales: 160 },
    { id: 't2', nombre: 'Ana', horasBaseMensuales: 150 }
];
const TODAS = [
    ...ACTIVOS,
    { id: 't3', nombre: 'Luis', horasBaseMensuales: 140, papelera: true },
    { id: 't4', nombre: 'Marta', horasBaseMensuales: 120, papelera: true }
];

console.log('\n─── CASO 1: sin actividad de nadie de baja, la plantilla es la activa ───');
{
    const r = plantillaDelPeriodo(ACTIVOS, TODAS, [['t1', { trabajadorId: 't1', nombre: 'Julian', horasExtra: 4 }]]);
    comprobar('solo los dos activos', r.length === 2, r.map((t) => t.nombre).join(', '));
    comprobar('ninguno marcado de baja', r.every((t) => t.enPapelera === false));
}

console.log('\n─── CASO 2: alguien de baja CON actividad entra igual ───');
{
    const r = plantillaDelPeriodo(ACTIVOS, TODAS, [
        ['t1', { trabajadorId: 't1', nombre: 'Julian', horasExtra: 4 }],
        ['t3', { trabajadorId: 't3', nombre: 'Luis', horasExtra: 6 }]
    ]);
    comprobar('son tres personas', r.length === 3, r.map((t) => t.nombre).join(', '));
    const luis = r.find((t) => t.id === 't3');
    comprobar('Luis está en la lista', !!luis);
    comprobar('viene marcado como de baja', luis?.enPapelera === true);
    comprobar('conserva su base mensual de la ficha', luis?.horasBaseMensuales === 140);
    comprobar('los activos siguen sin marcar', r.filter((t) => t.enPapelera).length === 1);
}

console.log('\n─── CASO 3: los de baja SIN actividad no entran ───');
{
    const r = plantillaDelPeriodo(ACTIVOS, TODAS, [['t3', { trabajadorId: 't3', nombre: 'Luis', horasExtra: 2 }]]);
    comprobar('Marta, de baja y sin horas, no aparece', !r.some((t) => t.id === 't4'));
    comprobar('Luis, de baja y con horas, sí', r.some((t) => t.id === 't3'));
}

console.log('\n─── CASO 4: nadie aparece dos veces ───');
{
    // La misma persona en dos entradas del resumen: una con id (cuadrilla nueva) y otra
    // solo con nombre (cuadrilla anterior al Bloque 2).
    const r = plantillaDelPeriodo(ACTIVOS, TODAS, [
        ['t3', { trabajadorId: 't3', nombre: 'Luis', horasExtra: 3 }],
        ['Luis', { trabajadorId: null, nombre: 'Luis', horasExtra: 2 }]
    ]);
    const veces = r.filter((t) => t.nombre === 'Luis').length;
    comprobar('Luis aparece una sola vez', veces === 1, `${veces} veces`);
}

console.log('\n─── CASO 5: actividad de alguien sin ficha ───');
{
    const r = plantillaDelPeriodo(ACTIVOS, TODAS, [
        ['Pedro', { trabajadorId: null, nombre: 'Pedro', horasExtra: 5 }]
    ]);
    const pedro = r.find((t) => t.nombre === 'Pedro');
    comprobar('entra igual, no se pierde su liquidación', !!pedro);
    comprobar('sin id, se identifica por nombre', claveDeTrabajador(pedro) === 'Pedro');
    comprobar('sin base configurada en la ficha', pedro?.horasBaseMensuales === undefined);
}

console.log('\n─── CASO 6: un activo nunca queda marcado de baja por error ───');
{
    // Aunque su nombre coincida con el de una ficha en papelera.
    const activosConHomonimo = [{ id: 't5', nombre: 'Luis', horasBaseMensuales: 170 }];
    const r = plantillaDelPeriodo(activosConHomonimo, TODAS, [
        ['t5', { trabajadorId: 't5', nombre: 'Luis', horasExtra: 3 }]
    ]);
    comprobar('el activo se queda como activo', r.length === 1 && r[0].enPapelera === false);
    comprobar('y con SU base, no la del homónimo de baja', r[0].horasBaseMensuales === 170);
}

console.log('\n─── CASO 7: entradas vacías o incompletas ───');
{
    comprobar('sin resumen devuelve la plantilla activa', plantillaDelPeriodo(ACTIVOS, TODAS, []).length === 2);
    comprobar('sin plantilla ni resumen devuelve lista vacía', plantillaDelPeriodo([], [], []).length === 0);
    comprobar('argumentos nulos no rompen', plantillaDelPeriodo(null, null, null).length === 0);
}

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
process.exit(fallos === 0 ? 0 : 1);
