/**
 * Bloque 3b: quién puede leer una firma en Storage.
 *
 *   npx firebase emulators:exec --only firestore,storage --project demo-sistema-seguro \
 *     "node tests/firmas-storage.test.mjs"
 *
 * Comprueba de paso si storage.rules puede consultar Firestore con firestore.get(),
 * que es la base del esAdmin() de estas reglas.
 */
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
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
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: fs.readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 }
});
await testEnv.clearFirestore();
await testEnv.clearStorage();

const EMAIL_ADMIN = 'oficina@empresa.com';
const EMAIL_JUAN = 'juan@empresa.com';
const EMAIL_ANA = 'ana@empresa.com';

await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'roles/uid-admin'), { admin: true });
    // Firma antigua, sin el metadato creador (como los 33 que ya existen)
    await uploadBytes(ref(ctx.storage(), 'firmas/antigua.png'), PNG, { contentType: 'image/png' });
    // Firma nueva, con el metadato
    await uploadBytes(ref(ctx.storage(), 'firmas/de-juan.png'), PNG, {
        contentType: 'image/png', customMetadata: { creador: EMAIL_JUAN }
    });
});

const admin = testEnv.authenticatedContext('uid-admin', { email: EMAIL_ADMIN });
const juan = testEnv.authenticatedContext('uid-juan', { email: EMAIL_JUAN });
const ana = testEnv.authenticatedContext('uid-ana', { email: EMAIL_ANA });

let fallos = 0;
const comprobar = async (desc, fn) => {
    try { await fn(); console.log(`   PASA   · ${desc}`); }
    catch (e) { fallos += 1; console.log(`   FALLA  · ${desc} — ${e.message.split('\n')[0]}`); }
};

console.log('\n─── CASO 0: ¿storage.rules puede consultar Firestore? ───');
await comprobar('esAdmin() vía firestore.get() concede lectura al admin', () =>
    assertSucceeds(getBytes(ref(admin.storage(), 'firmas/antigua.png')))
);

console.log('\n─── CASO 1: el creador lee SU propia firma ───');
await comprobar('Juan lee firmas/de-juan.png', () =>
    assertSucceeds(getBytes(ref(juan.storage(), 'firmas/de-juan.png')))
);

console.log('\n─── CASO 2: otro operario NO puede ───');
await comprobar('Ana NO lee la firma de Juan', () =>
    assertFails(getBytes(ref(ana.storage(), 'firmas/de-juan.png')))
);
await comprobar('Ana NO lee una firma antigua sin metadato', () =>
    assertFails(getBytes(ref(ana.storage(), 'firmas/antigua.png')))
);
await comprobar('Juan tampoco lee una firma antigua sin metadato', () =>
    assertFails(getBytes(ref(juan.storage(), 'firmas/antigua.png')))
);

console.log('\n─── CASO 3: el admin lee cualquier firma ───');
await comprobar('admin lee la de Juan', () =>
    assertSucceeds(getBytes(ref(admin.storage(), 'firmas/de-juan.png')))
);
await comprobar('admin lee la antigua sin metadato', () =>
    assertSucceeds(getBytes(ref(admin.storage(), 'firmas/antigua.png')))
);

console.log('\n─── CASO 4: subir sigue funcionando (sin regresión) ───');
await comprobar('subir SIN metadato, como hoy', () =>
    assertSucceeds(uploadBytes(ref(juan.storage(), 'firmas/nueva-sin-meta.png'), PNG, { contentType: 'image/png' }))
);
await comprobar('subir CON su propio metadato', () =>
    assertSucceeds(uploadBytes(ref(juan.storage(), 'firmas/nueva-con-meta.png'), PNG, {
        contentType: 'image/png', customMetadata: { creador: EMAIL_JUAN }
    }))
);
await comprobar('NO se puede atribuir una firma a otro', () =>
    assertFails(uploadBytes(ref(juan.storage(), 'firmas/falsificada.png'), PNG, {
        contentType: 'image/png', customMetadata: { creador: EMAIL_ANA }
    }))
);
await comprobar('sin autenticar no se sube nada', () =>
    assertFails(uploadBytes(ref(testEnv.unauthenticatedContext().storage(), 'firmas/anonima.png'), PNG, { contentType: 'image/png' }))
);

console.log('\n─── CASO 5: lo que sube el operario es legible por él después ───');
await comprobar('Juan lee la que acaba de subir con metadato', () =>
    assertSucceeds(getBytes(ref(juan.storage(), 'firmas/nueva-con-meta.png')))
);
await comprobar('otras rutas fuera de firmas/ siguen cerradas', () =>
    assertFails(uploadBytes(ref(juan.storage(), 'otros/cosa.png'), PNG, { contentType: 'image/png' }))
);

console.log(fallos === 0 ? '\n══ TODO CORRECTO ══' : `\n══ ${fallos} FALLO(S) ══`);
await testEnv.cleanup();
process.exit(fallos === 0 ? 0 : 1);
