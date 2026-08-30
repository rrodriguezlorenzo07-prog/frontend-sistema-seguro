// @ts-check
/**
 * Etiqueta de campo o de sección. Sustituye a labelStyle.
 * Mayúsculas pequeñas con tracking: es el gesto que la aplicación ya usaba y que la
 * dirección Vidrio conserva, solo que ahora en un sitio.
 */
import { color, texto, peso, interletra, espacio } from '../estilos/tokens';

/**
 * @param {object} props
 * @param {boolean} [props.tenue] para metadatos, menos peso visual
 * @param {import('react').ReactNode} [props.children]
 */
export default function Etiqueta({ tenue = false, style, children, ...resto }) {
    return (
        <span style={{
            display: 'block',
            fontSize: texto.etiqueta,
            fontWeight: peso.fuerte,
            letterSpacing: interletra.etiqueta,
            textTransform: 'uppercase',
            color: tenue ? color.textoTenue : color.textoSuave,
            marginBottom: espacio.xs,
            ...style
        }} {...resto}>
            {children}
        </span>
    );
}
