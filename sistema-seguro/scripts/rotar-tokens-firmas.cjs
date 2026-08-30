/**
 * Bloque 3, paso final: rota el token de descarga de las firmas ya migradas.
 *
 *   node scripts/rotar-tokens-firmas.cjs            -> solo comprobación previa
 *   node scripts/rotar-tokens-firmas.cjs --aplicar  -> rota los tokens
 *
 * IRREVERSIBLE: las URLs de descarga ya emitidas dejan de funcionar para siempre.
 *
 * CONDICIÓN DE SEGURIDAD: aborta si algún parte todavía guarda la URL completa en su
 * campo `firma`. Rotar en ese estado dejaría esas firmas en blanco sin vuelta atrás.
 *
 * Solo toca objetos bajo firmas/ referenciados por un parte.
 */
const crypto = require('node:crypto');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const BUCKET = 'sistema-seguro-dcecb.firebasestorage.app';
const APLICAR = process.argv.includes('--aplicar');
const TAMANO_LOTE = 5;

const app = initializeApp({ credential: applicationDefault(), projectId: 'sistema-seguro-dcecb', storageBucket: BUCKET });
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

const urlDescarga = (ruta, token) =>
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
const enmascarar = (t) => (t ? String(t).slice(0, 8) + '…' : '(ninguno)');

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR — SE ROTARÁN TOKENS (irreversible)' : 'MODO: SOLO COMPROBACIÓN');
    console.log('');

    // ── Condición de seguridad ─────────────────────────────────────────────
    const snap = await db.collection('partes_de_trabajo').get();
    const rutas = [];
    const conUrl = [];
    snap.forEach((d) => {
        const f = d.data().firma;
        if (!f || typeof f !== 'string') return;
        if (f.startsWith('firmas/')) { rutas.push({ id: d.id, ruta: f }); return; }
        conUrl.push({ id: d.id, inicio: f.slice(0, 60) });
    });

    console.log('COMPROBACIÓN PREVIA');
    console.log('  partes con firma como RUTA :', rutas.length);
    console.log('  partes con firma como URL  :', conUrl.length);
    if (conUrl.length > 0) {
        console.log('\n  ABORTADO: estos partes todavía guardan la URL completa.');
        conUrl.forEach(c => console.log('    -', c.id, '->', c.inicio + '…'));
        console.log('  Rotar ahora dejaría esas firmas en blanco. Migra primero.');
        process.exit(1);
    }
    console.log('  -> condición cumplida: ningún parte depende ya de la URL.');

    if (!APLICAR) {
        console.log('\nNada rotado. Ejecuta con --aplicar.');
        process.exit(0);
    }

    // ── Rotación, en lotes pequeños y con error por archivo ────────────────
    console.log('\nROTACIÓN');
    const exitos = [];
    const fallos = [];
    let primeraPrueba = null;

    for (let i = 0; i < rutas.length; i += TAMANO_LOTE) {
        const lote = rutas.slice(i, i + TAMANO_LOTE);
        await Promise.all(lote.map(async ({ id, ruta }) => {
            try {
                const archivo = bucket.file(ruta);
                const [meta] = await archivo.getMetadata();
                const tokenAnterior = (meta.metadata || {}).firebaseStorageDownloadTokens || null;

                const tokenNuevo = crypto.randomUUID();
                await archivo.setMetadata({ metadata: { firebaseStorageDownloadTokens: tokenNuevo } });

                // ¿sigue siendo legible por SDK autenticado?
                const [contenido] = await archivo.download();
                const esPng = contenido[0] === 0x89 && contenido[1] === 0x50;
                if (!esPng) throw new Error('tras rotar, el contenido ya no es un PNG');

                exitos.push({ id, ruta, tokenAnterior, tokenNuevo, bytes: contenido.length });
                if (!primeraPrueba && tokenAnterior) primeraPrueba = { ruta, tokenAnterior, tokenNuevo };
            } catch (error) {
                fallos.push({ id, ruta, causa: error.message });
            }
        }));
        console.log(`  lote ${Math.min(i + TAMANO_LOTE, rutas.length)}/${rutas.length}  (ok: ${exitos.length}, fallos: ${fallos.length})`);
    }

    console.log('\nRESULTADO');
    console.log('  tokens rotados con éxito :', exitos.length);
    console.log('  fallos                   :', fallos.length);
    fallos.forEach(f => console.log(`    - ${f.ruta} (parte ${f.id}): ${f.causa}`));

    // ── ¿La URL antigua ha dejado de funcionar? ────────────────────────────
    console.log('\nCOMPROBACIÓN DE REVOCACIÓN (petición HTTP sin autenticar)');
    if (!primeraPrueba) {
        console.log('  no se pudo capturar ningún token anterior; sin prueba');
    } else {
        const { ruta, tokenAnterior, tokenNuevo } = primeraPrueba;
        console.log('  archivo         :', ruta);
        console.log('  token anterior  :', enmascarar(tokenAnterior));
        console.log('  token nuevo     :', enmascarar(tokenNuevo));

        const antigua = await fetch(urlDescarga(ruta, tokenAnterior));
        console.log('  URL ANTIGUA -> HTTP', antigua.status, antigua.status === 403 ? '(REVOCADA, correcto)' : '(¡SIGUE RESPONDIENDO!)');

        const nueva = await fetch(urlDescarga(ruta, tokenNuevo));
        console.log('  URL NUEVA   -> HTTP', nueva.status, nueva.status === 200 ? '(el archivo sigue accesible con el token nuevo)' : '(revisar)');

        // Y una segunda, para no fiarse de un único caso
        const otra = exitos.find(e => e.ruta !== ruta && e.tokenAnterior);
        if (otra) {
            const r = await fetch(urlDescarga(otra.ruta, otra.tokenAnterior));
            console.log('  2ª URL antigua ->  HTTP', r.status, r.status === 403 ? '(REVOCADA, correcto)' : '(¡SIGUE RESPONDIENDO!)');
        }
    }
    process.exit(fallos.length === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
