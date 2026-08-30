/**
 * Los módulos de src/logica/. Sin Firestore, sin React, sin emulador.
 *
 *   node tests/logica.test.mjs
 *
 * Es lógica que hasta ahora vivía dentro de PanelOficina.jsx y no se podía ejercitar
 * sin montar el componente entero. Aquí solo se comprueba lo que ya hacía: si algo de
 * esto falla, la extracción cambió el comportamiento y eso es lo que había que evitar.
 */
import { hidratarPartes, rangoDeFechas, filtrarPorRango, buscarPartes, resumenDelDia, marcarFacturados } from '../src/logica/partes.js';
import { cuadrillaInicial, agregarOperario, ajustarHorasExtra, fijarHorasExtra, quitarOperario, normalizarCuadrilla } from '../src/logica/cuadrilla.js';
import { ubicacionCoincideConTarea, generarTareasDeHotel, alternarTareas, progresoDeObras, estadisticasDeObra } from '../src/logica/obras.js';
import { filtrarMateriales } from '../src/logica/inventario.js';

let fallos = 0;
const titulo = (t) => console.log(`\n─── ${t}`);
const comprobar = (desc, ok, detalle) => {
    if (!ok) fallos += 1;
    console.log(`   ${ok ? 'PASA  ' : 'FALLA '} · ${desc}${detalle ? ' — ' + detalle : ''}`);
};

// ════════════════════════════════════════════════════════════════════ partes

titulo('partes · hidratarPartes');
{
    const partes = [{ id: 'p1', obra: 'A', timestamp: 1 }, { id: 'p2', obra: 'B', timestamp: 2 }];
    const val = new Map([['p1', { cuadrilla: [{ nombre: 'Juan', horasExtra: 2 }], horasExtraAsignadas: 2 }]]);
    const r = hidratarPartes(partes, val);
    comprobar('el parte con validación recibe su cuadrilla', r[0].cuadrilla?.length === 1);
    comprobar('y sus horas extra', r[0].horasExtraAsignadas === 2);
    comprobar('el que no tiene validación se queda igual', r[1].cuadrilla === undefined);
    comprobar('no muta el original', partes[0].cuadrilla === undefined);
    comprobar('sin validaciones devuelve la lista tal cual', hidratarPartes(partes, new Map()) === partes);
    comprobar('con undefined tampoco rompe', hidratarPartes(partes, undefined) === partes);
}

titulo('partes · rangoDeFechas y filtrarPorRango');
{
    const { start, end } = rangoDeFechas('2026-08-01', '2026-08-31');
    comprobar('el fin cubre todo el último día', end - start === 30 * 86400000 + 86399999, `${end - start} ms`);

    const partes = [
        { id: 'antes', timestamp: start - 1 },
        { id: 'justo-al-inicio', timestamp: start },
        { id: 'dentro', timestamp: start + 1000 },
        { id: 'justo-al-final', timestamp: end },
        { id: 'despues', timestamp: end + 1 }
    ];
    const dentro = filtrarPorRango(partes, start, end).map((p) => p.id);
    comprobar('los límites son inclusivos por los dos lados',
              dentro.join(',') === 'justo-al-inicio,dentro,justo-al-final', dentro.join(','));
}

titulo('partes · buscarPartes');
{
    const partes = [
        { id: '1', obra: 'Hotel Meliá', creador: 'juan@x.com', nombreTrabajador: 'Juan', trabajo: 'Puertas', timestamp: 300 },
        { id: '2', obra: 'Hotel Sol', creador: 'ana@x.com', nombreTrabajador: 'Ana', trabajo: 'Ventanas', timestamp: 100 },
        { id: '3', obra: 'Residencia', creador: 'luis@x.com', trabajo: 'Cristales', timestamp: 200 }
    ];
    comprobar('busca por obra', buscarPartes(partes, 'hotel', 'recientes').length === 2);
    comprobar('busca por persona', buscarPartes(partes, 'ana', 'recientes')[0].id === '2');
    comprobar('busca por trabajo', buscarPartes(partes, 'cristal', 'recientes')[0].id === '3');
    comprobar('sin filtro los devuelve todos', buscarPartes(partes, '', 'recientes').length === 3);
    comprobar('ordena por reciente', buscarPartes(partes, '', 'recientes').map((p) => p.id).join('') === '132');
    comprobar('ordena por antiguo', buscarPartes(partes, '', 'antiguos').map((p) => p.id).join('') === '231');
    comprobar('un parte sin nombreTrabajador usa el creador',
              buscarPartes(partes, 'luis@x.com', 'recientes').length === 1);
}

