import React, { useState } from 'react';
import { FileCheck, CheckSquare, Trash2, Eye, X, Search } from 'lucide-react';

export default function GeneradorCertificaciones({ blockStyle, labelStyle, inputStyle, btnBlackStyle, certObraSeleccionada, setCertObraSeleccionada, setCertPartesSeleccionados, obrasList, generarPDFCertificacion, partesPendientesCertificar, toggleParteCertificacion, certPartesSeleccionados, certificacionesList, borrarCertificacion }) {
  
  const [certPreview, setCertPreview] = useState(null);

  // FILTROS HISTORIAL
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  // FILTROS PENDIENTES
  const [filtroPendientesTexto, setFiltroPendientesTexto] = useState('');
  const [filtroPendientesDesde, setFiltroPendientesDesde] = useState('');
  const [filtroPendientesHasta, setFiltroPendientesHasta] = useState('');

  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box' };
  const modalBoxStyle = { backgroundColor: '#fff', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #1a1a1a', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
  const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10 };
  const btnCloseStyle = { padding: '12px 20px', background: '#1a1a1a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' };

  // 1. Filtrar el historial
  const certificacionesFiltradas = certificacionesList.filter(cert => {
      let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
      if (filtroTexto) {
          const texto = filtroTexto.toLowerCase();
          coincideTexto = (cert.obra && cert.obra.toLowerCase().includes(texto)) || (cert.referencia && cert.referencia.toLowerCase().includes(texto));
      }
      const tsItem = cert.timestamp || (cert.fecha ? new Date(cert.fecha.split('/').reverse().join('-')).getTime() : 0);
      if (filtroDesde) coincideDesde = tsItem >= new Date(filtroDesde).getTime();
      if (filtroHasta) coincideHasta = tsItem <= (new Date(filtroHasta).getTime() + 86400000);
      return coincideTexto && coincideDesde && coincideHasta;
  });

  // 2. Filtrar los pendientes del hotel seleccionado
  const pendientesFiltrados = partesPendientesCertificar.filter(item => {
      let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
      if (filtroPendientesTexto) {
          const texto = filtroPendientesTexto.toLowerCase();
          coincideTexto = (item.trabajo && item.trabajo.toLowerCase().includes(texto)) || (item.nombreTrabajador && item.nombreTrabajador.toLowerCase().includes(texto));
      }
      const tsItem = item.timestamp || (item.fecha ? new Date(item.fecha.split('/').reverse().join('-')).getTime() : 0);
      if (filtroPendientesDesde) coincideDesde = tsItem >= new Date(filtroPendientesDesde).getTime();
      if (filtroPendientesHasta) coincideHasta = tsItem <= (new Date(filtroPendientesHasta).getTime() + 86400000);
      return coincideTexto && coincideDesde && coincideHasta;
  });


  return (
      <div style={blockStyle}>

          {certPreview && ( <div style={modalOverlayStyle}> <div style={modalBoxStyle}> <div style={modalHeaderStyle}> <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Detalles de Certificación Histórica</h3> <button type="button" onClick={() => setCertPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button> </div> <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a' }}> <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '15px' }}> <div><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Proyecto / Hotel</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{certPreview.obra}</p></div> <div style={{ textAlign: 'right' }}><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Referencia</p><p style={{ margin: 0, fontSize: '14px' }}>{certPreview.referencia}</p></div> </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Estado de Facturación</p> {certPreview.facturado ? <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: '#fff', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Ya Facturada</span> : <span style={{ border: '1px solid #1a1a1a', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Pendiente de Facturar</span>} </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Resumen de Horas Totales</p> <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', fontSize: '16px', fontWeight: 'bold' }}>{certPreview.totalHoras} h</p> </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 10px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Albaranes Agrupados</p> <ul style={{ margin: 0, padding: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}> {certPreview.albaranes && certPreview.albaranes.length > 0 ? certPreview.albaranes.map((alb, idx) => ( <li key={idx} style={{ padding: '10px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', fontSize: '12px' }}> <strong>{alb.fecha || 'Sin fecha'}</strong> - {alb.trabajo ? alb.trabajo.substring(0, 50) + '...' : 'Sin notas registradas'} <strong style={{ float: 'right' }}>{alb.horas || alb.horasTotales || 0}h</strong> </li> )) : <li style={{ padding: '10px', backgroundColor: '#fafafa', border: '1px dashed #e5e7eb', fontSize: '12px', color: '#64748b' }}>No hay detalles de albaranes guardados.</li>} </ul> </div> </div> <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafafa', position: 'sticky', bottom: 0 }}> <button type="button" onClick={() => setCertPreview(null)} style={btnCloseStyle}>Cerrar</button> </div> </div> </div> )}

          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Generador de Certificaciones</h3>
          <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '25px' }}>Agrupa albaranes de un hotel para emitir el PDF justificativo del mes.</p>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', padding: '20px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px' }}>
                  <label style={labelStyle}>Seleccionar Hotel / Proyecto</label>
                  <select value={certObraSeleccionada} onChange={(e) => { setCertObraSeleccionada(e.target.value); setCertPartesSeleccionados([]); }} style={inputStyle}>
                      <option value="">-- Elige un proyecto --</option>
                      {obrasList.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
                  </select>
              </div>
              <button type="button" onClick={generarPDFCertificacion} style={{...btnBlackStyle, height: '43px'}}><FileCheck size={16}/> Generar Certificación PDF</button>
          </div>

          {certObraSeleccionada && partesPendientesCertificar.length === 0 && <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed #cbd5e1', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>No hay albaranes pendientes de certificar para este hotel.</div>}
          
          {certObraSeleccionada && partesPendientesCertificar.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Albaranes ejecutados sin certificar:</h4>
                  
                  {/* === BARRA DE FILTRO PARA PENDIENTES === */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                      <div style={{ flex: 2, minWidth: '150px', display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '0 10px' }}>
                          <Search size={14} color="#94a3b8" />
                          <input type="text" placeholder="Buscar por operario o trabajo..." value={filtroPendientesTexto} onChange={(e) => setFiltroPendientesTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none', fontSize: '12px', padding: '8px' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>DESDE</label>
                          <input type="date" value={filtroPendientesDesde} onChange={(e) => setFiltroPendientesDesde(e.target.value)} style={{...inputStyle, padding: '6px', fontSize: '11px'}} />
                      </div>
                      <div style={{ flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>HASTA</label>
                          <input type="date" value={filtroPendientesHasta} onChange={(e) => setFiltroPendientesHasta(e.target.value)} style={{...inputStyle, padding: '6px', fontSize: '11px'}} />
                      </div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                      {pendientesFiltrados.length === 0 ? <div style={{ fontSize: '12px', color: '#64748b', padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #cbd5e1' }}>No hay albaranes que coincidan con el filtro.</div> :
                      pendientesFiltrados.map(p => (
                          <div key={p.id} onClick={() => toggleParteCertificacion(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: certPartesSeleccionados.includes(p.id) ? '2px solid #1a1a1a' : '1px solid #e5e7eb', backgroundColor: certPartesSeleccionados.includes(p.id) ? '#fafafa' : '#ffffff', cursor: 'pointer' }}><div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: certPartesSeleccionados.includes(p.id) ? '#1a1a1a' : 'transparent' }}>{certPartesSeleccionados.includes(p.id) && <CheckSquare size={14} color="#ffffff" />}</div><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>FECHA: {p.fecha} <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>| {p.horasTotales || p.horas || 0} horas totales</span></div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>OPERARIOS: {p.cuadrilla?.length > 0 ? p.cuadrilla.map(c=>c.nombre).join(', ') : p.nombreTrabajador}</div></div></div>
                      ))}
                  </div>
              </div>
          )}

          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', borderTop: '1px solid #e5e7eb', paddingTop: '30px' }}>Historial de Certificaciones Emitidas</h4>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', backgroundColor: '#fff', padding: '0 10px' }}>
                  <Search size={16} color="#64748b" />
                  <input type="text" placeholder="Buscar por hotel o referencia..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none' }} />
              </div>
              <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Desde</label>
                  <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Hasta</label>
                  <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} style={inputStyle} />
              </div>
          </div>

          <div style={{ display: 'grid', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
              {certificacionesFiltradas.length === 0 ? <div style={{ padding: '20px', backgroundColor: '#fff', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>No se han encontrado certificaciones.</div> : certificacionesFiltradas.map(cert => (
                  <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 20px' }}>
                      <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{cert.obra}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>| {cert.fecha}</span> <br/><span style={{ fontSize: '11px', letterSpacing: '1px' }}>REF: {cert.referencia} | TOTAL: {cert.totalHoras}h</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button type="button" onClick={() => setCertPreview(cert)} style={{ background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                          <span style={{ border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: cert.facturado ? 'white' : '#1a1a1a', backgroundColor: cert.facturado ? '#1a1a1a' : 'transparent' }}>{cert.facturado ? 'FACTURADO' : 'PENDIENTE'}</span>
                          <button type="button" onClick={() => borrarCertificacion(cert.id, cert.partesIds)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }} title="Anular certificación"><Trash2 size={16}/></button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );
}