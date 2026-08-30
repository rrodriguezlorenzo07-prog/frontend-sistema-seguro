/**
 * Bloque 3, primera pasada: el campo `firma` pasa de URL de descarga a RUTA de Storage.
 *
 *   node scripts/migrar-firmas-ruta.cjs            -> recuento en seco
 *   node scripts/migrar-firmas-ruta.cjs --aplicar  -> reescribe el campo firma
 *
 * NO toca ningún archivo de Storage ni ningún token. Solo reescribe el campo `firma`
 * de Firestore con la ruta extraída de la propia URL ya guardada.
 *
 * Es reversible mientras no se roten los tokens: de la ruta se puede volver a obtener
 * una URL en cualquier momento.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'sistema-seguro-dcecb' }));

const APLICAR = process.argv.includes('--aplicar');
const TAMANO_LOTE = 400;

/** Extrae "firmas/archivo.png" de la URL de descarga de Firebase Storage. */
const rutaDesdeUrl = (url) => {
    const m = String(url).match(/\/o\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
};

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR' : 'MODO: SECO (no se escribe nada)');
    console.log('');

    const snap = await db.collection('partes_de_trabajo').get();

    const aMigrar = [];
    let sinFirma = 0, yaEsRuta = 0, noParseable = 0, otros = 0;
    const problemas = [];

    snap.forEach((d) => {
        const f = d.data().firma;
        if (f === null || f === undefined || f === '') { sinFirma += 1; return; }
        if (typeof f !== 'string') { otros += 1; problemas.push(`${d.id}: firma no es texto`); return; }
        if (f.startsWith('firmas/')) { yaEsRuta += 1; return; }
        if (!f.startsWith('https://firebasestorage.googleapis.com/')) {
            otros += 1; problemas.push(`${d.id}: formato desconocido`); return;
        }
        const ruta = rutaDesdeUrl(f);
        if (!ruta) { noParseable += 1; problemas.push(`${d.id}: URL no parseable`); return; }
        aMigrar.push({ id: d.id, ruta });
    });

    console.log('RECUENTO');
    console.log('  partes totales        :', snap.size);
    console.log('  sin firma (se ignoran):', sinFirma);
    console.log('  ya guardan la ruta    :', yaEsRuta);
    console.log('');
    console.log('  A MIGRAR (URL -> ruta):', aMigrar.length);
    console.log('  URL no parseable      :', noParseable);
    console.log('  otros formatos        :', otros);
    if (problemas.length > 0) {
        console.log('  PROBLEMAS:');
        problemas.forEach(p => console.log('    -', p));
    }

    console.log('');
    console.log('  Muestra de la conversión:');
    aMigrar.slice(0, 3).forEach(({ id, ruta }) => console.log(`    ${id}  ->  ${ruta}`));

    if (!APLICAR) { console.log('\nNada escrito. Ejecuta con --aplicar para migrar.'); process.exit(0); }

    let hechas = 0;
    for (let i = 0; i < aMigrar.length; i += TAMANO_LOTE) {
        const lote = db.batch();
        aMigrar.slice(i, i + TAMANO_LOTE).forEach(({ id, ruta }) => {
            lote.update(db.doc('partes_de_trabajo/' + id), { firma: ruta });
            hechas += 1;
        });
        await lote.commit();
        console.log(`  lote confirmado: ${Math.min(i + TAMANO_LOTE, aMigrar.length)}/${aMigrar.length}`);
    }

    const despues = await db.collection('partes_de_trabajo').get();
    let rutas = 0, urls = 0, vacias = 0;
    despues.forEach((d) => {
        const f = d.data().firma;
        if (!f) { vacias += 1; return; }
        if (String(f).startsWith('firmas/')) rutas += 1; else urls += 1;
    });
    console.log('\nRESULTADO');
    console.log('  documentos actualizados:', hechas);
    console.log('  firmas como ruta       :', rutas);
    console.log('  firmas como URL        :', urls, '(esperado 0)');
    console.log('  partes sin firma       :', vacias, '(intactos)');
    process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