titulo('partes · marcarFacturados');
{
    const items = [{ id: '1', facturado: false }, { id: '2', facturado: false }, { id: '3' }];
    const r = marcarFacturados(items, ['1', '3']);
    comprobar('marca los indicados', r[0].facturado === true && r[2].facturado === true);
    comprobar('deja en paz al resto', r[1].facturado === false);
    comprobar('no muta el original', items[0].facturado === false);
    comprobar('sin ids no cambia nada', marcarFacturados(items, []).every((i) => !i.facturado));
    comprobar('argumentos nulos no rompen', marcarFacturados(null, null).length === 0);
    // Se usa igual sobre partes y sobre certificaciones: solo mira el id.
    const certs = [{ id: 'c1', obra: 'X' }];
    comprobar('vale también para certificaciones', marcarFacturados(certs, ['c1'])[0].facturado === true);
    comprobar('y conserva el resto de campos', marcarFacturados(certs, ['c1'])[0].obra === 'X');
}

titulo('partes · resumenDelDia');
{
    const hoy = new Date('2026-08-30T12:00:00');
    const ayer = new Date('2026-08-29T12:00:00');
    const partes = [
        { id: '1', creador: 'a@x.com', timestamp: hoy.getTime(), cuadrilla: [{ horasExtra: 2 }, { horasExtra: 0 }] },
        { id: '2', creador: 'a@x.com', timestamp: hoy.getTime(), cuadrilla: [{ horasExtra: 0 }] },
        { id: '3', creador: 'b@x.com', timestamp: ayer.getTime(), cuadrilla: [{ horasExtra: 5 }] }
    ];
    const r = resumenDelDia(partes, hoy);
    comprobar('solo cuenta los del día', r.partes.length === 2);
    comprobar('suma horas de documento (2×8+2 y 1×8)', r.horas === 26, `${r.horas} h`);
    comprobar('cuenta personas distintas, no partes', r.trabajadores === 1);
}

// ════════════════════════════════════════════════════════════════ cuadrilla

titulo('cuadrilla · cuadrillaInicial');
{
    const trabajadores = [{ id: 't1', nombre: 'Juan', email: 'juan@x.com' }];
    const conId = cuadrillaInicial({ trabajadorId: 't9', nombreTrabajador: 'Juan', creador: 'juan@x.com' }, trabajadores);
    comprobar('usa el trabajadorId del parte si lo trae', conId[0].trabajadorId === 't9');

    const sinId = cuadrillaInicial({ nombreTrabajador: 'Juan', creador: 'juan@x.com' }, trabajadores);
    comprobar('si no, lo resuelve por el email del creador', sinId[0].trabajadorId === 't1');

    const desconocido = cuadrillaInicial({ nombreTrabajador: 'X', creador: 'nadie@x.com' }, trabajadores);
    comprobar('si no hay ficha queda en null, no rompe', desconocido[0].trabajadorId === null);
    comprobar('empieza siempre con cero horas extra', desconocido[0].horasExtra === 0);
    comprobar('sin nombreTrabajador cae al email', cuadrillaInicial({ creador: 'x@x.com' }, [])[0].nombre === 'x@x.com');
}

titulo('cuadrilla · agregarOperario');
{
    const trabajadores = [{ id: 't1', nombre: 'Juan' }, { id: 't2', nombre: 'Ana' }];
    const base = [{ trabajadorId: 't1', nombre: 'Juan', horasExtra: 0 }];
    comprobar('añade a quien no está', agregarOperario(base, 't2', trabajadores).length === 2);
    comprobar('no duplica a quien ya está', agregarOperario(base, 't1', trabajadores) === base);
    comprobar('ignora un id que no existe', agregarOperario(base, 't9', trabajadores) === base);
    comprobar('ignora un id vacío', agregarOperario(base, '', trabajadores) === base);
    comprobar('no muta la cuadrilla original', base.length === 1);
}

titulo('cuadrilla · horas extra');
{
    const base = [{ trabajadorId: 't1', nombre: 'Juan', horasExtra: 2 }];
    comprobar('suma', ajustarHorasExtra(base, 0, 1)[0].horasExtra === 3);
    comprobar('resta', ajustarHorasExtra(base, 0, -1)[0].horasExtra === 1);
    comprobar('nunca baja de cero', ajustarHorasExtra(base, 0, -99)[0].horasExtra === 0);
    comprobar('no muta el original', base[0].horasExtra === 2);
    comprobar('fijar un número', fijarHorasExtra(base, 0, '3.5')[0].horasExtra === 3.5);
    comprobar('la cadena vacía se conserva para poder borrar el input', fijarHorasExtra(base, 0, '')[0].horasExtra === '');
    comprobar('un negativo se corta en cero', fijarHorasExtra(base, 0, '-5')[0].horasExtra === 0);
    comprobar('un texto que no es número cuenta como cero', fijarHorasExtra(base, 0, 'ocho')[0].horasExtra === 0);
}

