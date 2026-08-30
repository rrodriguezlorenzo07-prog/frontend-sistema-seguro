/**
 * Resolución de firmas guardadas en Cloud Storage.
 *
 * El campo `firma` de un parte guarda la RUTA del archivo ("firmas/firma_xxx.png"),
 * no su URL de descarga. La URL que devuelve getDownloadURL() lleva un token
 * permanente que autoriza por posesión y no caduca: guardarla en Firestore la hacía
 * circular en cada lectura del documento.
 *
 * Resolver la ruta con getBytes() sí pasa por las reglas de Storage, así que el
 * acceso a la firma queda por fin sujeto a ellas.
 */
import { ref, getBytes } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * ¿El valor guardado es una ruta de Storage, o una URL/base64 ya resuelta?
 * Durante la transición conviven ambos formatos.
 * @param {*} valor
 * @returns {boolean}
 */
export function esRutaDeStorage(valor) {
    return typeof valor === 'string'
        && valor !== ''
        && !valor.startsWith('http')
        && !valor.startsWith('data:');
}

/**
 * Devuelve algo pintable con <img src> y utilizable por jsPDF.
 *
 * - Si el valor ya es una URL o un base64 (partes anteriores a la migración), se
 *   devuelve tal cual: compatibilidad hacia atrás.
 * - Si es una ruta, se descarga por SDK y se convierte a data URL.
 *
 * @param {string|null|undefined} valor contenido del campo `firma`
 * @returns {Promise<string|null>} data URL, o null si no hay firma o falla
 */
export async function resolverFirma(valor) {
    if (!valor) return null;
    if (!esRutaDeStorage(valor)) return valor;

    try {
        const bytes = await getBytes(ref(storage, valor));
        const blob = new Blob([bytes], { type: 'image/png' });
        return await new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = reject;
            lector.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('No se pudo resolver la firma', valor, error);
        return null;
    }
}

/**
 * Resuelve varias firmas a la vez y devuelve un mapa id -> data URL.
 * Las que fallen o no existan quedan simplemente fuera del mapa.
 *
 * @param {Array<{id: string, firma?: string}>} documentos
 * @returns {Promise<Record<string, string>>}
 */
export async function resolverFirmasDe(documentos) {
    const conFirma = documentos.filter((d) => d && d.firma);
    const resueltas = await Promise.all(conFirma.map((d) => resolverFirma(d.firma)));

    const mapa = {};
    conFirma.forEach((d, i) => {
        if (resueltas[i]) mapa[d.id] = resueltas[i];
    });
    return mapa;
}
