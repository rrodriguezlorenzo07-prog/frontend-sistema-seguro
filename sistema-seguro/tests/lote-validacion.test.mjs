/**
 * Atomicidad del lote de aprobación de un parte.
 *
 * Ejecutar con:
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/lote-validacion.test.mjs"
 *
 * QUÉ SE COMPRUEBA
 *
 * Aprobar un parte hace CUATRO escrituras: marcar habitaciones terminadas, descontar
 * stock, cambiar el estado del parte y crear su documento de validación.
 *
 * Hasta el PASO 0 de esta pasada, el marcado de habitaciones era un `updateDoc` suelto
 * que se confirmaba ANTES de que el lote con las otras tres se enviara siquiera. Si el
 * lote fallaba después, quedaban habitaciones marcadas como terminadas por un parte que
 * nunca llegó a aprobarse — y una habitación terminada es lo que habilita facturar.
 *
 * Esta prueba reproduce las dos formas, la vieja y la nueva, contra el emulador, y
 * comprueba que solo la nueva deja la obra intacta cuando algo falla.
 */
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, writeBatch, increment } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';

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

/** Deja la obra con dos habitaciones sin terminar y el material con stock 10. */
async function sembrar(db) {
  await setDoc(doc(db, 'obras/obra-1'), {
    nombre: 'Hotel Sol',
    papelera: false,
    tareas: [
      { id: 'T-1', nombre: 'P1 - Hab 101', numeroHabitacion: 101, completada: false },
      { id: 'T-2', nombre: 'P1 - Hab 102', numeroHabitacion: 102, completada: false }
    ]
  });
  await setDoc(doc(db, 'inventario/MAT-1'), { nombre: 'Silicona', stock: 10 });
}

/** Las tareas con la 101 ya marcada, que es lo que calcularía la aprobación. */
const TAREAS_MARCADAS = [
  { id: 'T-1', nombre: 'P1 - Hab 101', numeroHabitacion: 101, completada: true },
  { id: 'T-2', nombre: 'P1 - Hab 102', numeroHabitacion: 102, completada: false }
];

/**
 * El lote de la aprobación. `parteId` apunta a un parte que NO existe, así que el
 * `update` sobre él hace fallar el lote entero: es la forma limpia de provocar el fallo
 * sin tocar reglas ni red.
 */
function loteDeAprobacion(db, parteId) {
  const lote = writeBatch(db);
  lote.update(doc(db, 'obras/obra-1'), { tareas: TAREAS_MARCADAS });
  lote.update(doc(db, 'inventario/MAT-1'), { stock: increment(-2) });
  lote.update(doc(db, 'partes_de_trabajo', parteId), { estado: 'aprobado' });
  lote.set(doc(db, 'validaciones', parteId), { cuadrilla: [], horasExtraAsignadas: 0 }, { merge: true });
  return lote;
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // ---------------------------------------------------------------- caso 1
    titulo('La forma VIEJA deja habitaciones marcadas cuando el lote falla');
    await testEnv.clearFirestore();
    await sembrar(db);

    // Así estaba escrito antes: el updateDoc de la obra se confirma por su cuenta…
    await updateDoc(doc(db, 'obras/obra-1'), { tareas: TAREAS_MARCADAS });
    // …y solo después se intenta el lote, que falla.
    let falloVieja = false;
    try {
      await loteDeAprobacion(db, 'parte-que-no-existe').commit();
    } catch {
      falloVieja = true;
    }

    await comprobar('el lote falla, como se esperaba', async () => {
      igual(falloVieja, true, 'el lote debía fallar');
    });

    await comprobar('PERO la habitación 101 se quedó marcada como terminada', async () => {
      const obra = await getDoc(doc(db, 'obras/obra-1'));
      igual(obra.data().tareas[0].completada, true, 'la 101 quedó marcada (este era el fallo)');
    });

    await comprobar('y el stock en cambio NO se descontó: el estado quedó incoherente', async () => {
      const mat = await getDoc(doc(db, 'inventario/MAT-1'));
      igual(mat.data().stock, 10, 'stock');
    });

    // ---------------------------------------------------------------- caso 2
    titulo('La forma NUEVA no deja nada escrito cuando el lote falla');
    await testEnv.clearFirestore();
    await sembrar(db);

    // Ahora el marcado de la obra va DENTRO del lote, sin updateDoc previo.
    let falloNueva = false;
    try {
      await loteDeAprobacion(db, 'parte-que-no-existe').commit();
    } catch {
      falloNueva = true;
    }

    await comprobar('el lote falla igual', async () => {
      igual(falloNueva, true, 'el lote debía fallar');
    });

    await comprobar('la habitación 101 sigue SIN terminar', async () => {
      const obra = await getDoc(doc(db, 'obras/obra-1'));
      igual(obra.data().tareas[0].completada, false, 'la 101 no debe marcarse');
    });

    await comprobar('el stock sigue intacto', async () => {
      const mat = await getDoc(doc(db, 'inventario/MAT-1'));
      igual(mat.data().stock, 10, 'stock');
    });

    await comprobar('no se creó ningún documento de validación', async () => {
      const val = await getDoc(doc(db, 'validaciones/parte-que-no-existe'));
      igual(val.exists(), false, 'no debe existir validación');
    });

    // ---------------------------------------------------------------- caso 3
    titulo('Con el parte existiendo, el lote confirma las cuatro escrituras');
    await testEnv.clearFirestore();
    await sembrar(db);
    await setDoc(doc(db, 'partes_de_trabajo/parte-1'), { estado: 'pendiente', obra: 'Hotel Sol' });

    await loteDeAprobacion(db, 'parte-1').commit();

    await comprobar('la habitación 101 queda terminada', async () => {
      const obra = await getDoc(doc(db, 'obras/obra-1'));
      igual(obra.data().tareas[0].completada, true, 'la 101');
    });
    await comprobar('la 102, que nadie tocó, sigue pendiente', async () => {
      const obra = await getDoc(doc(db, 'obras/obra-1'));
      igual(obra.data().tareas[1].completada, false, 'la 102');
    });
    await comprobar('el stock baja de 10 a 8', async () => {
      const mat = await getDoc(doc(db, 'inventario/MAT-1'));
      igual(mat.data().stock, 8, 'stock');
    });
    await comprobar('el parte queda aprobado', async () => {
      const parte = await getDoc(doc(db, 'partes_de_trabajo/parte-1'));
      igual(parte.data().estado, 'aprobado', 'estado');
    });
    await comprobar('y existe su documento de validación', async () => {
      const val = await getDoc(doc(db, 'validaciones/parte-1'));
      igual(val.exists(), true, 'validación');
    });
  });

  await testEnv.cleanup();

  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n✖ ' + error.message);
  process.exit(1);
});
