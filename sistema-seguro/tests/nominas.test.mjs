/**
 * Reglas de la colección de nóminas cerradas.
 *
 *   npx firebase emulators:exec --only firestore --project demo-sistema-seguro \
 *     "node tests/nominas.test.mjs"
 *
 * Lo que se comprueba, en orden de importancia:
 *   1. Un cierre se puede crear, cabecera y líneas, en un solo lote atómico.
 *   2. Sobrescribir un cierre existente es IMPOSIBLE, y no por una comprobación que
 *      alguien pueda quitar: `create` solo se evalúa cuando el documento no existe.
 *   3. Corregir una liquidación emite una versión nueva; la anterior sigue ahí.
 *   4. Un operario no lee una nómina. Ni la suya.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';

const PROJECT_ID = 'demo-sistema-seguro';
const EMAIL_ADMIN = 'oficina@empresa.com';
const EMAIL_OP = 'juan@empresa.com';
const UID_ADMIN = 'uid-admin';

let fallos = 0;
const titulo = (n, t) => console.log(`\n─── CASO ${n}: ${t}`);
const comprobar = async (desc, fn) => {
    try { await fn(); console.log(`   PASA   · ${desc}`); }
    catch (e) { fallos += 1; console.log(`   FALLA  · ${desc} — ${String(e.message).split('\n')[0]}`); }
};

// Agosto de 2026, mes natural completo.
const PERIODO = '2026-08';
const INICIO = new Date('2026-08-01T00:00:00').getTime();
const FIN = new Date('2026-08-31T23:59:59.999').getTime();

const cabecera = (version, extra = {}) => ({
    periodo: PERIODO,
    version,
    rangoInicio: INICIO,
    rangoFin: FIN,
    estado: 'cerrado',
    cerradoPor: UID_ADMIN,
    cerradoPorEmail: EMAIL_ADMIN,
    cerradoEn: serverTimestamp(),
    tarifaNormalGlobal: 10,
    tarifaExtraGlobal: 15,
    totales: { trabajadores: 2, horasNormales: 312, horasExtra: 9.5, importe: 3262.5 },
    cobertura: { partesLeidos: 41, albaranesComputados: 38, validacionesUsadas: 38 },
    cerradoRetroactivamente: false,
    sustituyeA: null,
    motivo: '',
    esquema: 1,
    ...extra
});

const linea = (trabajadorId, extra = {}) => ({
    trabajadorId,
    nombre: 'Julian',
    email: 'julian@empresa.com',
    baseMensual: 160,
    origenBase: 'ficha',
    diasAusencia: 0,
    horasNormalesCalculadas: 160,
    horasNormales: 160,
    ajusteManualNormales: false,
    horasExtraDeAlbaranes: 5.5,
    horasExtra: 5.5,
    ajusteManualExtras: false,
    tarifaNormal: 10,
    tarifaExtra: 15,
    tarifaPersonalizada: false,
    total: 1682.5,
    enPapelera: false,
    partesOrigen: ['parte-1', 'parte-2'],
    ...extra
});

/** Un cierre completo, cabecera y líneas, en un único lote atómico. */
const cerrar = (db, cierreId, version, lineas, extra = {}) => {
    const lote = writeBatch(db);
    lote.set(doc(db, 'nominas', cierreId), cabecera(version, extra));
    lineas.forEach((id) => lote.set(doc(db, 'nominas', cierreId, 'lineas', id), linea(id)));
    return lote.commit();
};

const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
});
await testEnv.clearFirestore();

await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `roles/${UID_ADMIN}`), { admin: true, veNominas: true });
});

const admin = testEnv.authenticatedContext(UID_ADMIN, { email: EMAIL_ADMIN }).firestore();
const operario = testEnv.authenticatedContext('uid-op', { email: EMAIL_OP }).firestore();
const anonimo = testEnv.unauthenticatedContext().firestore();

titulo(1, 'Oficina cierra agosto: cabecera y dos líneas en un lote');
await comprobar('el cierre v1 se crea entero', () =>
    assertSucceeds(cerrar(admin, `${PERIODO}-v1`, 1, ['t-julian', 't-ana']))
);
await comprobar('la cabecera quedó escrita', async () => {
    const d = await getDoc(doc(admin, 'nominas', `${PERIODO}-v1`));
    if (!d.exists() || d.data().version !== 1) throw new Error('no se escribió');
});
await comprobar('las dos líneas quedaron escritas', async () => {
    const s = await getDocs(collection(admin, 'nominas', `${PERIODO}-v1`, 'lineas'));
    if (s.size !== 2) throw new Error(`hay ${s.size} líneas`);
});

