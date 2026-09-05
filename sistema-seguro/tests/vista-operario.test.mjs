/**
 * La vista del operario contra el emulador: qué asignación ve cada uno y qué parte
 * puede enviar.
 *
 * Ejecutar con:
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/vista-operario.test.mjs"
 *
 * Los tres escenarios de la Pieza 2:
 *   · un operario con UNA asignación la recibe y el parte sale con su obraId
 *   · uno con VARIAS las recibe todas, ordenadas, para elegir
 *   · uno con NINGUNA recibe la lista vacía y aun así puede crear un parte libre
 *
 * Y lo que más fácil se rompe: la lista blanca de `partes_de_trabajo`. Si los campos
 * nuevos (asignacionId, horasTaller, horasCalle) no están en camposDelOperario(), el
 * hasOnly() rechaza el parte entero y el operario se queda sin poder enviar.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, addDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const HOY = new Date().toISOString().slice(0, 10);
const AYER = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const SOLO = 'solo@empresa.com';      // una asignación
const DOBLE = 'doble@empresa.com';    // dos
const HUERFANO = 'huerfano@empresa.com'; // ninguna

let testEnv;
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

/**
 * La asignación apunta a su cuadrilla y NO lleva correos: quién puede verla lo decide
 * la cuadrilla viva, que las reglas resuelven con get().
 */
const asignacion = (cuadrillaId, extra = {}) => ({
  fecha: HOY, horaInicio: '08:00', horaFin: '14:00',
  cuadrillaId, cuadrillaNombre: 'Cuadrilla A',
  operarios: [],
  vehiculoId: 'v1', vehiculoNombre: 'Furgoneta 1',
  destinoTipo: 'obra', obraId: 'o1', obraNombre: 'Hotel Sol',
  estado: 'planificado', parteId: null,
  creadoPor: 'oficina@empresa.com', creadoEn: Date.now(),
  ...extra
});

const cuadrillaCon = (nombre, correos) => ({
  nombre,
  operarios: correos.map((email, i) => ({ trabajadorId: `t${i}`, nombre: `Op ${i}`, email })),
  operarioEmails: correos,
  papelera: false
});

/** El payload exacto que arma ParteTrabajo.jsx, con los campos nuevos. */
const parteDe = (creador, extra = {}) => ({
  obra: 'Hotel Sol',
  obraId: 'o1',
  tareasRealizadas: [{ ubicacion: 'Hab 101', descripcion: 'Puerta' }],
  trabajo: '',
  materialesUsados: [],
  firma: 'https://firebasestorage.googleapis.com/v0/b/x/o/firmas%2Ff.png?alt=media&token=abc',
  creador,
  nombreTrabajador: 'Operario',
  trabajadorId: 't0',
  fecha: '04/09/2026',
  hora: '08:30',
  timestamp: Date.now(),
  estado: 'pendiente',
  asignacionId: 'asig-solo',
  horasTaller: 4,
  horasCalle: 3.5,
  ...extra
});

/**
 * La consulta literal de ParteTrabajo.jsx: por cuadrilla, no por correo.
 *
 * La regla exige que `cuadrillaId` vaya fijado con `==` a un único valor, porque de ahí
 * cuelga la ruta del get() que resuelve la cuadrilla viva. Un operario en dos cuadrillas
 * hace dos consultas; aquí cada uno está en una.
 */
