// @ts-check
/**
 * Tarjeta. Sustituye a blockStyle y a los seis bordes distintos que convivían: dos
 * dominantes empatados (#1a1a1a 54 veces, #e5e7eb 52) y cuatro sueltos, sin que en
 * ninguna parte estuviera escrito qué significaba cada uno.
 *
 * Aquí sí lo está: `blanca` es el contenedor por defecto, `tenida` agrupa sin
 * separar del fondo, y `fuerte` es énfasis — se usa poco a propósito, porque si todo
 * está enfatizado no lo está nada.
 */
import { color, espacio, radio, sombra } from '../estilos/tokens';

const tonos = {
    blanca: { backgroundColor: color.superficie, border: `1px solid ${color.linea}`, boxShadow: sombra.sutil },
    tenida: { backgroundColor: color.superficieTenida, border: `1px solid ${color.canto}` },
    hundida: { backgroundColor: color.superficieHundida, border: `1px solid ${color.lineaSuave}` },
    fuerte: { backgroundColor: color.superficie, border: `1px solid ${color.lineaFuerte}` },
    oscura: { backgroundColor: color.petroleo, border: '1px solid transparent', color: color.textoSobreOscuro }
};

const rellenos = { ninguno: '0', ajustado: espacio.md, normal: espacio.lg, amplio: espacio.xl };

/**
 * @param {object} props
 * @param {'blanca'|'tenida'|'hundida'|'fuerte'|'oscura'} [props.tono]
 * @param {'ninguno'|'ajustado'|'normal'|'amplio'} [props.relleno]
 * @param {import('react').ReactNode} [props.children]
 */
export default function Tarjeta({ tono = 'blanca', relleno = 'normal', style, children, ...resto }) {
    return (
        <div style={{
            padding: rellenos[relleno],
            borderRadius: radio.sutil,
            boxSizing: 'border-box',
            ...tonos[tono],
            ...style
        }} {...resto}>
            {children}
        </div>
    );
}
