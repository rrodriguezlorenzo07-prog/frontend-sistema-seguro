// @ts-check
/**
 * Catálogo de vehículos. Mismo patrón que obras/ e inventario/: alta, edición en línea
 * y papelera en vez de borrado.
 */
import { useState } from 'react';
import { Truck, Trash2, Plus, Edit } from 'lucide-react';

import { color, texto, peso, interletra, espacio } from '../../estilos/tokens';
import Boton from '../../ui/Boton';
import Tarjeta from '../../ui/Tarjeta';
import Campo from '../../ui/Campo';

export default function GestionVehiculos({
    blockStyle,
    vehiculosList,
    crearVehiculo,
    guardarVehiculo,
    borrarVehiculo
}) {
    const [nombre, setNombre] = useState('');
    const [matricula, setMatricula] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [editado, setEditado] = useState({ nombre: '', matricula: '' });

    const crear = () => {
        if (!nombre.trim()) return;
        crearVehiculo({ nombre: nombre.trim(), matricula: matricula.trim() });
        setNombre('');
        setMatricula('');
    };

    return (
        <div style={blockStyle}>
            <h3 style={{
                margin: `0 0 ${espacio.xs}`, fontSize: texto.titulo, fontWeight: peso.normal,
                letterSpacing: interletra.titulo, textTransform: 'uppercase'
            }}>
                Vehículos
            </h3>
            <p style={{
                color: color.textoSuave, fontSize: texto.menor, letterSpacing: interletra.etiqueta,
                textTransform: 'uppercase', marginBottom: espacio.xl
            }}>
                Furgonetas que se asignan a una cuadrilla en el cuadrante.
            </p>

            <div style={{ display: 'flex', gap: espacio.sm, marginBottom: espacio.xl, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '200px' }}>
                    <Campo
                        etiqueta="Nombre"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Furgoneta 1"
                        onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
                    />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                    <Campo
                        etiqueta="Matrícula"
                        value={matricula}
                        onChange={(e) => setMatricula(e.target.value)}
                        placeholder="1234 ABC"
                        onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
                    />
                </div>
                <Boton disabled={!nombre.trim()} onClick={crear}>
                    <Plus size={16} /> Registrar
                </Boton>
            </div>

            {vehiculosList.length === 0 ? (
                <Tarjeta tono="hundida">
                    <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                        Todavía no hay vehículos. El cuadrante permite asignar sin vehículo, pero
                        entonces nadie sabe en qué furgoneta va la cuadrilla.
                    </p>
                </Tarjeta>
            ) : (
                <Tarjeta relleno="ninguno">
                    {vehiculosList.map((v, i) => (
                        <div
                            key={v.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: espacio.sm,
                                padding: `${espacio.sm} ${espacio.md}`,
                                borderTop: i === 0 ? 'none' : `1px solid ${color.lineaSuave}`
                            }}
                        >
                            {editandoId === v.id ? (
                                <>
                                    <div style={{ flex: 2, minWidth: 0 }}>
                                        <Campo
                                            value={editado.nombre}
                                            onChange={(e) => setEditado({ ...editado, nombre: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Campo
                                            value={editado.matricula}
                                            onChange={(e) => setEditado({ ...editado, matricula: e.target.value })}
                                        />
                                    </div>
                                    <Boton
                                        tamano="pequeno"
                                        onClick={() => { guardarVehiculo(v.id, editado); setEditandoId(null); }}
                                    >
                                        Guardar
                                    </Boton>
                                    <Boton tamano="pequeno" variante="fantasma" onClick={() => setEditandoId(null)}>
                                        Cancelar
                                    </Boton>
                                </>
                            ) : (
                                <>
                                    <Truck size={17} style={{ color: color.vidrio, flexShrink: 0 }} />
                                    <span style={{ flex: 1, minWidth: 0, fontSize: texto.base, fontWeight: peso.medio }}>
                                        {v.nombre}
                                    </span>
                                    {v.matricula ? (
                                        <span style={{
                                            fontSize: texto.menor, color: color.textoTenue,
                                            fontVariantNumeric: 'tabular-nums', letterSpacing: interletra.etiqueta
                                        }}>
                                            {v.matricula}
                                        </span>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => { setEditandoId(v.id); setEditado({ nombre: v.nombre || '', matricula: v.matricula || '' }); }}
                                        aria-label={`Editar ${v.nombre}`}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: espacio.xxs, lineHeight: 0 }}
                                    >
                                        <Edit size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => borrarVehiculo(v.id)}
                                        aria-label={`Eliminar ${v.nombre}`}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: espacio.xxs, lineHeight: 0 }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </Tarjeta>
            )}
        </div>
    );
}
