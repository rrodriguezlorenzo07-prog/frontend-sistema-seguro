/**
 * Fase D.2, segunda pasada — borra cuadrilla y horasExtraAsignadas del documento
 * del parte, una vez que ya viven en validaciones/{parteId}.
 *
 *   node scripts/borrar-campos-validacion.cjs            -> recuento, no borra nada
 *   node scripts/borrar-campos-validacion.cjs --aplicar  -> borra de verdad
 *
 * SALVAGUARDA: de cada parte se comprueba ANTES que existe validaciones/{id} y que
 * su cuadrilla coincide exactamente con la del parte. Si no coincide o no existe,
 * ese documento NO se toca y se reporta como excluido para revisión manual.
 *
 * ESTA OPERACIÓN NO ES REVERSIBLE SIN COPIA DE SEGURIDAD.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROJECT_ID = 'sistema-seguro-dcecb';
const APLICAR = process.argv.includes('--aplicar');
const TAMANO_LOTE = 400;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
}

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }));

/** Comparación estable e independiente del orden de claves. */
const normalizar = (cuadrilla) => JSON.stringify(
    (cuadrilla || []).map((op) => {
        const salida = {};
        Object.keys(op || {}).sort().forEach((k) => { salida[k] = op[k]; });
        return salida;
    })
);

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR — SE BORRARÁN CAMPOS (irreversible)' : 'MODO: SECO — no se borra nada');
    console.log('Proyecto:', PROJECT_ID, '\n');

    const snap = await db.collection('partes_de_trabajo').where('estado', '==', 'aprobado').get();

    const conCuadrilla = [];
    let yaLimpios = 0;
    snap.forEach((doc) => {
        const datos = doc.data();
        if (Array.isArray(datos.cuadrilla) && datos.cuadrilla.length > 0) conCuadrilla.push({ id: doc.id, datos });
        else yaLimpios += 1;
    });

    const aBorrar = [];
    const excluidos = [];

    for (const { id, datos } of conCuadrilla) {
        const val = await db.doc(`validaciones/${id}`).get();
        if (!val.exists) {
            excluidos.push({ id, motivo: 'no existe validaciones/' + id });
            continue;
        }
        const enParte = normalizar(datos.cuadrilla);
        const enValidacion = normalizar(val.data().cuadrilla);
        if (enParte !== enValidacion) {
            excluidos.push({ id, motivo: 'la cuadrilla NO coincide', parte: enParte, validacion: enValidacion });
            continue;
        }
        aBorrar.push({ id, tieneHoras: datos.horasExtraAsignadas !== undefined });
    }

    console.log('RECUENTO');
    console.log('  partes con estado "aprobado"        :', snap.size);
    console.log('  ...ya sin cuadrilla en el parte     :', yaLimpios);
    console.log('  ...con cuadrilla todavía en el parte:', conCuadrilla.length);
    console.log('');
    console.log('  A LIMPIAR (cuadrilla verificada)    :', aBorrar.length);
    console.log('    ...de los cuales con horasExtraAsignadas:', aBorrar.filter((x) => x.tieneHoras).length);
    console.log('  EXCLUIDOS (revisar a mano)          :', excluidos.length);

    if (excluidos.length > 0) {
        console.log('\n  LISTA DE EXCLUIDOS:');
        excluidos.forEach((e) => {
            console.log(`    - ${e.id}: ${e.motivo}`);
            if (e.parte) {
                console.log(`        en el parte : ${e.parte}`);
                console.log(`        en validación: ${e.validacion}`);
            }
        });
    }

    if (!APLICAR) {
        console.log('\nNada borrado. Ejecuta con --aplicar para borrar los campos.');
        process.exit(0);
    }

    let borrados = 0;
    for (let i = 0; i < aBorrar.length; i += TAMANO_LOTE) {
        const lote = db.batch();
        for (const { id } of aBorrar.slice(i, i + TAMANO_LOTE)) {
            lote.update(db.doc(`partes_de_trabajo/${id}`), {
                cuadrilla: FieldValue.delete(),
                horasExtraAsignadas: FieldValue.delete()
            });
            borrados += 1;
        }
        await lote.commit();
        console.log(`  lote confirmado: ${Math.min(i + TAMANO_LOTE, aBorrar.length)}/${aBorrar.length}`);
    }

    // Comprobación posterior
    const despues = await db.collection('partes_de_trabajo').where('estado', '==', 'aprobado').get();
    let siguenConCuadrilla = 0;
    despues.forEach((d) => { if (Array.isArray(d.data().cuadrilla)) siguenConCuadrilla += 1; });
    const validaciones = (await db.collection('validaciones').get()).size;

    console.log('\nRESULTADO');
    console.log('  campos borrados en                 :', borrados, 'partes');
    console.log('  partes que aún conservan cuadrilla :', siguenConCuadrilla, `(esperado: ${excluidos.length})`);
    console.log('  documentos en validaciones/        :', validaciones, '(intactos)');

    process.exit(0);
})().catch((error) => {
    console.error('ERROR:', error.message);
    process.exit(1);
});
