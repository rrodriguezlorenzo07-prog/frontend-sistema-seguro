// @ts-check
/**
 * Acopios por obra: qué material hace falta y por dónde va.
 *
 * NO ES EL ALMACÉN. `InventarioAlmacen` sigue siendo el stock general y su descuento al
 * aprobar un parte no se toca (D4). Aquí no se resta nada de nadie: esto dice dónde está
 * una pieza concreta en su camino hacia la furgoneta de una obra concreta.
 *
 * La oficina planifica (A1); los estados los mueve el operario desde el móvil (A3),
 * aunque desde aquí también se puede corregir.
 */
import { useState, useMemo } from 'react';
import { Package, Trash2, Plus, Factory, Truck, CheckCircle, Clock } from 'lucide-react';

import { color, texto, peso, interletra, espacio } from '../../estilos/tokens';
import Boton from '../../ui/Boton';
import Tarjeta from '../../ui/Tarjeta';
import Campo from '../../ui/Campo';
import Etiqueta from '../../ui/Etiqueta';
import Insignia from '../../ui/Insignia';
import { NOMBRES, cadenaDe, loQueFalta, construirAcopio, siguienteEstado } from '../../logica/acopios';

/** El tono de la insignia según lo avanzado que esté. */
const TONO = { pendiente: 'neutra', fabricado: 'info', recepcionado: 'aviso', listo: 'exito' };
const ICONO = { pendiente: Clock, fabricado: Factory, recepcionado: Package, listo: Truck };

