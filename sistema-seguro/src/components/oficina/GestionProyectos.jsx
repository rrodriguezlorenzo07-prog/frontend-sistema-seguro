import React from 'react';
import { Trash2 } from 'lucide-react';

export default function GestionProyectos({ blockStyle, labelStyle, inputStyle, btnBlackStyle, nuevaObra, setNuevaObra, numPlantas, setNumPlantas, configHabitaciones, setConfigHabitaciones, generarHotelInteligente, obrasList, obraActiva, setObraActiva, borrarObra, obtenerEstadisticasHotel, marcarTareaHotel }) {
  return (
      <div style={blockStyle}>
        <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Gestión de Proyectos</h3>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap', backgroundColor: '#fafafa', padding: '20px', border: '1px solid #e5e7eb' }}>
          <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Identificador Proyecto</label><input type="text" value={nuevaObra} onChange={(e) => setNuevaObra(e.target.value)} placeholder="Hotel / Obra..." style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '100px' }}><label style={labelStyle}>Nº Plantas</label><input type="number" value={numPlantas} onChange={(e) => setNumPlantas(e.target.value)} min="1" style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '100px' }}><label style={labelStyle}>Unidades/Planta</label><input type="text" value={configHabitaciones} onChange={(e) => setConfigHabitaciones(e.target.value)} placeholder="Ej: 10, 15, 8" style={inputStyle} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={generarHotelInteligente} style={btnBlackStyle}>Inicializar</button></div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          {obrasList.map(obra => { 
              const tareasTotales = obra.tareas?.length || 0; const tareasHechas = obra.tareas?.filter(t => t.completada).length || 0; const porcentaje = tareasTotales === 0 ? 0 : Math.round((tareasHechas / tareasTotales) * 100); 
              return ( 
                  <div key={obra.id} onClick={() => setObraActiva(obra)} style={{ backgroundColor: obraActiva?.id === obra.id ? '#fafafa' : '#ffffff', border: obraActiva?.id === obra.id ? '2px solid #1a1a1a' : '1px solid #e5e7eb', padding: '20px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><h4 style={{ margin: '0 0 15px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>{obra.nombre}</h4><button onClick={(e) => { e.stopPropagation(); borrarObra(obra.id); }} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button></div>
                      <div style={{ backgroundColor: '#e5e7eb', height: '4px', overflow: 'hidden' }}><div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: '#1a1a1a' }}></div></div>
                      <p style={{ margin: '10px 0 0 0', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Progreso: {tareasHechas} / {tareasTotales} ({porcentaje}%)</p>
                  </div> 
              ); 
          })}
        </div>

        {obraActiva && ( 
            <div style={{ marginTop: '30px', padding: '30px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 20px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Detalle: {obraActiva.nombre}</h4>
                {(() => {
                    const stats = obtenerEstadisticasHotel(obraActiva.nombre);
                    return (
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' }}>
                            <div style={{ padding: '20px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', minWidth: '150px' }}><div style={labelStyle}>Horas Totales Invertidas</div><div style={{ fontSize: '24px', fontWeight: '300' }}>{stats.horas}h</div></div>
                            <div style={{ padding: '20px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', flex: 1 }}><div style={labelStyle}>Desglose de Material</div>{stats.materiales.length === 0 ? <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Sin consumo</span> : <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{stats.materiales.map(([n, c], i) => <span key={i} style={{ border: '1px solid #e5e7eb', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold' }}>{c}x {n}</span> )}</div>}</div>
                        </div>
                    );
                })()}
                <div><p style={labelStyle}>Mapa de Unidades</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>{obraActiva.tareas?.map(tarea => <div key={tarea.id} onClick={() => marcarTareaHotel(tarea.id)} style={{ padding: '10px 5px', backgroundColor: tarea.completada ? '#1a1a1a' : '#ffffff', color: tarea.completada ? 'white' : '#1a1a1a', border: '1px solid #1a1a1a', cursor: 'pointer', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', userSelect: 'none' }}>{tarea.nombre}</div> )}</div></div>
            </div> 
        )}
      </div> 
  );
}