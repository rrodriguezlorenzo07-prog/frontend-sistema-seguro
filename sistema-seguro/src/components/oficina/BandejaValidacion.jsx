import React from 'react';
import { CheckCircle, Minus, Plus, Trash2, CheckSquare, Package, FileText } from 'lucide-react';

export default function BandejaValidacion({
    partesPendientes,
    parteAValidar,
    setParteAValidar,
    nuevoOperario,
    setNuevoOperario,
    trabajadoresList,
    agregarOperarioCuadrilla,
    cuadrilla,
    cambiarHoras,
    setHorasDirecto,
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
            <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Documentos pendientes de asignación y validación.</p>
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
                    return (
                    <div key={parte.id} style={{ padding: '25px', border: '1px solid #1a1a1a', borderLeft: '4px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff' }}>
                        {parteAValidar?.id === parte.id ? (
                            <div style={{ padding: '20px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb' }}>
                                <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Asignación de Personal</h4>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <select value={nuevoOperario} onChange={(e)=>setNuevoOperario(e.target.value)} style={{ flex: 1, padding: '10px', border: '1px solid #1a1a1a', outline: 'none' }}>
                                        <option value="">-- Seleccionar operario --</option>
                                        {trabajadoresList.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                                    </select>
                                    <button onClick={agregarOperarioCuadrilla} style={btnBlackStyle}>Añadir</button>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '25px' }}>
                                    {cuadrilla.map((op, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px', flexWrap: 'wrap', gap: '15px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', minWidth: '120px' }}>{op.nombre}</span>
                                            
                                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', letterSpacing: '1px' }}>H. NORMALES</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <button onClick={()=>cambiarHoras(i, -1, 'horas')} style={{ background: 'none', border: '1px solid #e5e7eb', width: '25px', height: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12}/></button>
                                                        <input type="number" value={op.horas} onChange={(e) => setHorasDirecto(i, e.target.value, 'horas')} style={{ width: '40px', textAlign: 'center', border: '1px solid #e5e7eb', padding: '4px', outline: 'none', fontSize: '12px', fontWeight: 'bold' }} />
                                                        <button onClick={()=>cambiarHoras(i, 1, 'horas')} style={{ background: 'none', border: '1px solid #e5e7eb', width: '25px', height: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12}/></button>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', letterSpacing: '1px' }}>H. EXTRAS</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <button onClick={()=>cambiarHoras(i, -1, 'horasExtra')} style={{ background: 'none', border: '1px solid #e5e7eb', width: '25px', height: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12}/></button>
                                                        <input type="number" value={op.horasExtra} onChange={(e) => setHorasDirecto(i, e.target.value, 'horasExtra')} style={{ width: '40px', textAlign: 'center', border: '1px solid #e5e7eb', padding: '4px', outline: 'none', fontSize: '12px', fontWeight: 'bold', color: '#2563eb' }} />
                                                        <button onClick={()=>cambiarHoras(i, 1, 'horasExtra')} style={{ background: 'none', border: '1px solid #e5e7eb', width: '25px', height: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12}/></button>
                                                    </div>
                                                </div>
                                            </div>

                                            <button onClick={()=>quitarOperario(i)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={confirmarValidacionParte} style={btnBlackStyle}>Aprobar Documento</button>
                                    <button onClick={()=>setParteAValidar(null)} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid #1a1a1a', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{parte.obra}</h4>
                                        <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase' }}>Emitido por: <strong>{parte.nombreTrabajador || parte.creador}</strong> | Fecha: {parte.fecha}</div>
                                    </div>
                                    <button onClick={() => borrarParte(parte.id)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                </div>
                                
                                {habsArray.length > 0 && (
                                    <div style={{ padding: '15px', border: '1px solid #e5e7eb', fontSize: '12px', backgroundColor: '#fafafa' }}>
                                        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}><CheckSquare size={14}/> Habitaciones interv.</strong>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{habsArray.map((num, i) => <span key={i} style={{ border: '1px solid #1a1a1a', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>{num}</span>)}</div>
                                    </div>
                                )}

                                <div style={{ padding: '15px', border: '1px solid #e5e7eb', fontSize: '12px', backgroundColor: '#fafafa' }}>
                                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}><Package size={14}/> Material Empleado</strong>
                                    {parte.materialesUsados && parte.materialesUsados.length > 0 ? <ul style={{ margin: 0, paddingLeft: '20px' }}>{parte.materialesUsados.map((m, i) => <li key={i}>{m.cantidad}x {m.nombre}</li>)}</ul> : <span>NINGUNO REGISTRADO</span>}
                                </div>
                                
                                {parte.trabajo && (
                                    <div style={{ padding: '15px', border: '1px solid #e5e7eb', fontSize: '12px', backgroundColor: '#fafafa' }}>
                                        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}><FileText size={14}/> Notas de ejecución</strong>
                                        <span style={{ whiteSpace: 'pre-wrap' }}>{parte.trabajo}</span>
                                    </div>
                                )}
                                
                                {parte.firma && (
                                    <div style={{ marginTop: '10px', border: '1px solid #e5e7eb', padding: '10px', display: 'inline-block' }}>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Firma Autorizada:</p>
                                        <img src={parte.firma} alt="Firma" style={{ height: '60px', objectFit: 'contain' }} />
                                    </div>
                                )}
                                <button onClick={() => abrirValidacion(parte)} style={{ ...btnBlackStyle, width: 'fit-content', marginTop: '10px' }}>Procesar Documento</button>
                            </>
                        )}
                    </div>
                    );
                })}
            </div>
        )}
    </div>
  );
}