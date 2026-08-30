// @ts-check
import React, { useState, useEffect } from 'react';
import { CheckCircle, Trash2, Package, FileText, Clock, MapPin, Plus, Minus } from 'lucide-react';
import { resolverFirmasDe } from '../../utils/firmas';

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
    btnBlackStyle
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
      backgroundColor: '#ffffff', color: '#1a1a1a',
      border: '1px solid #1a1a1a', cursor: 'pointer'
  };

  return (
    <div>
        <div style={{ marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Bandeja de Entrada</h3>
            <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Revisa los partes enviados por los operarios antes de aceptarlos o asignarlos.</p>
        </div>

        {partesPendientes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', border: '1px dashed #cbd5e1' }}>
                <CheckCircle size={32} color="#1a1a1a" style={{ margin: '0 auto 15px auto' }} />
                <h4 style={{ margin: '0', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Todo al día</h4>
            </div>
        ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
                {partesPendientes.map(parte => {
                    const estaProcesando = parteAValidar?.id === parte.id;

                    return (
                    <div key={parte.id} style={{ padding: '25px', border: '1px solid #1a1a1a', borderLeft: '4px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff' }}>

                        {/* Cabecera siempre visible */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{parte.obra}</h4>
                                <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase' }}>Enviado por: <strong>{parte.nombreTrabajador || parte.creador}</strong> | Fecha: {parte.fecha}</div>
                            </div>
                            <button onClick={() => borrarParte(parte.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Rechazar y eliminar parte"><Trash2 size={18}/></button>
                        </div>

                        {/* RESUMEN DEL PARTE SIEMPRE VISIBLE */}
                        <div style={{ padding: '15px', border: '1px solid #1a1a1a', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', color: '#1a1a1a' }}>
                                📋 Resumen del parte enviado
                            </div>

                            <div>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><MapPin size={14}/> Trabajo registrado por habitación:</strong>
                                {parte.tareasRealizadas && parte.tareasRealizadas.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e2e8f0', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                                        {parte.tareasRealizadas.map((t, i) => (
                                            <div key={i} style={{ backgroundColor: '#ffffff', padding: '10px 12px' }}>
                                                <strong style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{t.ubicacion}</strong>
                                                <span style={{ color: '#475569', fontSize: '12px' }}>{t.descripcion}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <span style={{ color: '#64748b' }}>Sin habitaciones registradas</span>}
                            </div>

                            <div>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Package size={14}/> Material Empleado:</strong>
                                {parte.materialesUsados && parte.materialesUsados.length > 0 ? (
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {parte.materialesUsados.map((m, i) => <li key={i}><strong>{m.cantidad}x</strong> {m.nombre}</li>)}
                                    </ul>
                                ) : <span style={{ color: '#64748b' }}>Ninguno registrado</span>}
                            </div>

                            {parte.trabajo && (
                                <div>
                                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><FileText size={14}/> Notas / Observaciones:</strong>
                                    <span style={{ whiteSpace: 'pre-wrap', color: '#475569' }}>{parte.trabajo}</span>
                                </div>
                            )}
                        </div>

                        {parte.firma && (
                            <div style={{ border: '1px solid #e5e7eb', padding: '10px', display: 'inline-block', backgroundColor: '#fff' }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Firma de Conformidad:</p>
                                {firmas === null
                                    ? <span style={{ fontSize: '11px', color: '#94a3b8' }}>Cargando firma…</span>
                                    : (firmas[parte.id]
                                        ? <img src={firmas[parte.id]} alt="Firma" style={{ height: '50px', objectFit: 'contain' }} />
                                        : <span style={{ fontSize: '11px', color: '#94a3b8' }}>Firma no disponible</span>)}
                            </div>
                        )}

                        {/* BLOQUE DE ASIGNACIÓN (Aparece justo debajo al pulsar procesar, sin ocultar el resumen) */}
                        {estaProcesando ? (
                            <div style={{ padding: '20px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', marginTop: '5px' }}>
                                <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Asignación de Personal para el Albarán</h4>
                                <p style={{ margin: '0 0 15px 0', fontSize: '11px', color: '#64748b' }}>Aquí solo se registran <strong>horas extra</strong>. Las horas normales son base mensual fija y se calculan en Control de Nóminas.</p>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <select value={nuevoOperario} onChange={(e)=>setNuevoOperario(e.target.value)} style={{ flex: 1, padding: '10px', border: '1px solid #1a1a1a', outline: 'none' }}>
                                        <option value="">-- Seleccionar operario --</option>
                                        {trabajadoresList.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                    </select>
                                    <button onClick={agregarOperarioCuadrilla} style={btnBlackStyle}>Añadir</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '25px' }}>
                                    {cuadrilla.map((op, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px', gap: '15px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, minWidth: '120px' }}>{op.nombre}</span>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 'bold', color: '#2563eb', letterSpacing: '1px', textTransform: 'uppercase' }}>
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
                                                    style={{ width: '70px', padding: '8px', border: '1px solid #2563eb', color: '#2563eb', fontWeight: 'bold', textAlign: 'center', outline: 'none' }}
                                                />
                                                <button type="button" onClick={() => cambiarHorasExtra(i, 0.5)} style={btnPasoStyle} title="Sumar media hora"><Plus size={14}/></button>
                                            </div>

                                            <button onClick={()=>quitarOperario(i)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }} title="Quitar de la cuadrilla"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={confirmarValidacionParte} disabled={validandoParte} style={{ ...btnBlackStyle, opacity: validandoParte ? 0.5 : 1, cursor: validandoParte ? 'not-allowed' : 'pointer' }}>
                                        {validandoParte ? 'Registrando...' : 'Aprobar y Registrar Albarán'}
                                    </button>
                                    <button onClick={()=>setParteAValidar(null)} disabled={validandoParte} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid #1a1a1a', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: validandoParte ? 'not-allowed' : 'pointer', opacity: validandoParte ? 0.5 : 1 }}>Cancelar</button>
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
