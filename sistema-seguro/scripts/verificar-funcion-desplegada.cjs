/**
 * SOLO LECTURA. ¿Qué código está sirviendo asignarRolAdmin en producción ahora mismo?
 *
 *   node scripts/verificar-funcion-desplegada.cjs
 *
 * No invoca la función —invocarla escribiría en roles/ y en los claims— ni deja nada
 * en disco. Descarga el artefacto de origen desplegado en memoria y lee logica.js de
 * dentro, para comprobar sobre el código real, y no por inferencia del deploy, que la
 * versión activa escribe roles/ y el custom claim en la misma operación con rollback.
 */
const zlib = require('node:zlib');
const { GoogleAuth } = require('google-auth-library');

const PROYECTO = 'sistema-seguro-dcecb';
const REGION = 'us-central1';
const FUNCION = 'asignarRolAdmin';

/** Extrae un archivo de un zip en memoria, sin dependencias externas. */
function leerDelZip(buf, sufijo) {
    // Fin del directorio central
    let fin = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
    }
    if (fin === -1) throw new Error('no parece un zip');
    const total = buf.readUInt16LE(fin + 10);
    let p = buf.readUInt32LE(fin + 16);

    for (let n = 0; n < total; n++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('directorio central corrupto');
        const metodo = buf.readUInt16LE(p + 10);
        const compBytes = buf.readUInt32LE(p + 20);
        const nomLen = buf.readUInt16LE(p + 28);
        const extLen = buf.readUInt16LE(p + 30);
        const comLen = buf.readUInt16LE(p + 32);
        const offset = buf.readUInt32LE(p + 42);
        const nombre = buf.toString('utf8', p + 46, p + 46 + nomLen);

        if (nombre.endsWith(sufijo)) {
            // Cabecera local: las longitudes pueden diferir de las del central
            const nomLenL = buf.readUInt16LE(offset + 26);
            const extLenL = buf.readUInt16LE(offset + 28);
            const ini = offset + 30 + nomLenL + extLenL;
            const datos = buf.subarray(ini, ini + compBytes);
            return { nombre, contenido: (metodo === 8 ? zlib.inflateRawSync(datos) : datos).toString('utf8') };
        }
        p += 46 + nomLen + extLen + comLen;
    }
    throw new Error(`no encuentro ningún archivo que acabe en ${sufijo}`);
}

(async () => {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const cli = await auth.getClient();
    const base = `https://cloudfunctions.googleapis.com/v2/projects/${PROYECTO}/locations/${REGION}/functions/${FUNCION}`;

    const fn = (await cli.request({ url: base })).data;
    console.log('═══ FUNCIÓN ACTIVA ═══');
    console.log('  nombre     :', fn.name.split('/functions/')[1]);
    console.log('  estado     :', fn.state);
    console.log('  actualizada:', fn.updateTime);
    console.log('  runtime    :', fn.buildConfig?.runtime);
    console.log('  revisión   :', fn.serviceConfig?.revision);

    const { downloadUrl } = (await cli.request({ url: `${base}:generateDownloadUrl`, method: 'POST', data: {} })).data;
    const zip = Buffer.from(await (await fetch(downloadUrl)).arrayBuffer());
    console.log('  artefacto  :', zip.length, 'bytes (leído en memoria, no se guarda)');

    const { nombre, contenido } = leerDelZip(zip, 'logica.js');
    console.log('  archivo leído del artefacto:', nombre, `(${contenido.length} caracteres)`);

    // ── Qué tiene que estar y qué no ───────────────────────────────────────
    const señales = [
        ['escribe el custom claim',            /setCustomUserClaims\(/],
        ['fusiona con los claims previos',     /\.\.\.\(usuario\.customClaims \|\| \{\}\)/],
        ['retira la llave entera al revocar',  /delete claims\.admin/],
        ['guarda el estado previo',            /estadoPrevio/],
        ['deshace si el claim falla',          /estadoPrevio\.exists[\s\S]{0,120}ref\.set\(estadoPrevio\.data\(\)\)/],
        ['sigue escribiendo roles/{uid}',      /roles\/\$\{uidDestino\}/],
        ['devuelve también el claim',          /claim: usuarioFinal\.customClaims/]
    ];

    console.log('\n═══ CÓDIGO REALMENTE DESPLEGADO ═══');
    let fallos = 0;
    for (const [desc, patron] of señales) {
        const ok = patron.test(contenido);
        if (!ok) fallos += 1;
        console.log(`   ${ok ? 'SÍ    ' : 'NO    '} · ${desc}`);
    }

    console.log('\n═══ VEREDICTO ═══');
    if (fallos === 0) {
        console.log('  La versión activa es la NUEVA: escribe roles/ y el claim en la misma');
        console.log('  operación, y deshace la escritura de Firestore si el claim falla.');
    } else {
        console.log(`  ${fallos} señal(es) ausente(s). NO es la versión esperada. Revisar el deploy.`);
    }
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => {
    console.error('ERROR:', e.message);
    if (e.response?.data) console.error(JSON.stringify(e.response.data).slice(0, 400));
    process.exit(1);
});