titulo(2, 'Un cierre existente NO se puede tocar, por construcción');
await comprobar('volver a crear el mismo cierre falla', () =>
    assertFails(cerrar(admin, `${PERIODO}-v1`, 1, ['t-julian']))
);
await comprobar('setDoc encima de la cabecera falla', () =>
    assertFails(setDoc(doc(admin, 'nominas', `${PERIODO}-v1`), cabecera(1)))
);
await comprobar('updateDoc de un solo campo falla', () =>
    assertFails(updateDoc(doc(admin, 'nominas', `${PERIODO}-v1`), { 'totales.importe': 99999 }))
);
await comprobar('borrar la cabecera falla', () =>
    assertFails(deleteDoc(doc(admin, 'nominas', `${PERIODO}-v1`)))
);
await comprobar('reescribir una línea falla', () =>
    assertFails(setDoc(doc(admin, 'nominas', `${PERIODO}-v1`, 'lineas', 't-julian'), linea('t-julian', { total: 1 })))
);
await comprobar('cambiar el total de una línea falla', () =>
    assertFails(updateDoc(doc(admin, 'nominas', `${PERIODO}-v1`, 'lineas', 't-julian'), { total: 1 }))
);
await comprobar('borrar una línea falla', () =>
    assertFails(deleteDoc(doc(admin, 'nominas', `${PERIODO}-v1`, 'lineas', 't-julian')))
);

titulo(3, 'Corregir agosto emite la versión siguiente, sin tocar la anterior');
await comprobar('el cierre v2 se crea', () =>
    assertSucceeds(cerrar(admin, `${PERIODO}-v2`, 2, ['t-julian', 't-ana'], {
        sustituyeA: `${PERIODO}-v1`, motivo: 'Faltaba un día de ausencia de Ana'
    }))
);
await comprobar('v1 sigue intacto y consultable', async () => {
    const d = await getDoc(doc(admin, 'nominas', `${PERIODO}-v1`));
    if (!d.exists() || d.data().totales.importe !== 3262.5) throw new Error('v1 cambió');
});
await comprobar('el histórico del periodo devuelve las dos versiones', async () => {
    const s = await getDocs(query(collection(admin, 'nominas'), where('periodo', '==', PERIODO)));
    if (s.size !== 2) throw new Error(`hay ${s.size} cierres`);
    const versiones = s.docs.map((d) => d.data().version).sort();
    if (versiones.join(',') !== '1,2') throw new Error(`versiones ${versiones}`);
});
await comprobar('el vigente es el de versión más alta', async () => {
    const s = await getDocs(query(collection(admin, 'nominas'), where('periodo', '==', PERIODO)));
    const vigente = s.docs.map((d) => d.data()).sort((a, b) => b.version - a.version)[0];
    if (vigente.version !== 2 || vigente.sustituyeA !== `${PERIODO}-v1`) throw new Error('cadena rota');
});

titulo(4, 'Forma del cierre: lo que las reglas no dejan pasar');
await comprobar('un id que no cuadra con periodo y versión', () =>
    assertFails(setDoc(doc(admin, 'nominas', 'agosto'), cabecera(1)))
);
await comprobar('un id con la versión cambiada', () =>
    assertFails(setDoc(doc(admin, 'nominas', `${PERIODO}-v9`), cabecera(3)))
);
await comprobar('un periodo que no es un mes natural', () =>
    assertFails(setDoc(doc(admin, 'nominas', '2026-08-01_2026-08-15-v1'),
        cabecera(1, { periodo: '2026-08-01_2026-08-15' })))
);
await comprobar('un mes inexistente (13)', () =>
    assertFails(setDoc(doc(admin, 'nominas', '2026-13-v1'), cabecera(1, { periodo: '2026-13' })))
);
await comprobar('estado distinto de cerrado', () =>
    assertFails(setDoc(doc(admin, 'nominas', `2026-07-v1`), cabecera(1, { periodo: '2026-07', estado: 'borrador' })))
);
await comprobar('atribuir el cierre a otra persona', () =>
    assertFails(setDoc(doc(admin, 'nominas', `2026-07-v1`), cabecera(1, { periodo: '2026-07', cerradoPor: 'otro-uid' })))
);
await comprobar('un rango invertido', () =>
    assertFails(setDoc(doc(admin, 'nominas', `2026-07-v1`),
        cabecera(1, { periodo: '2026-07', rangoInicio: FIN, rangoFin: INICIO })))
);
await comprobar('version cero', () =>
    assertFails(setDoc(doc(admin, 'nominas', `2026-07-v0`), cabecera(0, { periodo: '2026-07' })))
);
await comprobar('una línea cuyo id no es su trabajadorId', () =>
    assertFails(setDoc(doc(admin, 'nominas', `${PERIODO}-v2`, 'lineas', 't-otro'), linea('t-julian')))
);
await comprobar('una línea sin total numérico', () =>
    assertFails(setDoc(doc(admin, 'nominas', `${PERIODO}-v2`, 'lineas', 't-luis'),
        linea('t-luis', { total: 'mucho' })))
);

