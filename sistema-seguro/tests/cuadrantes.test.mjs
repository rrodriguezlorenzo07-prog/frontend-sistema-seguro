/**
 * Lógica pura de cuadrantes. Sin emulador, sin red:
 *   node --test tests/cuadrantes.test.mjs
 *
 * Lo que de verdad hay que probar aquí es el solape. Los bloques horarios son libres
 * (D6), así que nada impide teclear dos asignaciones que se pisen: la detección es la
 * única red de seguridad, y la asignación rápida sobre la marcha (D1) es justo el caso
 * donde más fácil es equivocarse, porque se hace con prisa.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    minutosDe,
    franjaValida,
    franjasSePisan,
    solapesDe,
    ordenarPorHora,
    filasDelTablero,
    correosDeCuadrilla,
    construirAsignacion,
    asignacionVigente,
    destinoDeAsignacion,
    normalizarHorasReportadas,
    contrasteDeJornada
} from '../src/logica/cuadrantes.js';

// ----------------------------------------------------------------- minutosDe

test('minutosDe', async (t) => {
    await t.test('PASA · convierte una hora normal', () => {
        assert.equal(minutosDe('08:30'), 510);
    });
    await t.test('PASA · acepta una sola cifra en la hora', () => {
        assert.equal(minutosDe('8:05'), 485);
    });
    await t.test('PASA · medianoche es 0', () => {
        assert.equal(minutosDe('00:00'), 0);
    });
    await t.test('PASA · NaN si no es una hora, en vez de 0', () => {
        // Un 0 silencioso convertiría "texto basura" en "medianoche".
        assert.ok(Number.isNaN(minutosDe('mañana')));
        assert.ok(Number.isNaN(minutosDe('')));
        assert.ok(Number.isNaN(minutosDe('8')));
    });
    await t.test('PASA · NaN si la hora no existe', () => {
        assert.ok(Number.isNaN(minutosDe('25:00')));
        assert.ok(Number.isNaN(minutosDe('08:70')));
    });
});

// --------------------------------------------------------------- franjaValida

test('franjaValida', async (t) => {
    await t.test('PASA · acepta una franja normal', () => {
        assert.equal(franjaValida('08:00', '14:00').valida, true);
    });
    await t.test('PASA · rechaza fin anterior a inicio', () => {
        const r = franjaValida('14:00', '08:00');
        assert.equal(r.valida, false);
        assert.match(r.motivo, /posterior/);
    });
    await t.test('PASA · rechaza fin igual a inicio', () => {
        assert.equal(franjaValida('08:00', '08:00').valida, false);
    });
    await t.test('PASA · el motivo distingue cuál de las dos horas está mal', () => {
        assert.match(franjaValida('nada', '14:00').motivo, /inicio/);
        assert.match(franjaValida('08:00', 'nada').motivo, /fin/);
    });
});

// -------------------------------------------------------------- franjasSePisan

test('franjasSePisan', async (t) => {
    const f = (horaInicio, horaFin) => ({ horaInicio, horaFin });

    await t.test('PASA · dos franjas iguales se pisan', () => {
        assert.equal(franjasSePisan(f('08:00', '14:00'), f('08:00', '14:00')), true);
    });
    await t.test('PASA · solape parcial', () => {
        assert.equal(franjasSePisan(f('08:00', '12:00'), f('11:00', '15:00')), true);
    });
    await t.test('PASA · una dentro de otra', () => {
        assert.equal(franjasSePisan(f('08:00', '18:00'), f('10:00', '12:00')), true);
    });
    await t.test('PASA · TOCARSE NO ES PISARSE', () => {
        // Terminar a las 14:00 y empezar otra a las 14:00 es lo normal en obra.
        assert.equal(franjasSePisan(f('08:00', '14:00'), f('14:00', '18:00')), false);
    });
    await t.test('PASA · franjas separadas no se pisan', () => {
        assert.equal(franjasSePisan(f('08:00', '10:00'), f('16:00', '18:00')), false);
    });
    await t.test('PASA · una hora inválida no inventa un solape', () => {
        assert.equal(franjasSePisan(f('nada', '14:00'), f('08:00', '18:00')), false);
    });
});

// ------------------------------------------------------------------ solapesDe

const asignacion = (extra) => ({
    id: 'a-x', fecha: '2026-09-04', horaInicio: '08:00', horaFin: '14:00',
    cuadrillaId: 'c1', cuadrillaNombre: 'Cuadrilla A',
    vehiculoId: 'v1', vehiculoNombre: 'Furgoneta 1',
    obraNombre: 'Hotel Sol',
    ...extra
});

test('solapesDe', async (t) => {
    await t.test('PASA · sin asignaciones previas no hay solape', () => {
        assert.deepEqual(solapesDe(asignacion({}), []), []);
    });

    await t.test('PASA · detecta la cuadrilla en dos sitios a la vez', () => {
        const previa = asignacion({ id: 'a-1', obraNombre: 'Hotel Luna', vehiculoId: 'v2' });
        const nueva = asignacion({ id: null, vehiculoId: 'v2-otro' });
        const choques = solapesDe(nueva, [previa]);
        assert.equal(choques.length, 1);
        assert.equal(choques[0].tipo, 'cuadrilla');
        assert.match(choques[0].mensaje, /Cuadrilla A/);
        assert.match(choques[0].mensaje, /Hotel Luna/);
    });

    await t.test('PASA · detecta el vehículo en dos sitios a la vez', () => {
        const previa = asignacion({ id: 'a-1', cuadrillaId: 'c9', cuadrillaNombre: 'Cuadrilla B' });
        const choques = solapesDe(asignacion({ id: null }), [previa]);
        assert.equal(choques.length, 1);
        assert.equal(choques[0].tipo, 'vehiculo');
    });

    await t.test('PASA · cuadrilla Y vehículo a la vez dan dos choques', () => {
        const previa = asignacion({ id: 'a-1' });
        const choques = solapesDe(asignacion({ id: null }), [previa]);
        assert.equal(choques.length, 2);
        assert.deepEqual(choques.map((c) => c.tipo).sort(), ['cuadrilla', 'vehiculo']);
    });

    await t.test('PASA · dos cuadrillas en la MISMA obra no es un solape', () => {
        // Es lo normal y deseable: dos equipos en el mismo hotel.
        const previa = asignacion({ id: 'a-1', cuadrillaId: 'c9', vehiculoId: 'v9' });
        assert.deepEqual(solapesDe(asignacion({ id: null }), [previa]), []);
    });

    await t.test('PASA · sin vehículo asignado no se compara el vehículo', () => {
        const previa = asignacion({ id: 'a-1', cuadrillaId: 'c9' });
        const sinVehiculo = asignacion({ id: null, cuadrillaId: 'c8', vehiculoId: null });
        assert.deepEqual(solapesDe(sinVehiculo, [previa]), []);
    });

    await t.test('PASA · al EDITAR, no se detecta a sí misma', () => {
        const yaGuardada = asignacion({ id: 'a-1' });
        assert.deepEqual(solapesDe(asignacion({ id: 'a-1' }), [yaGuardada], 'a-1'), []);
    });

    await t.test('PASA · franjas que solo se tocan no dan solape', () => {
        const manana = asignacion({ id: 'a-1', horaInicio: '08:00', horaFin: '14:00' });
        const tarde = asignacion({ id: null, horaInicio: '14:00', horaFin: '18:00' });
        assert.deepEqual(solapesDe(tarde, [manana]), []);
    });
});

// -------------------------------------------------------------- ordenarPorHora

test('ordenarPorHora', async (t) => {
    await t.test('PASA · ordena por hora de inicio', () => {
        const lista = [
            asignacion({ id: 'c', horaInicio: '16:00' }),
            asignacion({ id: 'a', horaInicio: '08:00' }),
            asignacion({ id: 'b', horaInicio: '12:00' })
        ];
        assert.deepEqual(ordenarPorHora(lista).map((a) => a.id), ['a', 'b', 'c']);
    });
    await t.test('PASA · a igual hora, por nombre de cuadrilla', () => {
        const lista = [
            asignacion({ id: 'z', cuadrillaNombre: 'Zulú' }),
            asignacion({ id: 'a', cuadrillaNombre: 'Alfa' })
        ];
        assert.deepEqual(ordenarPorHora(lista).map((a) => a.id), ['a', 'z']);
    });
    await t.test('PASA · no muta el array recibido', () => {
        const lista = [asignacion({ id: 'b', horaInicio: '16:00' }), asignacion({ id: 'a', horaInicio: '08:00' })];
        ordenarPorHora(lista);
        assert.equal(lista[0].id, 'b');
    });
});

// ------------------------------------------------------------- filasDelTablero

test('filasDelTablero', async (t) => {
    const cuadrillas = [
        { id: 'c1', nombre: 'Cuadrilla A', operarios: [] },
        { id: 'c2', nombre: 'Cuadrilla B', operarios: [] }
    ];

    await t.test('PASA · una cuadrilla SIN trabajo también sale', () => {
        // Es justo lo que la oficina necesita ver de un vistazo.
        const filas = filasDelTablero(cuadrillas, [asignacion({ cuadrillaId: 'c1' })]);
        assert.equal(filas.length, 2);
        assert.equal(filas[1].cuadrilla.id, 'c2');
        assert.deepEqual(filas[1].asignaciones, []);
    });

    await t.test('PASA · agrupa y ordena dentro de cada fila', () => {
        const filas = filasDelTablero(cuadrillas, [
            asignacion({ id: 'tarde', cuadrillaId: 'c1', horaInicio: '15:00', horaFin: '19:00' }),
            asignacion({ id: 'manana', cuadrillaId: 'c1', horaInicio: '08:00', horaFin: '14:00' })
        ]);
        assert.deepEqual(filas[0].asignaciones.map((a) => a.id), ['manana', 'tarde']);
    });
});

// -------------------------------------------------------- correosDeCuadrilla

test('correosDeCuadrilla', async (t) => {
    await t.test('PASA · normaliza a minúsculas', () => {
        // correo() en las reglas devuelve el token ya en minúsculas: una mayúscula
        // suelta dejaría al operario sin ver su propia asignación.
        assert.deepEqual(correosDeCuadrilla([{ email: 'Juan@Empresa.COM' }]), ['juan@empresa.com']);
    });
    await t.test('PASA · quita espacios', () => {
        assert.deepEqual(correosDeCuadrilla([{ email: '  ana@x.com  ' }]), ['ana@x.com']);
    });
    await t.test('PASA · descarta vacíos y ausentes', () => {
        assert.deepEqual(correosDeCuadrilla([{ email: '' }, {}, { email: 'a@x.com' }]), ['a@x.com']);
    });
    await t.test('PASA · no repite', () => {
        assert.deepEqual(correosDeCuadrilla([{ email: 'a@x.com' }, { email: 'A@X.com' }]), ['a@x.com']);
    });
});

// ------------------------------------------------------- construirAsignacion

test('construirAsignacion', async (t) => {
    const cuadrilla = {
        id: 'c1',
        nombre: 'Cuadrilla A',
        operarios: [
            { trabajadorId: 't1', nombre: 'Juan', email: 'Juan@Empresa.com' },
            { trabajadorId: 't2', nombre: 'Ana', email: 'ana@empresa.com' }
        ]
    };

    await t.test('PASA · denormaliza los nombres junto a los ids', () => {
        const a = construirAsignacion({
            fecha: '2026-09-04', horaInicio: '08:00', horaFin: '14:00',
            cuadrilla, vehiculo: { id: 'v1', nombre: 'Furgoneta 1' },
            destinoTipo: 'obra', obra: { id: 'o1', nombre: 'Hotel Sol' },
            creadoPor: 'oficina@empresa.com'
        });
        assert.equal(a.cuadrillaId, 'c1');
        assert.equal(a.cuadrillaNombre, 'Cuadrilla A');
        assert.equal(a.vehiculoId, 'v1');
        assert.equal(a.vehiculoNombre, 'Furgoneta 1');
        assert.equal(a.obraId, 'o1');
        assert.equal(a.obraNombre, 'Hotel Sol');
    });

    await t.test('PASA · el array plano para las reglas sale normalizado', () => {
        const a = construirAsignacion({
            fecha: '2026-09-04', horaInicio: '08:00', horaFin: '14:00',
            cuadrilla, destinoTipo: 'taller', creadoPor: 'oficina@empresa.com'
        });
        assert.deepEqual(a.operarioEmails, ['juan@empresa.com', 'ana@empresa.com']);
    });

    await t.test('PASA · destino taller deja obraId y obraNombre en null', () => {
        const a = construirAsignacion({
            fecha: '2026-09-04', horaInicio: '08:00', horaFin: '14:00',
            cuadrilla, destinoTipo: 'taller',
            obra: { id: 'o1', nombre: 'Hotel Sol' },   // aunque se pase, se ignora
            creadoPor: 'oficina@empresa.com'
        });
        assert.equal(a.obraId, null);
        assert.equal(a.obraNombre, null);
    });

    await t.test('PASA · sin vehículo, los dos campos quedan en null', () => {
        const a = construirAsignacion({
            fecha: '2026-09-04', horaInicio: '08:00', horaFin: '14:00',
            cuadrilla, destinoTipo: 'taller', creadoPor: 'oficina@empresa.com'
        });
        assert.equal(a.vehiculoId, null);
        assert.equal(a.vehiculoNombre, null);
    });

    await t.test('PASA · nace planificado y sin parte', () => {
        const a = construirAsignacion({
            fecha: '2026-09-04', horaInicio: '08:00', horaFin: '14:00',
            cuadrilla, destinoTipo: 'taller', creadoPor: 'oficina@empresa.com'
        });
        assert.equal(a.estado, 'planificado');
        assert.equal(a.parteId, null);
    });
});

// --------------------------------------------------------- asignacionVigente

test('asignacionVigente', async (t) => {
    const manana = asignacion({ id: 'manana', horaInicio: '08:00', horaFin: '14:00' });
    const tarde = asignacion({ id: 'tarde', horaInicio: '15:00', horaFin: '19:00' });

    await t.test('PASA · sin asignaciones devuelve null', () => {
        assert.equal(asignacionVigente([], 600), null);
    });
    await t.test('PASA · devuelve la que está en curso', () => {
        assert.equal(asignacionVigente([manana, tarde], 10 * 60).id, 'manana');
    });
    await t.test('PASA · entre dos, devuelve la siguiente que empieza', () => {
        assert.equal(asignacionVigente([manana, tarde], 14 * 60 + 30).id, 'tarde');
    });
    await t.test('PASA · antes de empezar el día, devuelve la primera', () => {
        assert.equal(asignacionVigente([manana, tarde], 6 * 60).id, 'manana');
    });
    await t.test('PASA · si ya pasaron todas, devuelve la última', () => {
        // El operario que ficha tarde ve dónde estuvo, no una pantalla vacía.
        assert.equal(asignacionVigente([manana, tarde], 22 * 60).id, 'tarde');
    });
    await t.test('PASA · el fin es exclusivo: a las 14:00 ya no está en curso', () => {
        assert.equal(asignacionVigente([manana], 14 * 60).id, 'manana');
    });
});

// ----------------------------------------------------- destinoDeAsignacion

test('destinoDeAsignacion', async (t) => {
    await t.test('PASA · una obra da nombre e id', () => {
        assert.deepEqual(
            destinoDeAsignacion({ destinoTipo: 'obra', obraId: 'o1', obraNombre: 'Hotel Sol' }),
            { obra: 'Hotel Sol', obraId: 'o1' }
        );
    });
    await t.test('PASA · el TALLER escribe "Taller" y obraId null', () => {
        // El parte necesita un valor en `obra` porque las reglas lo exigen.
        assert.deepEqual(
            destinoDeAsignacion({ destinoTipo: 'taller', obraId: null, obraNombre: null }),
            { obra: 'Taller', obraId: null }
        );
    });
    await t.test('PASA · sin asignación no revienta', () => {
        assert.deepEqual(destinoDeAsignacion(null), { obra: '', obraId: null });
    });
});

// ------------------------------------------------ normalizarHorasReportadas

test('normalizarHorasReportadas', async (t) => {
    await t.test('PASA · un número normal pasa igual', () => {
        assert.equal(normalizarHorasReportadas(8), 8);
    });
    await t.test('PASA · acepta la coma decimal que teclea la gente', () => {
        assert.equal(normalizarHorasReportadas('4,5'), 4.5);
    });
    await t.test('PASA · redondea a la media hora', () => {
        assert.equal(normalizarHorasReportadas(3.7), 3.5);
        assert.equal(normalizarHorasReportadas(3.8), 4);
    });
    await t.test('PASA · vacío, texto y negativo dan 0', () => {
        assert.equal(normalizarHorasReportadas(''), 0);
        assert.equal(normalizarHorasReportadas('nada'), 0);
        assert.equal(normalizarHorasReportadas(-3), 0);
        assert.equal(normalizarHorasReportadas(undefined), 0);
    });
    await t.test('PASA · corta en 24: más de un día es un error de tecleo', () => {
        assert.equal(normalizarHorasReportadas(100), 24);
    });
});

// ---------------------------------------------------------- contrasteDeJornada

test('contrasteDeJornada', async (t) => {
    await t.test('PASA · una jornada normal no avisa', () => {
        const r = contrasteDeJornada(4, 4);
        assert.equal(r.total, 8);
        assert.equal(r.aviso, null);
    });
    await t.test('PASA · sin horas apuntadas no avisa', () => {
        assert.equal(contrasteDeJornada(0, 0).aviso, null);
    });
    await t.test('PASA · más de 12 h avisa, pero NO bloquea', () => {
        const r = contrasteDeJornada(8, 6);
        assert.equal(r.total, 14);
        assert.match(r.aviso, /14 h/);
    });
});
