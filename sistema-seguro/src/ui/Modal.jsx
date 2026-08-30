// @ts-check
/**
 * Modal. Sustituye a las SEIS implementaciones repartidas por cinco archivos, cada una
 * con su propia capa de fondo, su propio position: fixed y su propio ancho.
 *
 * Aporta además lo que ninguna de las seis tenía: cerrar con Escape, bloquear el
 * scroll del fondo mientras está abierto, y una capa que cierra al pulsarla.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { color, texto, peso, interletra, espacio, radio, sombra, transicion } from '../estilos/tokens';

const anchos = { estrecho: '420px', normal: '620px', ancho: '900px' };

/**
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {string} [props.titulo]
 * @param {string} [props.descripcion]
 * @param {() => void} [props.onCerrar]
 * @param {'estrecho'|'normal'|'ancho'} [props.ancho]
 * @param {import('react').ReactNode} [props.acciones] botonera del pie
 * @param {import('react').ReactNode} [props.children]
 */
export default function Modal({ abierto, titulo, descripcion, onCerrar, ancho = 'normal', acciones, children }) {
    useEffect(() => {
        if (!abierto) return undefined;
        const alPulsar = (e) => { if (e.key === 'Escape' && onCerrar) onCerrar(); };
        window.addEventListener('keydown', alPulsar);
        const scrollPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', alPulsar);
            document.body.style.overflow = scrollPrevio;
        };
    }, [abierto, onCerrar]);

    if (!abierto) return null;

    return (
        <div
            role="presentation"
            onClick={(e) => { if (e.target === e.currentTarget && onCerrar) onCerrar(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                backgroundColor: 'rgba(12, 42, 49, 0.42)',
                backdropFilter: 'blur(2px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: espacio.lg
            }}
        >
            <div role="dialog" aria-modal="true" aria-label={titulo} style={{
                width: '100%', maxWidth: anchos[ancho], maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                backgroundColor: color.superficie,
                border: `1px solid ${color.linea}`,
                borderRadius: radio.medio,
                boxShadow: sombra.elevada,
                overflow: 'hidden'
            }}>
                {(titulo || onCerrar) && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: espacio.md,
                        padding: `${espacio.lg} ${espacio.lg} ${espacio.md}`,
                        borderBottom: `1px solid ${color.lineaSuave}`
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {titulo && (
                                <h2 style={{
                                    margin: 0, fontSize: texto.mayor, fontWeight: peso.fuerte,
                                    letterSpacing: interletra.titulo, color: color.texto, lineHeight: 1.25
                                }}>{titulo}</h2>
                            )}
                            {descripcion && (
                                <p style={{
                                    margin: `${espacio.xs} 0 0`, fontSize: texto.base,
                                    color: color.textoSuave, lineHeight: 1.5
                                }}>{descripcion}</p>
                            )}
                        </div>
                        {onCerrar && (
                            <button type="button" onClick={onCerrar} aria-label="Cerrar"
                                style={{
                                    flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                                    color: color.textoTenue, padding: espacio.xxs, lineHeight: 0,
                                    borderRadius: radio.sutil, transition: `color ${transicion.normal}`
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = color.texto; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = color.textoTenue; }}>
                                <X size={18} />
                            </button>
                        )}
                    </div>
                )}

                <div style={{ padding: espacio.lg, overflowY: 'auto', flex: 1 }}>{children}</div>

                {acciones && (
                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: espacio.sm, flexWrap: 'wrap',
                        padding: `${espacio.md} ${espacio.lg}`,
                        borderTop: `1px solid ${color.lineaSuave}`,
                        backgroundColor: color.fondo
                    }}>{acciones}</div>
                )}
            </div>
        </div>
    );
}
