// @ts-check
/**
 * Campo de formulario: etiqueta, control, ayuda y error en una sola pieza.
 *
 * Sustituye a inputStyle y, sobre todo, a las ~30 veces que ese objeto se sobrescribía
 * en línea para cambiar el relleno, el tamaño de letra o el color del borde según el
 * estado. Esas variaciones ahora son props.
 *
 * El foco deja de ser el azul genérico de index.css y pasa a ser el verde de vidrio.
 */
import { useState } from 'react';
import { color, texto, peso, espacio, radio, sombra, transicion, objetivo } from '../estilos/tokens';
import Etiqueta from './Etiqueta';

const tamanos = {
    normal: { padding: `${espacio.sm} ${espacio.md}`, fontSize: texto.base, minHeight: objetivo.comodo },
    amplio: { padding: `${espacio.md}`, fontSize: texto.medio, minHeight: objetivo.amplio }
};

/**
 * @param {object} props
 * @param {string} [props.etiqueta]
 * @param {string} [props.ayuda]      texto explicativo bajo el campo
 * @param {string} [props.error]      si viene, manda sobre la ayuda y tiñe el borde
 * @param {'normal'|'amplio'} [props.tamano]
 * @param {'input'|'textarea'|'select'} [props.como]
 * @param {import('react').ReactNode} [props.children] opciones, si es un select
 */
export default function Campo({ etiqueta, ayuda, error, tamano = 'normal', como = 'input', style, children, ...resto }) {
    const [enfocado, setEnfocado] = useState(false);
    const Control = /** @type {any} */ (como);

    const bordeColor = error ? color.error : (enfocado ? color.vidrio : color.linea);

    return (
        <label style={{ display: 'block', width: '100%' }}>
            {etiqueta && <Etiqueta>{etiqueta}</Etiqueta>}
            <Control
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    color: color.texto,
                    backgroundColor: color.superficie,
                    border: `1px solid ${bordeColor}`,
                    borderRadius: radio.sutil,
                    outline: 'none',
                    boxShadow: enfocado ? sombra.foco : 'none',
                    transition: `border-color ${transicion.normal}, box-shadow ${transicion.normal}`,
                    ...tamanos[tamano],
                    ...(como === 'textarea' ? { minHeight: '92px', resize: 'vertical', lineHeight: 1.5 } : null),
                    ...style
                }}
                onFocus={() => setEnfocado(true)}
                onBlur={() => setEnfocado(false)}
                {...resto}
            >
                {children}
            </Control>
            {(error || ayuda) && (
                <span style={{
                    display: 'block',
                    marginTop: espacio.xxs,
                    fontSize: texto.menor,
                    fontWeight: error ? peso.medio : peso.normal,
                    color: error ? color.error : color.textoTenue,
                    lineHeight: 1.45
                }}>
                    {error || ayuda}
                </span>
            )}
        </label>
    );
}
