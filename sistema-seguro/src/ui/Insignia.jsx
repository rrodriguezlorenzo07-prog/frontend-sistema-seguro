// @ts-check
/**
 * Insignia de estado. Sustituye a las cinco que estaban escritas a mano —«Manual»,
 * «De baja», el estado del parte, el número de versiones y «Por defecto»— con la
 * misma forma y distinto código en cada sitio.
 *
 * El color aquí es SEMÁNTICO: dice en qué estado está algo. No se usa para decorar.
 */
import { color, texto, peso, interletra, espacio, radio } from '../estilos/tokens';

const tonos = {
    neutra: { backgroundColor: color.superficieTenida, color: color.textoSuave },
    info: { backgroundColor: color.infoSuave, color: color.info },
    aviso: { backgroundColor: color.avisoSuave, color: color.aviso },
    error: { backgroundColor: color.errorSuave, color: color.error },
    exito: { backgroundColor: color.exitoSuave, color: color.exito },
    fuerte: { backgroundColor: color.petroleo, color: color.textoSobreOscuro }
};

/**
 * @param {object} props
 * @param {'neutra'|'info'|'aviso'|'error'|'exito'|'fuerte'} [props.tono]
 * @param {import('react').ReactNode} [props.children]
 */
export default function Insignia({ tono = 'neutra', style, children, ...resto }) {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: texto.micro,
            fontWeight: peso.maximo,
            letterSpacing: interletra.etiqueta,
            textTransform: 'uppercase',
            padding: `3px ${espacio.xs}`,
            borderRadius: radio.sutil,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            ...tonos[tono],
            ...style
        }} {...resto}>
            {children}
        </span>
    );
}
