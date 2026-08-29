/**
 * Fase D.2 — migración ADITIVA de cuadrilla / horasExtraAsignadas a validaciones/{parteId}.
 *
 *   node scripts/migrar-validaciones.cjs            -> recuento en seco, no escribe nada
 *   node scripts/migrar-validaciones.cjs --aplicar  -> escribe validaciones/{parteId}
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS apuntando a la clave de servicio.
 *
 * GARANTÍAS:
 *   - NO escribe, modifica ni borra nada en partes_de_trabajo. Solo lee.
 *   - Idempotente: usa set(), así que una segunda pasada deja el mismo resultado.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'sistema-seguro-dcecb';
const APLICAR = process.argv.includes('--aplicar');
const TAMANO_LOTE = 400;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

const tieneCuadrilla = (datos) => Array.isArray(datos.cuadrilla) && datos.cuadrilla.length > 0;

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR (se escribirá en validaciones/)' : 'MODO: SECO (no se escribe nada)');
    console.log('Proyecto:', PROJECT_ID, '\n');

    const snap = await db.collection('partes_de_trabajo').where('estado', '==', 'aprobado').get();

    const candidatos = [];
    let sinCuadrilla = 0;
    snap.forEach((doc) => {
        const datos = doc.data();
        if (tieneCuadrilla(datos)) candidatos.push({ id: doc.id, datos });
        else sinCuadrilla += 1;
    });

    console.log('RECUENTO');
    console.log('  partes con estado "aprobado" :', snap.size);
    console.log('  ...con cuadrilla no vacía    :', candidatos.length, '  <- candidatos a migrar');
    console.log('  ...sin cuadrilla             :', sinCuadrilla);

    // ¿Cuántos ya tienen su documento en validaciones?
    const yaExisten = new Set();
    for (let i = 0; i < candidatos.length; i += 300) {
        const refs = candidatos.slice(i, i + 300).map((c) => db.doc(`validaciones/${c.id}`));
        if (refs.length === 0) break;
        const docs = await db.getAll(...refs);
        docs.forEach((d) => { if (d.exists) yaExisten.add(d.id); });
    }
    console.log('  ya presentes en validaciones :', yaExisten.size);
    console.log('  pendientes de escribir       :', candidatos.length - yaExisten.size);

    const totalValidaciones = (await db.collection('validaciones').get()).size;
    console.log('  documentos en validaciones/  :', totalValidaciones, '(antes de esta pasada)\n');

    if (!APLICAR) {
        console.log('Nada escrito. Vuelve a ejecutar con --aplicar para migrar.');
        process.exit(0);
    }

    let escritos = 0;
    for (let i = 0; i < candidatos.length; i += TAMANO_LOTE) {
        const lote = db.batch();
        for (const { id, datos } of candidatos.slice(i, i + TAMANO_LOTE)) {
            const horasExtraAsignadas = typeof datos.horasExtraAsignadas === 'number'
                ? datos.horasExtraAsignadas
                : datos.cuadrilla.reduce((suma, op) => suma + (Number(op?.horasExtra) || 0), 0);

            lote.set(db.doc(`validaciones/${id}`), {
                cuadrilla: datos.cuadrilla,
                horasExtraAsignadas,
                timestamp: datos.timestamp ?? null,
                obra: datos.obra ?? null,
                fechaValidacion: datos.fechaValidacion ?? null
            }, { merge: true });
            escritos += 1;
        }
        await lote.commit();
        console.log(`  lote confirmado: ${Math.min(i + TAMANO_LOTE, candidatos.length)}/${candidatos.length}`);
    }

    // Comprobación posterior: releer y contar
    const despues = (await db.collection('validaciones').get()).size;
    console.log('\nRESULTADO');
    console.log('  documentos escritos          :', escritos);
    console.log('  documentos en validaciones/  :', despues, '(después)');

    // Y confirmar que los partes NO han perdido nada
    const verificacion = await db.collection('partes_de_trabajo').where('estado', '==', 'aprobado').get();
    let conservanCuadrilla = 0;
    verificacion.forEach((doc) => { if (tieneCuadrilla(doc.data())) conservanCuadrilla += 1; });
    console.log('  partes que CONSERVAN cuadrilla:', conservanCuadrilla, conservanCuadrilla === candidatos.length ? '(intactos, correcto)' : '(¡REVISAR!)');

    process.exit(0);
})().catch((error) => {
    console.error('ERROR:', error.message);
    process.exit(1);
});
