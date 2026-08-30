/**
 * Demuestra el bug que arregla el bloque 2: un trabajador renombrado perdía sus
 * horas extra en la nómina. Ejecuta el código REAL extraído de PanelOficina.jsx
 * (calcularHorasPorTrabajador) y de ControlNominas.jsx (datosCalculados).
 *
 *   node scripts/demo-renombrado.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.cwd();
const { baseMensualDe, tieneBaseConfigurada, horasNormalesDelPeriodo } =
    await import(pathToFileURL(path.join(raiz, 'src/utils/nomina.js')).href);

const leer = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');

// ── Extrae calcularHorasPorTrabajador de PanelOficina.jsx ──────────────────
const panel = leer('src/components/PanelOficina.jsx');
const iniP = panel.indexOf('const calcularHorasPorTrabajador = () => {');
const finP = panel.indexOf('\n  };', iniP);
const fuenteResumen = panel.slice(iniP, finP + 5);
if (!fuenteResumen.includes('op.trabajadorId')) throw new Error('el agrupador no usa trabajadorId: parche no aplicado');

const construirResumen = new Function('partesHistorialFiltradosFecha',
    fuenteResumen + '\nreturn calcularHorasPorTrabajador();');

// ── Extrae datosCalculados de ControlNominas.jsx ───────────────────────────
const nominas = leer('src/components/oficina/ControlNominas.jsx');
const MARCA = '.sort((a, b) => b.totalPagar - a.totalPagar);';
const iniN = nominas.indexOf('const datosCalculados = listaBase.map');
const finN = nominas.indexOf(MARCA, iniN);
const fuenteNomina = nominas.slice(iniN, finN + MARCA.length);
if (!fuenteNomina.includes('trabajadorId')) throw new Error('el cruce de nómina no usa trabajadorId: parche no aplicado');

const construirNomina = new Function(
    'listaBase', 'horasTrabajadores', 'diasAusencia', 'horasManuales', 'horasExtraManuales',
    'tarifasOperarios', 'pagoHoraNormal', 'pagoHoraExtra',
    'baseMensualDe', 'tieneBaseConfigurada', 'horasNormalesDelPeriodo',
    fuenteNomina + '\nreturn datosCalculados;');

const calcular = (listaBase, horasTrabajadores) => construirNomina(
    listaBase, horasTrabajadores, {}, {}, {}, {}, 12, 18,
    baseMensualDe, tieneBaseConfigurada, horasNormalesDelPeriodo);

// ── Escenario ──────────────────────────────────────────────────────────────
const ID = 'TRAB-JULIAN';

// Un albarán validado con 5 horas extra para ese trabajador, guardado cuando
// todavía se llamaba "Julian".
const partesConId = [{
    estado: 'aprobado', timestamp: Date.now(),
    cuadrilla: [{ trabajadorId: ID, nombre: 'Julian', horasExtra: 5 }]
}];
// El mismo albarán, pero de antes de esta migración: sin trabajadorId.
const partesSinId = [{
    estado: 'aprobado', timestamp: Date.now(),
    cuadrilla: [{ nombre: 'Julian', horasExtra: 5 }]
}];

// La ficha, ya renombrada de "Julian" a "Julián Pérez".
const plantillaRenombrada = [{ id: ID, nombre: 'Julián Pérez', horasBaseMensuales: 160 }];

const linea = (titulo, listaBase, partes) => {
    const resumen = construirResumen(partes);
    const fila = calcular(listaBase, resumen)[0];
    console.log(`   ${titulo}`);
    console.log(`     horas extra que se le pagan : ${fila.hExtra}`);
    console.log(`     total a pagar               : ${fila.totalPagar.toFixed(2)} €`);
    return fila.hExtra;
};

console.log('\n═══ Trabajador renombrado de "Julian" a "Julián Pérez" ═══');
console.log('   Su albarán validado tiene 5 horas extra.\n');

console.log('── ANTES del bloque 2 (cuadrilla sin trabajadorId, cruce por nombre) ──');
const antes = linea('la ficha dice "Julián Pérez", el albarán dice "Julian":', plantillaRenombrada, partesSinId);

console.log('');
console.log('── DESPUÉS del bloque 2 (cuadrilla con trabajadorId) ──');
const despues = linea('mismo caso, pero cruzando por id:', plantillaRenombrada, partesConId);

console.log('');
console.log('─── comprobaciones ───');
console.log('  sin id, el renombrado PIERDE sus horas extra :', antes === 0 ? 'CONFIRMADO (0 h, el bug)' : 'inesperado: ' + antes);
console.log('  con id, las CONSERVA                        :', despues === 5 ? 'CONFIRMADO (5 h)' : 'FALLA: ' + despues);
console.log('  diferencia en su nómina                     :', ((despues - antes) * 18).toFixed(2), '€');

// Compatibilidad: un albarán antiguo sin id y una ficha NO renombrada sigue cuadrando
console.log('');
console.log('── COMPATIBILIDAD: albarán antiguo sin id, ficha sin renombrar ──');
const compat = linea('la ficha sigue diciendo "Julian":', [{ id: ID, nombre: 'Julian', horasBaseMensuales: 160 }], partesSinId);
console.log('  el recurso al nombre sigue funcionando      :', compat === 5 ? 'CONFIRMADO (5 h)' : 'FALLA: ' + compat);

process.exit((antes === 0 && despues === 5 && compat === 5) ? 0 : 1);
