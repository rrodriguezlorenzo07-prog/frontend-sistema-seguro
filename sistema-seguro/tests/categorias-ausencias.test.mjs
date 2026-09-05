/**
 * Categorías y ausencias, la lógica sola. Sin emulador: node --test.
 *
 * Lo que más importa aquí: que una ausencia NO se pueda registrar en fin de semana. Es
 * la pieza que hace viable el modelo de días naturales sin calendario laboral, y se
 * prueba con las trampas de siempre —el huso horario que desplaza un día, el 31 de
 * febrero, la coma decimal—.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizarTarifa, validarCategoria, construirCategoria, cambiosDeCategoria,
    categoriasActivas, categoriaDe, usoDeCategoria
} from '../src/logica/categorias.js';

import {
    TIPOS, fechaLocal, esFinDeSemana, nombreDelDia,
    validarAusencia, construirAusencia, contarPorTrabajador, ausenciasDe
} from '../src/logica/ausencias.js';

// =========================================================== categorías
test('normalizarTarifa', async (t) => {
    await t.test('PASA · un número normal', () => {
        assert.equal(normalizarTarifa('95.40'), 95.4);
        assert.equal(normalizarTarifa(95.4), 95.4);
    });
    await t.test('PASA · acepta la coma decimal que teclea la gente', () => {
        assert.equal(normalizarTarifa('95,40'), 95.4);
    });
    await t.test('PASA · cero es válido: una categoría sin importe aún', () => {
        assert.equal(normalizarTarifa('0'), 0);
    });
    await t.test('PASA · lo que no es un número da NaN, NO cero', () => {
        // Un 0 silencioso convertiría «me equivoqué tecleando» en «este día no se paga».
        for (const malo of ['', '  ', 'abc', '9,9,9', '-5', null, undefined]) {
            assert.ok(Number.isNaN(normalizarTarifa(malo)), `${malo} debería dar NaN`);
        }
    });
});

test('validarCategoria', async (t) => {
    const ok = { nombre: 'Oficial 1ª', tarifaDiaria: '95,40', tarifaHoraExtra: '14,20' };

    await t.test('PASA · una categoría bien formada', () => {
        assert.equal(validarCategoria(ok).valida, true);
    });
    await t.test('PASA · exige nombre', () => {
        assert.equal(validarCategoria({ ...ok, nombre: '   ' }).valida, false);
    });
    await t.test('PASA · exige que las dos tarifas sean números', () => {
        assert.equal(validarCategoria({ ...ok, tarifaDiaria: 'mucho' }).valida, false);
        assert.equal(validarCategoria({ ...ok, tarifaHoraExtra: '' }).valida, false);
    });
    await t.test('PASA · rechaza un nombre repetido, sin distinguir mayúsculas', () => {
        const existentes = [{ id: 'c1', nombre: 'Oficial 1ª', papelera: false }];
        assert.equal(validarCategoria(ok, existentes).valida, false);
        assert.equal(validarCategoria({ ...ok, nombre: 'oficial 1ª' }, existentes).valida, false);
    });
    await t.test('PASA · al editarse a sí misma no se considera duplicada', () => {
        const existentes = [{ id: 'c1', nombre: 'Oficial 1ª', papelera: false }];
        assert.equal(validarCategoria(ok, existentes, 'c1').valida, true);
    });
    await t.test('PASA · una en la papelera no bloquea el nombre', () => {
        const existentes = [{ id: 'c1', nombre: 'Oficial 1ª', papelera: true }];
        assert.equal(validarCategoria(ok, existentes).valida, true);
    });
});

test('construirCategoria y cambiosDeCategoria', async (t) => {
    await t.test('PASA · normaliza las tarifas y deja rastro', () => {
        const c = construirCategoria({ nombre: '  Peón  ', tarifaDiaria: '78,10', tarifaHoraExtra: '11,90', creadoPor: 'jefa@empresa.com' });
        assert.equal(c.nombre, 'Peón');
        assert.equal(c.tarifaDiaria, 78.1);
        assert.equal(c.tarifaHoraExtra, 11.9);
        assert.equal(c.papelera, false);
        assert.equal(c.creadoPor, 'jefa@empresa.com');
        assert.equal(c.actualizadoPor, 'jefa@empresa.com');
        assert.ok(c.creadoEn > 0 && c.actualizadoEn > 0);
    });
    await t.test('PASA · al editar no se toca creadoEn/creadoPor', () => {
        const cambios = cambiosDeCategoria({ nombre: 'Peón', tarifaDiaria: '80', tarifaHoraExtra: '12', actualizadoPor: 'otro@empresa.com' });
        assert.ok(!('creadoEn' in cambios));
        assert.ok(!('creadoPor' in cambios));
        assert.equal(cambios.actualizadoPor, 'otro@empresa.com');
    });
});

test('categoriasActivas, categoriaDe y usoDeCategoria', async (t) => {
    const cats = [
        { id: 'c2', nombre: 'Peón', papelera: false },
        { id: 'c1', nombre: 'Oficial 1ª', papelera: false },
        { id: 'c3', nombre: 'Vieja', papelera: true }
    ];
    await t.test('PASA · quita la papelera y ordena por nombre', () => {
        assert.deepEqual(categoriasActivas(cats).map((c) => c.id), ['c1', 'c2']);
    });
    await t.test('PASA · resuelve por id, nunca por nombre', () => {
        assert.equal(categoriaDe({ categoriaId: 'c2' }, cats).nombre, 'Peón');
        assert.equal(categoriaDe({ categoriaId: null }, cats), null);
        assert.equal(categoriaDe({}, cats), null);
        // Aunque el nombre desnormalizado esté desfasado, manda el id.
        assert.equal(categoriaDe({ categoriaId: 'c1', categoriaNombre: 'Peón' }, cats).nombre, 'Oficial 1ª');
    });
    await t.test('PASA · cuenta cuántos la usan', () => {
        const trabajadores = [{ categoriaId: 'c1' }, { categoriaId: 'c1' }, { categoriaId: 'c2' }, {}];
        assert.equal(usoDeCategoria('c1', trabajadores), 2);
        assert.equal(usoDeCategoria('c9', trabajadores), 0);
    });
});

// ============================================================ ausencias
test('fechaLocal', async (t) => {
    await t.test('PASA · una fecha normal, en hora LOCAL', () => {
        const f = fechaLocal('2026-09-05');
        assert.equal(f.getFullYear(), 2026);
        assert.equal(f.getMonth(), 8);
        assert.equal(f.getDate(), 5);
        // new Date('2026-09-05') sería medianoche UTC y en España puede caer el día 4.
        assert.notEqual(f.getTime(), new Date('2026-09-05').getTime());
    });
    await t.test('PASA · rechaza lo que no es una fecha', () => {
        for (const malo of ['', '5/9/2026', '2026-9-5', 'ayer', null]) {
            assert.equal(fechaLocal(malo), null, `${malo} debería ser null`);
        }
    });
    await t.test('PASA · rechaza un día que no existe en vez de desplazarlo', () => {
        // JavaScript convertiría el 31 de febrero en el 3 de marzo sin decir nada.
        assert.equal(fechaLocal('2026-02-31'), null);
        assert.equal(fechaLocal('2026-13-01'), null);
    });
});

test('esFinDeSemana', async (t) => {
    // 2026-09-05 es sábado y 2026-09-06 domingo.
    await t.test('PASA · sábado y domingo', () => {
        assert.equal(esFinDeSemana('2026-09-05'), true);
        assert.equal(esFinDeSemana('2026-09-06'), true);
    });
    await t.test('PASA · de lunes a viernes, no', () => {
        for (const d of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
            assert.equal(esFinDeSemana(d), false, `${d} no es fin de semana`);
        }
    });
    await t.test('PASA · nombra el día para poder explicarlo', () => {
        assert.equal(nombreDelDia('2026-09-05'), 'sábado');
        assert.equal(nombreDelDia('2026-09-07'), 'lunes');
    });
});

test('validarAusencia', async (t) => {
    const ok = { trabajadorId: 't1', fecha: '2026-09-07', tipo: 'falta' };

    await t.test('PASA · un martes normal vale', () => {
        assert.equal(validarAusencia(ok).valida, true);
    });
    await t.test('PASA · SÁBADO rechazado, y dice por qué', () => {
        const r = validarAusencia({ ...ok, fecha: '2026-09-05' });
        assert.equal(r.valida, false);
        assert.match(r.motivo, /sábado/);
    });
    await t.test('PASA · DOMINGO rechazado', () => {
        const r = validarAusencia({ ...ok, fecha: '2026-09-06' });
        assert.equal(r.valida, false);
        assert.match(r.motivo, /domingo/);
    });
    await t.test('PASA · exige trabajador y fecha válida', () => {
        assert.equal(validarAusencia({ ...ok, trabajadorId: '' }).valida, false);
        assert.equal(validarAusencia({ ...ok, fecha: 'nunca' }).valida, false);
    });
    await t.test('PASA · rechaza un tipo inventado', () => {
        assert.equal(validarAusencia({ ...ok, tipo: 'sabático' }).valida, false);
    });
    await t.test('PASA · no admite dos veces el mismo día y persona', () => {
        // Descontaría dos jornadas por una.
        const existentes = [{ trabajadorId: 't1', fecha: '2026-09-07' }];
        assert.equal(validarAusencia(ok, existentes).valida, false);
        // Otra persona el mismo día sí.
        assert.equal(validarAusencia({ ...ok, trabajadorId: 't2' }, existentes).valida, true);
    });
});

test('construirAusencia', async (t) => {
    await t.test('PASA · desnormaliza el nombre y deja rastro', () => {
        const a = construirAusencia({
            trabajadorId: 't1', trabajadorNombre: ' Juan ', fecha: '2026-09-07',
            tipo: 'vacaciones', motivo: ' playa ', creadoPor: 'jefa@empresa.com'
        });
        assert.equal(a.trabajadorNombre, 'Juan');
        assert.equal(a.tipo, 'vacaciones');
        assert.equal(a.motivo, 'playa');
        assert.equal(a.creadoPor, 'jefa@empresa.com');
        assert.ok(a.creadoEn > 0);
    });
    await t.test('PASA · un tipo desconocido cae en «falta», no revienta', () => {
        const a = construirAusencia({ trabajadorId: 't1', fecha: '2026-09-07', tipo: 'raro', creadoPor: 'x' });
        assert.equal(a.tipo, 'falta');
        assert.ok(TIPOS.includes(a.tipo));
    });
});

test('contarPorTrabajador y ausenciasDe', async (t) => {
    const lista = [
        { trabajadorId: 't1', fecha: '2026-09-07' },
        { trabajadorId: 't1', fecha: '2026-09-08' },
        { trabajadorId: 't1', fecha: '2026-10-01' },   // fuera del rango
        { trabajadorId: 't2', fecha: '2026-09-09' }
    ];
    await t.test('PASA · cuenta solo las del rango', () => {
        assert.deepEqual(contarPorTrabajador(lista, '2026-09-01', '2026-09-30'), { t1: 2, t2: 1 });
    });
    await t.test('PASA · sin rango, cuenta todas', () => {
        assert.deepEqual(contarPorTrabajador(lista, '', ''), { t1: 3, t2: 1 });
    });
    await t.test('PASA · las de una persona, de la más reciente a la más antigua', () => {
        assert.deepEqual(ausenciasDe(lista, 't1').map((a) => a.fecha),
                         ['2026-10-01', '2026-09-08', '2026-09-07']);
    });
});
