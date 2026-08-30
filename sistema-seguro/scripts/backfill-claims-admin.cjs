/**
 * Fase 2 de 3b, paso 1: pone el custom claim `admin` a los administradores que ya
 * existen en roles/, para que storage.rules pueda resolver el rol sin salir de Storage.
 *
 *   node scripts/backfill-claims-admin.cjs            -> solo recuento
 *   node scripts/backfill-claims-admin.cjs --aplicar  -> escribe los claims
 *
 * roles/{uid} sigue siendo la fuente de verdad; el claim es su reflejo en el token.
 * A partir de la Fase D.1 la Cloud Function escribe los dos a la vez, así que este
 * script es solo para los que quedaron atrás.
 *
 * setCustomUserClaims REEMPLAZA todos los claims del usuario, así que aquí se fusiona
 * con los que ya hubiera en vez de sobrescribirlos a ciegas.
 *
 * OJO: un usuario ya logueado no ve el claim nuevo hasta que su ID token se renueva
 * (hasta 1 hora, o cerrando sesión y volviendo a entrar).
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const PROYECTO = 'sistema-seguro-dcecb';
const APLICAR = process.argv.includes('--aplicar');

const app = initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
const auth = getAuth(app);
const db = getFirestore(app);

(async () => {
    console.log('MODO:', APLICAR ? 'APLICAR' : 'SOLO RECUENTO');

    // ── Antes ──────────────────────────────────────────────────────────────
    const snap = await db.collection('roles').get();
    const admins = snap.docs.filter(d => d.data().admin === true);
    const noAdmins = snap.docs.filter(d => d.data().admin !== true);

    console.log('\n═══ ANTES ═══');
    console.log('  documentos en roles/        :', snap.size);
    console.log('  con admin: true             :', admins.length);
    console.log('  con admin: false / ausente  :', noAdmins.length);

    const estado = async (uid) => {
        const u = await auth.getUser(uid).catch(() => null);
        return { u, claim: u?.customClaims?.admin === true };
    };

    let conClaimAntes = 0;
    console.log('\n  ADMINS SEGÚN roles/:');
    for (const d of admins) {
        const { u, claim } = await estado(d.id);
        if (claim) conClaimAntes += 1;
        console.log(`    ${d.id}  ${u?.email ?? '(sin usuario en Auth)'}`);
        console.log(`       claims actuales: ${JSON.stringify(u?.customClaims ?? null)}  -> claim admin: ${claim ? 'SÍ' : 'no'}`);
    }
    console.log('  admins con el claim ya puesto:', conClaimAntes, 'de', admins.length);

    // Desincronización al revés: claim puesto sin respaldo en roles/
    console.log('\n  ¿ALGUIEN CON EL CLAIM PERO SIN admin EN roles/?');
    const sobrantes = [];
    for (const d of noAdmins) {
        const { u, claim } = await estado(d.id);
        if (claim) sobrantes.push({ uid: d.id, email: u?.email });
    }
    console.log('   ', sobrantes.length === 0 ? 'ninguno' : sobrantes.map(s => `${s.uid} (${s.email})`).join(', '));

    if (!APLICAR) {
        console.log('\nNada escrito. Ejecuta con --aplicar.');
        process.exit(0);
    }

    // ── Escritura ──────────────────────────────────────────────────────────
    console.log('\n═══ ESCRITURA ═══');
    const fallos = [];
    for (const d of admins) {
        try {
            const u = await auth.getUser(d.id);
            await auth.setCustomUserClaims(d.id, { ...(u.customClaims || {}), admin: true });
            console.log(`  puesto  · ${d.id}  ${u.email}`);
        } catch (e) {
            fallos.push({ uid: d.id, causa: e.message });
            console.log(`  FALLO   · ${d.id}  ${e.message}`);
        }
    }

    // ── Después: releer de Auth, no fiarse de que la llamada no lanzara ─────
    console.log('\n═══ DESPUÉS (releído de Auth) ═══');
    let conClaimDespues = 0;
    for (const d of admins) {
        const { u, claim } = await estado(d.id);
        if (claim) conClaimDespues += 1;
        console.log(`  ${claim ? 'OK   ' : 'FALLA'} · ${u?.email ?? d.id}  claims: ${JSON.stringify(u?.customClaims ?? null)}`);
    }

    console.log('\n═══ RECUENTO ═══');
    console.log('  admins en roles/            :', admins.length);
    console.log('  con el claim ANTES          :', conClaimAntes);
    console.log('  con el claim DESPUÉS        :', conClaimDespues);
    console.log('  fallos                      :', fallos.length);
    console.log('\n  Los admins ya logueados necesitan un token nuevo para que esto');
    console.log('  surta efecto en el cliente: hasta 1 hora, o cerrar sesión y entrar.');
    process.exit(conClaimDespues === admins.length && fallos.length === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
