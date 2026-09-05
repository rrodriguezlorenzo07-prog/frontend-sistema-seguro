/**
 * Reglas de `acopios` contra el emulador.
 *
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/acopios-reglas.test.mjs"
 *
 * QUÉ SE PRUEBA AQUÍ Y QUÉ NO.
 *
 * Aquí: QUIÉN escribe y QUÉ CAMPOS toca. La oficina planifica (A1); el operario mueve
 * estados (A3) y nada más — no puede crear, ni borrar, ni cambiar de obra, ni tocar la
 * cantidad al marcar algo.
 *
 * El ORDEN de los estados NO se prueba aquí: vive en src/logica/acopios.js y se prueba
 * en tests/acopios.test.mjs sin levantar nada. Las reglas protegen de un tercero
 * malicioso; la lógica, del error honesto.
 *
 * Y se comprueba lo que NO se ha tocado: `inventario` sigue exactamente igual (D4).
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const ADMIN = 'oficina@empresa.com';
const OP1 = 'juan@empresa.com';

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

const acopio = (extra = {}) => ({
  obraId: 'o1', obraNombre: 'Hotel Sol',
  materialId: null, materialNombre: 'Perfil aluminio 40x20',
  descripcion: 'Ventanal salón', cantidad: 3.5, unidad: 'ml',
  requiereFabricacion: true,
  estado: 'pendiente', historial: [],
  actualizadoEn: Date.now(), actualizadoPor: ADMIN,
  creadoEn: Date.now(), creadoPor: ADMIN,
  ...extra
});

/** El cambio de estado tal cual lo produce cambioDeEstado() de la lógica. */
const mover = (estado, por) => ({
  estado,
  actualizadoEn: Date.now(),
  actualizadoPor: por,
  historial: [{ estado, en: Date.now(), por }]
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
    await setDoc(doc(db, 'acopios/a-perfil'), acopio());
    await setDoc(doc(db, 'acopios/a-tornillos'), acopio({
      materialId: 'm1', materialNombre: 'Tornillería', cantidad: 200, unidad: 'ud',
      requiereFabricacion: false
    }));
    // Inventario de referencia, para comprobar que sigue intacto.
    await setDoc(doc(db, 'inventario/m1'), { nombre: 'Tornillería', stock: 500 });
  });

  const admin = testEnv.authenticatedContext('uid-admin', { email: ADMIN, admin: true }).firestore();
  const juan = testEnv.authenticatedContext('uid-juan', { email: OP1 }).firestore();
  const anonimo = testEnv.unauthenticatedContext().firestore();

  // =============================================================== lectura
  titulo('Lectura: el operario necesita saber qué cargar');

  await comprobar('el operario lee un acopio', async () => {
    await assertSucceeds(getDoc(doc(juan, 'acopios/a-perfil')));
  });
  await comprobar('la consulta por obra funciona', async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(juan, 'acopios'), where('obraId', '==', 'o1'), orderBy('creadoEn')
    )));
    igual(snap.size, 2, 'acopios de la obra');
  });
  await comprobar('sin sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(anonimo, 'acopios/a-perfil')));
  });

  // ====================================================== A1: solo oficina crea
  titulo('Solo la oficina planifica (A1)');

  await comprobar('la oficina crea un acopio', async () => {
    await assertSucceeds(setDoc(doc(admin, 'acopios/a-nuevo'), acopio()));
  });
  await comprobar('el operario NO puede crear acopios', async () => {
    await assertFails(setDoc(doc(juan, 'acopios/a-inventado'), acopio({ creadoPor: OP1, actualizadoPor: OP1 })));
  });
  await comprobar('el operario NO puede borrar acopios', async () => {
    await assertFails(deleteDoc(doc(juan, 'acopios/a-perfil')));
  });
  await comprobar('la oficina SÍ borra', async () => {
    await assertSucceeds(deleteDoc(doc(admin, 'acopios/a-nuevo')));
  });

  // ================================================ A3: el operario mueve estados
  titulo('El operario mueve TODOS los estados (A3)');

  for (const estado of ['fabricado', 'recepcionado', 'listo']) {
    await comprobar(`puede marcar «${estado}»`, async () => {
      await assertSucceeds(updateDoc(doc(juan, 'acopios/a-perfil'), mover(estado, OP1)));
    });
  }

  await comprobar('tiene que firmar con SU correo, no con otro', async () => {
    await assertFails(updateDoc(doc(juan, 'acopios/a-perfil'), mover('recepcionado', ADMIN)));
  });

  await comprobar('un estado inventado se rechaza', async () => {
    await assertFails(updateDoc(doc(juan, 'acopios/a-perfil'), mover('entregado', OP1)));
  });

  // ============================================ LO QUE NO PUEDE TOCAR AL MARCAR
  titulo('Marcar un estado no es reescribir el acopio');

  const prohibidos = [
    ['la obra', { obraId: 'o-otra' }],
    ['el material', { materialId: 'm-otro' }],
    ['el nombre del material', { materialNombre: 'Otra cosa' }],
    ['la cantidad', { cantidad: 9999 }],
    ['la unidad', { unidad: 'ud' }],
    ['si requiere fabricación', { requiereFabricacion: false }],
    ['quién lo creó', { creadoPor: OP1 }]
  ];
  for (const [que, campo] of prohibidos) {
    await comprobar(`NO puede cambiar ${que}`, async () => {
      await assertFails(updateDoc(doc(juan, 'acopios/a-perfil'), { ...mover('recepcionado', OP1), ...campo }));
    });
  }

  await comprobar('la oficina SÍ puede corregir la cantidad', async () => {
    await assertSucceeds(updateDoc(doc(admin, 'acopios/a-perfil'), { cantidad: 4.2 }));
  });

  // ================================================== D4: inventario intacto
  titulo('El inventario general no se ha tocado (D4)');

  await comprobar('el operario sigue LEYENDO el inventario', async () => {
    await assertSucceeds(getDoc(doc(juan, 'inventario/m1')));
  });
  await comprobar('el operario sigue SIN poder escribir en él', async () => {
    await assertFails(updateDoc(doc(juan, 'inventario/m1'), { stock: 0 }));
  });
  await comprobar('la oficina sigue pudiendo', async () => {
    await assertSucceeds(updateDoc(doc(admin, 'inventario/m1'), { stock: 480 }));
  });
  await comprobar('el stock sigue donde lo dejó la oficina', async () => {
    const d = await getDoc(doc(admin, 'inventario/m1'));
    igual(d.get('stock'), 480, 'stock');
  });

  // ============================================ nada de lo anterior se movió
  titulo('Las colecciones ya desplegadas siguen igual');

  await comprobar('unidades_obra sigue exigiendo admin para confirmar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'unidades_obra/u1'), {
        obraId: 'o1', nombre: 'Unidad 101', estado: 'propuesta',
        propuestaPor: OP1, propuestaEn: Date.now(), confirmadaPor: null, confirmadaEn: null
      });
    });
    await assertFails(updateDoc(doc(juan, 'unidades_obra/u1'), { estado: 'confirmada' }));
  });
  await comprobar('cuadrantes sigue exigiendo el filtro por cuadrillaId', async () => {
    await assertFails(getDocs(collection(juan, 'cuadrantes')));
  });
  await comprobar('partes_de_trabajo responde como antes', async () => {
    await assertFails(getDocs(collection(juan, 'partes_de_trabajo')));
  });
  await comprobar('roles sigue cerrado a todos', async () => {
    await assertFails(getDoc(doc(admin, 'roles/uid-admin')));
  });

  await testEnv.cleanup();
  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n✖ ' + e.message); process.exit(1); });
