/**
 * Ciclo completo del estado 'rechazado' contra el emulador.
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro \
 *     "node tests/rechazo.test.mjs"
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-sistema-seguro',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
});
await testEnv.clearFirestore();

await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'roles/uid-admin'), { admin: true });
    await setDoc(doc(db, 'partes_de_trabajo/parte-1'), {
        obra: 'Hotel Sol', creador: 'juan@empresa.com', nombreTrabajador: 'Juan',
        estado: 'pendiente', papelera: false, timestamp: Date.now(),
        tareasRealizadas: [{ ubicacion: 'Hab 101', descripcion: 'Puerta' }]
    });
});

const admin = testEnv.authenticatedContext('uid-admin', { email: 'oficina@empresa.com' }).firestore();
const operario = testEnv.authenticatedContext('uid-op1', { email: 'juan@empresa.com' }).firestore();

let fallos = 0;
const comprobar = async (desc, fn) => {
    try { await fn(); console.log(`   PASA   · ${desc}`); }
    catch (e) { fallos += 1; console.log(`   FALLA  · ${desc} — ${e.message.split('\n')[0]}`); }
};
const estadoActual = async () => {
    // withSecurityRulesDisabled no devuelve lo que retorna el callback: hay que
    // sacar el dato por una variable de fuera.
    let datos = null;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const s = await getDoc(doc(ctx.firestore(), 'partes_de_trabajo/parte-1'));
        datos = s.data();
    });
    return datos;
};

// Simula los filtros reales de PanelOficina sobre el parte
const enBandeja = (p) => !p.papelera && p.estado === 'pendiente';
const enHistorial = (p) => !p.papelera && p.estado === 'aprobado';
const enPapelera = (p) => p.papelera === true;

console.log('\n═══ CICLO COMPLETO: pendiente -> rechazado -> pendiente ═══');

let p = await estadoActual();
console.log(`\n   [inicio]   estado=${p.estado} papelera=${p.papelera}  | bandeja:${enBandeja(p)} historial:${enHistorial(p)} papelera:${enPapelera(p)}`);
await comprobar('el parte arranca en la bandeja', () => { if (!enBandeja(p)) throw new Error('no está en la bandeja'); });

// ---- RECHAZAR (lo que hace borrarParte) -------------------------------------
await comprobar('oficina RECHAZA el parte (estado + papelera)', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-1'), { estado: 'rechazado', papelera: true }))
);
p = await estadoActual();
console.log(`   [rechazado] estado=${p.estado} papelera=${p.papelera}  | bandeja:${enBandeja(p)} historial:${enHistorial(p)} papelera:${enPapelera(p)}`);
await comprobar('queda en estado rechazado', () => { if (p.estado !== 'rechazado') throw new Error('estado = ' + p.estado); });
await comprobar('sale de la bandeja y NO entra en el histórico', () => { if (enBandeja(p) || enHistorial(p)) throw new Error('sigue visible donde no debe'); });
await comprobar('aparece en la papelera', () => { if (!enPapelera(p)) throw new Error('no está en la papelera'); });
await comprobar('el operario sigue pudiendo leer su parte rechazado', () =>
    assertSucceeds(getDoc(doc(operario, 'partes_de_trabajo/parte-1')))
);

// ---- RESTAURAR (lo que hace restaurarElemento) ------------------------------
await comprobar('oficina RESTAURA: vuelve a pendiente', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-1'), { papelera: false, estado: 'pendiente' }))
);
p = await estadoActual();
console.log(`   [restaurado] estado=${p.estado} papelera=${p.papelera} | bandeja:${enBandeja(p)} historial:${enHistorial(p)} papelera:${enPapelera(p)}`);
await comprobar('vuelve a estado pendiente', () => { if (p.estado !== 'pendiente') throw new Error('estado = ' + p.estado); });
await comprobar('REAPARECE en la bandeja de validación', () => { if (!enBandeja(p)) throw new Error('no ha vuelto a la bandeja'); });

// ---- El flujo normal sigue intacto ------------------------------------------
console.log('\n═══ NO REGRESIÓN ═══');
await comprobar('desde pendiente se sigue pudiendo aprobar', () =>
    assertSucceeds(updateDoc(doc(admin, 'partes_de_trabajo/parte-1'), {
        estado: 'aprobado', fechaValidacion: '30/8/2026', certificado: false, facturado: false, papelera: false
    }))
);
await comprobar('un parte APROBADO ya no se puede rechazar (queda congelado)', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-1'), { estado: 'rechazado', papelera: true }))
);

// ---- Estados fuera de la lista ----------------------------------------------
console.log('\n═══ ESTADOS NO PERMITIDOS ═══');
await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'partes_de_trabajo/parte-1'), { estado: 'pendiente', papelera: false });
});
for (const invalido of ['anulado', 'RECHAZADO', 'rechazada', '', 'borrado']) {
    await comprobar(`estado "${invalido}" es rechazado por las reglas`, () =>
        assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-1'), { estado: invalido }))
    );
}
await comprobar('cuadrilla sigue prohibida en el parte (Fase D.2 intacta)', () =>
    assertFails(updateDoc(doc(admin, 'partes_de_trabajo/parte-1'), { cuadrilla: [{ nombre: 'X', horasExtra: 1 }] }))
);

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
await testEnv.cleanup();
process.exit(fallos === 0 ? 0 : 1);
