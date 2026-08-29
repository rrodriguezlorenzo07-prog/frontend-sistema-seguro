/**
 * Verificación de la Fase D.2 con datos REALES de producción (solo lectura).
 *
 *   node scripts/verificar-d2.mjs
 *
 * 1. Para partes migrados: horasTotalesDocumento() debe dar lo mismo leyendo del
 *    parte (como antes de esta fase) que del objeto hidratado desde validaciones/.
 * 2. Para el camino nuevo: ejecuta el confirmarValidacionParte REAL de
 *    PanelOficina.jsx con Firestore simulado y comprueba el mismo resultado.
 * 3. Confirma que ningún parte perdió cuadrilla ni horasExtraAsignadas.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { horasTotalesDocumento } from '../src/utils/horasDocumento.js';

const require = createRequire(import.meta.url);
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
}

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'sistema-seguro-dcecb' }));

let fallos = 0;
const comprobar = (desc, ok, detalle) => {
    if (!ok) fallos += 1;
    console.log(`   ${ok ? 'PASA  ' : 'FALLA '} · ${desc}${detalle ? ' — ' + detalle : ''}`);
};

// ─── 1. PARTES MIGRADOS ──────────────────────────────────────────────────────
console.log('═══ 1 · Partes antiguos migrados (datos reales de producción) ═══\n');

const snap = await db.collection('partes_de_trabajo').where('estado', '==', 'aprobado').get();
const partes = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

let sinValidacion = 0;
let discrepancias = 0;
let perdieronCampos = 0;

for (const parte of partes) {
    const v = await db.doc(`validaciones/${parte.id}`).get();
    if (!v.exists) { sinValidacion += 1; continue; }

    // "Antes de esta fase": el parte con sus campos originales
    const antes = horasTotalesDocumento(parte);
    // "Ahora": objeto hidratado desde validaciones/
    const val = v.data();
    const { cuadrilla, horasExtraAsignadas, ...parteSinValidacion } = parte;
    const hidratado = { ...parteSinValidacion, cuadrilla: val.cuadrilla, horasExtraAsignadas: val.horasExtraAsignadas };
    const ahora = horasTotalesDocumento(hidratado);

    if (antes !== ahora) discrepancias += 1;
    // La migración es aditiva: el parte debe conservar lo que tenía. Ojo, los partes
    // anteriores a la Fase A nunca tuvieron horasExtraAsignadas, así que solo se exige
    // que siga estando en los que ya lo traían.
    const conservaCuadrilla = Array.isArray(parte.cuadrilla) && parte.cuadrilla.length > 0;
    const conservaHoras = val.horasExtraAsignadas === undefined || parte.horasExtraAsignadas !== undefined
        || val.horasExtraAsignadas === parte.cuadrilla.reduce((s, o) => s + (Number(o?.horasExtra) || 0), 0);
    if (!conservaCuadrilla || !conservaHoras) perdieronCampos += 1;
}

const muestra = partes[0];
if (muestra) {
    const val = (await db.doc(`validaciones/${muestra.id}`).get()).data();
    const { cuadrilla, horasExtraAsignadas, ...sinVal } = muestra;
    console.log(`   Parte de muestra: ${muestra.id}  (${muestra.obra}, ${muestra.fecha})`);
    console.log(`     cuadrilla en el PARTE        : ${JSON.stringify(muestra.cuadrilla)}`);
    console.log(`     cuadrilla en VALIDACIONES    : ${JSON.stringify(val.cuadrilla)}`);
    console.log(`     horasTotalesDocumento ANTES  : ${horasTotalesDocumento(muestra)}`);
    console.log(`     horasTotalesDocumento HIDRAT.: ${horasTotalesDocumento({ ...sinVal, cuadrilla: val.cuadrilla, horasExtraAsignadas: val.horasExtraAsignadas })}\n`);
}

comprobar(`los ${partes.length} partes aprobados tienen su validación`, sinValidacion === 0, `sin validación: ${sinValidacion}`);
comprobar('horasTotalesDocumento da lo mismo antes que hidratado', discrepancias === 0, `discrepancias: ${discrepancias}`);
comprobar('ningún parte perdió cuadrilla (migración aditiva)', perdieronCampos === 0, `afectados: ${perdieronCampos}`);

// ─── 2. CAMINO NUEVO ─────────────────────────────────────────────────────────
console.log('\n═══ 2 · Parte aprobado con el CÓDIGO NUEVO (confirmarValidacionParte real) ═══\n');

const src = fs.readFileSync('src/components/PanelOficina.jsx', 'utf8');
const extraer = (inicio) => {
    const i = src.indexOf(inicio);
    if (i === -1) throw new Error('no encuentro ' + inicio);
    const fin = src.indexOf('\n  };', i);
    return src.slice(i, fin + 5);
};
const fuenteMatcher = extraer('const ubicacionCoincideConTarea');
const fuenteConfirmar = extraer('const confirmarValidacionParte = async () => {');

if (fuenteConfirmar.includes("cuadrilla: cuadrillaNumerica, horasExtraAsignadas, fechaValidacion")) {
    throw new Error('el updateDoc del parte sigue llevando cuadrilla: el parche no se aplicó');
}

const harness = `(function () {
  const escrituras = [];
  let validandoParte = false;
  let parteAValidar = null;
  let cuadrilla = [];
  let obrasList = [];
  const db = {};
  const doc = (_db, coleccion, id) => ({ coleccion, id });
  const getDoc = async () => ({ exists: () => true, data: () => ({ stock: 100 }) });
  const updateDoc = async (ref, datos) => { escrituras.push({ tipo: 'updateDoc', ...ref, datos }); };
  const writeBatch = () => ({
    update: (ref, datos) => escrituras.push({ tipo: 'batch.update', ...ref, datos }),
    set: (ref, datos) => escrituras.push({ tipo: 'batch.set', ...ref, datos }),
    commit: async () => {}
  });
  const mostrarToast = () => {};
  const setParteAValidar = (v) => { parteAValidar = v; };
  const setCuadrilla = (v) => { cuadrilla = v; };
  const setValidandoParte = (v) => { validandoParte = v; };
  const cargarDatos = async () => {};
  ${fuenteMatcher}
  ${fuenteConfirmar}
  return {
    confirmarValidacionParte,
    preparar: (parte, cuad) => { parteAValidar = parte; cuadrilla = cuad; escrituras.length = 0; },
    escrituras: () => escrituras
  };
})()`;

const app = eval(harness);

const parteNuevo = {
    id: 'PARTE-NUEVO', estado: 'pendiente', obra: 'Hotel Sol',
    timestamp: 1756500000000, materialesUsados: [], tareasRealizadas: []
};
app.preparar(parteNuevo, [{ nombre: 'Juan', horasExtra: 1.5 }, { nombre: 'Ana', horasExtra: 0 }]);
await app.confirmarValidacionParte();

const escrituras = app.escrituras();
const alParte = escrituras.find(e => e.coleccion === 'partes_de_trabajo');
const aValidaciones = escrituras.find(e => e.coleccion === 'validaciones');

console.log('   escrituras:', escrituras.map(e => `${e.tipo} -> ${e.coleccion}/${e.id}`).join('  |  '));
console.log('   al parte      :', JSON.stringify(alParte?.datos));
console.log('   a validaciones:', JSON.stringify(aValidaciones?.datos), '\n');

comprobar('el parte se actualiza en el mismo lote', alParte?.tipo === 'batch.update');
comprobar('la validación se escribe en el mismo lote', aValidaciones?.tipo === 'batch.set');
comprobar('el parte YA NO lleva cuadrilla', alParte && !('cuadrilla' in alParte.datos));
comprobar('el parte YA NO lleva horasExtraAsignadas', alParte && !('horasExtraAsignadas' in alParte.datos));
comprobar('la validación lleva la cuadrilla', Array.isArray(aValidaciones?.datos?.cuadrilla));
comprobar('la validación replica el timestamp del parte', aValidaciones?.datos?.timestamp === parteNuevo.timestamp);

const hidratadoNuevo = { ...parteNuevo, ...alParte.datos, cuadrilla: aValidaciones.datos.cuadrilla, horasExtraAsignadas: aValidaciones.datos.horasExtraAsignadas };
const horasNuevo = horasTotalesDocumento(hidratadoNuevo);
console.log(`   horasTotalesDocumento del parte nuevo hidratado: ${horasNuevo}  (2 operarios × 8 h + 1.5 extra)`);
comprobar('el objeto hidratado da el número esperado', horasNuevo === 17.5, `= ${horasNuevo}`);

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} COMPROBACIÓN(ES) FALLIDA(S) ══`);
process.exit(fallos === 0 ? 0 : 1);
