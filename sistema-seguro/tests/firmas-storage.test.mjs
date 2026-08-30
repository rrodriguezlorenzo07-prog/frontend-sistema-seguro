/**
 * Bloque 3b, fase 2: quién puede leer una firma en Storage.
 *
 *   npx firebase emulators:exec --only storage --project demo-sistema-seguro \
 *     "node tests/firmas-storage.test.mjs"
 *
 * El rol de admin llega en el TOKEN, como custom claim, no desde Firestore. La versión
 * anterior de estas reglas lo resolvía con firestore.get() y esta prueba pasaba en
 * verde mientras en producción la oficina no podía ver ni una firma: la llamada entre
 * servicios funciona en el emulador y no en producción.
 *
 * POR ESO ESTA PRUEBA NO BASTA. El emulador no es representativo para las reglas de
 * Storage. Todo lo que se verifique aquí hay que repetirlo contra producción después
 * de desplegar, con scripts/verificar-incidente-firmas.cjs.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const PNG = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-sistema-seguro',
    storage: { rules: fs.readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 }
});
await testEnv.clearStorage();

const EMAIL_ADMIN = 'oficina@empresa.com';
const EMAIL_JUAN = 'juan@empresa.com';
const EMAIL_ANA = 'ana@empresa.com';

await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // Firma antigua, sin el metadato creador (como las 33 que ya existían)
    await uploadBytes(ref(ctx.storage(), 'firmas/antigua.png'), PNG, { contentType: 'image/png' });
    // Firma nueva, con el metadato que fija ParteTrabajo.jsx
    await uploadBytes(ref(ctx.storage(), 'firmas/de-juan.png'), PNG, {
        contentType: 'image/png', customMetadata: { creador: EMAIL_JUAN }
    });
    // Con el correo escrito en otra caja, para comprobar la normalización por los dos lados
    await uploadBytes(ref(ctx.storage(), 'firmas/de-ana-mayusculas.png'), PNG, {
        contentType: 'image/png', customMetadata: { creador: 'ANA@Empresa.com' }
    });
});

// El admin lo es por el claim del token, que es lo que escribe la Cloud Function.
const admin = testEnv.authenticatedContext('uid-admin', { email: EMAIL_ADMIN, admin: true });
const juan = testEnv.authenticatedContext('uid-juan', { email: EMAIL_JUAN });
const ana = testEnv.authenticatedContext('uid-ana', { email: EMAIL_ANA });
// Alguien que trae el claim, pero en false: no debe colarse.
const falsoAdmin = testEnv.authenticatedContext('uid-falso', { email: 'falso@empresa.com', admin: false });

let fallos = 0;
const comprobar = async (desc, fn) => {
    try { await fn(); console.log(`   PASA   · ${desc}`); }
    catch (e) { fallos += 1; console.log(`   FALLA  · ${desc} — ${e.message.split('\n')[0]}`); }
};

console.log('\n─── CASO 1: el admin lee cualquier firma, por el claim del token ───');
await comprobar('admin lee una firma con metadato', () =>
    assertSucceeds(getBytes(ref(admin.storage(), 'firmas/de-juan.png')))
);
await comprobar('admin lee una firma antigua SIN metadato', () =>
    assertSucceeds(getBytes(ref(admin.storage(), 'firmas/antigua.png')))
);

console.log('\n─── CASO 2: el creador lee SU propia firma ───');
await comprobar('Juan lee firmas/de-juan.png', () =>
    assertSucceeds(getBytes(ref(juan.storage(), 'firmas/de-juan.png')))
);
await comprobar('la comparación de correo no depende de mayúsculas', () =>
    assertSucceeds(getBytes(ref(ana.storage(), 'firmas/de-ana-mayusculas.png')))
);

console.log('\n─── CASO 3: otro operario NO puede ───');
await comprobar('Ana NO lee la firma de Juan', () =>
    assertFails(getBytes(ref(ana.storage(), 'firmas/de-juan.png')))
);
await comprobar('Ana NO lee una firma antigua sin metadato', () =>
    assertFails(getBytes(ref(ana.storage(), 'firmas/antigua.png')))
);
await comprobar('Juan tampoco lee una firma antigua sin metadato', () =>
    assertFails(getBytes(ref(juan.storage(), 'firmas/antigua.png')))
);
await comprobar('sin autenticar no se lee nada', () =>
    assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), 'firmas/de-juan.png')))
);

console.log('\n─── CASO 4: el claim tiene que valer true, y su ausencia no debe conceder ───');
await comprobar('claim admin=false no concede nada', () =>
    assertFails(getBytes(ref(falsoAdmin.storage(), 'firmas/antigua.png')))
);
await comprobar('sin claim alguno tampoco (Ana, que no lo trae)', () =>
    assertFails(getBytes(ref(ana.storage(), 'firmas/antigua.png')))
);

console.log('\n─── CASO 5: subir sigue funcionando, con y sin metadatos ───');
await comprobar('subir CON el metadato, como el cliente actual', () =>
    assertSucceeds(uploadBytes(ref(juan.storage(), 'firmas/nueva-con-meta.png'), PNG, {
        contentType: 'image/png', customMetadata: { creador: EMAIL_JUAN }
    }))
);
await comprobar('subir SIN metadato, como un bundle antiguo en caché', () =>
    assertSucceeds(uploadBytes(ref(juan.storage(), 'firmas/nueva-sin-meta.png'), PNG, { contentType: 'image/png' }))
);
await comprobar('lo que sube el operario es legible por él después', () =>
    assertSucceeds(getBytes(ref(juan.storage(), 'firmas/nueva-con-meta.png')))
);
await comprobar('lo que sube SIN metadato ya no lo lee ni él (solo oficina)', () =>
    assertFails(getBytes(ref(juan.storage(), 'firmas/nueva-sin-meta.png')))
);
await comprobar('no se sube algo que no sea PNG', () =>
    assertFails(uploadBytes(ref(juan.storage(), 'firmas/documento.pdf'), PNG, { contentType: 'application/pdf' }))
);
await comprobar('sin autenticar no se sube nada', () =>
    assertFails(uploadBytes(ref(testEnv.unauthenticatedContext().storage(), 'firmas/anonima.png'), PNG, { contentType: 'image/png' }))
);

console.log('\n─── CASO 6: una firma no se reemplaza ni se borra, y no hay otras rutas ───');
// HALLAZGO ABIERTO, no una regla querida: `allow update, delete: if false` NO impide
// reemplazar una firma. Una subida sobre una ruta ya ocupada se evalúa como `create`,
// así que ese `if false` nunca se mira. Se deja aquí como assertSucceeds para que
// conste la realidad; el día que se añada `resource == null` al create, esta
// comprobación debe pasar a assertFails y este comentario desaparecer.
await comprobar('PENDIENTE: hoy SÍ se puede sobrescribir una firma existente', () =>
    assertSucceeds(uploadBytes(ref(admin.storage(), 'firmas/de-juan.png'), PNG, { contentType: 'image/png' }))
);
await comprobar('otras rutas fuera de firmas/ siguen cerradas', () =>
    assertFails(uploadBytes(ref(juan.storage(), 'otros/cosa.png'), PNG, { contentType: 'image/png' }))
);
await comprobar('el admin tampoco lee fuera de firmas/', () =>
    assertFails(getBytes(ref(admin.storage(), 'otros/cosa.png')))
);

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
console.log('Recuerda: esto es el emulador. Repetir contra producción tras desplegar.');
await testEnv.cleanup();
process.exit(fallos === 0 ? 0 : 1);
