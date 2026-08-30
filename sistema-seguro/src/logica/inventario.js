// @ts-check
/**
 * Almacén: los cálculos, sin Firestore y sin React.
 *
 * Aquí vivió también `totalesDePresupuesto`. Se retiró al borrar el circuito de
 * presupuestos de PanelOficina.jsx: se quedó sin ningún llamador. La calculadora de
 * PresupuestosOfertas.jsx, que es la que se usa, hace sus propias cuentas con un IVA
 * configurable en pantalla.
 */

/** @typedef {import('../types.js').Material} Material */

/**
 * Filtra el almacén por nombre y lo ordena.
 * @param {Material[]} materiales
 * @param {string} filtro
 * @param {'menor'|'mayor'|string} orden por stock ascendente, descendente, o por nombre
 * @returns {Material[]}
 */
export function filtrarMateriales(materiales, filtro, orden) {
    const texto = (filtro || '').toLowerCase();
    return (materiales || [])
        .filter((m) => m.nombre.toLowerCase().includes(texto))
        .sort((a, b) => {
            if (orden === 'menor') return a.stock - b.stock;
            if (orden === 'mayor') return b.stock - a.stock;
            return a.nombre.localeCompare(b.nombre);
        });
}
