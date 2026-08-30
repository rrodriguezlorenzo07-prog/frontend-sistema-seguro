/**
 * Bloque 2, primera pasada: añade referencias por id JUNTO a los nombres existentes.
 *
 *   node scripts/migrar-referencias-id.cjs            -> recuento en seco
 *   node scripts/migrar-referencias-id.cjs --aplicar  -> escribe los ids
 *
 * ADITIVO: no borra ni modifica ningún nombre. Solo añade obraId / trabajadorId.
 *
 * Criterios, deliberadamente estrictos (los mismos que aplica el código hoy):
 *   - Nombres de obra y de trabajador: coincidencia EXACTA, sin trim ni minúsculas.
 *   - En la cuadrilla, si el "nombre" contiene @ se trata como email.
 *   - Lo que no resuelva queda en null explícito. No se corrige nada por aproximación.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'sistema-seguro-dcecb' }));

const APLICAR = process.argv.includes('--aplicar');
const TAMANO_LOTE = 400;

/** Índice nombre -> [ids]. Un nombre con más de un id es ambiguo y no se resuelve. */
const indexarPorCampo = (docs, campo) => {
    const mapa = new Map();
    docs.forEach((d) => {
        const clave = d.data()[campo];
        if (typeof clave !== 'string' || clave === '') return;
        if (!mapa.has(clave)) mapa.set(clave, []);
        mapa.get(clave).push(d.id);
    });
    return mapa;
};
/**
 * EXCEPCIÓN ÚNICA Y DELIBERADA — no es una normalización general.
 *
 * Hay una entrada de cuadrilla guardada como "julian" en minúscula que corresponde
 * inequívocamente al trabajador "Julian". Se resuelve a mano, caso por caso, porque
 * normalizar la comparación para todos (trim + minúsculas) corregiría en silencio
 * otros datos de nómina, y eso se descartó expresamente.
 *
 * "juan" y "juan " NO están aquí a propósito: no existe ningún trabajador con ese
 * nombre, así que no hay a quién resolverlos. Quedan en null.
 *
 * Si aparece otro caso así en el futuro, se añade aquí explícitamente y se documenta;
 * nunca se relaja el criterio de comparación general.
 */
const EXCEPCIONES_CUADRILLA = new Map([
    ['julian', 'Julian']
]);

