/**
 * Comprueba el bloque nuevo de validaciones/ contra el emulador, antes de desplegar.
 *
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro \
 *     "node tests/validaciones.test.mjs"
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-sistema-seguro',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
});

await testEnv.clearFirestore();

await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'roles/uid-admin'), { admin: true, veNominas: true });
    await setDoc(doc(ctx.firestore(), 'partes_de_trabajo/parte-1'), {
        obra: 'Hotel Sol', creador: 'juan@empresa.com', estado: 'aprobado', timestamp: Date.now()
    });
});

const admin = testEnv.authenticatedContext('uid-admin', { email: 'oficina@empresa.com' }).firestore();
const operario = testEnv.authenticatedContext('uid-op1', { email: 'juan@empresa.com' }).firestore();

let fallos = 0;
const comprobar = async (desc, fn) => {
    try { await fn(); console.log(`   PASA   · ${desc}`); }
    catch (e) { fallos += 1; console.log(`   FALLA  · ${desc} — ${e.message.split('\n')[0]}`); }
};

const validacion = { cuadrilla: [{ nombre: 'Juan', horasExtra: 1.5 }], horasExtraAsignadas: 1.5, timestamp: Date.now(), obra: 'Hotel Sol' };

console.log('\n─── CASO 1: el admin puede leer, crear y actualizar ───');
await comprobar('admin CREA validaciones/parte-1', () => assertSucceeds(setDoc(doc(admin, 'validaciones/parte-1'), validacion)));
await comprobar('admin LEE validaciones/parte-1', () => assertSucceeds(getDoc(doc(admin, 'validaciones/parte-1'))));
await comprobar('admin ACTUALIZA la cuadrilla', () => assertSucceeds(updateDoc(doc(admin, 'validaciones/parte-1'), { cuadrilla: [{ nombre: 'Juan', horasExtra: 3 }], horasExtraAsignadas: 3 })));
await comprobar('admin sin los campos obligatorios es RECHAZADO', () => assertFails(setDoc(doc(admin, 'validaciones/parte-2'), { obra: 'Hotel Sol' })));
await comprobar('admin con cuadrilla que no es lista es RECHAZADO', () => assertFails(setDoc(doc(admin, 'validaciones/parte-3'), { cuadrilla: 'Juan', horasExtraAsignadas: 1 })));

console.log('\n─── CASO 2: el operario NO puede, ni siquiera en su propio parte ───');
await comprobar('operario NO lee la validación de su parte', () => assertFails(getDoc(doc(operario, 'validaciones/parte-1'))));
await comprobar('operario NO crea una validación', () => assertFails(setDoc(doc(operario, 'validaciones/parte-9'), validacion)));
await comprobar('operario NO actualiza una existente', () => assertFails(updateDoc(doc(operario, 'validaciones/parte-1'), { horasExtraAsignadas: 99 })));
await comprobar('operario NO borra una existente', () => assertFails(deleteDoc(doc(operario, 'validaciones/parte-1'))));

console.log('\n─── Comprobación de no regresión: el parte sigue siendo legible por su autor ───');
await comprobar('operario SÍ lee su propio parte', () => assertSucceeds(getDoc(doc(operario, 'partes_de_trabajo/parte-1'))));

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
await testEnv.cleanup();
process.exit(fallos === 0 ? 0 : 1);
