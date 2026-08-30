/**
 * Verificación del cierre del incidente del 30/08/2026.
 *
 *   node scripts/verificar-incidente-firmas.cjs            -> solo lectura
 *   node scripts/verificar-incidente-firmas.cjs --subir    -> añade la subida de prueba
 *
 * 1. Qué ruleset de Storage está vivo.
 * 2. Si un admin recupera la lectura de una firma (lo que rompió esAdmin()).
 * 3. Con --subir: sube un PNG de prueba como OPERARIO SIN ROL ADMIN, por el endpoint
 *    REST y con el mismo formato que manda el SDK (multipart + customMetadata), que es
 *    lo que hace ParteTrabajo.jsx. Es la comprobación de que `create` volvió a abrirse.
 * 4. Tráfico real bajo firmas/.
 *
 * Las reglas se evalúan de verdad porque se usa un ID token de usuario, no el Admin
 * SDK, que se las salta.
 */
const crypto = require('node:crypto');
const { GoogleAuth } = require('google-auth-library');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const PROYECTO = 'sistema-seguro-dcecb';
const BUCKET = 'sistema-seguro-dcecb.firebasestorage.app';
const API_KEY = 'AIzaSyCW1nxHPHriIFbQauj6JunxdEalBvTFct8'; // clave web pública del cliente
const OPERARIO = 'rrodriguezlorenzo03@gmail.com';          // sin documento admin en roles/
const SUBIR = process.argv.includes('--subir');
const REGLAS_3B = new Date('2026-08-30T08:16:14Z');

const PNG = Buffer.from([
    0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,
    0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
    0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,0x89,0x00,0x00,0x00,
    0x0A,0x49,0x44,0x41,0x54,0x78,0x9C,0x63,0x00,0x01,0x00,0x00,
    0x05,0x00,0x01,0x0D,0x0A,0x2D,0xB4,0x00,0x00,0x00,0x00,0x49,
    0x45,0x4E,0x44,0xAE,0x42,0x60,0x82
]);

const app = initializeApp({ credential: applicationDefault(), projectId: PROYECTO, storageBucket: BUCKET });
const auth = getAuth(app);
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

