/**
 * Reglas de `categorias_profesionales` y `ausencias`, contra el emulador.
 *
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/categorias-ausencias-reglas.test.mjs"
 *
 * LO QUE SE COMPRUEBA: las dos colecciones son DATO SALARIAL y no siguen el patrón de
 * cuadrillas/vehiculos —que son `autenticado()` porque el operario los necesita—. Aquí
 * hacen falta los dos permisos, igual que en validaciones/ y nominas/. Un administrador
 * operativo sin veNominas no debe poder ni leer la tabla de tarifas ni tocar quién falta.
 *
 * Y se comprueba lo que NO cambia: la Fase 1 es aditiva, así que todo lo anterior
 * responde igual que antes.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const MAIL_COMPLETO = 'jefa@empresa.com';
const MAIL_OPERATIVO = 'encargado@empresa.com';
const MAIL_OPERARIO = 'juan@empresa.com';

let testEnv;
let fallos = 0;
let numero = 0;

const titulo = (t) => { numero += 1; console.log(`\n─── CASO ${numero}: ${t}`); };
async function comprobar(desc, fn) {
  try { await fn(); console.log(`   PASA   · ${desc}`); }
  catch (e) {
    fallos += 1;
    console.log(`   FALLA  · ${desc}\n            ${e.message.split('\n')[0]}`);
    throw new Error('parada en el primer fallo');
  }
}
const igual = (a, b, m) => { if (a !== b) throw new Error(`${m}: esperaba ${b}, recibí ${a}`); };

const categoria = (extra = {}) => ({
  nombre: 'Oficial 1ª', tarifaDiaria: 95.4, tarifaHoraExtra: 14.2,
  papelera: false,
  creadoEn: Date.now(), creadoPor: MAIL_COMPLETO,
  actualizadoEn: Date.now(), actualizadoPor: MAIL_COMPLETO,
  ...extra
});

const ausencia = (extra = {}) => ({
  trabajadorId: 't1', trabajadorNombre: 'Juan',
  fecha: '2026-09-07', tipo: 'falta', motivo: 'Cita médica',
  creadoPor: MAIL_COMPLETO, creadoEn: Date.now(),
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
    await setDoc(doc(db, 'roles/uid-completo'), { admin: true, veNominas: true });
    await setDoc(doc(db, 'roles/uid-operativo'), { admin: true });   // sin veNominas
    await setDoc(doc(db, 'categorias_profesionales/c1'), categoria());
    await setDoc(doc(db, 'ausencias/a1'), ausencia());
    await setDoc(doc(db, 'trabajadores/t1'), { nombre: 'Juan', email: MAIL_OPERARIO, papelera: false });
    await setDoc(doc(db, 'obras/o1'), { nombre: 'Hotel Sol' });
  });

  const completo = testEnv.authenticatedContext('uid-completo', { email: MAIL_COMPLETO }).firestore();
  const operativo = testEnv.authenticatedContext('uid-operativo', { email: MAIL_OPERATIVO }).firestore();
  const operario = testEnv.authenticatedContext('uid-juan', { email: MAIL_OPERARIO }).firestore();
  const anonimo = testEnv.unauthenticatedContext().firestore();

  // ================================================ categorías
  titulo('categorias_profesionales — es la tabla de tarifas del convenio');

  await comprobar('con los dos permisos, se lee', async () => {
    const d = await assertSucceeds(getDoc(doc(completo, 'categorias_profesionales/c1')));
    igual(d.get('tarifaDiaria'), 95.4, 'tarifaDiaria');
  });
  await comprobar('con los dos permisos, se lista', async () => {
    const s = await assertSucceeds(getDocs(collection(completo, 'categorias_profesionales')));
    igual(s.size, 1, 'categorías');
  });
  await comprobar('con los dos permisos, se crea, edita y borra', async () => {
    await assertSucceeds(setDoc(doc(completo, 'categorias_profesionales/c2'), categoria({ nombre: 'Peón' })));
    await assertSucceeds(updateDoc(doc(completo, 'categorias_profesionales/c2'), { tarifaDiaria: 80 }));
    await assertSucceeds(deleteDoc(doc(completo, 'categorias_profesionales/c2')));
  });

  await comprobar('el admin OPERATIVO no puede leerla', async () => {
    // Es lo que separa esta colección de cuadrillas/vehiculos: publicar las tarifas a
    // todo el que entre sería dejar los sueldos en el móvil de cada operario.
    await assertFails(getDoc(doc(operativo, 'categorias_profesionales/c1')));
  });
  await comprobar('el admin operativo tampoco puede listarlas', async () => {
    await assertFails(getDocs(collection(operativo, 'categorias_profesionales')));
  });
  await comprobar('el admin operativo no puede crear ni editar ni borrar', async () => {
    await assertFails(setDoc(doc(operativo, 'categorias_profesionales/c-suya'), categoria()));
    await assertFails(updateDoc(doc(operativo, 'categorias_profesionales/c1'), { tarifaDiaria: 999 }));
    await assertFails(deleteDoc(doc(operativo, 'categorias_profesionales/c1')));
  });
  await comprobar('el operario no ve nada, ni con sesión ni sin ella', async () => {
    await assertFails(getDoc(doc(operario, 'categorias_profesionales/c1')));
    await assertFails(getDocs(collection(operario, 'categorias_profesionales')));
    await assertFails(getDoc(doc(anonimo, 'categorias_profesionales/c1')));
  });

  // ================================================== ausencias
  titulo('ausencias — quién falta y qué día');

  await comprobar('con los dos permisos, se lee y se lista', async () => {
    await assertSucceeds(getDoc(doc(completo, 'ausencias/a1')));
    const s = await assertSucceeds(getDocs(collection(completo, 'ausencias')));
    igual(s.size, 1, 'ausencias');
  });
  await comprobar('con los dos permisos, se registra y se quita', async () => {
    await assertSucceeds(setDoc(doc(completo, 'ausencias/a2'), ausencia({ fecha: '2026-09-08' })));
    await assertSucceeds(updateDoc(doc(completo, 'ausencias/a2'), { motivo: 'Otro' }));
    await assertSucceeds(deleteDoc(doc(completo, 'ausencias/a2')));
  });

  await comprobar('el admin OPERATIVO no puede leerlas', async () => {
    await assertFails(getDoc(doc(operativo, 'ausencias/a1')));
    await assertFails(getDocs(collection(operativo, 'ausencias')));
  });
  await comprobar('el admin operativo no puede registrar ni borrar', async () => {
    await assertFails(setDoc(doc(operativo, 'ausencias/a-suya'), ausencia()));
    await assertFails(deleteDoc(doc(operativo, 'ausencias/a1')));
  });
  await comprobar('el operario no ve las suyas ni las de nadie', async () => {
    // Con el modelo nuevo cada ausencia vale una jornada: es dato salarial.
    await assertFails(getDoc(doc(operario, 'ausencias/a1')));
    await assertFails(getDocs(collection(operario, 'ausencias')));
  });

  titulo('La forma de una ausencia se valida al crear');

  await comprobar('exige trabajadorId', async () => {
    const sinTrabajador = ausencia();
    delete sinTrabajador.trabajadorId;
    await assertFails(setDoc(doc(completo, 'ausencias/mala-1'), sinTrabajador));
    await assertFails(setDoc(doc(completo, 'ausencias/mala-2'), ausencia({ trabajadorId: '' })));
  });
  await comprobar('exige una fecha con forma AAAA-MM-DD', async () => {
    for (const mala of ['7/9/2026', '2026-9-7', 'ayer', '']) {
      await assertFails(setDoc(doc(completo, 'ausencias/mala-3'), ausencia({ fecha: mala })));
    }
  });
  await comprobar('el SÁBADO no lo rechazan las reglas: eso es del formulario', async () => {
    // A propósito. Vive en logica/ausencias.js, donde se prueba en milisegundos, y
    // protege del error honesto —del dedo que se equivoca— no de un tercero, que no
    // gana nada saltándosela. Aquí se deja constancia de dónde está la frontera.
    await assertSucceeds(setDoc(doc(completo, 'ausencias/sabado'), ausencia({ fecha: '2026-09-05' })));
    await deleteDoc(doc(completo, 'ausencias/sabado'));
  });

  // ============================== el esquema 2 de las líneas de nómina
  titulo('nominas/{id}/lineas acepta los DOS esquemas');

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'nominas/2026-09-v1'), {
      periodo: '2026-09', version: 1, rangoInicio: 1, rangoFin: 2,
      estado: 'cerrado', cerradoPor: 'uid-completo', totales: {}
    });
  });

  await comprobar('esquema 1 (horasNormales) sigue aceptándose', async () => {
    await assertSucceeds(setDoc(doc(completo, 'nominas/2026-09-v1/lineas/t1'), {
      trabajadorId: 't1', horasNormales: 160, horasExtra: 3, total: 1645
    }));
  });
  await comprobar('esquema 2 (diasTrabajados) también', async () => {
    // Se amplía ANTES de que exista el cálculo: las reglas se despliegan antes que la
    // interfaz, y un cierre del modelo nuevo con la regla vieja se rechazaría entero.
    await assertSucceeds(setDoc(doc(completo, 'nominas/2026-09-v1/lineas/t2'), {
      trabajadorId: 't2', diasTrabajados: 21, horasExtra: 3, total: 2045.4
    }));
  });
  await comprobar('sin ninguno de los dos, se rechaza', async () => {
    await assertFails(setDoc(doc(completo, 'nominas/2026-09-v1/lineas/t3'), {
      trabajadorId: 't3', horasExtra: 0, total: 100
    }));
  });
  await comprobar('el admin operativo sigue sin poder escribir líneas', async () => {
    await assertFails(setDoc(doc(operativo, 'nominas/2026-09-v1/lineas/t4'), {
      trabajadorId: 't4', diasTrabajados: 21, horasExtra: 0, total: 100
    }));
  });

  // ======================================= la fase es aditiva: nada más se movió
  titulo('Lo que ya estaba desplegado responde igual');

  await comprobar('el operario sigue leyendo obras (no es dato salarial)', async () => {
    await assertSucceeds(getDoc(doc(operario, 'obras/o1')));
  });
  await comprobar('el operario sigue leyendo SU ficha', async () => {
    await assertSucceeds(getDoc(doc(operario, 'trabajadores/t1')));
  });
  await comprobar('el admin operativo conserva lo suyo', async () => {
    await assertSucceeds(setDoc(doc(operativo, 'obras/o2'), { nombre: 'Hotel Luna' }));
    await assertSucceeds(getDocs(collection(operativo, 'certificaciones')));
  });
  await comprobar('validaciones y nominas siguen exigiendo los dos permisos', async () => {
    await assertFails(getDocs(collection(operativo, 'validaciones')));
    await assertFails(getDoc(doc(operativo, 'nominas/2026-09-v1')));
  });
  await comprobar('roles sigue cerrado a todos', async () => {
    await assertFails(getDoc(doc(completo, 'roles/uid-completo')));
  });
  await comprobar('una colección inventada sigue denegada por defecto', async () => {
    await assertFails(getDoc(doc(completo, 'coleccion_que_no_existe/x')));
  });

  await testEnv.cleanup();
  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n✖ ' + e.message); process.exit(1); });
