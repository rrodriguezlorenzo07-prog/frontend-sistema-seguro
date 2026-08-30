// @ts-check
/**
 * TOKENS DE DISEÑO · dirección «Vidrio»
 *
 * La única fuente de verdad del aspecto de la aplicación. Ningún componente debería
 * volver a escribir un color, un tamaño de letra o un espaciado a mano: si hace falta
 * un valor que no está aquí, es que falta un token, no que haya que improvisarlo.
 *
 * EL CARÁCTER: arquitectónico y material. Verdes de vidrio sobre petróleo profundo,
 * mucho aire, líneas finísimas. Cuando dudes entre apretar y dejar respirar, deja
 * respirar: es la decisión que define esta dirección frente a las otras dos.
 *
 * Hasta aquí la aplicación tenía 28 colores literales sin nombre repartidos por 16
 * archivos, tres azules distintos y un morado que salía una sola vez. Esto lo sustituye.
 */

/**
 * PALETA
 *
 * Los nombres describen el papel, no el color: `superficie` seguirá llamándose así el
 * día que deje de ser blanca. Por eso no hay `verde` ni `azul` en las claves.
 */
export const color = {
    // — Base de la marca —
    petroleo: '#0C2A31',        // tinta, botones primarios, cabeceras
    petroleoSuave: '#164049',   // hover de lo anterior
    vidrio: '#2F7C87',          // acento: enlaces, valores destacados, foco
    vidrioSuave: '#4E9BA6',     // hover del acento
    canto: '#9CC4C9',           // borde sobre superficie teñida

    // — Superficies —
    fondo: '#F6F8F8',           // fondo de página
    superficie: '#FFFFFF',      // tarjetas, modales, campos
    superficieTenida: '#E6F0F1',// bloques agrupados, cabeceras de tabla
    superficieHundida: '#EEF3F3',// zonas que reciben contenido (listas, dropzones)

    // — Líneas —
    linea: '#D4E3E5',           // hairline por defecto
    lineaSuave: '#E8EFEF',      // separadores dentro de una tarjeta
    lineaFuerte: '#0C2A31',     // borde de énfasis; se usa poco a propósito

    // — Texto —
    texto: '#0C2A31',
    textoSuave: '#3F6169',      // secundario, descripciones
    textoTenue: '#6E8B92',      // etiquetas, metadatos, deshabilitado
    textoSobreOscuro: '#E6F0F1',

    // — Semánticos. Son estado, no decoración: no se usan como acento. —
    aviso: '#B06E12',
    avisoSuave: '#FBF0E0',
    error: '#A32A22',
    errorSuave: '#FBEBE9',
    exito: '#1E6E52',
    exitoSuave: '#E4F1EB',
    info: '#2F7C87',
    infoSuave: '#E6F0F1'
};

/**
 * TIPOGRAFÍA
 *
 * Familjen Grotesk para todo. Aguanta bien en tamaño grande sin volverse decorativa y
 * en texto corrido sin cansar, que es justo lo que necesita una aplicación que tiene
 * tanto pantallas de lectura como formularios.
 *
 * La familia se carga en index.css; aquí solo vive la referencia.
 */
export const fuente = {
    familia: '"Familjen Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif',
    // Para columnas de cifras: mismas anchuras de dígito, se alinean solas.
    cifras: 'tabular-nums'
};

/** Escala tipográfica. Sin valores intermedios: si no está, no se usa. */
export const texto = {
    micro: '10px',   // insignias
    etiqueta: '11px',// etiquetas de campo en mayúsculas
    menor: '12.5px', // metadatos, ayudas
    base: '14px',    // cuerpo, tablas
    medio: '16px',   // texto destacado, entradas de formulario
    mayor: '20px',   // títulos de sección
    titulo: '26px',  // títulos de pantalla
    cifra: '32px'    // totales
};

export const peso = { normal: 400, medio: 500, fuerte: 600, maximo: 700 };

export const interletra = {
    titulo: '-0.02em',   // los tamaños grandes piden apretar
    normal: '0',
    etiqueta: '0.12em'   // mayúsculas pequeñas piden abrir
};

export const interlinea = { apretada: 1.2, normal: 1.5, comoda: 1.65 };

/**
 * ESPACIADO
 *
 * Escala de 4 px. El aire es el rasgo que define esta dirección, así que los
 * componentes tiran del extremo alto de la escala más de lo que sería habitual.
 */
export const espacio = {
    xxs: '4px',
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
    xxxl: '64px'
};

/** Radios. Contenidos: esto es arquitectura, no una app de consumo. */
export const radio = { ninguno: '0', sutil: '3px', medio: '6px', pastilla: '999px' };

/**
 * SOMBRAS
 *
 * Muy contenidas y teñidas de petróleo, no de negro: una sombra gris sobre un fondo
 * verdoso se ve sucia. La de foco reemplaza el azul genérico de index.css.
 */
export const sombra = {
    sutil: '0 1px 2px rgba(12, 42, 49, 0.06)',
    media: '0 4px 16px rgba(12, 42, 49, 0.08)',
    elevada: '0 12px 32px rgba(12, 42, 49, 0.14)',
    foco: '0 0 0 3px rgba(47, 124, 135, 0.22)'
};

/** Transiciones. Una sola duración: mezclarlas se nota y no aporta. */
export const transicion = { normal: '160ms ease' };

/**
 * PUNTOS DE CORTE
 *
 * Declarados aquí para que la Fase 4 tenga de dónde partir. Hoy la aplicación entera
 * tiene UNA media query, en 1024px, y solo esconde el menú de escritorio.
 */
export const corte = { movil: '480px', tableta: '768px', escritorio: '1200px' };

/** Alturas mínimas de objetivo táctil. El operario usa esto de pie y en obra. */
export const objetivo = { comodo: '44px', amplio: '52px' };

export default { color, fuente, texto, peso, interletra, interlinea, espacio, radio, sombra, transicion, corte, objetivo };
