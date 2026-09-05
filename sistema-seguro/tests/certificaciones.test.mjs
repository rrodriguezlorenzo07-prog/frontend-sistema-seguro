/**
 * Qué se congela dentro de una certificación. Sin emulador: node --test.
 *
 * La regla de oro que comprueba este fichero: de un parte hidratado no puede salir NADA
 * de lo que se paga. El PDF necesita nombres y materiales; las horas por persona viven
 * en validaciones/ y ahí se quedan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    albaranParaCertificacion,
    CAMPOS_DEL_ALBARAN,
    CLAVES_PROHIBIDAS,
    CLAVES_PROHIBIDAS_CUADRILLA
} from '../src/logica/certificaciones.js';

/** Un parte tal y como llega DESPUÉS de hidratarlo con validaciones/. */
const parteHidratado = () => ({
    id: 'p1',
    fecha: '04/09/2026',
    hora: '08:30',
    timestamp: 1757000000000,
    obra: 'Hotel Sol',
    obraId: 'o1',
    trabajo: '',
    tareasRealizadas: [{ ubicacion: 'Hab 101', descripcion: 'Puerta' }],
    materialesUsados: [{ nombre: 'Silicona', cantidad: 2, precio: 4.5 }],
    nombreTrabajador: 'Juan',
    trabajadorId: 't1',
    creador: 'juan@empresa.com',
    firma: 'firmas/abc123.png',
    estado: 'aprobado',
    fechaValidacion: '05/09/2026',
    certificado: false,
    facturado: false,
    papelera: false,
    asignacionId: 'asig-1',
    horasTaller: 4,
    horasCalle: 3.5,
    // Lo que mete hidratarPartes() desde validaciones/:
    cuadrilla: [
        { trabajadorId: 't1', nombre: 'Juan', horasExtra: 3, horas: 8 },
        { trabajadorId: 't2', nombre: 'Ana', horasExtra: 0, horas: 8 }
    ],
    horasExtraAsignadas: 3
});

test('albaranParaCertificacion', async (t) => {
    await t.test('PASA · no deja pasar ninguna clave salarial', () => {
        const a = albaranParaCertificacion(parteHidratado());
        for (const clave of CLAVES_PROHIBIDAS) {
            assert.ok(!(clave in a), `no debe llevar «${clave}»`);
        }
    });

    await t.test('PASA · la cuadrilla se queda en nombres, sin horas', () => {
        const a = albaranParaCertificacion(parteHidratado());
        assert.deepEqual(a.cuadrilla, [{ nombre: 'Juan' }, { nombre: 'Ana' }]);
        for (const op of a.cuadrilla) {
            for (const clave of CLAVES_PROHIBIDAS_CUADRILLA) {
                assert.ok(!(clave in op), `la cuadrilla no debe llevar «${clave}»`);
            }
        }
    });

    await t.test('PASA · congela el total de horas antes de perder el detalle', () => {
        // 2 personas x 8 h + 3 h extra = 19. Si se calculara DESPUÉS de quitar las
        // extras saldría 16, y la certificación diría menos de lo que se certificó.
        const a = albaranParaCertificacion(parteHidratado());
        assert.equal(a.horasTotales, 19);
    });

    await t.test('PASA · conserva lo que el PDF y la vista previa usan', () => {
        const a = albaranParaCertificacion(parteHidratado());
        assert.equal(a.fecha, '04/09/2026');
        assert.equal(a.obra, 'Hotel Sol');
        assert.equal(a.nombreTrabajador, 'Juan');
        assert.deepEqual(a.tareasRealizadas, [{ ubicacion: 'Hab 101', descripcion: 'Puerta' }]);
        assert.deepEqual(a.materialesUsados, [{ nombre: 'Silicona', cantidad: 2, precio: 4.5 }]);
    });

    await t.test('PASA · es una lista blanca: un campo nuevo no se cuela solo', () => {
        const conCampoNuevo = { ...parteHidratado(), salarioSecreto: 99999 };
        const a = albaranParaCertificacion(conCampoNuevo);
        assert.ok(!('salarioSecreto' in a));
        // Y solo salen las claves previstas.
        const permitidas = new Set([...CAMPOS_DEL_ALBARAN, 'cuadrilla', 'horasTotales']);
        for (const clave of Object.keys(a)) {
            assert.ok(permitidas.has(clave), `clave inesperada: ${clave}`);
        }
    });

    await t.test('PASA · un parte sin cuadrilla no revienta', () => {
        const sinCuadrilla = { ...parteHidratado(), cuadrilla: undefined };
        const a = albaranParaCertificacion(sinCuadrilla);
        assert.deepEqual(a.cuadrilla, []);
        assert.equal(a.horasTotales, 0);
    });

    await t.test('PASA · descarta entradas de cuadrilla sin nombre', () => {
        const raro = { ...parteHidratado(), cuadrilla: [{ horasExtra: 5 }, { nombre: 'Ana' }] };
        assert.deepEqual(albaranParaCertificacion(raro).cuadrilla, [{ nombre: 'Ana' }]);
    });
});
