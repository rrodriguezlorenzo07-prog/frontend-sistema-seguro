/**
 * SOLO LECTURA. Comprueba que la ruta guardada basta para recuperar cada firma, y
 * que la lógica de ramificación de src/utils/firmas.js clasifica bien los formatos.
 */
const fs = require('fs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'sistema-seguro-dcecb',
    storageBucket: 'sistema-seguro-dcecb.firebasestorage.app'
});
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

// La función real, extraída del archivo que se despliega.
const fuente = fs.readFileSync('src/utils/firmas.js', 'utf8');
const ini = fuente.indexOf('export function esRutaDeStorage');
const fin = fuente.indexOf('\n}', ini);
const declaracion = fuente.slice(ini, fin + 2).replace('export function', 'function');
const esRutaDeStorage = new Function(declaracion + '\nreturn esRutaDeStorage;')();

let fallos = 0;
const comprobar = (desc, ok, detalle) => {
    if (!ok) fallos += 1;
    console.log(`   ${ok ? 'PASA  ' : 'FALLA '} · ${desc}${detalle ? ' — ' + detalle : ''}`);
};

(async () => {
    console.log('═══ 1. Clasificación de formatos (función real de src/utils/firmas.js) ═══');
    comprobar('una ruta se reconoce como ruta', esRutaDeStorage('firmas/firma_123.png') === true);
    comprobar('una URL NO se toma por ruta (compatibilidad)', esRutaDeStorage('https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&token=z') === false);
    comprobar('un base64 NO se toma por ruta', esRutaDeStorage('data:image/png;base64,AAAA') === false);
    comprobar('null no es ruta', esRutaDeStorage(null) === false);
    comprobar('cadena vacía no es ruta', esRutaDeStorage('') === false);

    console.log('\n═══ 2. ¿Basta la ruta para recuperar cada firma? ═══');
    const snap = await db.collection('partes_de_trabajo').get();
    const rutas = [];
    snap.forEach((d) => {
        const f = d.data().firma;
        if (typeof f !== 'string' || f === '') return;
        const ruta = f.startsWith('firmas/') ? f : (String(f).match(/\/o\/([^?]+)/) ? decodeURIComponent(String(f).match(/\/o\/([^?]+)/)[1]) : null);
        if (ruta) rutas.push({ id: d.id, ruta });
    });
    console.log('   firmas a comprobar:', rutas.length);

    let ok = 0, faltan = 0, noPng = 0;
    for (const { ruta } of rutas) {
        const archivo = bucket.file(ruta);
        const [existe] = await archivo.exists();
        if (!existe) { faltan += 1; console.log('     FALTA:', ruta); continue; }
        const [contenido] = await archivo.download();
        // Firma PNG: 89 50 4E 47
        const esPng = contenido[0] === 0x89 && contenido[1] === 0x50 && contenido[2] === 0x4E && contenido[3] === 0x47;
        if (!esPng) { noPng += 1; console.log('     NO ES PNG:', ruta); continue; }
        ok += 1;
    }
    comprobar('todas las rutas devuelven un PNG válido', faltan === 0 && noPng === 0, `${ok} correctas, ${faltan} inexistentes, ${noPng} no-PNG`);

    const muestra = rutas[0];
    if (muestra) {
        const [contenido] = await bucket.file(muestra.ruta).download();
        const dataUrl = 'data:image/png;base64,' + contenido.toString('base64');
        console.log('\n   Muestra: parte', muestra.id);
        console.log('     ruta guardada :', muestra.ruta);
        console.log('     bytes         :', contenido.length);
        console.log('     data URL      :', dataUrl.slice(0, 60) + '…  (' + dataUrl.length + ' caracteres)');
        console.log('     -> es lo que resolverFirma() devolverá al <img> y a jsPDF');
    }

    console.log('\n═══ 3. Partes sin firma ═══');
    let sinFirma = 0;
    snap.forEach((d) => { const f = d.data().firma; if (!f) sinFirma += 1; });
    console.log('   partes sin firma:', sinFirma, '-> resolverFirma(null) devuelve null y no se pinta nada');

    console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
