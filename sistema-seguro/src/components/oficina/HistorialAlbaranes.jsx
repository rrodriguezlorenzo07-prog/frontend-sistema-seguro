import React, { useState } from 'react';
import { FileSpreadsheet, Eye, Download, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function HistorialAlbaranes({ blockStyle, btnBlackStyle, exportarPartesExcel, labelStyle, inputStyle, fechaInicio, setFechaInicio, fechaFin, setFechaFin, filtroBuscador, setFiltroBuscador, setLimitePartes, ordenPartes, setOrdenPartes, partesAMostrar }) {
  
  const [partePreview, setPartePreview] = useState(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const generarPDFAlbaran = async (parte) => {
      setGenerandoPDF(true);
      try {
          const doc = new jsPDF();
          doc.setTextColor(0, 0, 0); 
          doc.setFontSize(22); 
          doc.setFont("helvetica", "bold"); 
          doc.text("ALBARÁN DE TRABAJO", 14, 25);
          
          let tsStr = Date.now().toString();
          if (parte.timestamp) {
              tsStr = typeof parte.timestamp === 'number' ? parte.timestamp.toString() : (parte.timestamp.seconds ? (parte.timestamp.seconds * 1000).toString() : tsStr);
          }
          const numAlbaran = `ALB-${tsStr.slice(-6).toUpperCase()}`;
          
          doc.setFontSize(10); 
          doc.setFont("helvetica", "normal"); 
          doc.text(`Referencia: ${numAlbaran}`, 14, 33); 
          doc.text(`Fecha de Ejecución: ${parte.fecha || 'Sin especificar'}`, 14, 38);
          
          doc.setFontSize(11); 
          doc.setFont("helvetica", "bold"); 
          doc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' });
          doc.setFontSize(10); 
          doc.setFont("helvetica", "normal"); 
          doc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' }); 
          
          doc.setDrawColor(0, 0, 0); 
          doc.setLineWidth(0.8); 
          doc.line(14, 45, 196, 45);
          
          doc.setFontSize(10); 
          doc.setFont("helvetica", "bold"); 
          doc.text("PROYECTO / CLIENTE:", 14, 55);
          doc.setFontSize(12); 
          doc.setFont("helvetica", "normal"); 
          doc.text(String(parte.obra || 'Sin especificar'), 14, 62);

          doc.setFontSize(10); 
          doc.setFont("helvetica", "bold"); 
          doc.text("PERSONAL ASIGNADO:", 14, 75);
          doc.setFontSize(10); 
          doc.setFont("helvetica", "normal"); 
          
          const equipoStr = parte.cuadrilla?.length > 0 
              ? parte.cuadrilla.map(c=>`${c.nombre} (${c.horas}h norm. / ${c.horasExtra || 0}h ext.)`).join(' - ') 
              : (parte.nombreTrabajador || parte.creador || 'Sin asignar');
          doc.text(String(equipoStr), 14, 82);

          let finalY = 95;

          if (parte.materialesUsados && parte.materialesUsados.length > 0) {
              let datosMat = parte.materialesUsados.map(m => [String(m.nombre || ''), String(m.cantidad || '0')]);
              autoTable(doc, { 
                  startY: finalY, 
                  head: [['Material Empleado', 'Cantidad']], 
                  body: datosMat, 
                  theme: 'grid', 
                  headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
                  styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 }
              });
              finalY = doc.lastAutoTable.finalY + 15;
          }

          doc.setFontSize(10); 
          doc.setFont("helvetica", "bold"); 
          doc.text("TRABAJO REALIZADO / NOTAS:", 14, finalY);
          doc.setFontSize(10); 
          doc.setFont("helvetica", "normal"); 
          
          const notas = String(parte.trabajo || 'Sin observaciones adicionales.');
          const textoTrabajo = doc.splitTextToSize(notas, 180);
          doc.text(textoTrabajo, 14, finalY + 8);
          
          finalY = finalY + 15 + (textoTrabajo.length * 5);

          // === INYECCIÓN DIRECTA DE LA URL DE FIREBASE STORAGE ===
          if (parte.firma && typeof parte.firma === 'string') {
              doc.setFontSize(10); 
              doc.setFont("helvetica", "bold"); 
              doc.text("FIRMA DE CONFORMIDAD:", 14, finalY + 10);
              
              try {
                  // Como ahora es una URL limpia, jsPDF la procesa directamente sin sobrecargar memoria
                  doc.addImage(parte.firma, 'PNG', 14, finalY + 15, 60, 30);
              } catch (e1) {
                  try {
                      doc.addImage(parte.firma, 'JPEG', 14, finalY + 15, 60, 30);
                  } catch (e2) {
                      doc.setFontSize(8); 
                      doc.setFont("helvetica", "normal");
                      doc.text("(Firma digital registrada en servidor central)", 14, finalY + 20);
                  }
              }
          }

          const nombreLimpio = String(parte.obra || 'General').replace(/[^a-zA-Z0-9]/g, '_');
          doc.save(`Albaran_${nombreLimpio}_${numAlbaran}.pdf`);
          
      } catch (error) {
          console.error("Fallo crítico del PDF:", error);
          alert("Error al generar el documento: " + error.message);
      } finally {
          setGenerandoPDF(false);
      }
  };

  return (
      <div style={blockStyle}>
          
          {/* MODAL DE VISTA PREVIA */}
          {partePreview && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box' }}>
                  <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #1a1a1a', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10 }}>
                          <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Vista Previa de Albarán</h3>
                          <button onClick={() => setPartePreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button>
                      </div>
                      
                      <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a', flex: 1 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '15px' }}>
                               <div>
                                   <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Proyecto</p>
                                   <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{partePreview.obra}</p>
                               </div>
                               <div style={{ textAlign: 'right' }}>
                                   <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Fecha</p>
                                   <p style={{ margin: 0, fontSize: '14px' }}>{partePreview.fecha}</p>
                               </div>
                           </div>

                           <div style={{ marginBottom: '20px' }}>
                               <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Personal Asignado</p>
                               <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a' }}>{partePreview.cuadrilla?.length > 0 ? partePreview.cuadrilla.map(c=>`${c.nombre} (${c.horas}h n. / ${c.horasExtra || 0}h ex.)`).join(' - ') : partePreview.nombreTrabajador}</p>
                           </div>

                           {partePreview.materialesUsados && partePreview.materialesUsados.length > 0 && (
                               <div style={{ marginBottom: '20px' }}>
                                   <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Material Empleado</p>
                                   <ul style={{ margin: 0, padding: '10px 10px 10px 25px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a' }}>
                                       {partePreview.materialesUsados.map((m, i) => <li key={i}>{m.cantidad}x {m.nombre}</li>)}
                                   </ul>
                               </div>
                           )}

                           <div style={{ marginBottom: '20px' }}>
                               <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Trabajo Realizado</p>
                               <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', whiteSpace: 'pre-wrap' }}>{partePreview.trabajo || 'Sin observaciones'}</p>
                           </div>

                           {partePreview.firma && (
                               <div style={{ marginTop: '30px' }}>
                                   <p style={{ margin: '0 0 10px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Firma de Conformidad</p>
                                   <img src={partePreview.firma} alt="Firma" style={{ height: '100px', objectFit: 'contain', border: '1px dashed #1a1a1a', padding: '10px', backgroundColor: '#fafafa' }} />
                               </div>
                           )}
                      </div>
                      
                      <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', gap: '10px', position: 'sticky', bottom: 0, backgroundColor: '#fafafa' }}>
                           <button onClick={() => setPartePreview(null)} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
                           <button 
                               onClick={() => generarPDFAlbaran(partePreview)} 
                               style={{...btnBlackStyle, opacity: generandoPDF ? 0.7 : 1}}
                               disabled={generandoPDF}
                           >
                               <Download size={16} /> {generandoPDF ? 'Generando...' : 'Descargar PDF'}
                           </button>
                      </div>
                  </div>
              </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}><h3 style={{ margin: 0, fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Albaranes / Historial</h3><button onClick={exportarPartesExcel} style={{ ...btnBlackStyle, backgroundColor: '#ffffff', color: '#1a1a1a', border: '1px solid #1a1a1a' }}><FileSpreadsheet size={14} /> Exportar BBDD</button></div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}><label style={labelStyle}>Desde:</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '150px' }}><label style={labelStyle}>Hasta:</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} /></div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
              <input type="text" placeholder="Término de búsqueda..." value={filtroBuscador} onChange={(e) => { setFiltroBuscador(e.target.value); setLimitePartes(50); }} style={{...inputStyle, flex: 2}} />
              <select value={ordenPartes} onChange={(e) => setOrdenPartes(e.target.value)} style={{...inputStyle, flex: 1, cursor: 'pointer'}}><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {partesAMostrar.map((parte) => ( 
              <div key={parte.id} style={{ padding: '25px', border: '1px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
                      <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{parte.obra} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>| {parte.fecha}</span></h4>
                      
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button onClick={() => setPartePreview(parte)} style={{ background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Eye size={12}/> Ver Albarán
                          </button>
                          {parte.facturado && <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Facturado</span>}
                          {parte.certificado && !parte.facturado && <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Certificado</span>}
                          {!parte.facturado && !parte.certificado && <span style={{ border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Validado libre</span>}
                      </div>
                  </div>
                  
                  <div style={{ fontSize: '12px', marginBottom: '10px' }}><strong>ASIGNACIÓN:</strong> {parte.cuadrilla?.length > 0 ? parte.cuadrilla.map(c=>`${c.nombre} (${c.horas}h n. / ${c.horasExtra||0}h ex.)`).join(' - ') : parte.nombreTrabajador}</div>
                  <div style={{ fontSize: '12px', marginBottom: '10px' }}><strong>MATERIAL:</strong> {parte.materialesUsados?.length > 0 ? parte.materialesUsados.map(m=>`${m.cantidad}x ${m.nombre}`).join(' / ') : 'Ninguno'}</div>
                  <div style={{ fontSize: '12px', color: '#475569', borderLeft: '3px solid #1a1a1a', paddingLeft: '10px', marginTop: '10px' }}><em>"{parte.parte || parte.trabajo || 'Sin observaciones'}"</em></div>
              </div>
            ))}
          </div>
      </div>
  );
}