titulo('cuadrilla · quitarOperario y normalizarCuadrilla');
{
    const base = [
        { trabajadorId: 't1', nombre: 'Juan', horasExtra: 2 },
        { trabajadorId: 't2', nombre: 'Ana', horasExtra: '' },
        { nombre: 'Sin ficha', horasExtra: '1.5' }
    ];
    comprobar('quita por posición', quitarOperario(base, 1).map((o) => o.nombre).join(',') === 'Juan,Sin ficha');
    comprobar('no muta el original', base.length === 3);

    const { cuadrilla, horasExtraAsignadas } = normalizarCuadrilla(base);
    comprobar('las cadenas vacías pasan a cero', cuadrilla[1].horasExtra === 0);
    comprobar('las numéricas en texto se convierten', cuadrilla[2].horasExtra === 1.5);
    comprobar('sin trabajadorId queda null explícito', cuadrilla[2].trabajadorId === null);
    comprobar('el total es la suma', horasExtraAsignadas === 3.5, `${horasExtraAsignadas} h`);
    comprobar('una cuadrilla vacía da cero', normalizarCuadrilla([]).horasExtraAsignadas === 0);
}

// ════════════════════════════════════════════════════════════════════ obras

titulo('obras · ubicacionCoincideConTarea');
{
    const hab = { id: 't', nombre: 'P1 - Hab 101', numeroHabitacion: 101, completada: false };
    comprobar('número exacto', ubicacionCoincideConTarea(hab, '101') === true);
    comprobar('dentro de un rango con guion', ubicacionCoincideConTarea(hab, '99-105') === true);
    comprobar('rango escrito con "al"', ubicacionCoincideConTarea(hab, '100 al 110') === true);
    comprobar('rango escrito con "a"', ubicacionCoincideConTarea(hab, '100 a 110') === true);
    comprobar('rango al revés también', ubicacionCoincideConTarea(hab, '105-99') === true);
    comprobar('fuera del rango no', ubicacionCoincideConTarea(hab, '200-300') === false);
    comprobar('otro número no', ubicacionCoincideConTarea(hab, '102') === false);
    comprobar('por nombre completo', ubicacionCoincideConTarea(hab, 'p1 - hab 101') === true);
    comprobar('ubicación vacía no', ubicacionCoincideConTarea(hab, '') === false);
    // El número de habitación manda de verdad: "1" es la planta dentro de
    // "P1 - Hab 101", no una habitación, y antes casaba por subcadena.
    comprobar('el número de planta NO empareja', ubicacionCoincideConTarea(hab, '1') === false);
    comprobar('un número que solo aparece dentro del nombre tampoco',
              ubicacionCoincideConTarea(hab, '0') === false);

    // El caso inverso: la ubicación nombra una habitación concreta y la tarea es la
    // planta entera. Al leer "hab" en los dos lados, el 1 de "P1" deja de contar.
    const planta = { id: 'p', nombre: 'planta 1', completada: false };
    comprobar('"P1 - Hab 101" NO empareja con una tarea llamada "planta 1"',
              ubicacionCoincideConTarea(planta, 'P1 - Hab 101') === false);
    comprobar('pero "planta 1" sí empareja consigo misma',
              ubicacionCoincideConTarea(planta, 'Planta 1') === true);

    // Que la ubicación diga "hab" no debe romper los rangos.
    comprobar('"hab 101 a 105" cubre la 101', ubicacionCoincideConTarea(hab, 'hab 101 a 105') === true);
    const hab103 = { id: 'h3', nombre: 'P1 - Hab 103', numeroHabitacion: 103, completada: false };
    comprobar('y también la 103, que está en medio del rango',
              ubicacionCoincideConTarea(hab103, 'hab 101 a 105') === true);
    comprobar('la 107 queda fuera', ubicacionCoincideConTarea({ id: 'h7', nombre: 'P1 - Hab 107', numeroHabitacion: 107, completada: false }, 'hab 101 a 105') === false);
    comprobar('"habitación 101" con el nombre largo también empareja',
              ubicacionCoincideConTarea(hab, 'habitación 101') === true);
    const sinNumero = { id: 't', nombre: 'Recepción', completada: false };
    comprobar('una tarea sin números no empareja con un número', ubicacionCoincideConTarea(sinNumero, '101') === false);
}

