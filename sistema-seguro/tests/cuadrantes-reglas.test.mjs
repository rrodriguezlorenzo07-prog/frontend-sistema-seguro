/**
 * Reglas de las tres colecciones nuevas de planificación, contra el emulador.
 *
 * Ejecutar con:
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/cuadrantes-reglas.test.mjs"
 *
 * Requiere un JRE instalado: el emulador de Firestore es un binario Java.
 *
 * LO QUE SE COMPRUEBA, en una frase: que un operario vea SU asignación y la de nadie
 * más, y que «la suya» se decida por la cuadrilla DE AHORA y no por la de cuando se
 * planificó. Todo lo demás de este fichero es contexto de esa comprobación.
 *
 * POR QUÉ CAMBIÓ. Antes cada asignación guardaba su propio `operarioEmails`, copiado al
 * crearla. Añadir a alguien a la cuadrilla después no le daba acceso —había que rehacer
 * la asignación— y quitarlo no se lo retiraba. Ahora la regla resuelve
 * `cuadrillas/{cuadrillaId}` con un get() por ruta, igual que esAdmin() con roles/{uid}.
 *
 * EL DETALLE QUE SE PAGA EN PRODUCCIÓN: con esa regla, la consulta tiene que fijar
 * `cuadrillaId` con `==` a un ÚNICO valor, para que la ruta del get() sea constante en
 * toda la consulta. Sin ese filtro no devuelve menos resultados: falla entera y la
 * pantalla se queda en blanco. Un `in` de dos valores también falla. Las dos cosas se
 * comprueban abajo.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const EMAIL_ADMIN = 'oficina@empresa.com';
const EMAIL_OP1 = 'juan@empresa.com';
const EMAIL_OP2 = 'ana@empresa.com';
const EMAIL_OP3 = 'benito@empresa.com';   // se añade DESPUÉS de planificar
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

/** La asignación ya NO lleva correos: solo apunta a su cuadrilla. */
const asignacionDe = (cuadrillaId, extra = {}) => ({
  fecha: HOY,
  horaInicio: '08:00',
  horaFin: '14:00',
  cuadrillaId,
  cuadrillaNombre: 'Cuadrilla ' + cuadrillaId,
  // Etiqueta informativa: quién estaba previsto. No gobierna ningún permiso.
  operarios: [],
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

const cuadrillaCon = (nombre, correos) => ({
  nombre,
  operarios: correos.map((email, i) => ({ trabajadorId: `t${i}`, nombre: `Op ${i}`, email })),
  operarioEmails: correos,
  papelera: false
});

/** La consulta REAL de la vista del operario. */
const consultaDelMovil = (db, cuadrillaId) => getDocs(query(
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

  // ---- Semilla, saltándose las reglas ---------------------------------------
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'roles/uid-admin'), { admin: true });
    await setDoc(doc(db, 'cuadrillas/c1'), cuadrillaCon('Cuadrilla A', [EMAIL_OP1]));
    await setDoc(doc(db, 'cuadrillas/c2'), cuadrillaCon('Cuadrilla B', [EMAIL_OP2]));
    await setDoc(doc(db, 'vehiculos/v1'), { nombre: 'Furgoneta 1', matricula: '1234 ABC', papelera: false });

    // La de Juan y la de Ana, el mismo día.
    await setDoc(doc(db, 'cuadrantes/asig-juan'), asignacionDe('c1'));
    await setDoc(doc(db, 'cuadrantes/asig-ana'), asignacionDe('c2', { horaInicio: '15:00', horaFin: '19:00' }));
  });

  const admin = testEnv.authenticatedContext('uid-admin', { email: EMAIL_ADMIN, admin: true }).firestore();
  const juan = testEnv.authenticatedContext('uid-juan', { email: EMAIL_OP1 }).firestore();
  const ana = testEnv.authenticatedContext('uid-ana', { email: EMAIL_OP2 }).firestore();
  const benito = testEnv.authenticatedContext('uid-benito', { email: EMAIL_OP3 }).firestore();
  const anonimo = testEnv.unauthenticatedContext().firestore();

  // ========================================================== catálogos
  titulo('Catálogos: los lee cualquiera que haya entrado, los escribe solo la oficina');

  await comprobar('el operario LEE las cuadrillas (necesita saber cuál es la suya)', async () => {
    await assertSucceeds(getDoc(doc(juan, 'cuadrillas/c1')));
  });
  await comprobar('el operario LISTA las cuadrillas: es el primer paso de su consulta', async () => {
    await assertSucceeds(getDocs(collection(juan, 'cuadrillas')));
  });
  await comprobar('el operario LEE los vehículos', async () => {
    await assertSucceeds(getDoc(doc(juan, 'vehiculos/v1')));
  });
  await comprobar('el operario NO puede crear una cuadrilla', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrillas/c-nueva'), cuadrillaCon('Mía', [])));
  });
  await comprobar('el operario NO puede editar una cuadrilla', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrillas/c1'), { nombre: 'Otra' }, { merge: true }));
  });
  await comprobar('el operario NO puede METERSE en una cuadrilla ajena', async () => {
    // Si pudiera, se daría acceso solo a las asignaciones de esa cuadrilla.
    await assertFails(updateDoc(doc(juan, 'cuadrillas/c2'), { operarioEmails: [EMAIL_OP2, EMAIL_OP1] }));
  });
  await comprobar('el operario NO puede crear un vehículo', async () => {
    await assertFails(setDoc(doc(juan, 'vehiculos/v-nuevo'), { nombre: 'Mío', papelera: false }));
  });
  await comprobar('sin sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(anonimo, 'cuadrillas/c1')));
    await assertFails(getDoc(doc(anonimo, 'vehiculos/v1')));
  });
  await comprobar('la oficina SÍ crea y edita', async () => {
    await assertSucceeds(setDoc(doc(admin, 'cuadrillas/c-admin'), cuadrillaCon('Nueva', [])));
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
    const snap = await assertSucceeds(consultaDelMovil(juan, 'c1'));
    if (snap.size !== 1) throw new Error(`esperaba 1 asignación, recibí ${snap.size}`);
    if (snap.docs[0].id !== 'asig-juan') throw new Error('devolvió la asignación equivocada');
  });
  await comprobar('Juan NO puede consultar la cuadrilla de Ana', async () => {
    await assertFails(consultaDelMovil(juan, 'c2'));
  });
  await comprobar('la oficina SÍ ve el cuadrante entero del día', async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(admin, 'cuadrantes'), where('fecha', '==', HOY), orderBy('horaInicio')
    )));
    if (snap.size !== 2) throw new Error(`la oficina debía ver 2, vio ${snap.size}`);
  });

  // ================================================== EL BUG QUE SE CORRIGIÓ
  titulo('La cuadrilla VIVA manda: altas y bajas surten efecto sin tocar la asignación');

  await comprobar('antes del alta, Benito no ve nada (correcto)', async () => {
    await assertFails(consultaDelMovil(benito, 'c1'));
    await assertFails(getDoc(doc(benito, 'cuadrantes/asig-juan')));
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'cuadrillas/c1'), {
      operarios: [
        { trabajadorId: 't0', nombre: 'Juan', email: EMAIL_OP1 },
        { trabajadorId: 't9', nombre: 'Benito', email: EMAIL_OP3 }
      ],
      operarioEmails: [EMAIL_OP1, EMAIL_OP3]
    });
  });

  await comprobar('ALTA: Benito ve la asignación YA EXISTENTE, sin recrearla', async () => {
    const snap = await assertSucceeds(consultaDelMovil(benito, 'c1'));
    if (snap.size !== 1) throw new Error(`esperaba 1, recibí ${snap.size}`);
    await assertSucceeds(getDoc(doc(benito, 'cuadrantes/asig-juan')));
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'cuadrillas/c1'), {
      operarios: [{ trabajadorId: 't9', nombre: 'Benito', email: EMAIL_OP3 }],
      operarioEmails: [EMAIL_OP3]
    });
  });

  await comprobar('BAJA: Juan deja de verla al instante, sin tocar el cuadrante', async () => {
    await assertFails(consultaDelMovil(juan, 'c1'));
    await assertFails(getDoc(doc(juan, 'cuadrantes/asig-juan')));
  });
  await comprobar('Benito, que sigue dentro, no se ve afectado', async () => {
    await assertSucceeds(consultaDelMovil(benito, 'c1'));
  });

  // Se deja como estaba para el resto de casos.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'cuadrillas/c1'), {
      operarios: [{ trabajadorId: 't0', nombre: 'Juan', email: EMAIL_OP1 }],
      operarioEmails: [EMAIL_OP1]
    });
  });

  // ============================ LA FORMA DE LA CONSULTA, que es lo que se paga caro
  titulo('La consulta tiene que fijar cuadrillaId, y no es cuestión de volumen');

  await comprobar('listar el cuadrante entero sin filtrar FALLA', async () => {
    await assertFails(getDocs(collection(juan, 'cuadrantes')));
  });
  await comprobar('filtrar solo por fecha FALLA, aunque solo haya una suya', async () => {
    await assertFails(getDocs(query(collection(juan, 'cuadrantes'), where('fecha', '==', HOY))));
  });
  await comprobar('un `in` con UNA cuadrilla pasa', async () => {
    await assertSucceeds(getDocs(query(collection(juan, 'cuadrantes'), where('cuadrillaId', 'in', ['c1']))));
  });
  await comprobar('un `in` con DOS cuadrillas FALLA: hace falta una consulta por cuadrilla', async () => {
    await assertFails(getDocs(query(collection(juan, 'cuadrantes'), where('cuadrillaId', 'in', ['c1', 'c2']))));
  });
  await comprobar('con cuadrillaId fijado, 30 documentos pasan de una vez', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 30; i += 1) await setDoc(doc(db, `cuadrantes/masiva-${i}`), asignacionDe('c1'));
    });
    const snap = await assertSucceeds(consultaDelMovil(juan, 'c1'));
    if (snap.size !== 31) throw new Error(`esperaba 31, recibí ${snap.size}`);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 30; i += 1) await deleteDoc(doc(db, `cuadrantes/masiva-${i}`));
    });
  });

  // ============================================ escritura del cuadrante
  titulo('Solo la oficina planifica');

  await comprobar('el operario NO puede crearse una asignación', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrantes/inventada'), asignacionDe('c1')));
  });
  await comprobar('el operario NO puede editar la suya', async () => {
    await assertFails(setDoc(doc(juan, 'cuadrantes/asig-juan'), { horaFin: '20:00' }, { merge: true }));
  });
  await comprobar('el operario NO puede borrar la suya', async () => {
    await assertFails(deleteDoc(doc(juan, 'cuadrantes/asig-juan')));
  });
  await comprobar('la oficina SÍ crea una asignación', async () => {
    await assertSucceeds(setDoc(doc(admin, 'cuadrantes/asig-nueva'), asignacionDe('c1')));
  });

  titulo('La forma del documento se valida al crear');

  await comprobar('rechaza una asignación SIN cuadrillaId', async () => {
    const sinCuadrilla = asignacionDe('c1');
    delete sinCuadrilla.cuadrillaId;
    await assertFails(setDoc(doc(admin, 'cuadrantes/mala-1'), sinCuadrilla));
  });
  await comprobar('rechaza cuadrillaId vacío (nadie podría verla)', async () => {
    await assertFails(setDoc(doc(admin, 'cuadrantes/mala-2'), asignacionDe('')));
  });
  await comprobar('rechaza un destinoTipo que no existe', async () => {
    await assertFails(setDoc(doc(admin, 'cuadrantes/mala-3'), asignacionDe('c1', { destinoTipo: 'luna' })));
  });
  await comprobar('acepta destino taller', async () => {
    await assertSucceeds(setDoc(doc(admin, 'cuadrantes/taller-1'), asignacionDe('c1', {
      destinoTipo: 'taller', obraId: null, obraNombre: null
    })));
  });
  await comprobar('una asignación a una cuadrilla borrada no revienta: se deniega', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'cuadrantes/huerfana'), asignacionDe('cuadrilla-que-no-existe'));
    });
    await assertFails(getDoc(doc(juan, 'cuadrantes/huerfana')));
    // Y la oficina sí la ve, que es lo que permite arreglarla.
    await assertSucceeds(getDoc(doc(admin, 'cuadrantes/huerfana')));
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
    await assertFails(getDoc(doc(admin, 'coleccion_que_no_existe/x')));
  });

  await testEnv.cleanup();

  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n✖ ' + error.message);
  process.exit(1);
});
