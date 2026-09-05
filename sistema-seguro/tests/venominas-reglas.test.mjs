/**
 * El permiso de nóminas, separado del de administración operativa.
 *
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/venominas-reglas.test.mjs"
 *
 * LA PREGUNTA QUE CONTESTA ESTE FICHERO: ¿puede un administrador operativo SIN
 * `veNominas` llegar a los datos salariales por alguna vía? Se comprueban las directas
 * —`validaciones/` y `nominas/`— y también la indirecta que existía de verdad: la copia
 * congelada de la cuadrilla dentro de `certificaciones/{id}.albaranes[]`.
 *
 * Y al revés: que separar el permiso NO le quite a nadie lo que ya podía hacer. Un admin
 * operativo tiene que seguir validando partes, planificando y tocando catálogos.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';

const MAIL_COMPLETO = 'jefa@empresa.com';   // admin + veNominas
const MAIL_OPERATIVO = 'encargado@empresa.com'; // admin, SIN veNominas
const MAIL_SOLO_NOMINAS = 'gestora@empresa.com'; // veNominas, SIN admin
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

const validacion = () => ({
  cuadrilla: [{ trabajadorId: 't1', nombre: 'Juan', horasExtra: 3 }],
  horasExtraAsignadas: 3,
  timestamp: Date.now()
});

const cierre = (periodo, version) => ({
  periodo, version,
  rangoInicio: 1, rangoFin: 2,
  estado: 'cerrado',
  cerradoPor: 'uid-completo',
  totales: { trabajadores: 1, horasNormales: 160, horasExtra: 3, importe: 1645 }
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
    // El caso que importa: es admin, pero la llave veNominas NO está escrita.
    await setDoc(doc(db, 'roles/uid-operativo'), { admin: true });
    await setDoc(doc(db, 'roles/uid-gestora'), { veNominas: true });

    await setDoc(doc(db, 'validaciones/p1'), validacion());
    await setDoc(doc(db, 'nominas/2026-08-v1'), cierre('2026-08', 1));
    await setDoc(doc(db, 'nominas/2026-08-v1/lineas/t1'), {
      trabajadorId: 't1', nombre: 'Juan', horasNormales: 160, horasExtra: 3, total: 1645
    });

    await setDoc(doc(db, 'partes_de_trabajo/p1'), {
      obra: 'Hotel Sol', creador: MAIL_OPERARIO, estado: 'pendiente', timestamp: Date.now()
    });
    await setDoc(doc(db, 'obras/o1'), { nombre: 'Hotel Sol' });
    await setDoc(doc(db, 'cuadrillas/c1'), { nombre: 'A', operarios: [], operarioEmails: [], papelera: false });
    await setDoc(doc(db, 'certificaciones/cert-1'), {
      obra: 'Hotel Sol', referencia: 'CERT-1', totalHoras: 11,
      albaranes: [{ id: 'p1', fecha: '04/09/2026', horasTotales: 11, cuadrilla: [{ nombre: 'Juan' }] }]
    });
  });

  const completo = testEnv.authenticatedContext('uid-completo', { email: MAIL_COMPLETO }).firestore();
  const operativo = testEnv.authenticatedContext('uid-operativo', { email: MAIL_OPERATIVO }).firestore();
  const gestora = testEnv.authenticatedContext('uid-gestora', { email: MAIL_SOLO_NOMINAS }).firestore();
  const operario = testEnv.authenticatedContext('uid-juan', { email: MAIL_OPERARIO }).firestore();

  // También por CLAIM, no solo por roles/: las reglas aceptan las dos vías.
  const porClaim = testEnv.authenticatedContext('uid-claim', {
    email: 'claim@empresa.com', admin: true, veNominas: true
  }).firestore();
  const claimSinNominas = testEnv.authenticatedContext('uid-claim2', {
    email: 'claim2@empresa.com', admin: true
  }).firestore();

  // ==================================================== validaciones
  titulo('validaciones/ — horas extra por persona');

  await comprobar('con los dos permisos, se lee', async () => {
    const d = await assertSucceeds(getDoc(doc(completo, 'validaciones/p1')));
    igual(d.get('horasExtraAsignadas'), 3, 'horasExtraAsignadas');
  });
  await comprobar('el admin OPERATIVO no puede leerla', async () => {
    await assertFails(getDoc(doc(operativo, 'validaciones/p1')));
  });
  await comprobar('el admin operativo tampoco puede LISTARLAS', async () => {
    await assertFails(getDocs(collection(operativo, 'validaciones')));
  });
  await comprobar('tampoco puede CREAR una (asignar horas extra)', async () => {
    await assertFails(setDoc(doc(operativo, 'validaciones/p-nueva'), validacion()));
  });
  await comprobar('tampoco puede ACTUALIZARLA', async () => {
    await assertFails(updateDoc(doc(operativo, 'validaciones/p1'), { horasExtraAsignadas: 99 }));
  });
  await comprobar('tampoco puede BORRARLA', async () => {
    await assertFails(deleteDoc(doc(operativo, 'validaciones/p1')));
  });
  await comprobar('quien tiene veNominas pero NO admin tampoco entra', async () => {
    // Hacen falta las DOS: ver nóminas es un permiso de oficina, no una puerta aparte.
    await assertFails(getDoc(doc(gestora, 'validaciones/p1')));
  });
  await comprobar('el operario sigue sin verlas, como siempre', async () => {
    await assertFails(getDoc(doc(operario, 'validaciones/p1')));
  });

  // ========================================================= nominas
  titulo('nominas/ — la liquidación cerrada y sus líneas');

  await comprobar('con los dos permisos, se lee la cabecera y la línea', async () => {
    await assertSucceeds(getDoc(doc(completo, 'nominas/2026-08-v1')));
    await assertSucceeds(getDoc(doc(completo, 'nominas/2026-08-v1/lineas/t1')));
  });
  await comprobar('el admin operativo NO lee la cabecera', async () => {
    await assertFails(getDoc(doc(operativo, 'nominas/2026-08-v1')));
  });
  await comprobar('el admin operativo NO lee las líneas (los importes)', async () => {
    await assertFails(getDoc(doc(operativo, 'nominas/2026-08-v1/lineas/t1')));
    await assertFails(getDocs(collection(operativo, 'nominas/2026-08-v1/lineas')));
  });
  await comprobar('el admin operativo NO puede cerrar un periodo', async () => {
    await assertFails(setDoc(doc(operativo, 'nominas/2026-09-v1'), { ...cierre('2026-09', 1), cerradoPor: 'uid-operativo' }));
  });
  await comprobar('con los dos permisos SÍ se cierra', async () => {
    await assertSucceeds(setDoc(doc(completo, 'nominas/2026-09-v1'), { ...cierre('2026-09', 1), cerradoPor: 'uid-completo' }));
  });
  await comprobar('un cierre sigue sin poder modificarse ni borrarse', async () => {
    await assertFails(updateDoc(doc(completo, 'nominas/2026-08-v1'), { estado: 'abierto' }));
    await assertFails(deleteDoc(doc(completo, 'nominas/2026-08-v1')));
  });

  // ====================================== la vía indirecta: certificaciones
  titulo('certificaciones/ — la copia congelada ya no lleva datos salariales');

  await comprobar('el admin operativo SÍ lee las certificaciones (es su trabajo)', async () => {
    const d = await assertSucceeds(getDoc(doc(operativo, 'certificaciones/cert-1')));
    const albaranes = d.get('albaranes');
    igual(albaranes.length, 1, 'albaranes');

    // Lo que importa: dentro no hay nada de lo que se paga.
    const alb = albaranes[0];
    for (const clave of ['firma', 'horasExtraAsignadas', 'horasTaller', 'horasCalle', 'creador']) {
      if (clave in alb) throw new Error(`el albarán congelado no debe llevar «${clave}»`);
    }
    for (const op of alb.cuadrilla) {
      for (const clave of ['horas', 'horasExtra', 'trabajadorId']) {
        if (clave in op) throw new Error(`la cuadrilla congelada no debe llevar «${clave}»`);
      }
    }
    igual(alb.cuadrilla[0].nombre, 'Juan', 'el nombre sí, que es lo que imprime el PDF');
    igual(alb.horasTotales, 11, 'el total congelado se conserva');
  });

  // ================================ lo operativo NO se toca al separar el permiso
  titulo('El admin operativo conserva todo lo suyo');

  await comprobar('sigue leyendo y validando partes', async () => {
    await assertSucceeds(getDoc(doc(operativo, 'partes_de_trabajo/p1')));
    await assertSucceeds(updateDoc(doc(operativo, 'partes_de_trabajo/p1'), {
      estado: 'aprobado', fechaValidacion: '04/09/2026'
    }));
  });
  await comprobar('sigue gestionando obras y cuadrillas', async () => {
    await assertSucceeds(setDoc(doc(operativo, 'obras/o2'), { nombre: 'Hotel Luna' }));
    await assertSucceeds(updateDoc(doc(operativo, 'cuadrillas/c1'), { nombre: 'B' }));
  });
  await comprobar('sigue leyendo certificaciones y facturas', async () => {
    await assertSucceeds(getDocs(collection(operativo, 'certificaciones')));
    await assertSucceeds(getDocs(collection(operativo, 'facturas')));
  });

  // ======================================== el permiso también viaja en el claim
  titulo('El claim del token vale igual que roles/{uid}');

  await comprobar('con claim admin+veNominas, entra a las nóminas', async () => {
    await assertSucceeds(getDoc(doc(porClaim, 'nominas/2026-08-v1')));
    await assertSucceeds(getDoc(doc(porClaim, 'validaciones/p1')));
  });
  await comprobar('con claim admin pero SIN veNominas, no entra', async () => {
    await assertFails(getDoc(doc(claimSinNominas, 'nominas/2026-08-v1')));
    await assertFails(getDoc(doc(claimSinNominas, 'validaciones/p1')));
  });
  await comprobar('y ese mismo sigue siendo admin para lo operativo', async () => {
    await assertSucceeds(setDoc(doc(claimSinNominas, 'obras/o3'), { nombre: 'Hotel Mar' }));
  });

  await testEnv.cleanup();
  if (fallos === 0) console.log('\n══ TODO CORRECTO ══\n');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n✖ ' + e.message); process.exit(1); });
