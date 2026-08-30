/**
 * Verifica trasladarFirmaIncrustada contra los emuladores de Firestore y Storage.
 *
 *   npx firebase emulators:exec --only firestore,storage --project demo-sistema-seguro \
 *     "node functions/pruebas/firmas.test.cjs"
 *
 * No toca producción: los emuladores se detectan por FIRESTORE_EMULATOR_HOST y
 * STORAGE_EMULATOR_HOST, que fija el propio emulators:exec.
 */
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const { trasladarFirmaIncrustada, esFirmaIncrustada, rutaDeFirma } = require('../firmas');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.STORAGE_EMULATOR_HOST) {
    console.error('Esta prueba solo corre contra los emuladores. Abortada.');
    process.exit(1);
}

initializeApp({ projectId: 'demo-sistema-seguro', storageBucket: 'demo-sistema-seguro.appspot.com' });
const db = getFirestore();
const bucket = getStorage().bucket();

const PNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);
const BASE64 = 'data:image/png;base64,' + PNG.toString('base64');
const EMAIL = 'juan@empresa.com';

let fallos = 0;
const comprobar = (desc, ok, detalle) => {
    if (!ok) fallos += 1;
    console.log(`   ${ok ? 'PASA  ' : 'FALLA '} · ${desc}${detalle ? ' — ' + detalle : ''}`);
};

const sembrarParte = async (id, firma) => {
    await db.doc(`partes_de_trabajo/${id}`).set({
        obra: 'Hotel de prueba', creador: EMAIL, estado: 'pendiente',
        timestamp: Date.now(), firma
    });
    return (await db.doc(`partes_de_trabajo/${id}`).get()).data();
};

(async () => {
    console.log('\n─── CASO 0: clasificación del formato ───');
    comprobar('un base64 PNG se reconoce', esFirmaIncrustada(BASE64) === true);
    comprobar('una ruta no', esFirmaIncrustada('firmas/firma_abc.png') === false);
    comprobar('null no', esFirmaIncrustada(null) === false);
    comprobar('el nombre se deriva del id del parte', rutaDeFirma('ABC') === 'firmas/firma_ABC.png');

    console.log('\n─── CASO 1: la firma incrustada acaba en Storage ───');
    const datos = await sembrarParte('parte-sin-cobertura', BASE64);
    const res = await trasladarFirmaIncrustada('parte-sin-cobertura', datos);
    comprobar('la función dice que la movió', res.movida === true, JSON.stringify(res));

    const [existe] = await bucket.file(rutaDeFirma('parte-sin-cobertura')).exists();
    comprobar('el archivo existe en Storage', existe === true);

    const [contenido] = existe ? await bucket.file(rutaDeFirma('parte-sin-cobertura')).download() : [Buffer.alloc(0)];
    comprobar('el contenido es el PNG original', contenido.equals(PNG), `${contenido.length} bytes`);

    const [meta] = existe ? await bucket.file(rutaDeFirma('parte-sin-cobertura')).getMetadata() : [{}];
    comprobar('lleva contentType image/png', meta.contentType === 'image/png', meta.contentType);
    comprobar('lleva el metadato creador', (meta.metadata || {}).creador === EMAIL, JSON.stringify(meta.metadata));

    const trasEl = (await db.doc('partes_de_trabajo/parte-sin-cobertura').get()).data();
    comprobar('el parte ya guarda la RUTA, no el base64', trasEl.firma === rutaDeFirma('parte-sin-cobertura'), trasEl.firma);
    comprobar('y no queda rastro del base64', !String(trasEl.firma).startsWith('data:'));

    console.log('\n─── CASO 2: es idempotente (reentrega del evento) ───');
    const repetido = await trasladarFirmaIncrustada('parte-sin-cobertura', trasEl);
    comprobar('la segunda vez no hace nada', repetido.movida === false && repetido.motivo === 'ya-es-ruta', JSON.stringify(repetido));

    const [archivos] = await bucket.getFiles({ prefix: 'firmas/firma_parte-sin-cobertura' });
    comprobar('no ha dejado un huérfano por intento', archivos.length === 1, `${archivos.length} objeto(s)`);

    console.log('\n─── CASO 3: los partes normales no se tocan ───');
    const conRuta = await sembrarParte('parte-con-cobertura', 'firmas/firma_1788079536476_t8jfrt6.png');
    const r3 = await trasladarFirmaIncrustada('parte-con-cobertura', conRuta);
    comprobar('un parte que ya trae ruta se ignora', r3.movida === false && r3.motivo === 'ya-es-ruta');

    const sinFirma = await sembrarParte('parte-sin-firma', null);
    const r4 = await trasladarFirmaIncrustada('parte-sin-firma', sinFirma);
    comprobar('un parte sin firma se ignora', r4.movida === false && r4.motivo === 'sin-firma');

    console.log('\n─── CASO 4: contenido que no es una firma ───');
    const basura = 'data:image/png;base64,' + Buffer.from('esto no es un png').toString('base64');
    const conBasura = await sembrarParte('parte-basura', basura);
    const r5 = await trasladarFirmaIncrustada('parte-basura', conBasura);
    comprobar('no se sube algo que no sea PNG', r5.movida === false && r5.motivo === 'no-es-png', JSON.stringify(r5));

    const intacto = (await db.doc('partes_de_trabajo/parte-basura').get()).data();
    comprobar('y el documento se deja como estaba', intacto.firma === basura);

    console.log('\n─── CASO 5: sin creador tampoco falla ───');
    await db.doc('partes_de_trabajo/parte-anonimo').set({ firma: BASE64, estado: 'pendiente', timestamp: Date.now() });
    const anonimo = (await db.doc('partes_de_trabajo/parte-anonimo').get()).data();
    const r6 = await trasladarFirmaIncrustada('parte-anonimo', anonimo);
    comprobar('se traslada igual', r6.movida === true, JSON.stringify(r6));
    const [metaAnon] = await bucket.file(rutaDeFirma('parte-anonimo')).getMetadata();
    comprobar('sin metadato creador, pero subida', !(metaAnon.metadata || {}).creador);

    console.log(fallos === 0 ? '\n══ TODAS LAS COMPROBACIONES PASAN ══' : `\n══ ${fallos} COMPROBACIÓN(ES) FALLIDA(S) ══`);
    process.exit(fallos === 0 ? 0 : 1);
})().catch((error) => {
    console.error('\nError inesperado:', error);
    process.exit(1);
});
