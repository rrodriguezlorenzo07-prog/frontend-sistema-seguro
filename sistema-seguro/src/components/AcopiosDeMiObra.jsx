// @ts-check
/**
 * Los acopios de la obra a la que va el operario hoy, para marcarlos desde el móvil.
 *
 * A3: marca TODOS los estados intermedios, no solo «listo para cargar». La regla de
 * Firestore ya le abre la escritura sobre `acopios`; limitarla a un solo estado no
 * compraría seguridad —puede marcar «listo» igual— y sí costaría veracidad, porque
 * obligaría a que oficina teclee lo que otro vio.
 *
 * UN BOTÓN GRANDE Y UNO SOLO. Esto se usa de pie, en un almacén, con guantes y con
 * prisa. El botón dice el siguiente paso de ESTE acopio, ya calculado: nada de elegir
 * entre cuatro estados en una pantalla de cinco pulgadas.
 */
import { useState } from 'react';
import { Package, Factory, Truck, Clock, ChevronRight, Undo2 } from 'lucide-react';

import { color, texto, peso, interletra, espacio, radio, objetivo } from '../estilos/tokens';
import Boton from '../ui/Boton';
import Tarjeta from '../ui/Tarjeta';
import Insignia from '../ui/Insignia';
import { NOMBRES, siguienteEstado, cadenaDe, loQueFalta } from '../logica/acopios';

const TONO = { pendiente: 'neutra', fabricado: 'info', recepcionado: 'aviso', listo: 'exito' };
const ICONO = { pendiente: Clock, fabricado: Factory, recepcionado: Package, listo: Truck };

export default function AcopiosDeMiObra({ acopios, obraNombre, cargando, onMover, moviendoId }) {
    const [deshacerAbierto, setDeshacerAbierto] = useState(null);

    if (cargando) {
        return (
            <div style={{ padding: espacio.xl, textAlign: 'center', color: color.textoTenue, fontSize: texto.menor, letterSpacing: interletra.etiqueta, textTransform: 'uppercase' }}>
                Buscando el material…
            </div>
        );
    }

    if (!acopios || acopios.length === 0) {
        return (
            <Tarjeta tono="hundida">
                <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                    No hay material planificado para {obraNombre || 'esta obra'}.
                </p>
            </Tarjeta>
        );
    }

    const falta = loQueFalta(acopios);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: espacio.md }}>
            <div>
                <h3 style={{ margin: 0, fontSize: texto.mayor, fontWeight: peso.fuerte, letterSpacing: interletra.titulo }}>
                    Material de {obraNombre}
                </h3>
                <p style={{ margin: `${espacio.xxs} 0 0`, fontSize: texto.menor, color: falta.faltan > 0 ? color.aviso : color.exito }}>
                    {falta.faltan > 0 ? `${falta.resumen} de ${falta.total}.` : `Los ${falta.total} listos para cargar.`}
                </p>
            </div>

            {acopios.map((a) => {
                const Icono = ICONO[a.estado] ?? Clock;
                const siguiente = siguienteEstado(a);
                const cadena = cadenaDe(Boolean(a.requiereFabricacion));
                const posicion = cadena.indexOf(a.estado);
                const moviendo = moviendoId === a.id;

                return (
                    <Tarjeta key={a.id} style={{ borderLeft: `3px solid ${a.estado === 'listo' ? color.exito : color.canto}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: espacio.sm }}>
                            <Icono size={20} style={{ color: color.vidrio, flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: texto.medio, fontWeight: peso.fuerte, letterSpacing: interletra.titulo }}>
                                    {a.materialNombre}
                                </div>
                                <div style={{ fontSize: texto.base, color: color.textoSuave, marginTop: '2px' }}>
                                    {a.cantidad} {a.unidad}
                                    {a.descripcion ? ` · ${a.descripcion}` : ''}
                                </div>
                                <div style={{ marginTop: espacio.xs }}>
                                    <Insignia tono={TONO[a.estado] ?? 'neutra'}>{NOMBRES[a.estado] ?? a.estado}</Insignia>
                                </div>
                            </div>
                        </div>

                        {/* Dónde va en su recorrido, de un vistazo. */}
                        <div style={{ display: 'flex', gap: '3px', margin: `${espacio.md} 0 ${espacio.sm}` }}>
                            {cadena.map((e, i) => (
                                <div
                                    key={e}
                                    title={NOMBRES[e]}
                                    style={{
                                        flex: 1, height: '4px', borderRadius: radio.pastilla,
                                        backgroundColor: i <= posicion ? color.vidrio : color.linea
                                    }}
                                />
                            ))}
                        </div>

                        {siguiente ? (
                            <Boton
                                tamano="amplio"
                                ancho
                                disabled={moviendo}
                                onClick={() => onMover(a, siguiente)}
                            >
                                {moviendo ? 'Guardando…' : <>Marcar {NOMBRES[siguiente]} <ChevronRight size={16} /></>}
                            </Boton>
                        ) : (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: espacio.xs,
                                minHeight: objetivo.amplio, color: color.exito, fontSize: texto.base, fontWeight: peso.fuerte
                            }}>
                                <Truck size={16} /> Listo para cargar
                            </div>
                        )}

                        {/* Corregir un dedo torpe sin llamar a oficina. Escondido tras un
                            toque para que no compita con el botón de avanzar. */}
                        {posicion > 0 && (
                            deshacerAbierto === a.id ? (
                                <div style={{ display: 'flex', gap: espacio.xs, marginTop: espacio.xs }}>
                                    <Boton
                                        tamano="pequeno"
                                        variante="secundario"
                                        onClick={() => { onMover(a, cadena[posicion - 1]); setDeshacerAbierto(null); }}
                                    >
                                        Volver a {NOMBRES[cadena[posicion - 1]]}
                                    </Boton>
                                    <Boton tamano="pequeno" variante="fantasma" onClick={() => setDeshacerAbierto(null)}>
                                        Cancelar
                                    </Boton>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setDeshacerAbierto(a.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px', margin: `${espacio.xs} auto 0`,
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: color.textoTenue, fontFamily: 'inherit', fontSize: texto.menor
                                    }}
                                >
                                    <Undo2 size={12} /> Me he equivocado
                                </button>
                            )
                        )}
                    </Tarjeta>
                );
            })}
        </div>
    );
}
