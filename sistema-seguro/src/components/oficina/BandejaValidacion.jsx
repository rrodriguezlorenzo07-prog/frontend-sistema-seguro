// @ts-check
import React, { useState, useEffect } from 'react';
import { CheckCircle, Trash2, Package, FileText, Clock, MapPin, Plus, Minus, Layers, Check } from 'lucide-react';
import { resolverFirmasDe } from '../../utils/firmas';
import { color, texto, peso, interletra, espacio, radio } from '../../estilos/tokens';
import Insignia from '../../ui/Insignia';

export default function BandejaValidacion({
    partesPendientes,
    parteAValidar,
    setParteAValidar,
    nuevoOperario,
    setNuevoOperario,
    trabajadoresList,
    agregarOperarioCuadrilla,
    cuadrilla,
    cambiarHorasExtra,
    setHorasExtraDirecto,
    quitarOperario,
    confirmarValidacionParte,
    validandoParte,
    borrarParte,
    abrirValidacion,
    btnBlackStyle,
    // Unidades de obra propuestas por el operario en este parte (Pieza 3, D7).
    unidadesPropuestas = [],
    unidadesAConfirmar = [],
    alternarUnidad,
    alternarTodasLasUnidades
}) {
  // Las firmas se guardan como ruta de Storage. Se resuelven una vez al montar
  // y se cachean en estado: así no se repite la descarga en cada render.
  // null = todavía no se ha resuelto nada; un objeto = resolución terminada.
  // Con un único estado, actualizado solo dentro del then, no hay ningún
  // setState síncrono dentro del efecto.
  const [firmas, setFirmas] = useState(null);

  // partesPendientes es un array nuevo en cada render del panel, así que no sirve
  // como dependencia: el efecto se relanzaría constantemente. Esta clave solo
  // cambia cuando cambia lo que hay que resolver de verdad.
  const claveFirmas = partesPendientes.map(p => p.id + ":" + (p.firma || "")).join("|");

  useEffect(() => {
      let cancelado = false;
      resolverFirmasDe(partesPendientes.filter(p => p.firma)).then((mapa) => {
          if (!cancelado) setFirmas(mapa);
      });
      return () => { cancelado = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFirmas]);

  const btnPasoStyle = {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '30px', height: '30px', padding: 0,
      backgroundColor: color.superficie, color: color.texto,
      border: `1px solid ${color.petroleo}`, cursor: 'pointer'
  };

  return (
    <div>
        <div style={{ marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Bandeja de Entrada</h3>
            <p style={{ color: color.textoSuave, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Revisa los partes enviados por los operarios antes de aceptarlos o asignarlos.</p>
        </div>

        {partesPendientes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', border: `1px dashed ${color.canto}` }}>
                <CheckCircle size={32} color={color.petroleo} style={{ margin: '0 auto 15px auto' }} />
                <h4 style={{ margin: '0', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Todo al día</h4>
            </div>
        ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
                {partesPendientes.map(parte => {
                    const estaProcesando = parteAValidar?.id === parte.id;

                    return (
                    <div key={parte.id} style={{ padding: '25px', border: `1px solid ${color.petroleo}`, borderLeft: `4px solid ${color.petroleo}`, display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: color.superficie }}>

                        {/* Cabecera siempre visible */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{parte.obra}</h4>
                                <div style={{ fontSize: '11px', color: color.textoSuave, letterSpacing: '1px', textTransform: 'uppercase' }}>Enviado por: <strong>{parte.nombreTrabajador || parte.creador}</strong> | Fecha: {parte.fecha}</div>
                            </div>
                            <button onClick={() => borrarParte(parte.id)} style={{ color: color.error, background: 'none', border: 'none', cursor: 'pointer' }} title="Rechazar y eliminar parte"><Trash2 size={18}/></button>
                        </div>

                        {/* RESUMEN DEL PARTE SIEMPRE VISIBLE */}
                        <div style={{ padding: '15px', border: `1px solid ${color.petroleo}`, backgroundColor: color.superficieTenida, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `1px solid ${color.lineaSuave}`, paddingBottom: '6px', color: color.texto }}>
                                📋 Resumen del parte enviado
                            </div>

                            <div>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><MapPin size={14}/> Trabajo registrado por habitación:</strong>
                                {parte.tareasRealizadas && parte.tareasRealizadas.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: color.lineaSuave, border: `1px solid ${color.lineaSuave}`, marginTop: '6px' }}>
                                        {parte.tareasRealizadas.map((t, i) => (
                                            <div key={i} style={{ backgroundColor: color.superficie, padding: '10px 12px' }}>
                                                <strong style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{t.ubicacion}</strong>
                                                <span style={{ color: color.textoSuave, fontSize: '12px' }}>{t.descripcion}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <span style={{ color: color.textoSuave }}>Sin habitaciones registradas</span>}
                            </div>

                            <div>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Package size={14}/> Material Empleado:</strong>
                                {parte.materialesUsados && parte.materialesUsados.length > 0 ? (
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {parte.materialesUsados.map((m, i) => <li key={i}><strong>{m.cantidad}x</strong> {m.nombre}</li>)}
                                    </ul>
                                ) : <span style={{ color: color.textoSuave }}>Ninguno registrado</span>}
                            </div>

                            {parte.trabajo && (
                                <div>
                                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><FileText size={14}/> Notas / Observaciones:</strong>
                                    <span style={{ whiteSpace: 'pre-wrap', color: color.textoSuave }}>{parte.trabajo}</span>
                                </div>
                            )}
                        </div>

                        {parte.firma && (
                            <div style={{ border: `1px solid ${color.linea}`, padding: '10px', display: 'inline-block', backgroundColor: color.superficie }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Firma de Conformidad:</p>
                                {firmas === null
                                    ? <span style={{ fontSize: '11px', color: color.textoTenue }}>Cargando firma…</span>
                                    : (firmas[parte.id]
                                        ? <img src={firmas[parte.id]} alt="Firma" style={{ height: '50px', objectFit: 'contain' }} />
                                        : <span style={{ fontSize: '11px', color: color.textoTenue }}>Firma no disponible</span>)}
                            </div>
                        )}

                        {/* BLOQUE DE ASIGNACIÓN (Aparece justo debajo al pulsar procesar, sin ocultar el resumen) */}
                        {estaProcesando ? (
                            <div style={{ padding: '20px', backgroundColor: color.fondo, border: `1px solid ${color.linea}`, marginTop: '5px' }}>
                                <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Asignación de Personal para el Albarán</h4>
                                <p style={{ margin: '0 0 15px 0', fontSize: '11px', color: color.textoSuave }}>Aquí solo se registran <strong>horas extra</strong>. Las horas normales son base mensual fija y se calculan en Control de Nóminas.</p>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <select value={nuevoOperario} onChange={(e)=>setNuevoOperario(e.target.value)} style={{ flex: 1, padding: '10px', border: `1px solid ${color.petroleo}`, outline: 'none' }}>
                                        <option value="">-- Seleccionar operario --</option>
                                        {trabajadoresList.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                    </select>
                                    <button onClick={agregarOperarioCuadrilla} style={btnBlackStyle}>Añadir</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: color.linea, border: `1px solid ${color.linea}`, marginBottom: '25px' }}>
                                    {cuadrilla.map((op, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.superficie, padding: '15px', gap: '15px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, minWidth: '120px' }}>{op.nombre}</span>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 'bold', color: color.vidrio, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                                    <Clock size={12}/> H. Extra
                                                </span>
                                                <button type="button" onClick={() => cambiarHorasExtra(i, -0.5)} style={btnPasoStyle} title="Restar media hora"><Minus size={14}/></button>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    value={op.horasExtra}
                                                    onFocus={e => e.target.select()}
                                                    onChange={(e) => setHorasExtraDirecto(i, e.target.value)}
                                                    style={{ width: '70px', padding: '8px', border: `1px solid ${color.vidrio}`, color: color.vidrio, fontWeight: 'bold', textAlign: 'center', outline: 'none' }}
                                                />
                                                <button type="button" onClick={() => cambiarHorasExtra(i, 0.5)} style={btnPasoStyle} title="Sumar media hora"><Plus size={14}/></button>
                                            </div>

                                            <button onClick={()=>quitarOperario(i)} style={{ color: color.texto, background: 'none', border: 'none', cursor: 'pointer' }} title="Quitar de la cuadrilla"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>

                                {/* UNIDADES DE OBRA PROPUESTAS (Pieza 3, D7).
                                    El operario propone desde el texto que ya escribía;
                                    aquí la oficina confirma. Solo lo confirmado cuenta:
                                    una propuesta sin confirmar no habilita facturar. */}
                                {unidadesPropuestas.length > 0 && (
                                    <div style={{ marginBottom: espacio.lg }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.sm, flexWrap: 'wrap', gap: espacio.xs }}>
                                            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: texto.menor, letterSpacing: interletra.etiqueta, textTransform: 'uppercase' }}>
                                                <Layers size={14} /> Unidades propuestas
                                                <Insignia tono={unidadesAConfirmar.length > 0 ? 'exito' : 'neutra'}>
                                                    {unidadesAConfirmar.length} de {unidadesPropuestas.length}
                                                </Insignia>
                                            </strong>
                                            <button type="button" onClick={alternarTodasLasUnidades}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.vidrio, fontSize: texto.menor, fontWeight: peso.fuerte, fontFamily: 'inherit', padding: 0 }}>
                                                {unidadesAConfirmar.length === unidadesPropuestas.length ? 'Ninguna' : 'Todas'}
                                            </button>
                                        </div>

                                        <p style={{ margin: `0 0 ${espacio.sm}`, fontSize: texto.menor, color: color.textoTenue, lineHeight: 1.45 }}>
                                            El operario dice haber terminado estas. Confirma solo las que
                                            estén de verdad acabadas: es lo que habilitará certificarlas.
                                        </p>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: espacio.xs }}>
                                            {unidadesPropuestas.map((u) => {
                                                const elegida = unidadesAConfirmar.includes(u.id);
                                                return (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => alternarUnidad(u.id)}
                                                        title={u.textoOriginal}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                            padding: `${espacio.xs} ${espacio.sm}`,
                                                            border: `1px solid ${elegida ? color.exito : color.linea}`,
                                                            backgroundColor: elegida ? color.exitoSuave : color.superficie,
                                                            color: elegida ? color.exito : color.textoSuave,
                                                            borderRadius: radio.sutil, cursor: 'pointer',
                                                            fontFamily: 'inherit', fontSize: texto.menor,
                                                            fontWeight: elegida ? peso.fuerte : peso.normal
                                                        }}
                                                    >
                                                        {elegida ? <Check size={13} /> : null}
                                                        {u.nombre}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={confirmarValidacionParte} disabled={validandoParte} style={{ ...btnBlackStyle, opacity: validandoParte ? 0.5 : 1, cursor: validandoParte ? 'not-allowed' : 'pointer' }}>
                                        {validandoParte ? 'Registrando...' : 'Aprobar y Registrar Albarán'}
                                    </button>
                                    <button onClick={()=>setParteAValidar(null)} disabled={validandoParte} style={{ padding: '12px 20px', background: 'transparent', border: `1px solid ${color.petroleo}`, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: validandoParte ? 'not-allowed' : 'pointer', opacity: validandoParte ? 0.5 : 1 }}>Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => abrirValidacion(parte)} style={{ ...btnBlackStyle, width: 'fit-content', marginTop: '5px' }}>Procesar y Aceptar Albarán</button>
                        )}

                    </div>
                    );
                })}
            </div>
        )}
    </div>
  );
}