titulo(5, 'Un cierre de un mes pasado se permite (D3) y un trabajador en papelera cuenta (D4)');
await comprobar('cerrar julio, mes ya pasado, marcado como retroactivo', () =>
    assertSucceeds(cerrar(admin, '2026-07-v1', 1, ['t-julian'], {
        periodo: '2026-07', cerradoRetroactivamente: true
    }))
);
await comprobar('una línea de alguien en papelera se acepta', () =>
    assertSucceeds(setDoc(doc(admin, 'nominas', '2026-07-v1', 'lineas', 't-baja'),
        linea('t-baja', { enPapelera: true })))
);

titulo(6, 'Una nómina no la lee nadie más que oficina');
await comprobar('el operario NO lee una cabecera', () =>
    assertFails(getDoc(doc(operario, 'nominas', `${PERIODO}-v1`)))
);
await comprobar('el operario NO lista los cierres', () =>
    assertFails(getDocs(collection(operario, 'nominas')))
);
await comprobar('el operario NO lee una línea, ni la suya', () =>
    assertFails(getDoc(doc(operario, 'nominas', `${PERIODO}-v1`, 'lineas', 't-julian')))
);
await comprobar('el operario NO puede crear un cierre', () =>
    assertFails(setDoc(doc(operario, 'nominas', '2026-06-v1'), cabecera(1, { periodo: '2026-06' })))
);
await comprobar('sin autenticar tampoco se lee nada', () =>
    assertFails(getDoc(doc(anonimo, 'nominas', `${PERIODO}-v1`)))
);

titulo(7, 'Carrera: dos admins cierran el mismo mes a la vez');
// Los dos leen que no hay cierres, los dos calculan versión 1, los dos escriben. Con
// reglas de solo-creación el segundo choca contra un id que ya existe: la carrera no
// hay que detectarla, se pierde sola. Y como cada cierre es un lote atómico, el que
// pierde no deja ni una línea suelta.
await comprobar('exactamente UNO de los dos cierres simultáneos entra', async () => {
    const resultados = await Promise.allSettled([
        cerrar(admin, '2026-05-v1', 1, ['t-julian'], { periodo: '2026-05' }),
        cerrar(admin, '2026-05-v1', 1, ['t-ana'], { periodo: '2026-05' })
    ]);
    const entraron = resultados.filter((r) => r.status === 'fulfilled').length;
    if (entraron !== 1) throw new Error(`entraron ${entraron} de 2`);
});
await comprobar('el periodo queda con un único cierre', async () => {
    const s = await getDocs(query(collection(admin, 'nominas'), where('periodo', '==', '2026-05')));
    if (s.size !== 1) throw new Error(`hay ${s.size} cierres`);
});
await comprobar('el perdedor no dejó líneas huérfanas del otro', async () => {
    const s = await getDocs(collection(admin, 'nominas', '2026-05-v1', 'lineas'));
    if (s.size !== 1) throw new Error(`hay ${s.size} líneas, se esperaba 1`);
});
await comprobar('quien perdió puede reintentar como v2', () =>
    assertSucceeds(cerrar(admin, '2026-05-v2', 2, ['t-ana'], { periodo: '2026-05', sustituyeA: '2026-05-v1' }))
);

console.log(fallos === 0 ? '\n══ TODOS LOS CASOS PASAN ══' : `\n══ ${fallos} CASO(S) FALLIDO(S) ══`);
await testEnv.cleanup();
process.exit(fallos === 0 ? 0 : 1);
