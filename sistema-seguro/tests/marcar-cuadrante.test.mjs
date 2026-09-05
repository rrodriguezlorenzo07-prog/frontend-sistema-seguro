/**
 * marcarAsignacionComoEnviada contra el emulador de Firestore.
 *
 * Ejecutar con:
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/marcar-cuadrante.test.mjs"
 *
 * Se ejercita la lógica directamente con el Admin SDK, sin levantar el runtime de Cloud
 * Functions: el disparador de index.js solo la llama y registra el resultado, así que lo
 * que hay que probar es esto. Mismo enfoque que con firmas.js.
 *
 * Los tres escenarios pedidos:
 *   · un parte CON asignacionId marca el cuadrante correcto y solo ese
 *   · un parte SIN asignacionId no toca ningún cuadrante
 *   · repetir el disparador sobre el mismo parte no rompe ni reescribe nada
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { createRequire } from 'node:module';

// El SDK se carga DESDE functions/, no desde la raíz. Hay dos copias instaladas de
// firebase-admin y cada una lleva su propio registro de apps: inicializar la de la raíz
// dejaba a functions/cuadrantes.js con «The default Firebase app does not exist».
const requerirDeFunctions = createRequire(new URL('../functions/', import.meta.url));
const { initializeApp, getApps } = requerirDeFunctions('firebase-admin/app');
const { getFirestore } = requerirDeFunctions('firebase-admin/firestore');
const { marcarAsignacionComoEnviada } = requerirDeFunctions('./cuadrantes.js');

if (getApps().length === 0) initializeApp({ projectId: 'demo-sistema-seguro' });
const db = getFirestore();

let fallos = 0;
let numero = 0;

function titulo(texto) {
  numero += 1;
  console.log(`\n─── CASO ${numero}: ${texto}`);
}

async function comprobar(descripcion, fn) {
  try {
    await fn();
    console.log(`   PASA   · ${descripcion}`);
  } catch (error) {
    fallos += 1;
    console.log(`   FALLA  · ${descripcion}`);
    console.log(`            ${error.message.split('\n')[0]}`);
    throw new Error('parada en el primer fallo');
  }
}

function igual(actual, esperado, mensaje) {
  if (actual !== esperado) throw new Error(`${mensaje}: esperaba ${esperado}, recibí ${actual}`);
}

const asignacion = (extra = {}) => ({
  fecha: '2026-09-04', horaInicio: '08:00', horaFin: '14:00',
  cuadrillaId: 'c1', cuadrillaNombre: 'Cuadrilla A',
  // Etiqueta informativa. Quién puede leerla lo decide la cuadrilla viva, no esta copia.
  operarios: [{ trabajadorId: 't0', nombre: 'Juan', email: 'juan@empresa.com' }],
  vehiculoId: 'v1', vehiculoNombre: 'Furgoneta 1',
  destinoTipo: 'obra', obraId: 'o1', obraNombre: 'Hotel Sol',
  estado: 'planificado', parteId: null,
  creadoPor: 'oficina@empresa.com', creadoEn: Date.now(),
  ...extra
});

async function limpiar() {
  for (const col of ['cuadrantes', 'partes_de_trabajo']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

async function main() {
  // ================================================ con asignación
  titulo('Un parte CON asignacionId marca su cuadrante');
  await limpiar();
  await db.doc('cuadrantes/asig-1').set(asignacion());
  await db.doc('cuadrantes/asig-otra').set(asignacion());

  let resultado;
  await comprobar('la función dice que la ha marcado', async () => {
    resultado = await marcarAsignacionComoEnviada('parte-1', { asignacionId: 'asig-1' });
    igual(resultado.marcada, true, 'marcada');
    igual(resultado.motivo, 'marcada', 'motivo');
  });

  await comprobar('el estado pasa a parte_enviado', async () => {
    const doc = await db.doc('cuadrantes/asig-1').get();
    // `estado` y no un booleano: es lo que leen CuadranteDiario.jsx y ParteTrabajo.jsx
    // para pintar la insignia. Un campo nuevo se escribiría sin que nadie lo mirara.
    igual(doc.get('estado'), 'parte_enviado', 'estado');
  });

  await comprobar('queda apuntado de qué parte salió', async () => {
    const doc = await db.doc('cuadrantes/asig-1').get();
    igual(doc.get('parteId'), 'parte-1', 'parteId');
    igual(typeof doc.get('parteEnviadoEn'), 'number', 'parteEnviadoEn');
  });

  await comprobar('NO toca la otra asignación', async () => {
    const doc = await db.doc('cuadrantes/asig-otra').get();
    igual(doc.get('estado'), 'planificado', 'la ajena sigue planificada');
    igual(doc.get('parteId'), null, 'parteId de la ajena');
  });

  await comprobar('no pisa el resto del documento', async () => {
    const doc = await db.doc('cuadrantes/asig-1').get();
    igual(doc.get('obraNombre'), 'Hotel Sol', 'obraNombre');
    igual(doc.get('cuadrillaNombre'), 'Cuadrilla A', 'cuadrillaNombre');
    igual(doc.get('operarios').length, 1, 'operarios');
  });

  // ================================================ sin asignación
  titulo('Un parte SIN asignacionId no toca ningún cuadrante');
  await limpiar();
  await db.doc('cuadrantes/asig-1').set(asignacion());

  for (const [etiqueta, datos] of [
    ['null', { asignacionId: null }],
    ['ausente', {}],
    ['cadena vacía', { asignacionId: '' }],
    ['sin datos', undefined]
  ]) {
    await comprobar(`con asignacionId ${etiqueta}, no hace nada`, async () => {
      const r = await marcarAsignacionComoEnviada('parte-libre', datos);
      igual(r.marcada, false, 'marcada');
      igual(r.motivo, 'sin-asignacion', 'motivo');
    });
  }

  await comprobar('el cuadrante que había sigue intacto', async () => {
    const doc = await db.doc('cuadrantes/asig-1').get();
    igual(doc.get('estado'), 'planificado', 'estado');
  });

  // ================================================ idempotencia
  titulo('Repetir el disparador no rompe nada');
  await limpiar();
  await db.doc('cuadrantes/asig-1').set(asignacion());

  await marcarAsignacionComoEnviada('parte-1', { asignacionId: 'asig-1' });
  const primera = (await db.doc('cuadrantes/asig-1').get()).get('parteEnviadoEn');

  await comprobar('la segunda vez dice ya-marcada y no escribe', async () => {
    const r = await marcarAsignacionComoEnviada('parte-1', { asignacionId: 'asig-1' });
    igual(r.marcada, false, 'marcada');
    igual(r.motivo, 'ya-marcada', 'motivo');
  });

  await comprobar('la marca de tiempo NO cambia', async () => {
    const doc = await db.doc('cuadrantes/asig-1').get();
    igual(doc.get('parteEnviadoEn'), primera, 'parteEnviadoEn');
  });

  await comprobar('un SEGUNDO parte no roba el cuadrante al primero', async () => {
    // Si el operario manda dos partes desde la misma asignación, el cuadrante sigue
    // apuntando al primero. El segundo queda registrado en partes_de_trabajo igual.
    const r = await marcarAsignacionComoEnviada('parte-2', { asignacionId: 'asig-1' });
    igual(r.motivo, 'ya-marcada', 'motivo');
    const doc = await db.doc('cuadrantes/asig-1').get();
    igual(doc.get('parteId'), 'parte-1', 'parteId');
  });

  // ================================================ cuadrante borrado
  titulo('Un cuadrante que ya no existe no revienta la función');
  await limpiar();

  await comprobar('devuelve el motivo en vez de lanzar', async () => {
    const r = await marcarAsignacionComoEnviada('parte-1', { asignacionId: 'asig-fantasma' });
    igual(r.marcada, false, 'marcada');
    igual(r.motivo, 'asignacion-inexistente', 'motivo');
  });

  await limpiar();

  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n✖ ' + error.message);
  process.exit(1);
});
