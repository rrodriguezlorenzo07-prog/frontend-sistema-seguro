/**
 * Traslado a Storage de las firmas que llegaron dentro del parte.
 *
 * Cuando el operario envía sin cobertura, la subida a Storage falla —Storage no tiene
 * cola offline, Firestore sí— y ParteTrabajo.jsx guarda la firma en base64 dentro del
 * propio documento para no perder el parte entero. Aquí se recoge eso y se deja el
 * campo `firma` como debe estar: una ruta de Storage.
 *
 * Va aparte de index.js para poder ejercitarlo contra el emulador sin levantar el
 * runtime de Cloud Functions, igual que logica.js.
 */
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

/** Tope del mismo orden que el de storage.rules. Una firma real pesa 2-6 KB. */
const MAXIMO_BYTES = 2 * 1024 * 1024;

/** ¿El campo `firma` trae la imagen incrustada en vez de una ruta? */
function esFirmaIncrustada(valor) {
    return typeof valor === 'string' && valor.startsWith('data:image/png;base64,');
}

/**
 * Nombre determinista, derivado del id del parte.
 *
 * A propósito: si el traslado se reintenta —porque la función falló a mitad, o porque
 * Cloud Functions reentrega el evento— se sobrescribe el mismo objeto en vez de dejar
 * un huérfano por intento. El Admin SDK no pasa por storage.rules, así que el
 * `resource == null` que impide sustituir una firma desde el cliente no estorba aquí.
 */
function rutaDeFirma(parteId) {
    return `firmas/firma_${parteId}.png`;
}

/**
 * Mueve a Storage la firma incrustada de un parte y deja la ruta en su lugar.
 *
 * Idempotente: si el parte ya guarda una ruta, no hace nada y lo dice.
 *
 * @param {string} parteId
 * @param {{firma?: string, creador?: string}} datos contenido del parte
 * @returns {Promise<{movida: boolean, motivo?: string, ruta?: string, bytes?: number}>}
 */
async function trasladarFirmaIncrustada(parteId, datos) {
    const firma = datos && datos.firma;

    if (!firma) return { movida: false, motivo: 'sin-firma' };
    if (!esFirmaIncrustada(firma)) return { movida: false, motivo: 'ya-es-ruta' };

    const contenido = Buffer.from(firma.split(',')[1] || '', 'base64');

    // Firma PNG: 89 50 4E 47. Si no lo es, no se sube nada y se deja el documento
    // como está: perder la firma sería peor que conservarla en un formato incómodo.
    const esPng = contenido[0] === 0x89 && contenido[1] === 0x50
                  && contenido[2] === 0x4e && contenido[3] === 0x47;
    if (!esPng) return { movida: false, motivo: 'no-es-png' };
    if (contenido.length === 0) return { movida: false, motivo: 'vacia' };
    if (contenido.length > MAXIMO_BYTES) return { movida: false, motivo: 'demasiado-grande' };

    const ruta = rutaDeFirma(parteId);
    const creador = String(datos.creador || '').toLowerCase().trim();

    // El metadato `creador` es lo que permite a storage.rules dejar que el operario
    // lea su propia firma. Se fija igual que lo haría el cliente.
    await getStorage().bucket().file(ruta).save(contenido, {
        contentType: 'image/png',
        metadata: creador ? { metadata: { creador } } : undefined
    });

    // Solo después de que el archivo exista se suelta el base64 del documento.
    await getFirestore().doc(`partes_de_trabajo/${parteId}`).update({ firma: ruta });

    return { movida: true, ruta, bytes: contenido.length };
}

module.exports = { trasladarFirmaIncrustada, esFirmaIncrustada, rutaDeFirma, MAXIMO_BYTES };
