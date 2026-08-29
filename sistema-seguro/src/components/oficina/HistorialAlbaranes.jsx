import React, { useState } from 'react';
import { FileSpreadsheet, Eye, Download, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function HistorialAlbaranes({ blockStyle, btnBlackStyle, exportarPartesExcel, labelStyle, inputStyle, fechaInicio, setFechaInicio, fechaFin, setFechaFin, filtroBuscador, setFiltroBuscador, setLimitePartes, ordenPartes, setOrdenPartes, partesAMostrar, cargarMasPartes, hayMasPartes, cargandoMas, buscarPartesPorFechas }) {
  
  const [partePreview, setPartePreview] = useState(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const convertirUrlABase64 = (url) => {
      return new Promise((resolve) => {
          if (!url) return resolve(null);
          if (url.startsWith('data:image')) return resolve(url); 
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width || 300; canvas.height = img.height || 150;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(null);
          img.src = url;
      });
  };

  const generarPDFAlbaran = async (parte) => {
      setGenerandoPDF(true);
      try {
          const doc = new jsPDF();
          doc.setTextColor(0, 0, 0); doc.setFontSize(22); doc.setFont("helvetica", "bold"); 
          doc.text("ALBARÁN DE TRABAJO", 14, 25);
          
          let tsStr = Date.now().toString();
          if (parte.timestamp) tsStr = typeof parte.timestamp === 'number' ? parte.timestamp.toString() : (parte.timestamp.seconds ? (parte.timestamp.seconds * 1000).toString() : tsStr);
          const numAlbaran = `ALB-${tsStr.slice(-6).toUpperCase()}`;
          
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); 
          doc.text(`Referencia: ${numAlbaran}`, 14, 33); doc.text(`Fecha: ${parte.fecha || 'Sin especificar'}`, 14, 38);
          
          doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' });
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' }); 
          
          doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.8); doc.line(14, 45, 196, 45);
          
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("PROYECTO / CLIENTE:", 14, 55);
          doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text(String(parte.obra || 'Sin especificar'), 14, 62);

          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("PERSONAL ASIGNADO:", 14, 75);
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); 
          const equipoStr = parte.cuadrilla?.length > 0 ? parte.cuadrilla.map(c=>c.nombre).join(' - ') : (parte.nombreTrabajador || 'Sin asignar');
          doc.text(String(equipoStr), 14, 82);

          let finalY = 95;

          if (parte.materialesUsados && parte.materialesUsados.length > 0) {
              let datosMat = parte.materialesUsados.map(m => {
                  const p = parseFloat(m.precio || 0); const c = parseFloat(m.cantidad || 0);
                  return [String(c), String(m.nombre || ''), `${p.toFixed(2)} €`, `${(c*p).toFixed(2)} €`];
              });
              const totalMat = parte.materialesUsados.reduce((sum, m) => sum + (parseFloat(m.cantidad||0) * parseFloat(m.precio||0)), 0);
              datosMat.push(['', '', 'TOTAL:', `${totalMat.toFixed(2)} €`]);

              autoTable(doc, { 
                  startY: finalY, head: [['Cant.', 'Material Empleado', 'Precio/U', 'Subtotal']], body: datosMat, 
                  theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
                  styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
                  didParseCell: function(data) { if(data.row.index === datosMat.length - 1) data.cell.styles.fontStyle = 'bold'; }
              });
              finalY = doc.lastAutoTable.finalY + 15;
          }

          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("TAREAS Y HABITACIONES:", 14, finalY);
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); finalY += 8;

          if (parte.tareasRealizadas && parte.tareasRealizadas.length > 0) {
              parte.tareasRealizadas.forEach(t => {
                  const textoTarea = doc.splitTextToSize(`• ${t.ubicacion || 'General'}: ${t.descripcion}`, 180);
                  doc.text(textoTarea, 14, finalY); finalY += (textoTarea.length * 6);
              });
          } else {
              const notas = doc.splitTextToSize(String(parte.trabajo || 'Sin observaciones.'), 180);
              doc.text(notas, 14, finalY); finalY += (notas.length * 6);
          }
          finalY += 10;

          if (parte.firma) {
              doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("FIRMA DE CONFORMIDAD:", 14, finalY);
              const base64Firma = await convertirUrlABase64(parte.firma);
              if (base64Firma) {
                  try { doc.addImage(base64Firma, 'PNG', 14, finalY + 5, 60, 30); } 
                  catch (e) { doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("(Firma digital registrada en servidor central)", 14, finalY + 15); }
              } else { doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("(Firma digital registrada en servidor central)", 14, finalY + 15); }
          }

          doc.save(`Albaran_${String(parte.obra || 'General').replace(/[^a-zA-Z0-9]/g, '_')}_${numAlbaran}.pdf`);
      } catch (error) { alert("Error al generar el documento: " + error.message); } 
      finally { setGenerandoPDF(false); }
  };

  return (
      <div style={blockStyle}>
          {partePreview && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box' }}>
                  <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '600px', maxHeight: '90vh', minHeight: '600px', overflowY: 'auto', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10 }}>
                          <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Vista Previa Albarán</h3>
                          <button onClick={() => setPartePreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button>
                      </div>
                      <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a', flex: 1, display: 'flex', flexDirection: 'column' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '15px' }}>
                               <div><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Proyecto</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{partePreview.obra}</p></div>
                               <div style={{ textAlign: 'right' }}><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Fecha</p><p style={{ margin: 0, fontSize: '14px' }}>{partePreview.fecha}</p></div>
                           </div>

                           <div style={{ marginBottom: '20px' }}>
                               <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Personal Asignado</p>
                               <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a' }}>{partePreview.cuadrilla?.length > 0 ? partePreview.cuadrilla.map(c=>c.nombre).join(' - ') : partePreview.nombreTrabajador}</p>
                           </div>

                           {partePreview.materialesUsados && partePreview.materialesUsados.length > 0 && (
                               <div style={{ marginBottom: '20px' }}>
                                   <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Material Empleado y Costes</p>
                                   <ul style={{ margin: 0, padding: '12px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', listStyle: 'none' }}>
                                       {partePreview.materialesUsados.map((m, i) => (
                                           <li key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e5e7eb', paddingBottom: '5px', marginBottom: '5px' }}>
                                               <span><strong>{m.cantidad}x</strong> {m.nombre}</span>
                                               <span>{parseFloat(m.precio || 0).toFixed(2)} €/u &rarr; <strong>{(m.cantidad * parseFloat(m.precio || 0)).toFixed(2)} €</strong></span>
                                           </li>
                                       ))}
                                       <li style={{ textAlign: 'right', marginTop: '10px', fontWeight: 'bold' }}>
                                           TOTAL MATERIALES: {partePreview.materialesUsados.reduce((sum, m) => sum + (m.cantidad * parseFloat(m.precio || 0)), 0).toFixed(2)} €
                                       </li>
                                   </ul>
                               </div>
                           )}

                           <div style={{ marginBottom: '20px' }}>
                               <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Tareas y Habitaciones</p>
                               {partePreview.tareasRealizadas && partePreview.tareasRealizadas.length > 0 ? (
                                   <div style={{ backgroundColor: '#fafafa', border: '1px solid #1a1a1a' }}>
                                       {partePreview.tareasRealizadas.map((t, i) => (
                                           <div key={i} style={{ padding: '10px', borderBottom: i !== partePreview.tareasRealizadas.length -1 ? '1px solid #e5e7eb' : 'none' }}>
                                               <strong style={{ display: 'block', color: '#1a1a1a' }}>{t.ubicacion}</strong>
                                               <span style={{ color: '#475569' }}>{t.descripcion}</span>
                                           </div>
                                       ))}
                                   </div>
                               ) : (
                                   <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', whiteSpace: 'pre-wrap' }}>{partePreview.trabajo || 'Sin observaciones'}</p>
                               )}
                           </div>

                           <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                               <p style={{ margin: '0 0 10px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Firma de Conformidad</p>
                               <div style={{ width: '100%', height: '120px', backgroundColor: '#fafafa', border: '1px dashed #1a1a1a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                   {partePreview.firma ? <img src={partePreview.firma} alt="Firma" style={{ maxHeight: '100px' }} /> : <span style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase' }}>Sin firma registrada</span>}
                               </div>
                           </div>
                      </div>
                      <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', gap: '10px', position: 'sticky', bottom: 0, backgroundColor: '#fafafa', zIndex: 10 }}>
                           <button onClick={() => setPartePreview(null)} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
                           <button onClick={() => generarPDFAlbaran(partePreview)} style={{...btnBlackStyle, opacity: generandoPDF ? 0.7 : 1}} disabled={generandoPDF}>
                               <Download size={16} /> {generandoPDF ? 'Generando...' : 'Descargar PDF'}
                           </button>
                      </div>
                  </div>
              </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Albaranes / Historial</h3>
              <button onClick={exportarPartesExcel} style={{ ...btnBlackStyle, backgroundColor: '#ffffff', color: '#1a1a1a', border: '1px solid #1a1a1a' }}><FileSpreadsheet size={14} /> Exportar BBDD</button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '150px' }}><label style={labelStyle}>Desde:</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '150px' }}><label style={labelStyle}>Hasta:</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} /></div>
              {/* BOTON BUSCAR EN FECHAS */}
              <button onClick={buscarPartesPorFechas} style={{ ...btnBlackStyle, flex: 1, minWidth: '150px', justifyContent: 'center', height: '42px' }}>Buscar en BD</button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
              <input type="text" placeholder="Filtro rápido (sobre cargados)..." value={filtroBuscador} onChange={(e) => { setFiltroBuscador(e.target.value); setLimitePartes(50); }} style={{...inputStyle, flex: 2}} />
              <select value={ordenPartes} onChange={(e) => setOrdenPartes(e.target.value)} style={{...inputStyle, flex: 1, cursor: 'pointer'}}><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select>
          </div>
          
          <div onScroll={(e) => { if (filtroBuscador !== '' || fechaInicio !== '' || fechaFin !== '') return; const { scrollTop, clientHeight, scrollHeight } = e.currentTarget; if (scrollHeight - scrollTop <= clientHeight + 30) setLimitePartes(prev => prev + 10); }} style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '5px' }}>
              {partesAMostrar.length === 0 ? <div style={{ fontSize: '12px', color: '#64748b', padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #cbd5e1' }}>No se han encontrado albaranes.</div> : (
                  <>
                      {partesAMostrar.map((parte) => ( 
                        <div key={parte.id} style={{ padding: '25px', border: '1px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
                                <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{parte.obra} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>| {parte.fecha}</span></h4>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <button onClick={() => setPartePreview(parte)} style={{ background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={12}/> Ver Albarán</button>
                                    {parte.facturado && <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold' }}>Facturado</span>}
                                    {parte.certificado && !parte.facturado && <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold' }}>Certificado</span>}
                                    {!parte.facturado && !parte.certificado && <span style={{ border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold' }}>Validado libre</span>}
                                </div>
                            </div>
                            <div style={{ fontSize: '12px', marginBottom: '10px' }}><strong>ASIGNACIÓN:</strong> {parte.cuadrilla?.length > 0 ? parte.cuadrilla.map(c=>c.nombre).join(' - ') : parte.nombreTrabajador}</div>
                            <div style={{ fontSize: '12px', marginBottom: '10px' }}><strong>MATERIAL:</strong> {parte.materialesUsados?.length > 0 ? parte.materialesUsados.map(m=>`${m.cantidad}x ${m.nombre}`).join(' / ') : 'Ninguno'}</div>
                            <div style={{ fontSize: '12px', color: '#475569', borderLeft: '3px solid #1a1a1a', paddingLeft: '10px', marginTop: '10px' }}><em>{parte.tareasRealizadas?.length > 0 ? parte.tareasRealizadas.map(t => `${t.ubicacion}: ${t.descripcion}`).join(' | ') : (parte.trabajo || 'Sin observaciones')}</em></div>
                        </div>
                      ))}
                      
                      {hayMasPartes && (
                          <button 
                              onClick={cargarMasPartes} 
                              disabled={cargandoMas}
                              style={{ width: '100%', padding: '15px', backgroundColor: '#fafafa', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a', cursor: 'pointer', border: '1px dashed #cbd5e1', textTransform: 'uppercase' }}
                          >
                              {cargandoMas ? 'Descargando...' : '↓ Descargar más albaranes antiguos ↓'}
                          </button>
                      )}
                  </>
              )}
          </div>
      </div>
  );
}