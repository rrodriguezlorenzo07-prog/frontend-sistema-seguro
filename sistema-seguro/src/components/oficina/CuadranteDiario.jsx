// @ts-check
/**
 * Dispatch Board: el cuadrante de un día.
 *
 * DOS FORMAS DE USARLO, y las dos importan igual (D1):
 *
 *   · PLANIFICAR CON ANTELACIÓN. Se elige un día cualquiera con el selector de fecha y
 *     se rellena tranquilamente. Es el uso de la tarde anterior.
 *
 *   · ASIGNAR SOBRE LA MARCHA. El botón «Asignar ahora» abre el formulario ya puesto en
 *     hoy, con la hora actual redondeada como inicio. Son tres toques desde que suena el
 *     teléfono hasta que el operario lo ve en el móvil. Sin esto, exigir que todo parte
 *     venga de un cuadrante convertiría cualquier urgencia en un cuello de botella.
 *
 * Los bloques horarios son libres (D6): la oficina teclea inicio y fin exactos. Eso
 * permite solapes, así que antes de guardar se avisa de ellos — pero no se bloquea:
 * mandar dos cuadrillas a la vez puede ser un error o puede ser lo que se quiere.
 */
import { useState, useMemo } from 'react';
import { CalendarDays, Plus, Trash2, Truck, MapPin, Wrench, Zap, AlertTriangle } from 'lucide-react';

import { color, texto, peso, interletra, espacio, radio } from '../../estilos/tokens';
import Boton from '../../ui/Boton';
import Tarjeta from '../../ui/Tarjeta';
import Campo from '../../ui/Campo';
import Etiqueta from '../../ui/Etiqueta';
import Insignia from '../../ui/Insignia';
import Modal from '../../ui/Modal';
import { filasDelTablero, solapesDe, franjaValida, construirAsignacion } from '../../logica/cuadrantes';
import { agruparPorObra, loQueFalta } from '../../logica/acopios';

