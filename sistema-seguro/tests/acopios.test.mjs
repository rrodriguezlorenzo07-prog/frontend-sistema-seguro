/**
 * Máquina de estados de los acopios. Sin emulador:
 *   node --test tests/acopios.test.mjs
 *
 * AQUÍ es donde se prueba el ORDEN de los estados, no en las reglas. Las reglas
 * comprueban quién escribe y qué campos toca; esto comprueba que nadie marque «listo»
 * algo que aún no ha llegado al almacén — que es el error honesto que de verdad va a
 * pasar, con guantes y con prisa.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ESTADOS,
    cadenaDe,
    transicionValida,
    siguienteEstado,
    cambioDeEstado,
    estaListo,
    loQueFalta,
    agruparPorObra,
    trocearParaConsulta,
    construirAcopio,
    normalizarCantidad
} from '../src/logica/acopios.js';

const acopio = (extra = {}) => ({
    obraId: 'o1', obraNombre: 'Hotel Sol',
    materialId: null, materialNombre: 'Perfil 40x20',
    cantidad: 3.5, unidad: 'ml',
    requiereFabricacion: true,
    estado: 'pendiente', historial: [],
    ...extra
});

// ================================================================== la cadena

test('cadenaDe · el recorrido depende de si se fabrica (A2)', async (t) => {
    await t.test('PASA · un perfil a medida pasa por fabricado', () => {
        assert.deepEqual(cadenaDe(true), ['pendiente', 'fabricado', 'recepcionado', 'listo']);
    });
    await t.test('PASA · un tornillo NO: solo se recepciona', () => {
        assert.deepEqual(cadenaDe(false), ['pendiente', 'recepcionado', 'listo']);
    });
});

// ============================================== EL ORDEN, que es lo que importa

test('transicionValida · con fabricación', async (t) => {
    const req = true;

    await t.test('PASA · pendiente → fabricado', () => {
        assert.equal(transicionValida('pendiente', 'fabricado', req).valida, true);
    });
    await t.test('PASA · fabricado → recepcionado', () => {
        assert.equal(transicionValida('fabricado', 'recepcionado', req).valida, true);
    });
    await t.test('PASA · recepcionado → listo', () => {
        assert.equal(transicionValida('recepcionado', 'listo', req).valida, true);
    });

    await t.test('PASA · NO se puede marcar listo sin recepcionar', () => {
        // El caso que pediste explícitamente.
        const r = transicionValida('fabricado', 'listo', req);
        assert.equal(r.valida, false);
        assert.match(r.motivo, /Recepcionado/);
    });
    await t.test('PASA · NO se salta de pendiente a listo', () => {
        const r = transicionValida('pendiente', 'listo', req);
        assert.equal(r.valida, false);
        assert.match(r.motivo, /Fabricado/);
    });
    await t.test('PASA · NO se salta de pendiente a recepcionado si se fabrica', () => {
        assert.equal(transicionValida('pendiente', 'recepcionado', req).valida, false);
    });
});

test('transicionValida · sin fabricación', async (t) => {
    const req = false;

    await t.test('PASA · pendiente → recepcionado, saltándose fabricado', () => {
        assert.equal(transicionValida('pendiente', 'recepcionado', req).valida, true);
    });
    await t.test('PASA · recepcionado → listo', () => {
        assert.equal(transicionValida('recepcionado', 'listo', req).valida, true);
    });
    await t.test('PASA · «fabricado» se RECHAZA: este acopio no se fabrica', () => {
        const r = transicionValida('pendiente', 'fabricado', req);
        assert.equal(r.valida, false);
        assert.match(r.motivo, /no requiere fabricación/);
    });
    await t.test('PASA · sigue sin poder saltar a listo', () => {
        assert.equal(transicionValida('pendiente', 'listo', req).valida, false);
    });
});

test('transicionValida · casos límite', async (t) => {
    await t.test('PASA · retroceder SÍ vale: corregir un dedo torpe', () => {
        // Decisión de criterio, explicada en el módulo: obligar a llamar a oficina
        // convertiría un despiste de tres segundos en una llamada de tres minutos.
        assert.equal(transicionValida('listo', 'recepcionado', true).valida, true);
        assert.equal(transicionValida('listo', 'pendiente', true).valida, true);
    });
    await t.test('PASA · quedarse en el mismo estado no es una transición', () => {
        const r = transicionValida('recepcionado', 'recepcionado', true);
        assert.equal(r.valida, false);
        assert.match(r.motivo, /Ya está/);
    });
    await t.test('PASA · un estado inventado se rechaza', () => {
        const r = transicionValida('pendiente', 'entregado', true);
        assert.equal(r.valida, false);
        assert.match(r.motivo, /no es un estado/);
    });
    await t.test('PASA · partir de un estado inválido se rechaza', () => {
        assert.equal(transicionValida('inventado', 'listo', true).valida, false);
    });
});

// ============================================================ siguienteEstado

test('siguienteEstado', async (t) => {
    await t.test('PASA · con fabricación, lo siguiente es fabricar', () => {
        assert.equal(siguienteEstado(acopio()), 'fabricado');
    });
    await t.test('PASA · sin fabricación, lo siguiente es recepcionar', () => {
        assert.equal(siguienteEstado(acopio({ requiereFabricacion: false })), 'recepcionado');
    });
    await t.test('PASA · desde listo no hay siguiente', () => {
        assert.equal(siguienteEstado(acopio({ estado: 'listo' })), null);
    });
    await t.test('PASA · un acopio roto no revienta', () => {
        assert.equal(siguienteEstado(null), null);
        assert.equal(siguienteEstado(acopio({ estado: 'raro' })), null);
    });
});

// ============================================================= cambioDeEstado

test('cambioDeEstado', async (t) => {
    await t.test('PASA · devuelve los campos a escribir', () => {
        const r = cambioDeEstado(acopio(), 'fabricado', 'Juan@Empresa.com');
        assert.equal(r.motivo, null);
        assert.equal(r.cambios.estado, 'fabricado');
        assert.equal(r.cambios.actualizadoPor, 'juan@empresa.com');
        assert.equal(typeof r.cambios.actualizadoEn, 'number');
    });

    await t.test('PASA · añade el salto al historial sin perder los anteriores', () => {
        const previo = acopio({
            estado: 'fabricado',
            historial: [{ estado: 'fabricado', en: 1, por: 'ana@empresa.com' }]
        });
        const r = cambioDeEstado(previo, 'recepcionado', 'juan@empresa.com');
        assert.equal(r.cambios.historial.length, 2);
        assert.equal(r.cambios.historial[0].por, 'ana@empresa.com');
        assert.equal(r.cambios.historial[1].estado, 'recepcionado');
    });

    await t.test('PASA · una transición inválida devuelve null y el motivo', () => {
        const r = cambioDeEstado(acopio(), 'listo', 'juan@empresa.com');
        assert.equal(r.cambios, null);
        assert.match(r.motivo, /Fabricado/);
    });

    await t.test('PASA · NO devuelve obraId, materialId ni cantidad', () => {
        // Son justo los campos que las reglas prohíben tocar al operario: si la lógica
        // los incluyera, la escritura fallaría entera contra Firestore.
        const r = cambioDeEstado(acopio(), 'fabricado', 'juan@empresa.com');
        for (const prohibido of ['obraId', 'materialId', 'cantidad', 'unidad', 'requiereFabricacion']) {
            assert.equal(prohibido in r.cambios, false, `no debe tocar ${prohibido}`);
        }
    });
});

// ================================================== lo que FALTA, no lo listo

test('loQueFalta · el aviso que evita un viaje en balde (A4)', async (t) => {
    await t.test('PASA · todo listo no genera aviso', () => {
        const r = loQueFalta([acopio({ estado: 'listo' }), acopio({ estado: 'listo' })]);
        assert.equal(r.faltan, 0);
        assert.equal(r.resumen, null);
    });

    await t.test('PASA · cuenta lo que NO está listo', () => {
        const r = loQueFalta([
            acopio({ estado: 'listo' }),
            acopio({ estado: 'recepcionado' }),
            acopio({ estado: 'pendiente' })
        ]);
        assert.equal(r.faltan, 2);
        assert.equal(r.total, 3);
    });

    await t.test('PASA · nombra el estado MÁS ATRASADO, que marca cuándo estará todo', () => {
        const r = loQueFalta([acopio({ estado: 'pendiente' }), acopio({ estado: 'recepcionado' })]);
        assert.match(r.resumen, /sin preparar/);
    });

    await t.test('PASA · singular y plural', () => {
        assert.match(loQueFalta([acopio({ estado: 'pendiente' })]).resumen, /^1 acopio /);
        assert.match(loQueFalta([acopio({ estado: 'pendiente' }), acopio({ estado: 'pendiente' })]).resumen, /^2 acopios /);
    });

    await t.test('PASA · una obra sin acopios no avisa de nada', () => {
        assert.equal(loQueFalta([]).resumen, null);
        assert.equal(loQueFalta(null).faltan, 0);
    });
});

// ============================================================ agruparPorObra

test('agruparPorObra', async (t) => {
    await t.test('PASA · agrupa por obra', () => {
        const m = agruparPorObra([
            acopio({ obraId: 'o1' }), acopio({ obraId: 'o2' }), acopio({ obraId: 'o1' })
        ]);
        assert.equal(m.get('o1').length, 2);
        assert.equal(m.get('o2').length, 1);
    });
    await t.test('PASA · descarta los que no tienen obra', () => {
        const m = agruparPorObra([acopio({ obraId: null }), acopio({ obraId: 'o1' })]);
        assert.equal(m.size, 1);
    });
});

// ====================================================== el límite de los 30

test('trocearParaConsulta · el tope del operador `in` de Firestore', async (t) => {
    await t.test('PASA · menos de 30 va en un solo trozo', () => {
        const t1 = trocearParaConsulta(['a', 'b', 'c']);
        assert.equal(t1.length, 1);
        assert.equal(t1[0].length, 3);
    });
    await t.test('PASA · 31 obras se parten en dos consultas', () => {
        const muchas = Array.from({ length: 31 }, (_, i) => 'o' + i);
        const trozos = trocearParaConsulta(muchas);
        assert.equal(trozos.length, 2);
        assert.equal(trozos[0].length, 30);
        assert.equal(trozos[1].length, 1);
    });
    await t.test('PASA · quita repetidos antes de trocear', () => {
        assert.deepEqual(trocearParaConsulta(['a', 'a', 'b']), [['a', 'b']]);
    });
    await t.test('PASA · descarta nulos y vacíos', () => {
        assert.deepEqual(trocearParaConsulta([null, '', 'a', undefined]), [['a']]);
    });
    await t.test('PASA · lista vacía no genera ninguna consulta', () => {
        assert.deepEqual(trocearParaConsulta([]), []);
    });
});

// =========================================================== construirAcopio

test('construirAcopio', async (t) => {
    const base = {
        obraId: 'o1', obraNombre: 'Hotel Sol',
        materialNombre: 'Perfil aluminio 40x20',
        cantidad: '3,5', unidad: 'ml',
        requiereFabricacion: true,
        creadoPor: 'Oficina@Empresa.com'
    };

    await t.test('PASA · nace pendiente y sin historial', () => {
        const a = construirAcopio(base);
        assert.equal(a.estado, 'pendiente');
        assert.deepEqual(a.historial, []);
    });

    await t.test('PASA · la cantidad admite DECIMALES con coma', () => {
        // El catálogo guarda el stock con parseInt y no puede dar esto.
        assert.equal(construirAcopio(base).cantidad, 3.5);
    });

    await t.test('PASA · materialId en null cuando es una pieza a medida', () => {
        assert.equal(construirAcopio(base).materialId, null);
    });

    await t.test('PASA · el nombre del material se guarda como copia', () => {
        // Copia congelada, no referencia: el catálogo se identifica por nombre y
        // renombrarlo no debe romper el acopio.
        assert.equal(construirAcopio(base).materialNombre, 'Perfil aluminio 40x20');
    });

    await t.test('PASA · normaliza el correo de quien lo crea', () => {
        assert.equal(construirAcopio(base).creadoPor, 'oficina@empresa.com');
    });
});

test('normalizarCantidad', async (t) => {
    await t.test('PASA · acepta coma decimal', () => {
        assert.equal(normalizarCantidad('12,75'), 12.75);
    });
    await t.test('PASA · redondea a dos decimales', () => {
        assert.equal(normalizarCantidad(3.14159), 3.14);
    });
    await t.test('PASA · vacío, texto y negativo dan 0', () => {
        assert.equal(normalizarCantidad(''), 0);
        assert.equal(normalizarCantidad('nada'), 0);
        assert.equal(normalizarCantidad(-5), 0);
    });
});

test('coherencia del módulo', async (t) => {
    await t.test('PASA · toda la cadena está en ESTADOS', () => {
        for (const e of cadenaDe(true)) assert.ok(ESTADOS.includes(e));
        for (const e of cadenaDe(false)) assert.ok(ESTADOS.includes(e));
    });
    await t.test('PASA · estaListo solo con listo', () => {
        assert.equal(estaListo(acopio({ estado: 'listo' })), true);
        assert.equal(estaListo(acopio({ estado: 'recepcionado' })), false);
        assert.equal(estaListo(null), false);
    });
});
