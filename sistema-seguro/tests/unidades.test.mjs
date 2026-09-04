/**
 * Lectura de unidades de obra. Sin emulador:
 *   node --test tests/unidades.test.mjs
 *
 * ESTA ES LA PIEZA QUE TOCA DINERO. La misma función que ayuda al operario a proponer
 * qué cerró es la que decide cuántas unidades factura una partida, así que un error aquí
 * sale en una factura.
 *
 * Los casos no son inventados: salen de las ubicaciones que los operarios han escrito de
 * verdad en producción, incluida la partida real de once habitaciones que hasta ahora se
 * facturaba como una.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    leerUnidades,
    cantidadDeLinea,
    resumirNumeros,
    previsualizarPropuesta,
    unidadesDesdeLinea
} from '../src/logica/unidades.js';

// ================================================== casos reales de producción

test('los textos que los operarios escriben de verdad', async (t) => {
    await t.test('PASA · "Habitaciones 100-110" son ONCE, no una', () => {
        // La partida real: [Habitaciones 100-110] Instalación de puerta de paso,
        // facturada hasta ahora con cantidad 1.
        const r = leerUnidades('Habitaciones 100-110');
        assert.equal(r.cantidad, 11);
        assert.equal(r.numeros[0], 100);
        assert.equal(r.numeros[10], 110);
    });

    await t.test('PASA · "Habitacion 100 a la 200" son 101', () => {
        assert.equal(leerUnidades('Habitacion 100 a la 200').cantidad, 101);
    });

    await t.test('PASA · "Habitaciones 102-105" son cuatro', () => {
        assert.equal(leerUnidades('Habitaciones 102-105').cantidad, 4);
    });

    await t.test('PASA · "100-110" sin la palabra también', () => {
        assert.equal(leerUnidades('100-110').cantidad, 11);
    });

    await t.test('PASA · "barandilla" NO es contable, y no se inventa', () => {
        const r = leerUnidades('barandilla');
        assert.equal(r.reconocido, false);
        assert.equal(r.motivo, 'sin-numeros');
        assert.deepEqual(r.numeros, []);
    });

    await t.test('PASA · "103" suelto es una', () => {
        assert.deepEqual(leerUnidades('103').numeros, [103]);
    });
});

// ================================================================ formas de escribir

test('leerUnidades · formas de escribir un rango', async (t) => {
    const eleven = ['100-110', '100 a 110', '100 a la 110', '100 al 110',
                    '100 hasta 110', '100–110', '100/110'];
    for (const texto of eleven) {
        await t.test(`PASA · "${texto}" son 11`, () => {
            assert.equal(leerUnidades(texto).cantidad, 11);
        });
    }

    await t.test('PASA · el rango al revés se entiende igual', () => {
        assert.equal(leerUnidades('110-100').cantidad, 11);
    });

    await t.test('PASA · con tildes y mayúsculas', () => {
        assert.equal(leerUnidades('HABITACIÓN 101 A LA 105').cantidad, 5);
    });

    await t.test('PASA · números sueltos separados por comas', () => {
        assert.deepEqual(leerUnidades('101, 103, 105').numeros, [101, 103, 105]);
    });

    await t.test('PASA · rango MÁS sueltos', () => {
        assert.deepEqual(leerUnidades('100-102, 110').numeros, [100, 101, 102, 110]);
    });

    await t.test('PASA · no cuenta dos veces los extremos del rango', () => {
        // "100-102" no debe dar [100,101,102,100,102].
        assert.deepEqual(leerUnidades('100-102').numeros, [100, 101, 102]);
    });

    await t.test('PASA · repetidos se colapsan', () => {
        assert.deepEqual(leerUnidades('101, 101, 101').numeros, [101]);
    });
});

test('leerUnidades · lo que NO se puede leer', async (t) => {
    await t.test('PASA · texto vacío', () => {
        assert.equal(leerUnidades('').reconocido, false);
        assert.equal(leerUnidades('   ').motivo, 'vacio');
    });
    await t.test('PASA · tecleo de prueba sin números', () => {
        for (const basura of ['fdsa', 'gfds', 'cx<', 'puchil']) {
            assert.equal(leerUnidades(basura).reconocido, false);
        }
    });
    await t.test('PASA · un rango inverosímil se rechaza en vez de generar miles', () => {
        // "1-99999" no es un encargo, es un error de tecleo.
        const r = leerUnidades('1-99999');
        assert.equal(r.reconocido, false);
        assert.equal(r.motivo, 'rango-inverosimil');
        assert.equal(r.cantidad, 0);
    });
    await t.test('PASA · el tope deja pasar un rango grande pero creíble', () => {
        assert.equal(leerUnidades('1-500').cantidad, 500);
    });
});

// ============================================================== cantidadDeLinea

test('cantidadDeLinea · lo que acaba en la factura', async (t) => {
    await t.test('PASA · las once habitaciones facturan 11', () => {
        const r = cantidadDeLinea('Habitaciones 100-110');
        assert.equal(r.cantidad, 11);
        assert.equal(r.revisar, false);
        assert.match(r.detalle, /11 unidades/);
    });

    await t.test('PASA · una sola unidad no pide revisión', () => {
        const r = cantidadDeLinea('Habitacion 101');
        assert.equal(r.cantidad, 1);
        assert.equal(r.revisar, false);
    });

    await t.test('PASA · CAE A 1 cuando no entiende, como antes', () => {
        // Es la regla que no se negocia: no inventar un número.
        const r = cantidadDeLinea('barandilla');
        assert.equal(r.cantidad, 1);
        assert.equal(r.revisar, true);
    });

    await t.test('PASA · y MARCA para revisar, que es lo nuevo', () => {
        assert.equal(cantidadDeLinea('fdsa').revisar, true);
        assert.equal(cantidadDeLinea('').revisar, true);
        assert.equal(cantidadDeLinea('1-99999').revisar, true);
    });

    await t.test('PASA · nunca devuelve 0: una línea siempre factura algo', () => {
        for (const texto of ['', 'barandilla', 'fdsa', '1-99999', 'Hab 101']) {
            assert.ok(cantidadDeLinea(texto).cantidad >= 1, `falló con "${texto}"`);
        }
    });
});

// =============================================================== resumirNumeros

test('resumirNumeros', async (t) => {
    await t.test('PASA · vuelve a plegar un tramo seguido', () => {
        assert.equal(resumirNumeros([100, 101, 102]), '100–102');
    });
    await t.test('PASA · separa los tramos que no se tocan', () => {
        assert.equal(resumirNumeros([100, 101, 102, 105]), '100–102, 105');
    });
    await t.test('PASA · números sueltos', () => {
        assert.equal(resumirNumeros([101, 103, 105]), '101, 103, 105');
    });
    await t.test('PASA · uno solo', () => {
        assert.equal(resumirNumeros([101]), '101');
    });
    await t.test('PASA · lista vacía', () => {
        assert.equal(resumirNumeros([]), '');
    });
});

// ========================================================= previsualizarPropuesta

test('previsualizarPropuesta · lo que ve el operario al teclear', async (t) => {
    await t.test('PASA · sin escribir nada, no hay resumen', () => {
        assert.equal(previsualizarPropuesta('').valido, false);
    });
    await t.test('PASA · un rango se resume contando', () => {
        const p = previsualizarPropuesta('100-110');
        assert.equal(p.cantidad, 11);
        assert.match(p.resumen, /11 unidades/);
    });
    await t.test('PASA · una unidad se dice en singular', () => {
        assert.match(previsualizarPropuesta('101').resumen, /1 unidad: la 101/);
    });
    await t.test('PASA · sin números SE ADMITE igual: "barandilla" es trabajo real', () => {
        const p = previsualizarPropuesta('barandilla');
        assert.equal(p.valido, true);
        assert.equal(p.cantidad, 1);
        assert.match(p.resumen, /Sin numerar/);
    });
});

// =========================================================== unidadesDesdeLinea

test('unidadesDesdeLinea · un documento por unidad', async (t) => {
    const base = {
        obraId: 'o1', obraNombre: 'Hotel Sol', parteId: 'p1',
        descripcion: 'Puerta de paso', propuestaPor: 'Juan@Empresa.com'
    };

    await t.test('PASA · un rango de 11 da ONCE documentos', () => {
        // Uno por unidad, para poder confirmar ocho y dejar tres pendientes.
        const u = unidadesDesdeLinea({ ...base, ubicacion: 'Habitaciones 100-110' });
        assert.equal(u.length, 11);
        assert.equal(u[0].numero, 100);
        assert.equal(u[10].numero, 110);
    });

    await t.test('PASA · todos nacen como propuesta y sin confirmar', () => {
        const u = unidadesDesdeLinea({ ...base, ubicacion: '101' });
        assert.equal(u[0].estado, 'propuesta');
        assert.equal(u[0].confirmadaPor, null);
        assert.equal(u[0].confirmadaEn, null);
        assert.equal(typeof u[0].propuestaEn, 'number');
    });

    await t.test('PASA · el correo del proponente se normaliza', () => {
        const u = unidadesDesdeLinea({ ...base, ubicacion: '101' });
        assert.equal(u[0].propuestaPor, 'juan@empresa.com');
    });

    await t.test('PASA · guarda el texto original tal cual lo escribió', () => {
        const u = unidadesDesdeLinea({ ...base, ubicacion: '  Habitaciones 100-102  ' });
        assert.equal(u[0].textoOriginal, 'Habitaciones 100-102');
    });

    await t.test('PASA · "barandilla" da UNA unidad con su propio nombre', () => {
        const u = unidadesDesdeLinea({ ...base, ubicacion: 'barandilla' });
        assert.equal(u.length, 1);
        assert.equal(u[0].nombre, 'barandilla');
        assert.equal(u[0].numero, null);
    });

    await t.test('PASA · arrastra obra y parte a cada documento', () => {
        const u = unidadesDesdeLinea({ ...base, ubicacion: '100-101' });
        for (const unidad of u) {
            assert.equal(unidad.obraId, 'o1');
            assert.equal(unidad.obraNombre, 'Hotel Sol');
            assert.equal(unidad.parteId, 'p1');
        }
    });

    await t.test('PASA · una obra escrita a mano deja obraId en null sin romper', () => {
        const u = unidadesDesdeLinea({ ...base, obraId: null, obraNombre: null, ubicacion: '101' });
        assert.equal(u[0].obraId, null);
        assert.equal(u.length, 1);
    });
});
