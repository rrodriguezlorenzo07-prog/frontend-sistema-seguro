/**
 * Muestra el CSV que producen los exportadores con la utilidad unificada,
 * incluyendo datos "hostiles": punto y coma, comillas y saltos de línea.
 *   node scripts/demo-csv.mjs
 */
import { construirCSV, textoCSV, numeroCSV, enteroCSV } from '../src/utils/csv.js';

const mostrar = (titulo, contenido) => {
    console.log('\n═══ ' + titulo + ' ═══');
    console.log(contenido.replace(/^﻿/, '<BOM>').replace(/\r\n/g, '\n'));
};

// ── Nóminas ────────────────────────────────────────────────────────────────
const cabecerasNomina = ['Trabajador', 'Base Mensual (h)', 'Origen de la Base', 'Días de Ausencia',
    'Horas Normales', 'H. Normales Calculadas', 'Ajuste Manual Normales',
    'Horas Extras', 'H. Extras de Albaranes', 'Ajuste Manual Extras',
    'Tarifa Normal (€)', 'Tarifa Extra (€)', 'Total Pagar (€)'];

const trabajadores = [
    { nombre: 'Juan Pérez Núñez', baseMensual: 150, baseConfigurada: true, dLibres: 1,
      hNormal: 138, hNormalCalc: 142, normalManual: true, hExtra: 8, origE: 6, extraManual: true,
      tarifaN: 12.5, tarifaE: 18.75, totalPagar: 1875.5 },
    { nombre: 'Ana "La Jefa"; Gómez', baseMensual: 160, baseConfigurada: false, dLibres: 0,
      hNormal: 160, hNormalCalc: 160, normalManual: false, hExtra: 0, origE: 0, extraManual: false,
      tarifaN: 12.5, tarifaE: 18.75, totalPagar: 2000 }
];

const filasNomina = trabajadores.map((item) => ([
    textoCSV(item.nombre), numeroCSV(item.baseMensual, 0),
    textoCSV(item.baseConfigurada ? 'Ficha del trabajador' : 'Por defecto (sin configurar)'),
    enteroCSV(item.dLibres), numeroCSV(item.hNormal), numeroCSV(item.hNormalCalc),
    textoCSV(item.normalManual ? 'SÍ' : ''), numeroCSV(item.hExtra), numeroCSV(item.origE),
    textoCSV(item.extraManual ? 'SÍ' : ''), numeroCSV(item.tarifaN), numeroCSV(item.tarifaE),
    numeroCSV(item.totalPagar)
]));
filasNomina.push([textoCSV('TOTAL GLOBAL A PAGAR'), ...Array(11).fill(textoCSV('')), numeroCSV(3875.5)]);
mostrar('NÓMINAS', construirCSV(cabecerasNomina, filasNomina));

// ── Albaranes, con texto hostil ────────────────────────────────────────────
const partes = [
    { fecha: '29/8/2026', equipo: 'Juan (+1.5h extra) - Ana', horasExtraAsignadas: 1.5,
      obra: 'Hotel Meliá; Sala "A"', materiales: '2x Silicona; 3x Junta',
      trabajo: 'Cambio de junta.\nSe detectó una fuga en la "línea 3"; pendiente de revisar.' }
];
const filasPartes = partes.map((p) => ([
    textoCSV(p.fecha), textoCSV(p.equipo), numeroCSV(p.horasExtraAsignadas),
    textoCSV(p.obra), textoCSV(p.materiales), textoCSV(p.trabajo)
]));
mostrar('ALBARANES (con ; comillas y salto de línea dentro de los campos)',
    construirCSV(['Fecha', 'Operarios (H. Extra)', 'Horas Extra', 'Hotel/Obra', 'Material Utilizado', 'Trabajo Realizado'], filasPartes));

// ── Almacén ────────────────────────────────────────────────────────────────
mostrar('ALMACÉN', construirCSV(['Material', 'Stock Actual'], [
    [textoCSV('Silicona neutra 300ml'), enteroCSV(48)],
    [textoCSV('Perfil en "U"; 3m'), enteroCSV(7)]
]));

console.log('\n─── comprobaciones ───');
console.log('  decimal con coma        :', numeroCSV(1234.5) === '1234,50' ? 'OK (1234,50)' : 'FALLA');
console.log('  comillas duplicadas     :', textoCSV('Ana "La Jefa"') === '"Ana ""La Jefa"""' ? 'OK' : 'FALLA');
console.log('  ; dentro del texto      :', textoCSV('a;b') === '"a;b"' ? 'OK (queda en una sola columna)' : 'FALLA');
console.log('  valor no numérico       :', numeroCSV(undefined) === '' ? 'OK (celda vacía)' : 'FALLA');
