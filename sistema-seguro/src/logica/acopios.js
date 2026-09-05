// @ts-check
/**
 * Acopios: material concreto, para una obra concreta, y por dónde va.
 *
 * DÓNDE VIVE LA MÁQUINA DE ESTADOS Y POR QUÉ AQUÍ. Las reglas de Firestore podrían
 * comprobar el orden comparando con `resource.data.estado`, pero encerrarían la lógica en
 * un sitio que solo se puede probar levantando un emulador. Aquí se prueba con
 * `node --test` en milisegundos.
 *
 * El reparto es el mismo de siempre: las reglas protegen de un tercero malicioso —quién
 * escribe y qué campos toca—, y esta lógica protege de un error honesto, que es lo que de
 * verdad va a pasar: un dedo que roza el botón equivocado en un almacén.
 *
 * NO TOCA `inventario/` NI SU DESCUENTO (D4). Un acopio no resta stock: son dos sistemas
 * paralelos. El descuento sigue viviendo en el writeBatch de la aprobación del parte.
 */

/** @typedef {import('../types.js').Acopio} Acopio */

/**
 * El recorrido completo. `fabricado` solo aparece cuando la pieza se fabrica: un perfil
 * cortado a medida sí, una caja de tornillos no —esa solo se recibe— (A2).
 */
export const ESTADOS = ['pendiente', 'fabricado', 'recepcionado', 'listo'];

/** Cómo se llama cada estado donde lo lee una persona. */
export const NOMBRES = {
    pendiente: 'Pendiente',
    fabricado: 'Fabricado',
    recepcionado: 'Recepcionado',
    listo: 'Listo para cargar'
};

/**
 * El recorrido que le toca a ESTE acopio.
 *
 * @param {boolean} requiereFabricacion
 * @returns {string[]}
 */
export function cadenaDe(requiereFabricacion) {
    return requiereFabricacion
        ? ['pendiente', 'fabricado', 'recepcionado', 'listo']
        : ['pendiente', 'recepcionado', 'listo'];
}

/**
 * ¿Se puede pasar de un estado a otro?
 *
 * HACIA DELANTE, DE UNO EN UNO. No se puede marcar «listo» sin pasar por
 * «recepcionado»: si se pudiera, el estado dejaría de significar nada y la pantalla que
 * dice qué falta mentiría.
 *
 * HACIA ATRÁS, LIBRE. Esto es decisión de criterio y va explicada: marcar de más es un
 * error frecuente cuando se hace con guantes y con prisa, y obligar a llamar a oficina
 * para deshacerlo convierte un despiste de tres segundos en una llamada de tres minutos.
 * Todo salto queda en `historial`, así que retroceder deja rastro igual que avanzar.
 *
 * @param {string} desde
 * @param {string} hasta
 * @param {boolean} requiereFabricacion
 * @returns {{valida: boolean, motivo: string|null}}
 */
export function transicionValida(desde, hasta, requiereFabricacion) {
    const cadena = cadenaDe(requiereFabricacion);
    const i = cadena.indexOf(desde);
    const j = cadena.indexOf(hasta);

    if (j < 0) {
        // Puede ser un estado inventado, o `fabricado` en algo que no se fabrica.
        return ESTADOS.includes(hasta)
            ? { valida: false, motivo: `Este acopio no pasa por «${NOMBRES[hasta] || hasta}»: no requiere fabricación.` }
            : { valida: false, motivo: `«${hasta}» no es un estado de acopio.` };
    }
    if (i < 0) {
        return { valida: false, motivo: `«${desde}» no es un estado válido para este acopio.` };
    }
    if (i === j) {
        return { valida: false, motivo: 'Ya está en ese estado.' };
    }
    if (j < i) {
        // Retroceder para corregir un error: permitido y auditado.
        return { valida: true, motivo: null };
    }
    if (j > i + 1) {
        const salta = cadena[i + 1];
        return { valida: false, motivo: `Antes hay que marcarlo como «${NOMBRES[salta]}».` };
    }
    return { valida: true, motivo: null };
}

/**
 * El estado siguiente, o null si ya está al final.
 *
 * @param {Acopio} acopio
 * @returns {string|null}
 */
export function siguienteEstado(acopio) {
    const cadena = cadenaDe(Boolean(acopio?.requiereFabricacion));
    const i = cadena.indexOf(acopio?.estado);
    if (i < 0 || i === cadena.length - 1) return null;
    return cadena[i + 1];
}

/**
 * Los campos que hay que escribir para mover un acopio de estado.
 *
 * Devuelve `null` si la transición no vale, para que quien llama no tenga que acordarse
 * de comprobarlo aparte.
 *
 * @param {Acopio} acopio
 * @param {string} nuevoEstado
 * @param {string} porCorreo
 * @returns {{cambios: object, motivo: null}|{cambios: null, motivo: string}}
 */
export function cambioDeEstado(acopio, nuevoEstado, porCorreo) {
    const { valida, motivo } = transicionValida(
        acopio?.estado,
        nuevoEstado,
        Boolean(acopio?.requiereFabricacion)
    );
    if (!valida) return { cambios: null, motivo: motivo || 'Transición no permitida.' };

    const correo = String(porCorreo || '').toLowerCase().trim();
    const ahora = Date.now();
    return {
        cambios: {
            estado: nuevoEstado,
            actualizadoEn: ahora,
            actualizadoPor: correo,
            // El rastro completo, no solo el último valor: un acopio que va y viene
            // entre dos estados es justo lo que hay que poder ver después.
            historial: [...(acopio?.historial || []), { estado: nuevoEstado, en: ahora, por: correo }]
        },
        motivo: null
    };
}

