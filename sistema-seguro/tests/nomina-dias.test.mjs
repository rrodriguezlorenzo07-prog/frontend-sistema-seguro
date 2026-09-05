/**
 * El modelo de días (esquema 2). Sin emulador: node --test.
 *
 * Lo que se comprueba aquí es aritmética que acaba en la nómina de alguien, así que las
 * trampas que importan son las de siempre: que un campo sin rellenar no se convierta en
 * un cero silencioso, y que restar más ausencias que días del mes no produzca un importe
 * negativo.
 *
 * El modelo VIEJO sigue probado más abajo: las liquidaciones cerradas con él se leen tal
 * cual y no se recalculan nunca.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DIAS_TRABAJABLES_MES, diasPagadosDelPeriodo, importeBaseDelPeriodo, tieneCategoria,
    HORAS_BASE_POR_DEFECTO, baseMensualDe, horasNormalesDelPeriodo
} from '../src/utils/nomina.js';

test('DIAS_TRABAJABLES_MES', async (t) => {
    await t.test('PASA · son 30 fijos, no los días reales del mes', () => {
        // Es la convención de la nómina española: salario mensual / 30. Contar los días
        // reales haría que febrero pagara menos que marzo con la misma tarifa.
        assert.equal(DIAS_TRABAJABLES_MES, 30);
    });
});

test('diasPagadosDelPeriodo', async (t) => {
    await t.test('PASA · un mes sin ausencias se paga entero', () => {
        assert.equal(diasPagadosDelPeriodo(30, 0), 30);
    });
    await t.test('PASA · resta las ausencias', () => {
        assert.equal(diasPagadosDelPeriodo(30, 3), 27);
    });
    await t.test('PASA · nunca baja de cero', () => {
        // Con más ausencias que días del mes, el importe no puede salir negativo.
        assert.equal(diasPagadosDelPeriodo(30, 45), 0);
    });
    await t.test('PASA · lo que no es un número cuenta como cero, no revienta', () => {
        assert.equal(diasPagadosDelPeriodo(30, undefined), 30);
        assert.equal(diasPagadosDelPeriodo(30, null), 30);
        assert.equal(diasPagadosDelPeriodo(undefined, 0), 0);
    });
});

test('importeBaseDelPeriodo', async (t) => {
    await t.test('PASA · días por tarifa', () => {
        assert.equal(importeBaseDelPeriodo(30, 64), 1920);
        assert.equal(importeBaseDelPeriodo(27, 64), 1728);
    });
    await t.test('PASA · admite tarifas con decimales', () => {
        assert.equal(importeBaseDelPeriodo(30, 95.4), 2862);
    });
    await t.test('PASA · sin días o sin tarifa, cero', () => {
        assert.equal(importeBaseDelPeriodo(0, 64), 0);
        assert.equal(importeBaseDelPeriodo(30, 0), 0);
    });
});

test('tieneCategoria', async (t) => {
    await t.test('PASA · con id asignado, sí', () => {
        assert.equal(tieneCategoria({ categoriaId: 'c1' }), true);
    });
    await t.test('PASA · sin ella, no — y no hay valor por defecto', () => {
        // Es lo que bloquea el cierre. Un defecto silencioso liquidaría a 0 € a alguien
        // por un campo sin rellenar, y eso se descubre en la nómina.
        assert.equal(tieneCategoria({}), false);
        assert.equal(tieneCategoria({ categoriaId: null }), false);
        assert.equal(tieneCategoria({ categoriaId: '' }), false);
        assert.equal(tieneCategoria(null), false);
    });
});

test('el modelo de horas (esquema 1) sigue intacto', async (t) => {
    await t.test('PASA · las liquidaciones viejas se siguen pudiendo leer igual', () => {
        // Estas funciones NO se han tocado: un cierre de esquema 1 se lee con ellas y da
        // exactamente lo que dio el día que se emitió.
        assert.equal(HORAS_BASE_POR_DEFECTO, 160);
        assert.equal(baseMensualDe({ horasBaseMensuales: 152 }), 152);
        assert.equal(baseMensualDe({}), 160);
        assert.equal(horasNormalesDelPeriodo(160, 2), 144);
        assert.equal(horasNormalesDelPeriodo(160, 100), 0);
    });
});

test('el cálculo completo, como lo hace la pantalla', async (t) => {
    /** Réplica de lo que hace ControlNominas para una persona. */
    const liquidar = ({ tarifaDiaria, tarifaHoraExtra, ausencias, horasExtra, tarifaExtraManual }) => {
        const diasPagados = diasPagadosDelPeriodo(DIAS_TRABAJABLES_MES, ausencias);
        const importeBase = importeBaseDelPeriodo(diasPagados, tarifaDiaria);
        const tarifaE = tarifaExtraManual ?? tarifaHoraExtra;
        return { diasPagados, importeBase, importeExtra: horasExtra * tarifaE, total: importeBase + horasExtra * tarifaE };
    };

    await t.test('PASA · mes limpio, sin ausencias ni extras', () => {
        const r = liquidar({ tarifaDiaria: 64, tarifaHoraExtra: 14, ausencias: 0, horasExtra: 0 });
        assert.equal(r.diasPagados, 30);
        assert.equal(r.importeBase, 1920);
        assert.equal(r.total, 1920);
    });

    await t.test('PASA · con dos ausencias y cinco horas extra', () => {
        const r = liquidar({ tarifaDiaria: 64, tarifaHoraExtra: 14, ausencias: 2, horasExtra: 5 });
        assert.equal(r.diasPagados, 28);
        assert.equal(r.importeBase, 1792);      // 28 × 64
        assert.equal(r.importeExtra, 70);       // 5 × 14
        assert.equal(r.total, 1862);
    });

    await t.test('PASA · el ajuste manual de tarifa extra manda sobre la categoría', () => {
        // La cadena de prioridad no cambia: lo único que cambió es el último eslabón.
        const r = liquidar({ tarifaDiaria: 64, tarifaHoraExtra: 14, ausencias: 0, horasExtra: 10, tarifaExtraManual: 20 });
        assert.equal(r.importeExtra, 200);
        assert.equal(r.total, 2120);
    });

    await t.test('PASA · un mes entero de ausencias no paga base, pero sí las extras', () => {
        const r = liquidar({ tarifaDiaria: 64, tarifaHoraExtra: 14, ausencias: 30, horasExtra: 4 });
        assert.equal(r.diasPagados, 0);
        assert.equal(r.importeBase, 0);
        assert.equal(r.total, 56);
    });
});