export default function AcopiosObra({
    blockStyle,
    obrasActivas,
    materialesList,
    obraAcopios,
    setObraAcopios,
    acopiosDeLaObra,
    crearAcopio,
    moverEstadoAcopio,
    borrarAcopio,
    guardandoAcopio
}) {
    const [form, setForm] = useState({
        materialId: '', materialNombre: '', descripcion: '',
        cantidad: '', unidad: 'ud', requiereFabricacion: false
    });
    const [error, setError] = useState('');

    const obra = obrasActivas.find((o) => o.id === obraAcopios);
    const falta = useMemo(() => loQueFalta(acopiosDeLaObra), [acopiosDeLaObra]);

    const crear = () => {
        if (!obraAcopios) { setError('Elige primero la obra.'); return; }
        const nombre = form.materialId
            ? (materialesList.find((m) => m.id === form.materialId)?.nombre ?? '')
            : form.materialNombre.trim();
        if (!nombre) { setError('Elige un material del catálogo o escribe el nombre de la pieza.'); return; }
        if (!(Number(String(form.cantidad).replace(',', '.')) > 0)) { setError('La cantidad tiene que ser mayor que cero.'); return; }

        crearAcopio(construirAcopio({
            obraId: obraAcopios,
            obraNombre: obra?.nombre ?? null,
            materialId: form.materialId || null,
            materialNombre: nombre,
            descripcion: form.descripcion,
            cantidad: form.cantidad,
            unidad: form.unidad,
            requiereFabricacion: form.requiereFabricacion,
            creadoPor: 'oficina'
        }));
        setForm({ materialId: '', materialNombre: '', descripcion: '', cantidad: '', unidad: 'ud', requiereFabricacion: false });
        setError('');
    };

    return (
        <div style={blockStyle}>
            <h3 style={{
                margin: `0 0 ${espacio.xs}`, fontSize: texto.titulo, fontWeight: peso.normal,
                letterSpacing: interletra.titulo, textTransform: 'uppercase'
            }}>
                Acopios
            </h3>
            <p style={{
                color: color.textoSuave, fontSize: texto.menor, letterSpacing: interletra.etiqueta,
                textTransform: 'uppercase', marginBottom: espacio.xl
            }}>
                Material reservado para una obra. No afecta al stock del almacén.
            </p>

            {/* --------------------------------------------------------- la obra */}
            <div style={{ marginBottom: espacio.xl, maxWidth: '420px' }}>
                <Campo
                    etiqueta="Obra"
                    como="select"
                    value={obraAcopios ?? ''}
                    onChange={(e) => setObraAcopios(e.target.value || null)}
                >
                    <option value="">Elegir obra…</option>
                    {obrasActivas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </Campo>
            </div>

            {!obraAcopios ? (
                <Tarjeta tono="hundida">
                    <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                        Elige una obra para ver y planificar su material.
                    </p>
                </Tarjeta>
            ) : (
                <>
                    {/* ------------------------------------------------ qué falta */}
                    {acopiosDeLaObra.length > 0 && (
                        <Tarjeta
                            tono="tenida"
                            relleno="ajustado"
                            style={{ marginBottom: espacio.lg, borderLeft: `3px solid ${falta.faltan > 0 ? color.aviso : color.exito}` }}
                        >
                            <p style={{ margin: 0, fontSize: texto.base, color: falta.faltan > 0 ? color.aviso : color.exito, fontWeight: peso.medio }}>
                                {falta.faltan > 0
                                    ? `${falta.resumen} de ${falta.total}.`
                                    : `Los ${falta.total} acopios están listos para cargar.`}
                            </p>
                        </Tarjeta>
                    )}

                    {/* --------------------------------------------------- alta */}
                    <Tarjeta style={{ marginBottom: espacio.lg }}>
                        <Etiqueta>Planificar material</Etiqueta>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: espacio.sm, marginTop: espacio.sm }}>
                            <Campo
                                etiqueta="Del catálogo"
                                ayuda="O déjalo vacío y escribe una pieza a medida."
                                como="select"
                                value={form.materialId}
                                onChange={(e) => setForm({ ...form, materialId: e.target.value, materialNombre: '' })}
                            >
                                <option value="">— Pieza a medida —</option>
                                {materialesList.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                            </Campo>

                            {!form.materialId && (
                                <Campo
                                    etiqueta="Qué es"
                                    value={form.materialNombre}
                                    onChange={(e) => setForm({ ...form, materialNombre: e.target.value })}
                                    placeholder="Perfil aluminio 40x20"
                                />
                            )}

                            <Campo
                                etiqueta="Cantidad"
                                inputMode="decimal"
                                value={form.cantidad}
                                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                                placeholder="3,5"
                            />

                            <Campo
                                etiqueta="Unidad"
                                como="select"
                                value={form.unidad}
                                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                            >
                                <option value="ud">unidades</option>
                                <option value="ml">metros lineales</option>
                                <option value="m2">metros cuadrados</option>
                                <option value="kg">kilos</option>
                            </Campo>
                        </div>

                        <div style={{ marginTop: espacio.sm }}>
                            <Campo
                                etiqueta="Detalle"
                                value={form.descripcion}
                                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                                placeholder="Corte para ventanal salón, planta 2"
                            />
                        </div>

                        {/* A2: el interruptor que decide si pasa por «fabricado». */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: espacio.xs, marginTop: espacio.md, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={form.requiereFabricacion}
                                onChange={(e) => setForm({ ...form, requiereFabricacion: e.target.checked })}
                                style={{ width: '18px', height: '18px', accentColor: color.vidrio }}
                            />
                            <span style={{ fontSize: texto.base }}>
                                Hay que fabricarlo
                                <span style={{ display: 'block', fontSize: texto.menor, color: color.textoTenue }}>
                                    Un perfil a medida sí; una caja de tornillos no, solo se recibe.
                                </span>
                            </span>
                        </label>

                        {error && (
                            <p style={{ margin: `${espacio.sm} 0 0`, fontSize: texto.menor, color: color.error, fontWeight: peso.medio }}>
                                {error}
                            </p>
                        )}

                        <div style={{ marginTop: espacio.md }}>
                            <Boton onClick={crear} disabled={guardandoAcopio}>
                                <Plus size={16} /> {guardandoAcopio ? 'Guardando…' : 'Añadir acopio'}
                            </Boton>
                        </div>
                    </Tarjeta>

                    {/* ------------------------------------------------- listado */}
                    {acopiosDeLaObra.length === 0 ? (
                        <Tarjeta tono="hundida">
                            <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                                Esta obra no tiene material planificado todavía.
                            </p>
                        </Tarjeta>
                    ) : (
                        <Tarjeta relleno="ninguno">
                            {acopiosDeLaObra.map((a, i) => {
                                const Icono = ICONO[a.estado] ?? Clock;
                                const siguiente = siguienteEstado(a);
                                return (
                                    <div
                                        key={a.id}
                                        style={{
                                            display: 'flex', alignItems: 'flex-start', gap: espacio.sm,
                                            padding: `${espacio.sm} ${espacio.md}`,
                                            borderTop: i === 0 ? 'none' : `1px solid ${color.lineaSuave}`,
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <Icono size={17} style={{ color: color.vidrio, flexShrink: 0, marginTop: '3px' }} />
                                        <div style={{ flex: 1, minWidth: '180px' }}>
                                            <div style={{ fontSize: texto.base, fontWeight: peso.medio }}>
                                                {a.materialNombre}
                                                <span style={{ color: color.textoTenue, fontWeight: peso.normal }}>
                                                    {' · '}{a.cantidad} {a.unidad}
                                                </span>
                                            </div>
                                            {a.descripcion ? (
                                                <div style={{ fontSize: texto.menor, color: color.textoSuave, marginTop: '2px' }}>
                                                    {a.descripcion}
                                                </div>
                                            ) : null}
                                            <div style={{ display: 'flex', gap: espacio.xs, alignItems: 'center', marginTop: espacio.xxs, flexWrap: 'wrap' }}>
                                                <Insignia tono={TONO[a.estado] ?? 'neutra'}>{NOMBRES[a.estado] ?? a.estado}</Insignia>
                                                {!a.requiereFabricacion && <Insignia tono="neutra">No se fabrica</Insignia>}
                                                {a.actualizadoPor && a.historial?.length > 0 ? (
                                                    <span style={{ fontSize: texto.micro, color: color.textoTenue }}>
                                                        último cambio: {a.actualizadoPor}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: espacio.xs, alignItems: 'center' }}>
                                            {siguiente && (
                                                <Boton
                                                    tamano="pequeno"
                                                    variante="secundario"
                                                    onClick={() => moverEstadoAcopio(a, siguiente)}
                                                >
                                                    <CheckCircle size={13} /> {NOMBRES[siguiente]}
                                                </Boton>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => borrarAcopio(a.id)}
                                                aria-label={`Quitar ${a.materialNombre}`}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: espacio.xxs, lineHeight: 0 }}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </Tarjeta>
                    )}

                    <p style={{ marginTop: espacio.md, fontSize: texto.menor, color: color.textoTenue, lineHeight: 1.5 }}>
                        Los estados los marca normalmente el operario desde el móvil. El recorrido
                        de este material es: {cadenaDe(true).map((e) => NOMBRES[e]).join(' → ')},
                        saltándose «Fabricado» cuando no hay que fabricarlo.
                    </p>
                </>
            )}
        </div>
    );
}
