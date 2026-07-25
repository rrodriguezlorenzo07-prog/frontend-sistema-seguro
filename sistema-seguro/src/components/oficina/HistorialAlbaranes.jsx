import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export default function HistorialAlbaranes({ blockStyle, btnBlackStyle, exportarPartesExcel, labelStyle, inputStyle, fechaInicio, setFechaInicio, fechaFin, setFechaFin, filtroBuscador, setFiltroBuscador, setLimitePartes, ordenPartes, setOrdenPartes, partesAMostrar }) {
  return (
      <div style={blockStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}><h3 style={{ margin: 0, fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Albaranes / Historial</h3><button onClick={exportarPartesExcel} style={{ ...btnBlackStyle, backgroundColor: '#ffffff', color: '#1a1a1a', border: '1px solid #1a1a1a' }}><FileSpreadsheet size={14} /> Exportar BBDD</button></div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: '150px' }}><label style={labelStyle}>Desde:</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} /></div><div style={{ flex: 1, minWidth: '150px' }}><label style={labelStyle}>Hasta:</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} /></div></div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}><input type="text" placeholder="Término de búsqueda..." value={filtroBuscador} onChange={(e) => { setFiltroBuscador(e.target.value); setLimitePartes(50); }} style={{...inputStyle, flex: 2}} /><select value={ordenPartes} onChange={(e) => setOrdenPartes(e.target.value)} style={{...inputStyle, flex: 1, cursor: 'pointer'}}><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {partesAMostrar.map((parte) => ( 
              <div key={parte.id} style={{ padding: '25px', border: '1px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{parte.obra} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>| {parte.fecha}</span></h4>
                      <div style={{ display: 'flex', gap: '5px' }}>
                          {parte.facturado && <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: 'white', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Facturado</span>}
                          {parte.certificado && !parte.facturado && <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: 'white', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Certificado</span>}
                          {!parte.facturado && !parte.certificado && <span style={{ border: '1px solid #1a1a1a', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Validado libre</span>}
                      </div>
                  </div>
                  <div style={{ fontSize: '12px', marginBottom: '10px' }}><strong>ASIGNACIÓN:</strong> {parte.cuadrilla?.length > 0 ? parte.cuadrilla.map(c=>`${c.nombre} (${c.horas}h n. / ${c.horasExtra||0}h ex.)`).join(' - ') : parte.nombreTrabajador}</div>
                  <div style={{ fontSize: '12px', marginBottom: '10px' }}><strong>MATERIAL:</strong> {parte.materialesUsados?.length > 0 ? parte.materialesUsados.map(m=>`${m.cantidad}x ${m.nombre}`).join(' / ') : 'Ninguno'}</div>
                  <div style={{ fontSize: '12px' }}><strong>NOTAS:</strong> {parte.trabajo || 'Sin observaciones'}</div>
              </div>
            ))}
          </div>
      </div>
  );
}