const urlFirma = (ruta) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}?alt=media`;

const idTokenDe = async (uid) => {
    const custom = await auth.createCustomToken(uid);
    const d = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: custom, returnSecureToken: true })
    })).json();
    if (!d.idToken) throw new Error('no se pudo canjear el token: ' + JSON.stringify(d).slice(0, 200));
    return d.idToken;
};

(async () => {
    // ── 1. Reglas vivas ────────────────────────────────────────────────────
    const gauth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase'] });
    const cli = await gauth.getClient();
    const pedir = async (url) => (await cli.request({ url })).data;
    const { releases } = await pedir(`https://firebaserules.googleapis.com/v1/projects/${PROYECTO}/releases`);
    const rel = releases.find(r => r.name.includes('firebase.storage'));
    const fuente = (await pedir(`https://firebaserules.googleapis.com/v1/${rel.rulesetName}`)).source.files.map(f => f.content).join('\n');

    console.log('═══ 1. REGLAS DE STORAGE VIVAS ═══');
    console.log('  ruleset     :', rel.rulesetName.split('/rulesets/')[1]);
    console.log('  actualizado :', rel.updateTime);
    console.log('  read        :', (fuente.match(/allow read:[^;]*/) || ['(no encontrado)'])[0].replace(/\s+/g, ' '));
    console.log('  create      :', (fuente.match(/allow create:[^;]*/) || ['(no encontrado)'])[0].replace(/\s+/g, ' '));
    // Sin descartar los comentarios esto se detecta a sí mismo: el propio aviso que
    // dejamos en storage.rules nombra firestore.get().
    const sinComentarios = fuente.split(/\r?\n/).filter(l => !l.trim().startsWith('//')).join('\n');
    console.log('  ¿queda alguna llamada real entre servicios?:', sinComentarios.includes('firestore.') ? 'SÍ' : 'NO');

    // ── 2. ¿La oficina recupera la lectura? ────────────────────────────────
    const roles = await db.collection('roles').where('admin', '==', true).get();
    const uidAdmin = roles.docs[0].id;
    const admin = await auth.getUser(uidAdmin);
    const snap = await db.collection('partes_de_trabajo').orderBy('timestamp', 'desc').limit(30).get();
    const conFirma = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .find(p => typeof p.firma === 'string' && p.firma.startsWith('firmas/'));

    console.log('\n═══ 2. LECTURA DE UNA FIRMA (evalúa storage.rules) ═══');
    console.log('  parte:', conFirma.id, '·', conFirma.firma);
    const tokenAdmin = await idTokenDe(uidAdmin);
    const rAdmin = await fetch(urlFirma(conFirma.firma), { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    const buf = rAdmin.ok ? Buffer.from(await rAdmin.arrayBuffer()) : null;
    console.log(`  admin (${admin.email}) -> HTTP ${rAdmin.status}` +
                (buf ? `  ${buf.length} bytes, PNG: ${buf[0] === 0x89 && buf[1] === 0x50 ? 'sí' : 'NO'}` : ''));
    const rAnon = await fetch(urlFirma(conFirma.firma));
    console.log(`  sin autenticar -> HTTP ${rAnon.status} ${rAnon.status === 403 ? '(sigue denegado, correcto)' : '(REVISAR)'}`);

    // ── 3. Subida controlada como operario ─────────────────────────────────
    if (SUBIR) {
        const operario = await auth.getUserByEmail(OPERARIO);
        const esAdminOperario = (await db.doc(`roles/${operario.uid}`).get()).data()?.admin === true;
        console.log('\n═══ 3. SUBIDA CONTROLADA ═══');
        console.log('  como   :', operario.email, '· uid', operario.uid);
        console.log('  ¿admin?:', esAdminOperario ? 'SÍ (la prueba no sería representativa)' : 'no — operario normal, correcto');

        const ruta = `firmas/prueba_incidente_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.png`;
        const tokenOp = await idTokenDe(operario.uid);

        // Mismo formato que uploadString(..., 'data_url', { contentType, customMetadata })
        const limite = '----claude' + crypto.randomBytes(8).toString('hex');
        const meta = JSON.stringify({ contentType: 'image/png', metadata: { creador: OPERARIO } });
        const cuerpo = Buffer.concat([
            Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${meta}\r\n`),
            Buffer.from(`--${limite}\r\nContent-Type: image/png\r\n\r\n`),
            PNG,
            Buffer.from(`\r\n--${limite}--`)
        ]);

        const res = await fetch(
            `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=multipart&name=${encodeURIComponent(ruta)}`,
            { method: 'POST',
              headers: { Authorization: `Bearer ${tokenOp}`, 'Content-Type': `multipart/related; boundary=${limite}` },
              body: cuerpo }
        );
        const texto = await res.text();
        console.log(`  A) multipart + customMetadata -> ${ruta}`);
        console.log(`     HTTP ${res.status} ${res.ok ? '(ACEPTADA)' : '(RECHAZADA)'}`);
        if (!res.ok) console.log('      ', texto.replace(/\s+/g, ' ').slice(0, 200));

        // Si el multipart falla, no basta con dar el fallo por bueno: puede ser mi
        // formato del cuerpo y no la regla. Una subida simple no deja lugar a dudas
        // sobre qué contentType ve la regla, y es además lo que manda el cliente que
        // hay hoy en producción, que no envía metadatos.
        let rutaB = null, resB = null;
        if (!res.ok) {
            rutaB = `firmas/prueba_incidente_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.png`;
            resB = await fetch(
                `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(rutaB)}`,
                { method: 'POST', headers: { Authorization: `Bearer ${tokenOp}`, 'Content-Type': 'image/png' }, body: PNG }
            );
            console.log(`  B) subida simple, sin metadatos -> ${rutaB}`);
            console.log(`     HTTP ${resB.status} ${resB.ok ? '(ACEPTADA)' : '(RECHAZADA)'}`);
            if (!resB.ok) console.log('      ', (await resB.text()).replace(/\s+/g, ' ').slice(0, 200));
        }

        for (const r of [res.ok ? ruta : null, resB?.ok ? rutaB : null].filter(Boolean)) {
            const [m] = await bucket.file(r).getMetadata();
            console.log(`  en el bucket: ${r}`);
            console.log(`     contentType=${m.contentType}  bytes=${m.size}  creador=${(m.metadata || {}).creador ?? '(sin metadato)'}`);
        }
    }

    // ── 4. Tráfico real ────────────────────────────────────────────────────
    console.log('\n═══ 4. TRÁFICO EN firmas/ ═══');
    const [archivos] = await bucket.getFiles({ prefix: 'firmas/' });
    const orden = archivos.map(a => ({
        nombre: a.name, creado: new Date(a.metadata.timeCreated),
        creador: (a.metadata.metadata || {}).creador ?? null
    })).sort((a, b) => a.creado - b.creado);
    const nuevos = orden.filter(a => a.creado >= REGLAS_3B);
    console.log('  objetos totales:', orden.length, '· ahora:', new Date().toISOString());
    console.log('  posteriores al despliegue que rompió:', nuevos.length);
    nuevos.forEach(a => {
        const prueba = a.nombre.includes('prueba_incidente') ? '  [prueba de este script]' : '  <-- SUBIDA REAL DE UN OPERARIO';
        console.log(`    ${a.creado.toISOString()}  ${a.nombre}  creador=${a.creador ?? '(sin metadato)'}${prueba}`);
    });
    if (nuevos.filter(a => !a.nombre.includes('prueba_incidente')).length === 0) {
        console.log('    (ninguna subida real de operario todavía)');
    }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
