/**
 * Quita los datos salariales que quedaron congelados dentro de
 * `certificaciones/{id}.albaranes[]`.
 *
 *   node scripts/limpiar-albaranes-certificacion.cjs            -> recuento, no escribe
 *   node scripts/limpiar-albaranes-certificacion.cjs --aplicar  -> escribe
 *
 * QUÉ PASÓ. Una certificación guardaba una copia entera del parte, y el parte venía
 * hidratado desde `validaciones/`: con la cuadrilla y las horas extra de cada persona.
 * Como `certificaciones` la lee cualquier administrador, esas horas quedaban al alcance
 * de quien solo tiene permiso operativo, saltándose el aislamiento que `validaciones/`
 * existe para dar. La escritura ya está corregida (logica/certificaciones.js); esto
 * limpia lo que se escribió antes.
 *
 * ES UNA LISTA NEGRA, no una reproyección. Se BORRAN claves concretas y se deja todo lo
 * demás intacto. Reconstruir el documento con la lista blanca del código nuevo sería más
 * elegante y bastante más peligroso: un campo antiguo que no estuviera en la lista
 * desaparecería de una certificación ya emitida, y una certificación emitida es un
 * documento que se le enseñó a un cliente.
 *
 * SE CONSERVAN LAS HORAS TOTALES. Antes de quitar `horasExtra` de la cuadrilla se
 * calcula el total del albarán —cuadrilla × 8 + extras— y se guarda en `horasTotales`,
 * que es lo que la vista previa pinta. Sin eso, abrir una certificación vieja mostraría
 * menos horas de las que se certificaron.
 *
 * ESTA OPERACIÓN NO ES REVERSIBLE SIN COPIA DE SEGURIDAD.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'sistema-seguro-dcecb';
const APLICAR = process.argv.includes('--aplicar');

// Mismas constantes que src/logica/certificaciones.js. Si cambian allí, cambian aquí.
const CLAVES_PROHIBIDAS = ['firma', 'horasExtraAsignadas', 'horasTaller', 'horasCalle', 'creador'];
const CLAVES_PROHIBIDAS_CUADRILLA = ['horas', 'horasExtra', 'trabajadorId'];
const HORAS_JORNADA = 8;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
}

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }));

/** Igual que utils/horasDocumento.js: cuadrilla × 8 + suma de horas extra. */
function horasTotalesDocumento(albaran) {
    const cuadrilla = Array.isArray(albaran?.cuadrilla) ? albaran.cuadrilla : [];
    if (cuadrilla.length === 0) return 0;
    const extra = cuadrilla.reduce((s, op) => s + (Number(op?.horasExtra) || 0), 0);
    return cuadrilla.length * HORAS_JORNADA + extra;
}

/** Devuelve {albaran, tocado} con las claves prohibidas fuera. */
function limpiarAlbaran(albaran) {
    let tocado = false;
    const salida = { ...albaran };

    // El total ANTES de perder el detalle, y solo si no lo tenía ya.
    if (salida.horasTotales === undefined) {
        const total = horasTotalesDocumento(albaran);
        if (total > 0) { salida.horasTotales = total; tocado = true; }
    }

    for (const clave of CLAVES_PROHIBIDAS) {
        if (clave in salida) { delete salida[clave]; tocado = true; }
    }

    if (Array.isArray(salida.cuadrilla)) {
        salida.cuadrilla = salida.cuadrilla.map((op) => {
            const limpio = { ...op };
            for (const clave of CLAVES_PROHIBIDAS_CUADRILLA) {
                if (clave in limpio) { delete limpio[clave]; tocado = true; }
            }
            return limpio;
        });
    }

    return { albaran: salida, tocado };
}

(async () => {
    console.log(APLICAR ? 'MODO: APLICAR — SE BORRARÁN CLAVES (irreversible)' : 'MODO: SECO — no se borra nada');
    console.log('Proyecto:', PROJECT_ID, '\n');

    const snap = await db.collection('certificaciones').get();

    const aLimpiar = [];
    let sinAlbaranes = 0;
    let yaLimpias = 0;
    let albaranesTotales = 0;
    let albaranesSucios = 0;
    const clavesVistas = {};

    snap.forEach((doc) => {
        const datos = doc.data();
        if (!Array.isArray(datos.albaranes) || datos.albaranes.length === 0) { sinAlbaranes += 1; return; }

        let algunoTocado = false;
        const nuevos = datos.albaranes.map((a) => {
            albaranesTotales += 1;
            for (const c of CLAVES_PROHIBIDAS) if (c in (a || {})) clavesVistas[c] = (clavesVistas[c] || 0) + 1;
            for (const op of (a?.cuadrilla || [])) {
                for (const c of CLAVES_PROHIBIDAS_CUADRILLA) if (c in (op || {})) clavesVistas[`cuadrilla.${c}`] = (clavesVistas[`cuadrilla.${c}`] || 0) + 1;
            }
            const { albaran, tocado } = limpiarAlbaran(a);
            if (tocado) { algunoTocado = true; albaranesSucios += 1; }
            return albaran;
        });

        if (algunoTocado) aLimpiar.push({ id: doc.id, referencia: datos.referencia, albaranes: nuevos, n: datos.albaranes.length });
        else yaLimpias += 1;
    });

    console.log(`Certificaciones: ${snap.size}`);
    console.log(`   sin albaranes incrustados : ${sinAlbaranes}`);
    console.log(`   ya limpias                : ${yaLimpias}`);
    console.log(`   POR LIMPIAR               : ${aLimpiar.length}`);
    console.log(`\nAlbaranes incrustados: ${albaranesTotales} · con alguna clave a quitar: ${albaranesSucios}`);
    console.log('\nClaves encontradas:');
    Object.entries(clavesVistas).sort().forEach(([c, n]) => console.log(`   ${c.padEnd(28)} ${n}`));
    if (Object.keys(clavesVistas).length === 0) console.log('   (ninguna)');

    if (aLimpiar.length > 0) {
        console.log('\nCertificaciones afectadas:');
        aLimpiar.forEach((c) => console.log(`   ${c.id}  ref=${c.referencia}  ${c.n} albarán(es)`));
    }

    if (aLimpiar.length === 0) { console.log('\nNada que hacer.\n'); process.exit(0); }
    if (!APLICAR) { console.log('\nRepite con --aplicar para escribirlo.\n'); process.exit(0); }

    for (const c of aLimpiar) {
        await db.doc(`certificaciones/${c.id}`).update({ albaranes: c.albaranes });
        console.log(`   limpiada ${c.id} (${c.referencia})`);
    }

    // Lectura de vuelta: que no quede ni una clave prohibida.
    const despues = await db.collection('certificaciones').get();
    let quedan = 0;
    despues.forEach((doc) => {
        for (const a of (doc.data().albaranes || [])) {
            for (const clave of CLAVES_PROHIBIDAS) if (clave in (a || {})) quedan += 1;
            for (const op of (a?.cuadrilla || [])) {
                for (const clave of CLAVES_PROHIBIDAS_CUADRILLA) if (clave in (op || {})) quedan += 1;
            }
        }
    });

    console.log(`\nClaves prohibidas que quedan tras la limpieza: ${quedan}\n`);
    process.exit(quedan === 0 ? 0 : 1);
})();
