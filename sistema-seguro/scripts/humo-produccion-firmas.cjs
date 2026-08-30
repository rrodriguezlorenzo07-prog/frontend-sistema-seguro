/**
 * Fase 2 de 3b, paso 6: humo contra PRODUCCIÓN REAL tras desplegar storage.rules.
 *
 *   node scripts/humo-produccion-firmas.cjs
 *
 * SOLO LECTURA: no sube, no borra, no escribe. Acuña tokens de usuario con la cuenta
 * de servicio y pide firmas por el endpoint de descarga, que evalúa las reglas de
 * verdad — cosa que el Admin SDK no hace, porque se las salta.
 *
 * Existe porque el emulador NO es representativo para las reglas de Storage: el
 * 30/08/2026 la suite del emulador estaba en verde mientras en producción la oficina
 * no podía ver ni una firma. Todo lo que se verifique allí hay que repetirlo aquí.
 */
const { GoogleAuth } = require('google-auth-library');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const PROYECTO = 'sistema-seguro-dcecb';
const BUCKET = 'sistema-seguro-dcecb.firebasestorage.app';
const API_KEY = 'AIzaSyCW1nxHPHriIFbQauj6JunxdEalBvTFct8'; // clave web pública del cliente
const ADMIN = 'rrodriguezlorenzo02@gmail.com';
const OPERARIO = 'rrodriguezlorenzo03@gmail.com';

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

let fallos = 0;
const esperar = async (desc, esperado, hacer) => {
    const obtenido = await hacer();
    const ok = obtenido === esperado;
    if (!ok) fallos += 1;
    console.log(`   ${ok ? 'PASA  ' : 'FALLA '} · ${desc} — esperado HTTP ${esperado}, obtenido ${obtenido}`);
};

(async () => {
    // ── Reglas vivas ───────────────────────────────────────────────────────
    const gauth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase'] });
    const cli = await gauth.getClient();
    const pedir = async (url) => (await cli.request({ url })).data;
    const { releases } = await pedir(`https://firebaserules.googleapis.com/v1/projects/${PROYECTO}/releases`);
    const rel = releases.find(r => r.name.includes('firebase.storage'));
    const fuente = (await pedir(`https://firebaserules.googleapis.com/v1/${rel.rulesetName}`)).source.files.map(f => f.content).join('\n');
    const sinComentarios = fuente.split(/\r?\n/).filter(l => !l.trim().startsWith('//')).join('\n');

    console.log('═══ REGLAS VIVAS ═══');
    console.log('  ruleset    :', rel.rulesetName.split('/rulesets/')[1]);
    console.log('  actualizado:', rel.updateTime);
    console.log('  read       :', (fuente.match(/allow read:[^;]*/) || ['?'])[0].replace(/\s+/g, ' '));
    console.log('  esAdmin por claim :', sinComentarios.includes('request.auth.token.admin') ? 'sí' : 'NO');
    console.log('  llamadas a Firestore:', sinComentarios.includes('firestore.') ? 'SÍ (no debería)' : 'ninguna');

    // ── PRECONDICIÓN: el claim tiene que estar puesto ANTES de probar nada ──
    console.log('\n═══ PRECONDICIÓN — CLAIM DEL ADMIN ═══');
    const uAdmin = await auth.getUserByEmail(ADMIN);
    const claims = uAdmin.customClaims || {};
    console.log(`  ${ADMIN}`);
    console.log('    uid   :', uAdmin.uid);
    console.log('    claims:', JSON.stringify(claims));
    if (claims.admin !== true) {
        console.log('\n  ABORTADO: la cuenta no tiene el claim admin. Ejecuta antes');
        console.log('  scripts/backfill-claims-admin.cjs --aplicar. No se prueba nada más.');
        process.exit(1);
    }
    console.log('    -> claim presente, se puede continuar.');

    // ── Elegir archivos reales ─────────────────────────────────────────────
    const [archivos] = await bucket.getFiles({ prefix: 'firmas/' });
    const conMeta = archivos.map(a => ({ nombre: a.name, creador: (a.metadata.metadata || {}).creador ?? null }));
    const propiaDelOperario = conMeta.find(a => a.creador && a.creador.toLowerCase() === OPERARIO);
    const ajena = conMeta.find(a => !a.creador);   // firma antigua, de nadie identificable

    console.log('\n═══ ARCHIVOS ELEGIDOS ═══');
    console.log('  ajena  (sin metadato) :', ajena?.nombre ?? '(ninguna)');
    console.log('  propia del operario   :', propiaDelOperario?.nombre ?? '(ninguna)');

    const codigo = async (ruta, token) => {
        const r = await fetch(urlFirma(ruta), token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        return r.status;
    };

    // ── Los dos casos pedidos ──────────────────────────────────────────────
    console.log('\n═══ HUMO ═══');
    const tokenAdmin = await idTokenDe(uAdmin.uid);
    const carga = JSON.parse(Buffer.from(tokenAdmin.split('.')[1], 'base64').toString());
    console.log(`  claim admin dentro del token acuñado: ${carga.admin === true ? 'sí' : 'NO'}`);

    await esperar(`admin (${ADMIN}) lee una firma`, 200, () => codigo(ajena.nombre, tokenAdmin));

    const uOperario = await auth.getUserByEmail(OPERARIO);
    const esAdminOperario = (await db.doc(`roles/${uOperario.uid}`).get()).data()?.admin === true;
    const claimOperario = (uOperario.customClaims || {}).admin === true;
    console.log(`  operario ${OPERARIO}: admin en roles/=${esAdminOperario}, claim=${claimOperario}`);
    if (esAdminOperario || claimOperario) {
        console.log('   AVISO: esta cuenta es admin, el caso negativo no sería representativo.');
        fallos += 1;
    }
    const tokenOperario = await idTokenDe(uOperario.uid);
    await esperar('operario NO lee una firma ajena', 403, () => codigo(ajena.nombre, tokenOperario));

    // ── Extra: esSuya() y correo(), que nunca se habían probado en producción ──
    if (propiaDelOperario) {
        await esperar('operario SÍ lee su propia firma (esSuya + correo)', 200,
                      () => codigo(propiaDelOperario.nombre, tokenOperario));
    } else {
        console.log('   (sin firma propia del operario con metadato: no se puede probar esSuya)');
    }
    await esperar('sin autenticar no se lee nada', 403, () => codigo(ajena.nombre, null));

    console.log(fallos === 0 ? '\n══ HUMO EN PRODUCCIÓN: TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) EN PRODUCCIÓN ══`);
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
