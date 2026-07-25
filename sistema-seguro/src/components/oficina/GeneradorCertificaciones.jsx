import React from 'react';
import { FileCheck, CheckSquare, Trash2 } from 'lucide-react';

export default function GeneradorCertificaciones({ blockStyle, labelStyle, inputStyle, btnBlackStyle, certObraSeleccionada, setCertObraSeleccionada, setCertPartesSeleccionados, obrasList, generarPDFCertificacion, partesPendientesCertificar, toggleParteCertificacion, certPartesSeleccionados, certificacionesList, borrarCertificacion }) {
  return (
      <div style={blockStyle}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Generador de Certificaciones</h3>
          <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '25px' }}>Agrupa albaranes de un hotel para emitir el PDF justificativo del mes.</p>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', padding: '20px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Seleccionar Hotel / Proyecto</label><select value={certObraSeleccionada} onChange={(e) => { setCertObraSeleccionada(e.target.value); setCertPartesSeleccionados([]); }} style={inputStyle}><option value="">-- Elige un proyecto --</option>{obrasList.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}</select></div>
              <button onClick={generarPDFCertificacion} style={{...btnBlackStyle, height: '43px'}}><FileCheck size={16}/> Generar Certificación PDF</button>
          </div>

          {certObraSeleccionada && partesPendientesCertificar.length === 0 && <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed #cbd5e1', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>No hay albaranes pendientes de certificar para este hotel.</div>}
          {certObraSeleccionada && partesPendientesCertificar.length > 0 && (
              <div style={{ marginBottom: '40px' }}><h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Albaranes ejecutados sin certificar:</h4><div style={{ display: 'grid', gap: '10px' }}>
                  {partesPendientesCertificar.map(p => (
                      <div key={p.id} onClick={() => toggleParteCertificacion(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: certPartesSeleccionados.includes(p.id) ? '2px solid #1a1a1a' : '1px solid #e5e7eb', backgroundColor: certPartesSeleccionados.includes(p.id) ? '#fafafa' : '#ffffff', cursor: 'pointer' }}><div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: certPartesSeleccionados.includes(p.id) ? '#1a1a1a' : 'transparent' }}>{certPartesSeleccionados.includes(p.id) && <CheckSquare size={14} color="#ffffff" />}</div><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>FECHA: {p.fecha} <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>| {p.horasTotales || p.horas || 0} horas totales</span></div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>OPERARIOS: {p.cuadrilla?.length > 0 ? p.cuadrilla.map(c=>c.nombre).join(', ') : p.nombreTrabajador}</div></div></div>
                  ))}
              </div></div>
          )}

          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', borderTop: '1px solid #e5e7eb', paddingTop: '30px' }}>Historial de Certificaciones Emitidas</h4>
          <div style={{ display: 'grid', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
              {certificacionesList.length === 0 ? <div style={{ padding: '20px', backgroundColor: '#fff', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>Aún no hay certificaciones</div> : certificacionesList.map(cert => (
                  <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 20px' }}>
                      <div><strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{cert.obra}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>| {cert.fecha}</span> <br/><span style={{ fontSize: '11px', letterSpacing: '1px' }}>REF: {cert.referencia} | TOTAL: {cert.totalHoras}h</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: cert.facturado ? 'white' : '#1a1a1a', backgroundColor: cert.facturado ? '#1a1a1a' : 'transparent' }}>{cert.facturado ? 'FACTURADO' : 'PENDIENTE'}</span>
                          <button onClick={() => borrarCertificacion(cert.id, cert.partesIds)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }} title="Anular certificación"><Trash2 size={16}/></button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );
}