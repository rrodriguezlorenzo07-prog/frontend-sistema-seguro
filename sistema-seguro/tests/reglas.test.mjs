/**
 * Verificación de firestore.rules contra el emulador.
 *
 * Ejecutar con:
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro "node tests/reglas.test.mjs"
 *
 * Requiere un JRE instalado (el emulador de Firestore es un binario Java).
 * Se detiene en el primer caso que falle, como se pidió.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const EMAIL_ADMIN = 'oficina@empresa.com';
const EMAIL_OP1 = 'juan@empresa.com';
const EMAIL_OP2 = 'ana@empresa.com';

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

const parteDeOperario = (creador) => ({
  obra: 'Hotel Sol',
  tareasRealizadas: [{ ubicacion: 'Hab 101', descripcion: 'Puerta de paso' }],
  trabajo: 'Sin incidencias',
  materialesUsados: [{ id: 'MAT-1', nombre: 'Silicona', cantidad: 2, precio: 3.5 }],
  firma: 'https://firebasestorage.googleapis.com/v0/b/x/o/firmas%2Ff.png?alt=media&token=abc',
  creador,
  nombreTrabajador: 'Trabajador de prueba',
  fecha: '29/08/2026',
  hora: '08:30',
  timestamp: Date.now(),
  estado: 'pendiente'
});

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });

  await testEnv.clearFirestore();

  // ---- Semilla, saltándose las reglas (paso 3 del encargo) -----------------
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'roles/uid-admin'), { admin: true, veNominas: true });
    await setDoc(doc(db, 'trabajadores/t-admin'), { nombre: 'Oficina', email: EMAIL_ADMIN, rol: 'admin', papelera: false });
    await setDoc(doc(db, 'trabajadores/t-op1'), { nombre: 'Juan', email: EMAIL_OP1, rol: 'operario', papelera: false });
    await setDoc(doc(db, 'trabajadores/t-op2'), { nombre: 'Ana', email: EMAIL_OP2, rol: 'operario', papelera: false });

    await setDoc(doc(db, 'partes_de_trabajo/parte-op1'), parteDeOperario(EMAIL_OP1));
    await setDoc(doc(db, 'partes_de_trabajo/parte-op2'), parteDeOperario(EMAIL_OP2));
    // Caso 7b: creador guardado con otra caja que la del token de Auth
    await setDoc(doc(db, 'partes_de_trabajo/parte-op1-mayus'), parteDeOperario('Juan@Empresa.com'));
  });

  const admin = testEnv.authenticatedContext('uid-admin', { email: EMAIL_ADMIN }).firestore();
  const op1 = testEnv.authenticatedContext('uid-op1', { email: EMAIL_OP1 }).firestore();

  // ---- CASO 1 -------------------------------------------------------------
  titulo('Admin con roles/{uid}: crear parte, validar y certificar');
  await comprobar('admin crea un parte propio', () =>
    assertSucceeds(setDoc(doc(admin, 'partes_de_trabajo/parte-admin'), parteDeOperario(EMAIL_ADMIN)))
  );
  // La cuadrilla y las horas extra NO viajan en el parte desde la Fase D.2: viven en
  // validaciones/{parteId}, fuera del alcance de su autor. Este caso escribía los dos
  // campos y por eso fallaba: no era un fallo de las reglas, era el test quedándose
  // atrás respecto a ellas.
  await comprobar('admin valida el parte (pendiente -> aprobado)', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-op1'), {
      estado: 'aprobado',
      fechaValidacion: '29/08/2026',
      certificado: false,
      facturado: false,
      papelera: false
    }))
  );
  await comprobar('la cuadrilla va aparte, en validaciones/{parteId}', () =>
    assertSucceeds(setDoc(doc(admin, 'validaciones/parte-op1'), {
      cuadrilla: [{ trabajadorId: 't-op1', nombre: 'Juan', horasExtra: 1.5 }],
      horasExtraAsignadas: 1.5,
      timestamp: Date.now()
    }))
  );
  await comprobar('y NO se puede colar dentro del parte', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-op1'), {
      cuadrilla: [{ nombre: 'Juan', horasExtra: 99 }]
    }))
  );
  await comprobar('admin crea la certificación', () =>
    assertSucceeds(addDoc(collection(admin, 'certificaciones'), {
      obra: 'Hotel Sol', partesIds: ['parte-op1'], referencia: 'CERT-000001',
      totalHoras: 9.5, fecha: '29/08/2026', timestamp: Date.now(),
      facturado: false, papelera: false
    }))
  );

  // ---- CASO 1b ------------------------------------------------------------
  titulo('Operario sin cobertura envía el parte con la firma incrustada → debe pasar');
  // Es la premisa del arreglo de la pérdida de parte: cuando Storage no responde, la
  // firma viaja en base64 dentro del campo `firma`. Si las reglas no lo aceptaran, el
  // parte se seguiría perdiendo, solo que más tarde y en silencio.
  await comprobar('el parte con firma en base64 se crea igual', () =>
    assertSucceeds(setDoc(doc(op1, 'partes_de_trabajo/parte-sin-cobertura'), {
      ...parteDeOperario(EMAIL_OP1),
      firma: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    }))
  );
  await comprobar('y sin firma ninguna también', () =>
    assertSucceeds(setDoc(doc(op1, 'partes_de_trabajo/parte-sin-firma'), {
      ...parteDeOperario(EMAIL_OP1), firma: null
    }))
  );
  await comprobar('pero el operario NO puede cambiarla después', () =>
    assertFails(updateDoc(doc(op1, 'partes_de_trabajo/parte-sin-cobertura'), { firma: 'firmas/otra.png' }))
  );

  // ---- CASO 2 -------------------------------------------------------------
  titulo("Operario intenta aprobar su propio parte → debe fallar");
  await comprobar('operario NO puede poner estado: aprobado', () =>
    assertFails(updateDoc(doc(op1, 'partes_de_trabajo/parte-op1-mayus'), { estado: 'aprobado' }))
  );

  // ---- CASO 3 -------------------------------------------------------------
  titulo('Operario lee el parte de otro operario (get directo) → debe fallar');
  await comprobar('operario NO puede leer parte-op2', () =>
    assertFails(getDoc(doc(op1, 'partes_de_trabajo/parte-op2')))
  );

  // ---- CASO 4 -------------------------------------------------------------
  titulo('Admin cambia materialesUsados de un parte APROBADO → debe fallar');
  await comprobar('parte aprobado: materialesUsados es inmutable', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-op1'), {
      materialesUsados: [{ id: 'MAT-9', nombre: 'Manipulado', cantidad: 99 }]
    }))
  );

  // ---- CASO 5 -------------------------------------------------------------
  titulo('Admin marca certificado: true en ese parte aprobado → debe pasar');
  await comprobar('parte aprobado: el ciclo documental sí se permite', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-op1'), {
      certificado: true, idCertificacion: 'CERT-1'
    }))
  );

  // ---- CASO 6 -------------------------------------------------------------
  titulo('Operario lista/lee la plantilla completa → debe fallar');
  await comprobar('operario NO puede listar trabajadores', () =>
    assertFails(getDocs(collection(op1, 'trabajadores')))
  );
  await comprobar('operario NO puede leer la ficha de otro', () =>
    assertFails(getDoc(doc(op1, 'trabajadores/t-op2')))
  );
  await comprobar('operario SÍ puede leer su propia ficha (query por email)', () =>
    assertSucceeds(getDocs(query(collection(op1, 'trabajadores'), where('email', '==', EMAIL_OP1))))
  );

  // ---- CASO 7 -------------------------------------------------------------
  titulo('Query real de ParteTrabajo.jsx:55 — where("creador","==",email)');

  await comprobar('7a · query con el email del token, creador en la misma caja', async () => {
    const snap = await assertSucceeds(
      getDocs(query(collection(op1, 'partes_de_trabajo'), where('creador', '==', EMAIL_OP1)))
    );
    console.log(`            -> devuelve ${snap.size} parte(s): ${snap.docs.map(d => d.id).join(', ') || 'ninguno'}`);
    if (snap.size === 0) throw new Error('la query no devolvió los partes del operario');
  });

  await comprobar('7b · query con el creador guardado en OTRA caja ("Juan@Empresa.com")', async () => {
    const snap = await assertSucceeds(
      getDocs(query(collection(op1, 'partes_de_trabajo'), where('creador', '==', 'Juan@Empresa.com')))
    );
    console.log(`            -> devuelve ${snap.size} parte(s): ${snap.docs.map(d => d.id).join(', ') || 'ninguno'}`);
  });

  await comprobar('7c · query SIN filtro (colección entera) → debe fallar', () =>
    assertFails(getDocs(collection(op1, 'partes_de_trabajo')))
  );
}

main()
  .then(() => {
    console.log(fallos === 0 ? '\n══ TODOS LOS CASOS PASAN ══' : `\n══ ${fallos} CASO(S) FALLIDO(S) ══`);
  })
  .catch((error) => {
    if (error.message !== 'parada en el primer fallo') {
      console.error('\nError inesperado en el arranque de las pruebas:', error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    if (testEnv) await testEnv.cleanup();
  });