titulo('obras · generarTareasDeHotel');
{
    const t = generarTareasDeHotel(2, '3, 2', 'SEMILLA');
    comprobar('genera 3 + 2 habitaciones', t.length === 5);
    comprobar('numera por planta', t[0].numeroHabitacion === 101 && t[3].numeroHabitacion === 201);
    comprobar('nombra con planta y número', t[0].nombre === 'P1 - Hab 101');
    comprobar('id determinista con la semilla', t[0].id === 'T-1-1-SEMILLA');
    comprobar('empiezan sin completar', t.every((x) => x.completada === false));
    comprobar('si falta el valor de una planta repite el de la primera', generarTareasDeHotel(3, '2', 'S').length === 6);
    comprobar('sin configuración usa 10 por planta', generarTareasDeHotel(1, '', 'S').length === 10);
}

titulo('obras · alternarTareas y progresoDeObras');
{
    const tareas = [
        { id: 'a', nombre: 'A', completada: false },
        { id: 'b', nombre: 'B', completada: true },
        { id: 'c', nombre: 'C', completada: false }
    ];
    comprobar('alterna una sola', alternarTareas(tareas, 'a')[0].completada === true);
    comprobar('alterna varias a la vez', alternarTareas(tareas, ['a', 'b']).map((t) => t.completada).join() === 'true,false,false');
    comprobar('no muta el original', tareas[0].completada === false);

    const p = progresoDeObras([{ nombre: 'O1', tareas }, { nombre: 'O2', tareas: [{ id: 'd', completada: true }] }]);
    comprobar('cuenta todas las tareas', p.totalTareas === 4);
    comprobar('y las completadas', p.completadas === 2);
    comprobar('porcentaje redondeado', p.porcentaje === 50);
    comprobar('sin obras no divide por cero', progresoDeObras([]).porcentaje === 0);
    comprobar('una obra sin tareas no rompe', progresoDeObras([{ nombre: 'X' }]).porcentaje === 0);
}

titulo('obras · estadisticasDeObra');
{
    const partes = [
        { id: '1', obra: 'Meliá', obraId: 'o1', cuadrilla: [{ horasExtra: 2 }], materialesUsados: [{ nombre: 'Silicona', cantidad: 3 }] },
        { id: '2', obra: 'Meliá', obraId: 'o2', cuadrilla: [{ horasExtra: 0 }], materialesUsados: [{ nombre: 'Silicona', cantidad: 2 }] },
        { id: '3', obra: 'Meliá', cuadrilla: [{ horasExtra: 1 }], materialesUsados: [] }
    ];
    // Con obraId se excluye la obra homónima distinta (o2), pero los partes SIN obraId
    // siguen entrando por nombre: son los anteriores al Bloque 2 y perderlos dejaría
    // huecos en el histórico. Es el compromiso que ya existía, anotado aquí.
    const porId = estadisticasDeObra(partes, 'Meliá', 'o1');
    comprobar('excluye la obra homónima con otro id', !porId.materiales.some(([, c]) => c === 2));
    comprobar('cuenta la suya (10 h) más la que no tiene id (9 h)', porId.horas === 19, `${porId.horas} h`);

    // El respaldo por nombre es lo que mezclaba obras homónimas. Se conserva solo para
    // los partes anteriores al Bloque 2, que no llevan obraId.
    const porNombre = estadisticasDeObra(partes, 'Meliá');
    comprobar('sin obraId cae al nombre y las junta todas', porNombre.horas === 27, `${porNombre.horas} h`);
    comprobar('acumula el mismo material de varios partes', porNombre.materiales[0][1] === 5);
    comprobar('una obra sin partes da cero', estadisticasDeObra(partes, 'Ninguna').horas === 0);
}

// ═══════════════════════════════════════════════════════════════ inventario

titulo('inventario · filtrarMateriales');
{
    const mats = [
        { id: '1', nombre: 'Silicona', stock: 5 },
        { id: '2', nombre: 'Cristal', stock: 2 },
        { id: '3', nombre: 'Aluminio', stock: 9 }
    ];
    comprobar('filtra por nombre', filtrarMateriales(mats, 'sil', 'nombre').length === 1);
    comprobar('el filtro no distingue mayúsculas', filtrarMateriales(mats, 'SIL', 'nombre').length === 1);
    comprobar('ordena por stock ascendente', filtrarMateriales(mats, '', 'menor').map((m) => m.id).join('') === '213');
    comprobar('ordena por stock descendente', filtrarMateriales(mats, '', 'mayor').map((m) => m.id).join('') === '312');
    comprobar('por defecto, alfabético', filtrarMateriales(mats, '', 'nombre').map((m) => m.nombre).join(',') === 'Aluminio,Cristal,Silicona');
}

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
process.exit(fallos === 0 ? 0 : 1);
