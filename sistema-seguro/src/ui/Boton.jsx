// @ts-check
/**
 * Botón. Sustituye a btnBlackStyle y a las seis variantes que se escribían a mano
 * encima de él: blanco con borde, rojo de peligro, pastilla de submenú, pestaña de
 * categoría, icono suelto y el de restaurar un ajuste.
 */
import { color, texto, peso, interletra, espacio, radio, sombra, transicion, objetivo } from '../estilos/tokens';

const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.xs,
    fontFamily: 'inherit',
    fontSize: texto.menor,
    fontWeight: peso.fuerte,
    letterSpacing: interletra.etiqueta,
    textTransform: 'uppercase',
    lineHeight: 1,
    border: '1px solid transparent',
    borderRadius: radio.sutil,
    cursor: 'pointer',
    transition: `background ${transicion.normal}, border-color ${transicion.normal}, color ${transicion.normal}`,
    whiteSpace: 'nowrap'
};

/** Alto y relleno. `amplio` es el tamaño de campo: se toca con guantes. */
const tamanos = {
    pequeno: { padding: `${espacio.xs} ${espacio.sm}`, fontSize: texto.micro, minHeight: '32px' },
    normal: { padding: `${espacio.sm} ${espacio.lg}`, minHeight: objetivo.comodo },
    amplio: { padding: `${espacio.md} ${espacio.xl}`, fontSize: texto.base, minHeight: objetivo.amplio }
};

const variantes = {
    primario: { backgroundColor: color.petroleo, color: color.textoSobreOscuro, boxShadow: sombra.sutil },
    secundario: { backgroundColor: 'transparent', color: color.vidrio, borderColor: color.canto },
    fantasma: { backgroundColor: 'transparent', color: color.textoSuave, borderColor: 'transparent' },
    peligro: { backgroundColor: 'transparent', color: color.error, borderColor: color.error }
};

const hover = {
    primario: { backgroundColor: color.petroleoSuave },
    secundario: { backgroundColor: color.superficieTenida, borderColor: color.vidrio },
    fantasma: { backgroundColor: color.superficieTenida, color: color.texto },
    peligro: { backgroundColor: color.errorSuave }
};

/**
 * @param {object} props
 * @param {'primario'|'secundario'|'fantasma'|'peligro'} [props.variante]
 * @param {'pequeno'|'normal'|'amplio'} [props.tamano]
 * @param {boolean} [props.ancho] ocupa todo el ancho disponible
 * @param {import('react').ReactNode} [props.children]
 */
export default function Boton({ variante = 'primario', tamano = 'normal', ancho = false, style, disabled, children, ...resto }) {
    const estilo = {
        ...base,
        ...tamanos[tamano],
        ...variantes[variante],
        ...(ancho ? { width: '100%' } : null),
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : null),
        ...style
    };

    // El hover en línea evita tener que declarar clases en CSS global para esto.
    const alEntrar = (e) => { if (!disabled) Object.assign(e.currentTarget.style, hover[variante]); };
    const alSalir = (e) => { if (!disabled) Object.assign(e.currentTarget.style, variantes[variante]); };

    return (
        <button type="button" style={estilo} disabled={disabled}
                onMouseEnter={alEntrar} onMouseLeave={alSalir}
                onFocus={(e) => { e.currentTarget.style.boxShadow = sombra.foco; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = variante === 'primario' ? sombra.sutil : 'none'; }}
                {...resto}>
            {children}
        </button>
    );
}
