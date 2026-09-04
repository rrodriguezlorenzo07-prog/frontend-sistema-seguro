/**
 * Reglas de las tres colecciones nuevas de planificación, contra el emulador.
 *
 * Ejecutar con:
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/cuadrantes-reglas.test.mjs"
 *
 * Requiere un JRE instalado: el emulador de Firestore es un binario Java.
 *
 * LO QUE SE COMPRUEBA, en una frase: que un operario vea SU asignación y la de nadie
 * más. Todo lo demás de este fichero es contexto de esa comprobación.
 *
 * El detalle que importa: la regla filtra por `operarioEmails`, un array plano de
 * cadenas, porque las reglas de Firestore no saben recorrer un array de objetos. Y con
 * esa regla, una consulta SIN el filtro no devuelve menos resultados: falla entera. Eso
 * también se comprueba aquí, porque es el error que se paga en producción con una
 * pantalla en blanco.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const EMAIL_ADMIN = 'oficina@empresa.com';
const EMAIL_OP1 = 'juan@empresa.com';
const EMAIL_OP2 = 'ana@empresa.com';
const HOY = '2026-09-04';

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

const asignacionDe = (correos, extra = {}) => ({
  fecha: HOY,
  horaInicio: '08:00',
  horaFin: '14:00',
  cuadrillaId: 'c1',
  cuadrillaNombre: 'Cuadrilla A',
  operarios: correos.map((email, i) => ({ trabajadorId: `t${i}`, nombre: `Op ${i}`, email })),
  operarioEmails: correos,
  vehiculoId: 'v1',
  vehiculoNombre: 'Furgoneta 1',
  destinoTipo: 'obra',
  obraId: 'o1',
  obraNombre: 'Hotel Sol',
  estado: 'planificado',
  parteId: null,
  creadoPor: EMAIL_ADMIN,
  creadoEn: Date.now(),
  ...extra
});

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });

  await testEnv.clearFirestore();

  // ---- Semilla, saltándose las reglas ---------------------------------------
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'roles/uid-admin'), { admin: true });
    await setDoc(doc(db, 'cuadrillas/c1'), {
      nombre: 'Cuadrilla A',
      operarios: [{ trabajadorId: 't0', nombre: 'Juan', email: EMAIL_OP1 }],
      papelera: false
    });
    await setDoc(doc(db, 'vehiculos/v1'), { nombre: 'Furgoneta 1', matricula: '1234 ABC', papelera: false });

    // La de Juan y la de Ana, el mismo día.
    await setDoc(doc(db, 'cuadrantes/asig-juan'), asignacionDe([EMAIL_OP1]));
    await setDoc(doc(db, 'cuadrantes/asig-ana'), asignacionDe([EMAIL_OP2], {
      horaInicio: '15:00', horaFin: '19:00', cuadrillaId: 'c2', cuadrillaNombre: 'Cuadrilla B'
    }));
  });

  const admin = testEnv.authenticatedContext('uid-admin', { email: EMAIL_ADMIN, admin: true }).firestore();
  const juan = testEnv.authenticatedContext('uid-juan', { email: EMAIL_OP1 }).firestore();
  const ana = testEnv.authenticatedContext('uid-ana', { email: EMAIL_OP2 }).firestore();
  const anonimo = testEnv.unauthenticatedContext().firestore();

  // ========================================================== catálogos
  titulo('Catálogos: los lee cualquiera que haya entrado, los escribe solo la oficina');

  await comprobar('el operario LEE las cuadrillas (necesita el nombre de la suya)', async () => {
    await assertSucceeds(getDoc(doc(juan, 'cuadrillas/c1')));
  });
  await comprobar('el operario LEE los vehículos', async () => {
    await assertSucceeds(getDoc(doc(juan, 'vehiculos/v1')));
  });
  await comprobar('el operario NO puede crear una cuadrilla', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrillas/c-nueva'), { nombre: 'Mía', operarios: [], papelera: false }));
  });
  await comprobar('el operario NO puede editar una cuadrilla', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrillas/c1'), { nombre: 'Otra' }, { merge: true }));
  });
  await comprobar('el operario NO puede crear un vehículo', async () => {
    await assertFails(setDoc(doc(juan, 'vehiculos/v-nuevo'), { nombre: 'Mío', papelera: false }));
  });
  await comprobar('sin sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(anonimo, 'cuadrillas/c1')));
    await assertFails(getDoc(doc(anonimo, 'vehiculos/v1')));
  });
  await comprobar('la oficina SÍ crea y edita', async () => {
    await assertSucceeds(setDoc(doc(admin, 'cuadrillas/c-admin'), { nombre: 'Nueva', operarios: [], papelera: false }));
    await assertSucceeds(setDoc(doc(admin, 'vehiculos/v-admin'), { nombre: 'Furgoneta 2', papelera: false }));
  });

  // ========================================== EL CASO QUE IMPORTA: aislamiento
  titulo('Cada operario ve SU asignación y ninguna más');

  await comprobar('Juan LEE su propia asignación', async () => {
    await assertSucceeds(getDoc(doc(juan, 'cuadrantes/asig-juan')));
  });

  await comprobar('Juan NO puede leer la de Ana', async () => {
    await assertFails(getDoc(doc(juan, 'cuadrantes/asig-ana')));
  });

  await comprobar('Ana NO puede leer la de Juan', async () => {
    await assertFails(getDoc(doc(ana, 'cuadrantes/asig-juan')));
  });

  await comprobar('la consulta del móvil devuelve SOLO la suya', async () => {
    const snap = await getDocs(query(
      collection(juan, 'cuadrantes'),
      where('operarioEmails', 'array-contains', EMAIL_OP1),
      where('fecha', '==', HOY),
      orderBy('horaInicio')
    ));
    if (snap.size !== 1) throw new Error(`esperaba 1 asignación, recibí ${snap.size}`);
    if (snap.docs[0].id !== 'asig-juan') throw new Error('devolvió la asignación equivocada');
  });

  await comprobar('Juan NO puede listar el cuadrante entero sin filtrar', async () => {
    // Sin el filtro por operarioEmails la regla no se satisface y la consulta FALLA:
    // no devuelve menos resultados. Es justo el error que deja la pantalla en blanco.
    await assertFails(getDocs(collection(juan, 'cuadrantes')));
  });

  await comprobar('Juan NO puede colarse filtrando por el correo de Ana', async () => {
    await assertFails(getDocs(query(
      collection(juan, 'cuadrantes'),
      where('operarioEmails', 'array-contains', EMAIL_OP2)
    )));
  });

  await comprobar('la oficina SÍ ve el cuadrante entero del día', async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(admin, 'cuadrantes'),
      where('fecha', '==', HOY),
      orderBy('horaInicio')
    )));
    if (snap.size !== 2) throw new Error(`la oficina debía ver 2, vio ${snap.size}`);
  });

  // ============================================ escritura del cuadrante
  titulo('Solo la oficina planifica');

  await comprobar('el operario NO puede crearse una asignación', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrantes/inventada'), asignacionDe([EMAIL_OP1])));
  });
  await comprobar('el operario NO puede editar la suya', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrantes/asig-juan'), { horaFin: '20:00' }, { merge: true }));
  });
  await comprobar('el operario NO puede borrar la suya', async () => {
    await assertFails(deleteDoc(doc(juan, 'cuadrantes/asig-juan')));
  });
  await comprobar('la oficina SÍ crea una asignación', async () => {
    await assertSucceeds(setDoc(doc(admin, 'cuadrantes/asig-nueva'), asignacionDe([EMAIL_OP1, EMAIL_OP2])));
  });
  await comprobar('con los dos correos, los DOS la ven', async () => {
    await assertSucceeds(getDoc(doc(juan, 'cuadrantes/asig-nueva')));
    await assertSucceeds(getDoc(doc(ana, 'cuadrantes/asig-nueva')));
  });

  titulo('La forma del documento se valida al crear');

  await comprobar('rechaza una asignación SIN operarioEmails', async () => {
    const sinCorreos = asignacionDe([EMAIL_OP1]);
    delete sinCorreos.operarioEmails;
    await assertFails(setDoc(doc(admin, 'cuadrantes/mala-1'), sinCorreos));
  });
  await comprobar('rechaza operarioEmails vacío (nadie podría verla)', async () => {
    await assertFails(setDoc(doc(admin, 'cuadrantes/mala-2'), asignacionDe([])));
  });
  await comprobar('rechaza un destinoTipo que no existe', async () => {
    await assertFails(setDoc(doc(admin, 'cuadrantes/mala-3'), asignacionDe([EMAIL_OP1], { destinoTipo: 'luna' })));
  });
  await comprobar('acepta destino taller', async () => {
    await assertSucceeds(setDoc(doc(admin, 'cuadrantes/taller-1'), asignacionDe([EMAIL_OP1], {
      destinoTipo: 'taller', obraId: null, obraNombre: null
    })));
  });

  titulo('Las colecciones ya desplegadas siguen igual');

  await comprobar('partes_de_trabajo sigue respondiendo como antes', async () => {
    // Una regla nueva mal escrita podría abrir algo de lo que ya estaba cerrado.
    await assertFails(getDocs(collection(juan, 'partes_de_trabajo')));
  });
  await comprobar('roles sigue cerrado a todos', async () => {
    await assertFails(getDoc(doc(admin, 'roles/uid-admin')));
  });
  await comprobar('una colección inventada sigue denegada por defecto', async () => {
    await assertFails(getDoc(doc(admin, 'acopios/x')));
  });

  await testEnv.cleanup();

  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n✖ ' + error.message);
  process.exit(1);
});