const resolverUnico = (mapa, clave) => {
    const ids = mapa.get(clave);
    if (!ids) return { id: null, motivo: 'sin coincidencia' };
    if (ids.length > 1) return { id: null, motivo: 'AMBIGUO (' + ids.length + ' candidatos)' };
    return { id: ids[0], motivo: 'ok' };
};

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR (se escribirán ids)' : 'MODO: SECO (no se escribe nada)');
    console.log('');

    const [snapPartes, snapObras, snapTrab, snapCert, snapVal] = await Promise.all([
        db.collection('partes_de_trabajo').get(),
        db.collection('obras').get(),
        db.collection('trabajadores').get(),
        db.collection('certificaciones').get(),
        db.collection('validaciones').get()
    ]);

    const obrasPorNombre = indexarPorCampo(snapObras.docs, 'nombre');
    const trabPorNombre = indexarPorCampo(snapTrab.docs, 'nombre');
    const trabPorEmail = indexarPorCampo(snapTrab.docs, 'email');

    const escrituras = [];   // { ref, datos }
    const resumen = {
        a: { conId: 0, nulo: 0, ambiguo: 0, detalle: new Map() },
        b: { conId: 0, nulo: 0, ambiguo: 0, detalle: new Map() },
        c: { conId: 0, nulo: 0, detalle: new Map() },
        d: { conId: 0, nulo: 0, porNombre: 0, porEmail: 0, porExcepcion: 0, detalle: new Map() }
    };
    const anota = (bloque, clave) => bloque.detalle.set(clave, (bloque.detalle.get(clave) || 0) + 1);

    // ── (a) obraId en partes  y  (c) trabajadorId del autor ────────────────
    snapPartes.docs.forEach((d) => {
        const p = d.data();
        const cambios = {};

        const ro = resolverUnico(obrasPorNombre, p.obra);
        cambios.obraId = ro.id;
        if (ro.id) resumen.a.conId += 1;
        else {
            resumen.a.nulo += 1;
            if (ro.motivo.startsWith('AMBIGUO')) resumen.a.ambiguo += 1;
            anota(resumen.a, `"${p.obra}" -> ${ro.motivo}`);
        }

        const rt = resolverUnico(trabPorEmail, p.creador);
        cambios.trabajadorId = rt.id;
        if (rt.id) resumen.c.conId += 1;
        else { resumen.c.nulo += 1; anota(resumen.c, `"${p.creador}" -> ${rt.motivo}`); }

        escrituras.push({ ref: db.doc('partes_de_trabajo/' + d.id), datos: cambios });
    });

    // ── (b) obraId en certificaciones ──────────────────────────────────────
    snapCert.docs.forEach((d) => {
        const c = d.data();
        const r = resolverUnico(obrasPorNombre, c.obra);
        if (r.id) resumen.b.conId += 1;
        else {
            resumen.b.nulo += 1;
            if (r.motivo.startsWith('AMBIGUO')) resumen.b.ambiguo += 1;
            anota(resumen.b, `"${c.obra}" -> ${r.motivo}`);
        }
        escrituras.push({ ref: db.doc('certificaciones/' + d.id), datos: { obraId: r.id } });
    });

    // ── (d) trabajadorId en cada elemento de cuadrilla ─────────────────────
    snapVal.docs.forEach((d) => {
        const v = d.data();
        const cuadrilla = Array.isArray(v.cuadrilla) ? v.cuadrilla : [];
        if (cuadrilla.length === 0) return;

        const nueva = cuadrilla.map((op) => {
            const nombre = op?.nombre;
            let resuelto = { id: null, motivo: 'sin nombre' };
            if (typeof nombre === 'string' && nombre !== '') {
                resuelto = nombre.includes('@')
                    ? resolverUnico(trabPorEmail, nombre)
                    : resolverUnico(trabPorNombre, nombre);
                if (resuelto.id) {
                    if (nombre.includes('@')) resumen.d.porEmail += 1; else resumen.d.porNombre += 1;
                } else if (EXCEPCIONES_CUADRILLA.has(nombre)) {
                    resuelto = resolverUnico(trabPorNombre, EXCEPCIONES_CUADRILLA.get(nombre));
                    if (resuelto.id) resumen.d.porExcepcion += 1;
                }
            }
            if (resuelto.id) resumen.d.conId += 1;
            else { resumen.d.nulo += 1; anota(resumen.d, `"${nombre}" -> ${resuelto.motivo}`); }
            // El nombre se conserva SIEMPRE: es el registro histórico del documento.
            return { ...op, trabajadorId: resuelto.id };
        });

        escrituras.push({ ref: db.doc('validaciones/' + d.id), datos: { cuadrilla: nueva } });
    });

    // ── Informe ────────────────────────────────────────────────────────────
    const bloque = (titulo, r, total) => {
        console.log(`\n${titulo}`);
        console.log('   con id :', r.conId, ' | null:', r.nulo, r.ambiguo ? `(de ellos ambiguos: ${r.ambiguo})` : '', ' | total:', total);
        if (r.detalle.size > 0) {
            console.log('   sin resolver:');
            [...r.detalle.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`     ${k}  x${n}`));
        }
    };

    console.log('RECUENTO EN SECO');
    bloque('(a) partes_de_trabajo.obraId', resumen.a, snapPartes.size);
    bloque('(b) certificaciones.obraId', resumen.b, snapCert.size);
    bloque('(c) partes_de_trabajo.trabajadorId (autor, por email)', resumen.c, snapPartes.size);
    bloque('(d) validaciones.cuadrilla[].trabajadorId', resumen.d, resumen.d.conId + resumen.d.nulo);
    console.log('\n   (d) resueltos por nombre:', resumen.d.porNombre,
        '| por email:', resumen.d.porEmail,
        '| por excepción documentada:', resumen.d.porExcepcion);
    console.log('\nDocumentos que se tocarían:', escrituras.length);

    if (!APLICAR) { console.log('\nNada escrito. Ejecuta con --aplicar para migrar.'); process.exit(0); }

    let hechas = 0;
    for (let i = 0; i < escrituras.length; i += TAMANO_LOTE) {
        const lote = db.batch();
        escrituras.slice(i, i + TAMANO_LOTE).forEach(({ ref, datos }) => { lote.update(ref, datos); hechas += 1; });
        await lote.commit();
        console.log(`  lote confirmado: ${Math.min(i + TAMANO_LOTE, escrituras.length)}/${escrituras.length}`);
    }

    // Comprobación posterior: los nombres siguen intactos
    const [dp, dc, dv] = await Promise.all([
        db.collection('partes_de_trabajo').get(),
        db.collection('certificaciones').get(),
        db.collection('validaciones').get()
    ]);
    let partesSinObra = 0, certSinObra = 0, cuadrillaSinNombre = 0;
    dp.forEach(d => { if (d.data().obra === undefined) partesSinObra += 1; });
    dc.forEach(d => { if (d.data().obra === undefined) certSinObra += 1; });
    dv.forEach(d => (d.data().cuadrilla || []).forEach(o => { if (o.nombre === undefined) cuadrillaSinNombre += 1; }));

    console.log('\nRESULTADO');
    console.log('  documentos actualizados        :', hechas);
    console.log('  partes que perdieron .obra     :', partesSinObra, '(esperado 0)');
    console.log('  certificaciones sin .obra      :', certSinObra, '(esperado 0)');
    console.log('  operarios de cuadrilla sin nombre:', cuadrillaSinNombre, '(esperado 0)');
    process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