/**
 * ¿Está listo para cargar?
 * @param {Acopio} acopio
 * @returns {boolean}
 */
export function estaListo(acopio) {
    return acopio?.estado === 'listo';
}

/**
 * LO QUE FALTA de una obra, que es lo que evita un viaje en balde (A4).
 *
 * Se cuenta lo que NO está listo, no lo que sí: «hay 4 preparados» es decoración, y
 * «quedan 2 sin recepcionar» es lo que hace que alguien coja el teléfono antes de
 * conducir cuarenta minutos.
 *
 * @param {Acopio[]} acopios de una sola obra
 * @returns {{faltan: number, total: number, porEstado: Record<string, number>, resumen: string|null}}
 */
export function loQueFalta(acopios) {
    const lista = acopios || [];
    const pendientes = lista.filter((a) => !estaListo(a));

    /** @type {Record<string, number>} */
    const porEstado = {};
    for (const a of pendientes) {
        porEstado[a.estado] = (porEstado[a.estado] || 0) + 1;
    }

    if (pendientes.length === 0) {
        return { faltan: 0, total: lista.length, porEstado, resumen: null };
    }

    // Se nombra el estado más atrasado: es el que marca cuándo estará todo.
    const masAtrasado = ESTADOS.find((e) => porEstado[e] > 0);
    const n = pendientes.length;
    const detalle = masAtrasado === 'pendiente' ? 'sin preparar'
        : masAtrasado === 'fabricado' ? 'sin recepcionar'
        : 'sin marcar como listos';

    return {
        faltan: n,
        total: lista.length,
        porEstado,
        resumen: `${n} ${n === 1 ? 'acopio' : 'acopios'} ${detalle}`
    };
}

/**
 * Agrupa acopios por obra, para cruzarlos con las asignaciones del cuadrante.
 *
 * @param {Acopio[]} acopios
 * @returns {Map<string, Acopio[]>}
 */
export function agruparPorObra(acopios) {
    /** @type {Map<string, Acopio[]>} */
    const mapa = new Map();
    for (const a of acopios || []) {
        if (!a?.obraId) continue;
        const lista = mapa.get(a.obraId) || [];
        lista.push(a);
        mapa.set(a.obraId, lista);
    }
    return mapa;
}

/**
 * Trocea una lista de obras en grupos de 30.
 *
 * Firestore admite como mucho 30 valores en un `in`. Hoy hay tres obras y esto no hace
 * falta, pero una consulta que revienta el día que la empresa crece es peor que diez
 * líneas ahora: el fallo llegaría en forma de pantalla en blanco, sin aviso.
 *
 * @param {string[]} obraIds
 * @param {number} [tamano]
 * @returns {string[][]}
 */
export function trocearParaConsulta(obraIds, tamano = 30) {
    const unicos = [...new Set((obraIds || []).filter(Boolean))];
    const trozos = [];
    for (let i = 0; i < unicos.length; i += tamano) {
        trozos.push(unicos.slice(i, i + tamano));
    }
    return trozos;
}

/**
 * Prepara el documento de un acopio nuevo.
 *
 * `materialNombre` es una COPIA CONGELADA, no una referencia. El catálogo se identifica
 * por nombre —`agregarMaterial` deduplica comparando cadenas en minúsculas—, así que
 * renombrar una entrada rompería cualquier vínculo por texto. Guardando el nombre aquí,
 * el acopio sigue diciendo qué era aunque el catálogo cambie debajo.
 *
 * La cantidad admite DECIMALES: un perfil se mide en metros lineales y el vidrio en m².
 * El catálogo no puede darlos porque guarda el stock con `parseInt`.
 *
 * @param {object} datos
 * @param {string} datos.obraId
 * @param {string} datos.obraNombre
 * @param {string|null} [datos.materialId] null si es una pieza fabricada a medida
 * @param {string} datos.materialNombre
 * @param {string} [datos.descripcion]
 * @param {number|string} datos.cantidad
 * @param {string} datos.unidad
 * @param {boolean} datos.requiereFabricacion
 * @param {string} datos.creadoPor
 * @returns {Acopio}
 */
export function construirAcopio({
    obraId, obraNombre, materialId = null, materialNombre,
    descripcion = '', cantidad, unidad, requiereFabricacion, creadoPor
}) {
    const ahora = Date.now();
    return /** @type {Acopio} */ ({
        obraId,
        obraNombre: obraNombre ?? null,
        materialId: materialId || null,
        materialNombre: String(materialNombre || '').trim(),
        descripcion: String(descripcion || '').trim(),
        cantidad: normalizarCantidad(cantidad),
        unidad,
        requiereFabricacion: Boolean(requiereFabricacion),
        estado: 'pendiente',
        historial: [],
        actualizadoEn: ahora,
        actualizadoPor: String(creadoPor || '').toLowerCase().trim(),
        creadoEn: ahora,
        creadoPor: String(creadoPor || '').toLowerCase().trim()
    });
}

/**
 * Cantidad con decimales, admitiendo la coma que teclea la gente.
 *
 * Se queda en dos decimales: más precisión que eso en un metro lineal es ruido, y sin
 * redondeo salen 3.5000000000000004 en las sumas.
 *
 * @param {number|string} valor
 * @returns {number}
 */
export function normalizarCantidad(valor) {
    const n = Number(String(valor ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100) / 100;
}
