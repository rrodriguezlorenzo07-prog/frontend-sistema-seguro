/**
 * FRENTE A · Reglas de unidades_obra contra el emulador.
 *
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/unidades-reglas.test.mjs"
 *
 * D7: el operario PROPONE, la oficina CONFIRMA. Lo que hay que probar es que esa
 * frontera aguanta — que un operario no pueda confirmarse a sí mismo lo que luego
 * habilitará facturar.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const ADMIN = 'oficina@empresa.com';
const OP1 = 'juan@empresa.com';
const OP2 = 'ana@empresa.com';

let testEnv;
let fallos = 0;
let numero = 0;

function titulo(t) { numero += 1; console.log(`\n─── CASO ${numero}: ${t}`); }
async function comprobar(desc, fn) {
  try { await fn(); console.log(`   PASA   · ${desc}`); }
  catch (e) {
    fallos += 1;
    console.log(`   FALLA  · ${desc}`);
    console.log(`            ${e.message.split('\n')[0]}`);
    throw new Error('parada en el primer fallo');
  }
}
function igual(a, b, m) { if (a !== b) throw new Error(`${m}: esperaba ${b}, recibí ${a}`); }

const unidad = (extra = {}) => ({
  obraId: 'o1', obraNombre: 'Hotel Sol',
  nombre: 'Unidad 101', numero: 101, orden: 101,
  descripcion: 'Puerta de paso', textoOriginal: 'Habitaciones 100-110',
  parteId: 'p1',
  estado: 'propuesta',
  propuestaPor: OP1, propuestaEn: Date.now(),
  confirmadaPor: null, confirmadaEn: null,
  ...extra
});

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'roles/uid-admin'), { admin: true });
    await setDoc(doc(db, 'unidades_obra/u-de-juan'), unidad());
    await setDoc(doc(db, 'unidades_obra/u-de-ana'), unidad({ propuestaPor: OP2, numero: 102, orden: 102 }));
    await setDoc(doc(db, 'unidades_obra/u-confirmada'), unidad({
      numero: 103, orden: 103, estado: 'confirmada', confirmadaPor: ADMIN, confirmadaEn: Date.now()
    }));
  });

  const admin = testEnv.authenticatedContext('uid-admin', { email: ADMIN, admin: true }).firestore();
  const juan = testEnv.authenticatedContext('uid-juan', { email: OP1 }).firestore();
  const ana = testEnv.authenticatedContext('uid-ana', { email: OP2 }).firestore();
  const anonimo = testEnv.unauthenticatedContext().firestore();

  // ============================================================ lectura
  titulo('Lectura: todos los que han entrado ven el avance');

  await comprobar('el operario lee una unidad', async () => {
    await assertSucceeds(getDoc(doc(juan, 'unidades_obra/u-de-juan')));
  });
  await comprobar('el operario ve TAMBIÉN las de otros: el avance no es secreto', async () => {
    await assertSucceeds(getDoc(doc(juan, 'unidades_obra/u-de-ana')));
  });
  await comprobar('la consulta del mapa de obra funciona', async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(juan, 'unidades_obra'), where('obraId', '==', 'o1'), orderBy('orden')
    )));
    igual(snap.size, 3, 'unidades');
  });
  await comprobar('sin sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(anonimo, 'unidades_obra/u-de-juan')));
  });

  // ======================================================== el operario propone
  titulo('El operario PROPONE');

  await comprobar('crea una propuesta en su propio nombre', async () => {
    await assertSucceeds(setDoc(doc(juan, 'unidades_obra/nueva-1'), unidad({ numero: 200, orden: 200 })));
  });

  await comprobar('NO puede proponer en nombre de otro', async () => {
    await assertFails(setDoc(doc(juan, 'unidades_obra/nueva-2'), unidad({ propuestaPor: OP2 })));
  });

  await comprobar('NO puede crearla ya confirmada', async () => {
    // El atajo evidente: saltarse a la oficina creándola directamente como buena.
    await assertFails(setDoc(doc(juan, 'unidades_obra/nueva-3'), unidad({ estado: 'confirmada' })));
  });

  await comprobar('NO puede rellenar los campos de confirmación al crear', async () => {
    await assertFails(setDoc(doc(juan, 'unidades_obra/nueva-4'), unidad({ confirmadaPor: ADMIN })));
    await assertFails(setDoc(doc(juan, 'unidades_obra/nueva-5'), unidad({ confirmadaEn: Date.now() })));
  });

  await comprobar('sin sesión no se propone nada', async () => {
    await assertFails(setDoc(doc(anonimo, 'unidades_obra/nueva-6'), unidad()));
  });

  // ====================================================== LA FRONTERA QUE IMPORTA
  titulo('Solo la oficina CONFIRMA');

  await comprobar('el operario NO puede confirmar la suya', async () => {
    await assertFails(updateDoc(doc(juan, 'unidades_obra/u-de-juan'), {
      estado: 'confirmada', confirmadaPor: OP1, confirmadaEn: Date.now()
    }));
  });

  await comprobar('tampoco puede confirmar la de otro', async () => {
    await assertFails(updateDoc(doc(juan, 'unidades_obra/u-de-ana'), { estado: 'confirmada' }));
  });

  await comprobar('ni cambiar el nombre de la suya después de proponerla', async () => {
    await assertFails(updateDoc(doc(juan, 'unidades_obra/u-de-juan'), { nombre: 'Otra cosa' }));
  });

  await comprobar('ni moverla a otra obra', async () => {
    await assertFails(updateDoc(doc(juan, 'unidades_obra/u-de-juan'), { obraId: 'o-inventada' }));
  });

  await comprobar('la oficina SÍ confirma', async () => {
    await assertSucceeds(updateDoc(doc(admin, 'unidades_obra/u-de-juan'), {
      estado: 'confirmada', confirmadaPor: ADMIN, confirmadaEn: Date.now()
    }));
  });

  // ============================================================ retirada
  titulo('El operario retira su propuesta, pero no lo confirmado');

  await comprobar('borra una propuesta suya sin confirmar', async () => {
    await assertSucceeds(deleteDoc(doc(juan, 'unidades_obra/nueva-1')));
  });

  await comprobar('NO borra la propuesta de otro', async () => {
    await assertFails(deleteDoc(doc(juan, 'unidades_obra/u-de-ana')));
  });

  await comprobar('NO borra una ya CONFIRMADA: eso ya es de la empresa', async () => {
    await assertFails(deleteDoc(doc(juan, 'unidades_obra/u-confirmada')));
  });

  await comprobar('Ana tampoco borra la de Juan', async () => {
    await assertFails(deleteDoc(doc(ana, 'unidades_obra/u-confirmada')));
  });

  await comprobar('la oficina SÍ borra cualquiera', async () => {
    await assertSucceeds(deleteDoc(doc(admin, 'unidades_obra/u-confirmada')));
  });

  // ================================================== nada de lo viejo se movió
  titulo('Las colecciones ya desplegadas siguen igual');

  await comprobar('partes_de_trabajo responde como antes', async () => {
    await assertFails(getDocs(collection(juan, 'partes_de_trabajo')));
  });
  await comprobar('cuadrantes sigue exigiendo el filtro por cuadrillaId', async () => {
    await assertFails(getDocs(collection(juan, 'cuadrantes')));
  });
  await comprobar('roles sigue cerrado a todos', async () => {
    await assertFails(getDoc(doc(admin, 'roles/uid-admin')));
  });
  await comprobar('una colección inventada sigue denegada', async () => {
    await assertFails(getDoc(doc(admin, 'coleccion_que_no_existe/x')));
  });

  await testEnv.cleanup();
  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n✖ ' + e.message); process.exit(1); });