/** La hora actual redondeada a la media hora siguiente, para la asignación rápida. */
function horaRedondeada() {
    const d = new Date();
    let h = d.getHours();
    let m = d.getMinutes() < 30 ? 30 : 0;
    if (m === 0) h += 1;
    if (h > 23) return '23:30';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function sumarHoras(hhmm, horas) {
    const [h, m] = hhmm.split(':').map(Number);
    const total = Math.min(h * 60 + m + horas * 60, 23 * 60 + 59);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function CuadranteDiario({
    blockStyle,
    fecha,
    setFecha,
    asignaciones,
    cuadrillasList,
    vehiculosList,
    obrasActivas,
    crearAsignacion,
    borrarAsignacion,
    guardando,
    // Acopios de las obras del día, para avisar de lo que FALTA (A4).
    acopiosDelDia = []
}) {
    const [abierto, setAbierto] = useState(false);
    const [rapida, setRapida] = useState(false);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');

    const filas = useMemo(
        () => filasDelTablero(cuadrillasList, asignaciones),
        [cuadrillasList, asignaciones]
    );

    // LO QUE FALTA, no lo que está listo: «hay 4 preparados» es decoración; lo que
    // evita conducir cuarenta minutos en balde es «quedan 2 sin recepcionar».
    const acopiosPorObra = useMemo(() => agruparPorObra(acopiosDelDia), [acopiosDelDia]);

    const hoy = new Date().toISOString().slice(0, 10);

    const abrirFormulario = ({ esRapida, cuadrillaId = '' }) => {
        const inicio = esRapida ? horaRedondeada() : '08:00';
        setForm({
            cuadrillaId,
            vehiculoId: '',
            destinoTipo: 'obra',
            obraId: '',
            horaInicio: inicio,
            horaFin: esRapida ? sumarHoras(inicio, 4) : '14:00'
        });
        setRapida(esRapida);
        setError('');
        setAbierto(true);
        // La asignación rápida es siempre para hoy: si la oficina estaba mirando otro
        // día, se la trae de vuelta en vez de crear la urgencia en la fecha equivocada.
        if (esRapida && fecha !== hoy) setFecha(hoy);
    };

    const cuadrillaElegida = cuadrillasList.find((c) => c.id === form?.cuadrillaId);
    const vehiculoElegido = vehiculosList.find((v) => v.id === form?.vehiculoId);
    const obraElegida = obrasActivas.find((o) => o.id === form?.obraId);

    // Los solapes se calculan mientras se escribe, no al pulsar guardar: enterarte del
    // choque cuando ya has rellenado todo es enterarte tarde.
    const solapes = useMemo(() => {
        if (!form?.cuadrillaId) return [];
        const candidata = {
            horaInicio: form.horaInicio,
            horaFin: form.horaFin,
            cuadrillaId: form.cuadrillaId,
            vehiculoId: form.vehiculoId || null
        };
        return solapesDe(candidata, asignaciones);
    }, [form, asignaciones]);

    const guardar = () => {
        if (!form?.cuadrillaId) { setError('Elige una cuadrilla.'); return; }
        if (!cuadrillaElegida || (cuadrillaElegida.operarios || []).length === 0) {
            setError('Esa cuadrilla no tiene operarios. Añádelos antes de asignarla.');
            return;
        }
        const franja = franjaValida(form.horaInicio, form.horaFin);
        if (!franja.valida) { setError(franja.motivo); return; }
        if (form.destinoTipo === 'obra' && !form.obraId) { setError('Elige la obra de destino.'); return; }

        crearAsignacion(construirAsignacion({
            fecha,
            horaInicio: form.horaInicio,
            horaFin: form.horaFin,
            cuadrilla: cuadrillaElegida,
            vehiculo: vehiculoElegido ? { id: vehiculoElegido.id, nombre: vehiculoElegido.nombre } : null,
            destinoTipo: form.destinoTipo,
            obra: obraElegida ? { id: obraElegida.id, nombre: obraElegida.nombre } : null,
            creadoPor: 'oficina'
        }));
        setAbierto(false);
        setForm(null);
    };

    return (
        <div style={blockStyle}>
            {/* ------------------------------------------------------- cabecera */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                gap: espacio.md, flexWrap: 'wrap', marginBottom: espacio.lg
            }}>
                <div>
                    <h3 style={{
                        margin: `0 0 ${espacio.xs}`, fontSize: texto.titulo, fontWeight: peso.normal,
                        letterSpacing: interletra.titulo, textTransform: 'uppercase'
                    }}>
                        Cuadrante
                    </h3>
                    <p style={{
                        color: color.textoSuave, fontSize: texto.menor, letterSpacing: interletra.etiqueta,
                        textTransform: 'uppercase', margin: 0
                    }}>
                        {asignaciones.length === 0
                            ? 'Sin asignaciones este día'
                            : `${asignaciones.length} ${asignaciones.length === 1 ? 'asignación' : 'asignaciones'}`}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: espacio.sm, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '170px' }}>
                        <Campo
                            etiqueta="Día"
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                    </div>
                    {/* Planificación normal */}
                    <Boton variante="secundario" onClick={() => abrirFormulario({ esRapida: false })}>
                        <Plus size={16} /> Planificar
                    </Boton>
                    {/* D1: la salida de emergencia. Hoy, con la hora ya puesta. */}
                    <Boton onClick={() => abrirFormulario({ esRapida: true })}>
                        <Zap size={16} /> Asignar ahora
                    </Boton>
                </div>
            </div>

            {fecha !== hoy && (
                <p style={{
                    fontSize: texto.menor, color: color.vidrio, marginBottom: espacio.md,
                    display: 'flex', alignItems: 'center', gap: espacio.xxs
                }}>
                    <CalendarDays size={14} /> Estás viendo un día distinto de hoy.
                </p>
            )}

            {/* -------------------------------------------------------- tablero */}
            {cuadrillasList.length === 0 ? (
                <Tarjeta tono="hundida">
                    <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                        No hay cuadrillas creadas. El cuadrante asigna cuadrillas, así que primero
                        hay que crearlas en su pestaña.
                    </p>
                </Tarjeta>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: espacio.sm }}>
                    {filas.map(({ cuadrilla, asignaciones: suyas }) => (
                        <Tarjeta key={cuadrilla.id} relleno="ajustado">
                            <div style={{ display: 'flex', gap: espacio.md, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                {/* Columna de la cuadrilla */}
                                <div style={{ minWidth: '150px', flexShrink: 0 }}>
                                    <div style={{ fontSize: texto.base, fontWeight: peso.fuerte, letterSpacing: interletra.titulo }}>
                                        {cuadrilla.nombre}
                                    </div>
                                    <div style={{ fontSize: texto.menor, color: color.textoTenue, marginTop: '2px' }}>
                                        {(cuadrilla.operarios || []).map((o) => o.nombre).join(', ') || 'Sin operarios'}
                                    </div>
                                </div>

                                {/* Sus bloques del día */}
                                <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexWrap: 'wrap', gap: espacio.xs }}>
                                    {suyas.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => abrirFormulario({ esRapida: false, cuadrillaId: cuadrilla.id })}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: espacio.xxs,
                                                background: 'transparent', border: `1px dashed ${color.canto}`,
                                                borderRadius: radio.sutil, padding: `${espacio.xs} ${espacio.sm}`,
                                                color: color.textoTenue, fontFamily: 'inherit', fontSize: texto.menor,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Plus size={14} /> Libre — asignar
                                        </button>
                                    ) : suyas.map((a) => (
                                        <div
                                            key={a.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: espacio.xs,
                                                background: color.superficieTenida,
                                                border: `1px solid ${color.canto}`,
                                                borderLeft: `3px solid ${a.destinoTipo === 'taller' ? color.textoTenue : color.vidrio}`,
                                                borderRadius: radio.sutil,
                                                padding: `${espacio.xs} ${espacio.sm}`
                                            }}
                                        >
                                            <span style={{
                                                fontSize: texto.menor, fontWeight: peso.fuerte,
                                                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'
                                            }}>
                                                {a.horaInicio}–{a.horaFin}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: texto.menor }}>
                                                {a.destinoTipo === 'taller'
                                                    ? <><Wrench size={12} /> Taller</>
                                                    : <><MapPin size={12} /> {a.obraNombre}</>}
                                            </span>
                                            {a.vehiculoNombre ? (
                                                <span style={{
                                                    display: 'flex', alignItems: 'center', gap: '3px',
                                                    fontSize: texto.menor, color: color.textoSuave
                                                }}>
                                                    <Truck size={12} /> {a.vehiculoNombre}
                                                </span>
                                            ) : null}
                                            {a.estado === 'parte_enviado' ? <Insignia tono="exito">Parte enviado</Insignia> : null}
                                            {(() => {
                                                if (!a.obraId) return null;
                                                const falta = loQueFalta(acopiosPorObra.get(a.obraId) || []);
                                                if (falta.total === 0 || falta.faltan === 0) return null;
                                                return (
                                                    <span title={falta.resumen}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: texto.menor, color: color.aviso, fontWeight: peso.fuerte }}>
                                                        <AlertTriangle size={12} /> {falta.resumen}
                                                    </span>
                                                );
                                            })()}
                                            <button
                                                type="button"
                                                onClick={() => borrarAsignacion(a.id)}
                                                aria-label="Quitar asignación"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: 0, lineHeight: 0 }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}

                                    {suyas.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => abrirFormulario({ esRapida: false, cuadrillaId: cuadrilla.id })}
                                            aria-label={`Añadir bloque a ${cuadrilla.nombre}`}
                                            style={{
                                                background: 'transparent', border: `1px dashed ${color.linea}`,
                                                borderRadius: radio.sutil, padding: `${espacio.xs}`,
                                                color: color.textoTenue, cursor: 'pointer', lineHeight: 0
                                            }}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Tarjeta>
                    ))}
                </div>
            )}

            {/* ------------------------------------------------------ formulario */}
            <Modal
                abierto={abierto}
                titulo={rapida ? 'Asignar ahora' : 'Nueva asignación'}
                descripcion={rapida
                    ? 'Para hoy, empezando a la hora que viene puesta. Ajústala si hace falta.'
                    : undefined}
                onCerrar={() => { setAbierto(false); setForm(null); }}
                acciones={<>
                    <Boton variante="fantasma" onClick={() => { setAbierto(false); setForm(null); }}>Cancelar</Boton>
                    <Boton onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Asignar'}</Boton>
                </>}
            >
                {form && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: espacio.md }}>
                        <Campo
                            etiqueta="Cuadrilla"
                            como="select"
                            value={form.cuadrillaId}
                            onChange={(e) => setForm({ ...form, cuadrillaId: e.target.value })}
                        >
                            <option value="">Elegir…</option>
                            {cuadrillasList.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre} ({(c.operarios || []).length})
                                </option>
                            ))}
                        </Campo>

                        <div style={{ display: 'flex', gap: espacio.sm }}>
                            <Campo
                                etiqueta="Desde"
                                type="time"
                                value={form.horaInicio}
                                onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                            />
                            <Campo
                                etiqueta="Hasta"
                                type="time"
                                value={form.horaFin}
                                onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                            />
                        </div>

                        <div>
                            <Etiqueta>Destino</Etiqueta>
                            <div style={{ display: 'flex', gap: espacio.xs, marginTop: espacio.xxs }}>
                                <Boton
                                    variante={form.destinoTipo === 'obra' ? 'primario' : 'secundario'}
                                    tamano="pequeno"
                                    onClick={() => setForm({ ...form, destinoTipo: 'obra' })}
                                >
                                    <MapPin size={14} /> Obra
                                </Boton>
                                <Boton
                                    variante={form.destinoTipo === 'taller' ? 'primario' : 'secundario'}
                                    tamano="pequeno"
                                    onClick={() => setForm({ ...form, destinoTipo: 'taller', obraId: '' })}
                                >
                                    <Wrench size={14} /> Taller
                                </Boton>
                            </div>
                        </div>

                        {form.destinoTipo === 'obra' && (
                            <Campo
                                etiqueta="Obra"
                                como="select"
                                value={form.obraId}
                                onChange={(e) => setForm({ ...form, obraId: e.target.value })}
                            >
                                <option value="">Elegir obra…</option>
                                {obrasActivas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                            </Campo>
                        )}

                        <Campo
                            etiqueta="Vehículo"
                            ayuda="Opcional. Sin vehículo, nadie sabe en qué furgoneta va la cuadrilla."
                            como="select"
                            value={form.vehiculoId}
                            onChange={(e) => setForm({ ...form, vehiculoId: e.target.value })}
                        >
                            <option value="">Sin vehículo</option>
                            {vehiculosList.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                        </Campo>

                        {/* Los solapes AVISAN, no bloquean: mandar dos cuadrillas a la vez
                            puede ser un error o puede ser justo lo que se quiere. */}
                        {solapes.length > 0 && (
                            <Tarjeta tono="tenida" relleno="ajustado" style={{ borderLeft: `3px solid ${color.aviso}` }}>
                                <div style={{ display: 'flex', gap: espacio.xs, alignItems: 'flex-start' }}>
                                    <AlertTriangle size={16} style={{ color: color.aviso, flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontSize: texto.menor, fontWeight: peso.fuerte, color: color.aviso, marginBottom: espacio.xxs }}>
                                            {solapes.length === 1 ? 'Hay un solape' : `Hay ${solapes.length} solapes`}
                                        </div>
                                        {solapes.map((s, i) => (
                                            <div key={i} style={{ fontSize: texto.menor, color: color.textoSuave }}>{s.mensaje}</div>
                                        ))}
                                    </div>
                                </div>
                            </Tarjeta>
                        )}

                        {error && (
                            <p style={{ margin: 0, fontSize: texto.menor, color: color.error, fontWeight: peso.medio }}>
                                {error}
                            </p>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
