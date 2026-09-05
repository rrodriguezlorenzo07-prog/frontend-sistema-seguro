/**
 * Fase D.2, segunda pasada: comprueba que oficina ya no puede escribir la cuadrilla
 * dentro del parte, y que nada más se ha roto.
 *
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro \
 *     "node tests/cierre-d2.test.mjs"
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-sistema-seguro',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
});

await testEnv.clearFirestore();

await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'roles/uid-admin'), { admin: true, veNominas: true });
    // Un parte pendiente, listo para validar
    await setDoc(doc(db, 'partes_de_trabajo/parte-pendiente'), {
        obra: 'Hotel Sol', creador: 'juan@empresa.com', estado: 'pendiente',
        timestamp: Date.now(), tareasRealizadas: [{ ubicacion: 'Hab 101', descripcion: 'Puerta' }]
    });
    // Y otro ya aprobado
    await setDoc(doc(db, 'partes_de_trabajo/parte-aprobado'), {
        obra: 'Hotel Sol', creador: 'juan@empresa.com', estado: 'aprobado',
        timestamp: Date.now(), certificado: false, facturado: false, papelera: false
    });
});

const admin = testEnv.authenticatedContext('uid-admin', { email: 'oficina@empresa.com' }).firestore();

let fallos = 0;
const comprobar = async (desc, fn) => {
    try { await fn(); console.log(`   PASA   · ${desc}`); }
    catch (e) { fallos += 1; console.log(`   FALLA  · ${desc} — ${e.message.split('\n')[0]}`); }
};

console.log('\n─── CASO 1: el admin NO puede escribir cuadrilla dentro del parte ───');
await comprobar('updateDoc con cuadrilla sobre un parte pendiente → rechazado', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-pendiente'), {
        estado: 'aprobado', cuadrilla: [{ nombre: 'Juan', horasExtra: 1 }]
    }))
);
await comprobar('updateDoc con horasExtraAsignadas → rechazado', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-pendiente'), { horasExtraAsignadas: 5 }))
);
await comprobar('updateDoc con cuadrilla sobre un parte YA aprobado → rechazado', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-aprobado'), { cuadrilla: [{ nombre: 'X', horasExtra: 9 }] }))
);

console.log('\n─── CASO 2: aprobar con los campos permitidos sigue funcionando ───');
await comprobar('pendiente → aprobado con estado/fechaValidacion/certificado/facturado/papelera', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-pendiente'), {
        estado: 'aprobado', fechaValidacion: '30/8/2026',
        certificado: false, facturado: false, papelera: false
    }))
);
await comprobar('ciclo documental sobre el aprobado (certificado + idCertificacion)', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-aprobado'), { certificado: true, idCertificacion: 'CERT-1' }))
);
await comprobar('enviar a la papelera un parte aprobado', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-aprobado'), { papelera: true }))
);

console.log('\n─── CASO 3: validaciones/ sigue igual (sin regresión) ───');
const validacion = { cuadrilla: [{ nombre: 'Juan', horasExtra: 1.5 }], horasExtraAsignadas: 1.5, timestamp: Date.now(), obra: 'Hotel Sol' };
await comprobar('admin CREA validaciones/parte-pendiente', () =>
    assertSucceeds(setDoc(doc(admin, 'validaciones/parte-pendiente'), validacion))
);
await comprobar('admin LEE validaciones/parte-pendiente', () =>
    assertSucceeds(getDoc(doc(admin, 'validaciones/parte-pendiente')))
);
await comprobar('admin ACTUALIZA la validación', () =>
    assertSucceeds(updateDoc(doc(admin, 'validaciones/parte-pendiente'), { cuadrilla: [{ nombre: 'Juan', horasExtra: 3 }], horasExtraAsignadas: 3 }))
);

console.log('\n─── No regresión: el operario sigue leyendo su parte, pero no la validación ───');
const operario = testEnv.authenticatedContext('uid-op1', { email: 'juan@empresa.com' }).firestore();
await comprobar('operario SÍ lee su propio parte', () =>
    assertSucceeds(getDoc(doc(operario, 'partes_de_trabajo/parte-pendiente')))
);
await comprobar('operario NO lee la validación de su parte', () =>
    assertFails(getDoc(doc(operario, 'validaciones/parte-pendiente')))
);

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
await testEnv.cleanup();
process.exit(fallos === 0 ? 0 : 1);
