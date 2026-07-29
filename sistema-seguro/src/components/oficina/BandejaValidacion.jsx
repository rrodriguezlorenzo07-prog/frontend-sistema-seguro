import React from 'react';
import { CheckCircle, Trash2, CheckSquare, Package, FileText, Clock } from 'lucide-react';

export default function BandejaValidacion({
    partesPendientes,
    parteAValidar,
    setParteAValidar,
    nuevoOperario,
    setNuevoOperario,
    trabajadoresList,
    agregarOperarioCuadrilla,
    cuadrilla,
    quitarOperario,
    confirmarValidacionParte,
    borrarParte,
    abrirValidacion,
    decodificarRangos,
    btnBlackStyle
}) {
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
                    const habsArray = decodificarRangos(parte.habitacionesRango);
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
                            
                            {(parte.horas || parte.horasTotales) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} color="#64748b" />
                                    <strong>Horas reportadas:</strong> {parte.horasTotales || parte.horas} h
                                </div>
                            )}

                            {habsArray.length > 0 && (
                                <div>
                                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><CheckSquare size={14}/> Habitaciones intervenidas:</strong>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                        {habsArray.map((num, i) => <span key={i} style={{ border: '1px solid #1a1a1a', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#fff' }}>{num}</span>)}
                                    </div>
                                </div>
                            )}

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
                                <img src={parte.firma} alt="Firma" style={{ height: '50px', objectFit: 'contain' }} />
                            </div>
                        )}

                        {/* BLOQUE DE ASIGNACIÓN (Aparece justo debajo al pulsar procesar, sin ocultar el resumen) */}
                        {estaProcesando ? (
                            <div style={{ padding: '20px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', marginTop: '5px' }}>
                                <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Asignación de Personal para el Albarán</h4>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <select value={nuevoOperario} onChange={(e)=>setNuevoOperario(e.target.value)} style={{ flex: 1, padding: '10px', border: '1px solid #1a1a1a', outline: 'none' }}>
                                        <option value="">-- Seleccionar operario --</option>
                                        {trabajadoresList.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                                    </select>
                                    <button onClick={agregarOperarioCuadrilla} style={btnBlackStyle}>Añadir</button>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '25px' }}>
                                    {cuadrilla.map((op, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{op.nombre}</span>
                                            <button onClick={()=>quitarOperario(i)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={confirmarValidacionParte} style={btnBlackStyle}>Aprobar y Registrar Albarán</button>
                                    <button onClick={()=>setParteAValidar(null)} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid #1a1a1a', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
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