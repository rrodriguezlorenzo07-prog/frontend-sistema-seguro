/**
 * Bloque 2: la creación de partes admite obraId y trabajadorId, con o sin ellos.
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro \
 *     "node tests/referencias-id.test.mjs"
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-sistema-seguro',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
});
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'roles/uid-admin'), { admin: true, veNominas: true });
});

const operario = testEnv.authenticatedContext('uid-op1', { email: 'juan@empresa.com' }).firestore();
const admin = testEnv.authenticatedContext('uid-admin', { email: 'oficina@empresa.com' }).firestore();

let fallos = 0;
const comprobar = async (desc, fn) => {
    try { await fn(); console.log(`   PASA   · ${desc}`); }
    catch (e) { fallos += 1; console.log(`   FALLA  · ${desc} — ${e.message.split('\n')[0]}`); }
};

const parteBase = () => ({
    obra: 'Hotel Sol',
    tareasRealizadas: [{ ubicacion: 'Hab 101', descripcion: 'Puerta' }],
    trabajo: '', materialesUsados: [], firma: null,
    creador: 'juan@empresa.com', nombreTrabajador: 'Juan',
    fecha: '30/8/2026', hora: '09:00', timestamp: Date.now(), estado: 'pendiente'
});

console.log('\n─── CASO 1: crear un parte CON los ids nuevos ───');
await comprobar('con obraId y trabajadorId', () =>
    assertSucceeds(setDoc(doc(operario, 'partes_de_trabajo/con-ids'),
        { ...parteBase(), obraId: 'OBRA-1', trabajadorId: 'TRAB-1' }))
);
await comprobar('con obraId en null (obra escrita a mano)', () =>
    assertSucceeds(setDoc(doc(operario, 'partes_de_trabajo/obra-libre'),
        { ...parteBase(), obra: 'Chalet de los Pinos', obraId: null, trabajadorId: 'TRAB-1' }))
);

console.log('\n─── CASO 2: sin los ids, como hasta ahora (compatibilidad) ───');
await comprobar('sin obraId ni trabajadorId', () =>
    assertSucceeds(setDoc(doc(operario, 'partes_de_trabajo/sin-ids'), parteBase()))
);

console.log('\n─── CASO 3: nada más se cuela ───');
await comprobar('un campo no previsto sigue rechazado', () =>
    assertFails(setDoc(doc(operario, 'partes_de_trabajo/intruso'), { ...parteBase(), loQueSea: 'x' }))
);
await comprobar('la cuadrilla sigue prohibida al crear', () =>
    assertFails(setDoc(doc(operario, 'partes_de_trabajo/intruso2'),
        { ...parteBase(), cuadrilla: [{ nombre: 'Juan', horasExtra: 1 }] }))
);
await comprobar('el operario sigue sin poder crear el parte de otro', () =>
    assertFails(setDoc(doc(operario, 'partes_de_trabajo/de-otro'),
        { ...parteBase(), creador: 'ana@empresa.com' }))
);

console.log('\n─── CASO 4: sin regresión en la validación ───');
await comprobar('oficina aprueba un parte con ids', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/con-ids'), {
        estado: 'aprobado', fechaValidacion: '30/8/2026', certificado: false, facturado: false, papelera: false
    }))
);
await comprobar('oficina escribe la validación con obraId y trabajadorId', () =>
    assertSucceeds(setDoc(doc(admin, 'validaciones/con-ids'), {
        cuadrilla: [{ trabajadorId: 'TRAB-1', nombre: 'Juan', horasExtra: 1.5 }],
        horasExtraAsignadas: 1.5, timestamp: Date.now(), obra: 'Hotel Sol', obraId: 'OBRA-1'
    }))
);
await comprobar('oficina NO puede meter obraId dentro del parte aprobado', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/con-ids'), { obraId: 'OTRA' }))
);

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
await testEnv.cleanup();
process.exit(fallos === 0 ? 0 : 1);