const consultaDelDia = (db, cuadrillaId) => getDocs(query(
  collection(db, 'cuadrantes'),
  where('cuadrillaId', '==', cuadrillaId),
  where('fecha', '==', HOY),
  orderBy('horaInicio')
));

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });

  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Una cuadrilla por operario: es de ellas de donde cuelga ahora quién ve qué.
    await setDoc(doc(db, 'cuadrillas/c-solo'), cuadrillaCon('Cuadrilla A', [SOLO]));
    await setDoc(doc(db, 'cuadrillas/c-doble'), cuadrillaCon('Cuadrilla A', [DOBLE]));
    await setDoc(doc(db, 'cuadrillas/c-huerfano'), cuadrillaCon('Cuadrilla A', [HUERFANO]));

    await setDoc(doc(db, 'cuadrantes/asig-solo'), asignacion('c-solo'));
    // Sembradas al revés a propósito: la consulta tiene que devolverlas ordenadas.
    await setDoc(doc(db, 'cuadrantes/asig-doble-tarde'), asignacion('c-doble', {
      horaInicio: '15:00', horaFin: '19:00', destinoTipo: 'taller', obraId: null, obraNombre: null
    }));
    await setDoc(doc(db, 'cuadrantes/asig-doble-manana'), asignacion('c-doble', {
      horaInicio: '08:00', horaFin: '14:00', obraNombre: 'Hotel Luna', obraId: 'o2'
    }));
    // Del huérfano, pero de AYER: no debe aparecer hoy.
    await setDoc(doc(db, 'cuadrantes/asig-vieja'), asignacion('c-huerfano', { fecha: AYER }));
  });

  const solo = testEnv.authenticatedContext('uid-solo', { email: SOLO }).firestore();
  const doble = testEnv.authenticatedContext('uid-doble', { email: DOBLE }).firestore();
  const huerfano = testEnv.authenticatedContext('uid-huerfano', { email: HUERFANO }).firestore();

  // ====================================================== una sola asignación
  titulo('Operario con UNA asignación: la ve y el parte sale con su obra');

  let laSuya;
  await comprobar('la consulta le devuelve exactamente una', async () => {
    const snap = await assertSucceeds(consultaDelDia(solo, 'c-solo'));
    igual(snap.size, 1, 'asignaciones');
    laSuya = snap.docs[0].data();
  });

  await comprobar('trae obra, horario, vehículo y cuadrilla para pre-rellenar', async () => {
    igual(laSuya.obraId, 'o1', 'obraId');
    igual(laSuya.obraNombre, 'Hotel Sol', 'obraNombre');
    igual(laSuya.horaInicio, '08:00', 'horaInicio');
    igual(laSuya.vehiculoNombre, 'Furgoneta 1', 'vehiculoNombre');
    igual(laSuya.cuadrillaNombre, 'Cuadrilla A', 'cuadrillaNombre');
  });

  await comprobar('puede enviar el parte CON los campos nuevos', async () => {
    // Si camposDelOperario() no incluye asignacionId / horasTaller / horasCalle,
    // el hasOnly() tumba esto y el operario se queda sin poder enviar.
    await assertSucceeds(addDoc(collection(solo, 'partes_de_trabajo'), parteDe(SOLO)));
  });

  await comprobar('no ve la asignación de otro operario', async () => {
    const snap = await assertSucceeds(consultaDelDia(solo, 'c-solo'));
    igual(snap.docs.some((d) => d.id.startsWith('asig-doble')), false, 'no debe ver las ajenas');
  });

  await comprobar('ni consultando la cuadrilla ajena a propósito', async () => {
    // Lo anterior sale gratis por ser cuadrillas distintas; esto es la comprobación
    // de verdad: pedir la ajena directamente tiene que ser denegado, no vacío.
    await assertFails(consultaDelDia(solo, 'c-doble'));
  });

  // ============================================================ varias
  titulo('Operario con VARIAS: las recibe todas y ordenadas');

  await comprobar('la consulta le devuelve las dos', async () => {
    const snap = await assertSucceeds(consultaDelDia(doble, 'c-doble'));
    igual(snap.size, 2, 'asignaciones');
  });

  await comprobar('llegan ordenadas por hora, aunque se sembraran al revés', async () => {
    const snap = await consultaDelDia(doble, 'c-doble');
    const horas = snap.docs.map((d) => d.data().horaInicio);
    igual(horas.join(','), '08:00,15:00', 'orden');
  });

  await comprobar('distingue el destino de taller del de obra', async () => {
    const snap = await consultaDelDia(doble, 'c-doble');
    const tarde = snap.docs.map((d) => d.data()).find((a) => a.horaInicio === '15:00');
    igual(tarde.destinoTipo, 'taller', 'destinoTipo');
    igual(tarde.obraId, null, 'una asignación de taller no tiene obra del catálogo');
  });

  await comprobar('un parte de TALLER se acepta con obra "Taller" y obraId null', async () => {
    await assertSucceeds(addDoc(collection(doble, 'partes_de_trabajo'), parteDe(DOBLE, {
      obra: 'Taller', obraId: null, asignacionId: 'asig-doble-tarde', horasTaller: 8, horasCalle: 0
    })));
  });

  // =========================================================== ninguna
  titulo('Operario SIN asignación: lista vacía, pero puede crear libre');

  await comprobar('la consulta no falla, simplemente no devuelve nada', async () => {
    const snap = await assertSucceeds(consultaDelDia(huerfano, 'c-huerfano'));
    igual(snap.size, 0, 'asignaciones de hoy');
  });

  await comprobar('la de AYER no se cuela en la de hoy', async () => {
    const snap = await consultaDelDia(huerfano, 'c-huerfano');
    igual(snap.docs.some((d) => d.id === 'asig-vieja'), false, 'no debe aparecer');
  });

  await comprobar('SÍ puede enviar un parte libre, con asignacionId null', async () => {
    // La vía libre sigue abierta: si la oficina no planificó, el operario trabaja igual.
    await assertSucceeds(addDoc(collection(huerfano, 'partes_de_trabajo'), parteDe(HUERFANO, {
      obra: 'Cliente de urgencia', obraId: null, asignacionId: null, horasTaller: 0, horasCalle: 8
    })));
  });

  // =================================================== la lista blanca
  titulo('La lista blanca sigue siendo estricta');

  await comprobar('un campo inventado sigue rechazándose', async () => {
    await assertFails(addDoc(collection(solo, 'partes_de_trabajo'), parteDe(SOLO, { sueldo: 9999 })));
  });

  await comprobar('el operario no puede crearse el parte ya aprobado', async () => {
    await assertFails(addDoc(collection(solo, 'partes_de_trabajo'), parteDe(SOLO, { estado: 'aprobado' })));
  });

  await comprobar('no puede firmar un parte a nombre de otro', async () => {
    await assertFails(addDoc(collection(solo, 'partes_de_trabajo'), parteDe(DOBLE)));
  });

  await comprobar('sigue sin poder escribir en cuadrantes', async () => {
    await assertFails(setDoc(doc(solo, 'cuadrantes/asig-solo'), { estado: 'parte_enviado' }, { merge: true }));
  });

  await testEnv.cleanup();

  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n✖ ' + error.message);
  process.exit(1);
});
