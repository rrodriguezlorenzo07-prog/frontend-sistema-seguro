import React, { useState } from 'react';
import { FileCheck, CheckSquare, Trash2, Eye, X, Search, Plus, FileText, PenTool } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function GeneradorCertificaciones({ blockStyle, labelStyle, inputStyle, btnBlackStyle, certObraSeleccionada, setCertObraSeleccionada, setCertPartesSeleccionados, obrasList, partesPendientesCertificar, toggleParteCertificacion, certPartesSeleccionados, certificacionesList, borrarCertificacion }) {
  
  const [modoCert, setModoCert] = useState('albaranes');
  
  const [partidasLibres, setPartidasLibres] = useState([]);
  const [libConcepto, setLibConcepto] = useState('');
  const [libCantidad, setLibCantidad] = useState(1);
  const [libPrecio, setLibPrecio] = useState('');

  const [preciosAlbaranes, setPreciosAlbaranes] = useState({});

  // NUEVO: MEMORIA VISUAL PARA NO TENER QUE RECARGAR LA PÁGINA
  const [certsNuevasLocales, setCertsNuevasLocales] = useState([]);
  const [partesCertificadosLocales, setPartesCertificadosLocales] = useState([]);

  const [certPreview, setCertPreview] = useState(null);
  const [albaranPreview, setAlbaranPreview] = useState(null); 
  const [limiteCertificaciones, setLimiteCertificaciones] = useState(15);
  const [limitePendientes, setLimitePendientes] = useState(15);
  
  const [filtroTexto, setFiltroTexto] = useState(''); const [filtroDesde, setFiltroDesde] = useState(''); const [filtroHasta, setFiltroHasta] = useState('');
  const [filtroPendientesTexto, setFiltroPendientesTexto] = useState(''); const [filtroPendientesDesde, setFiltroPendientesDesde] = useState(''); const [filtroPendientesHasta, setFiltroPendientesHasta] = useState('');

  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box' };
  const modalBoxStyle = { backgroundColor: '#fff', width: '100%', maxWidth: '700px', maxHeight: '90vh', minHeight: '500px', overflowY: 'auto', border: '1px solid #1a1a1a', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
  const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10 };
  const btnCloseStyle = { padding: '12px 20px', background: '#1a1a1a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' };

  // Fusión de base de datos con nuestra memoria visual instantánea
  const todasLasCertificaciones = [...certsNuevasLocales, ...certificacionesList];
  const certificacionesUnidas = Array.from(new Map(todasLasCertificaciones.map(c => [c.id, c])).values()).sort((a, b) => b.timestamp - a.timestamp);

  const certificacionesFiltradas = certificacionesUnidas.filter(cert => {
      let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
      if (filtroTexto) { const texto = filtroTexto.toLowerCase(); coincideTexto = (cert.obra && cert.obra.toLowerCase().includes(texto)) || (cert.referencia && cert.referencia.toLowerCase().includes(texto)); }
      const tsItem = cert.timestamp || (cert.fecha ? new Date(cert.fecha.split('/').reverse().join('-')).getTime() : 0);
      if (filtroDesde) coincideDesde = tsItem >= new Date(filtroDesde).getTime();
      if (filtroHasta) coincideHasta = tsItem <= (new Date(filtroHasta).getTime() + 86400000);
      return coincideTexto && coincideDesde && coincideHasta;
  });

  // Ocultamos mágicamente los albaranes que acabamos de certificar
  const partesRealesPendientes = partesPendientesCertificar.filter(p => !partesCertificadosLocales.includes(p.id));
  
  const pendientesFiltrados = partesRealesPendientes.filter(item => {
      let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
      if (filtroPendientesTexto) { const texto = filtroPendientesTexto.toLowerCase(); coincideTexto = (item.trabajo && item.trabajo.toLowerCase().includes(texto)) || (item.nombreTrabajador && item.nombreTrabajador.toLowerCase().includes(texto)); }
      const tsItem = item.timestamp || (item.fecha ? new Date(item.fecha.split('/').reverse().join('-')).getTime() : 0);
      if (filtroPendientesDesde) coincideDesde = tsItem >= new Date(filtroPendientesDesde).getTime();
      if (filtroPendientesHasta) coincideHasta = tsItem <= (new Date(filtroPendientesHasta).getTime() + 86400000);
      return coincideTexto && coincideDesde && coincideHasta;
  });

  const calcularTotalMaterialesCert = (cert) => {
      if (!cert.albaranes) return 0;
      return cert.albaranes.reduce((total, alb) => {
          if (!alb.materialesUsados) return total;
          const totalAlb = alb.materialesUsados.reduce((sum, m) => sum + (parseFloat(m.cantidad||0) * parseFloat(m.precio||0)), 0);
          return total + totalAlb;
      }, 0);
  };

  const albaranesSeleccionadosData = partesRealesPendientes.filter(p => certPartesSeleccionados.includes(p.id));
  let itemsAValorar = [];
  
  albaranesSeleccionadosData.forEach(alb => {
      const horas = Number(alb.horasTotales) || Number(alb.horas) || 0;
      if (horas > 0) {
          const equipo = alb.cuadrilla?.length > 0 ? alb.cuadrilla.map(c=>c.nombre).join(', ') : (alb.nombreTrabajador || 'Equipo');
          itemsAValorar.push({ idKey: `${alb.id}-H`, concepto: `[Mano de Obra] ${equipo}`, cantidad: horas, fecha: alb.fecha });
      }
      (alb.tareasRealizadas || []).forEach((t, i) => {
          itemsAValorar.push({ idKey: `${alb.id}-T-${i}`, concepto: `[${t.ubicacion}] ${t.descripcion}`, cantidad: 1, fecha: alb.fecha });
      });
      (alb.materialesUsados || []).forEach((m, i) => {
           itemsAValorar.push({ idKey: `${alb.id}-M-${i}`, concepto: `[Material] ${m.nombre}`, cantidad: Number(m.cantidad) || 1, fecha: alb.fecha });
      });
  });

  const agregarPartida = () => {
      if(!libConcepto || !libCantidad || !libPrecio) { alert("Completa todos los campos."); return; }
      setPartidasLibres([...partidasLibres, { id: Date.now(), concepto: libConcepto, cantidad: parseFloat(libCantidad), precio: parseFloat(libPrecio) }]);
      setLibConcepto(''); setLibCantidad(1); setLibPrecio('');
  };
  const quitarPartida = (id) => setPartidasLibres(partidasLibres.filter(p => p.id !== id));

  // Modificamos el botón de borrar para que también quite el elemento de la memoria visual
  const handleDeleteCert = (id, partesIds) => {
      borrarCertificacion(id, partesIds);
      setCertsNuevasLocales(certsNuevasLocales.filter(c => c.id !== id));
      setPartesCertificadosLocales(partesCertificadosLocales.filter(pId => !partesIds.includes(pId)));
  };

  // === GENERACIÓN DE PDFS (Sin reinicios) ===
  const generarPDFCertificacion = async () => {
      if(!certObraSeleccionada) { alert("Selecciona un proyecto primero."); return; }
      
      const pdfDoc = new jsPDF();
      pdfDoc.setTextColor(0, 0, 0);
      pdfDoc.setFontSize(22);
      pdfDoc.setFont("helvetica", "bold");

      const esModoLibre = modoCert === 'libre';
      const esAlbaranValorado = modoCert === 'albaranes' && Object.values(preciosAlbaranes).some(val => parseFloat(val) > 0);

      if (esModoLibre || esAlbaranValorado) {
          if(esModoLibre && partidasLibres.length === 0) { alert("Añade al menos una partida a la tabla."); return; }
          if(!esModoLibre && certPartesSeleccionados.length === 0) { alert("Selecciona al menos un albarán."); return; }

          pdfDoc.text("CERTIFICACIÓN DE OBRA VALORADA", 14, 25);
          const numCert = `CERT-V-${Date.now().toString().slice(-6).toUpperCase()}`;

          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal");
          pdfDoc.text(`Referencia: ${numCert}`, 14, 33);
          pdfDoc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 38);
          pdfDoc.setFontSize(11); pdfDoc.setFont("helvetica", "bold");
          pdfDoc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' });
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal");
          pdfDoc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' });
          pdfDoc.setDrawColor(0, 0, 0); pdfDoc.setLineWidth(0.8); pdfDoc.line(14, 45, 196, 45);
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "bold");
          pdfDoc.text("PROYECTO / HOTEL:", 14, 55);
          pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "normal");
          pdfDoc.text(certObraSeleccionada, 14, 62);

          let datosTabla = [];
          let totalCertificacion = 0;
          let partidasFinales = [];

          if (esModoLibre) {
              partidasLibres.forEach(p => {
                  const importe = p.cantidad * p.precio;
                  totalCertificacion += importe;
                  datosTabla.push([ p.concepto, p.cantidad.toString(), `${p.precio.toFixed(2)} €`, `${importe.toFixed(2)} €` ]);
                  partidasFinales.push(p);
              });
          } else {
              itemsAValorar.forEach(item => {
                  const precio = parseFloat(preciosAlbaranes[item.idKey]) || 0;
                  if (precio > 0) {
                      const importe = item.cantidad * precio;
                      totalCertificacion += importe;
                      datosTabla.push([ item.concepto, item.cantidad.toString(), `${precio.toFixed(2)} €`, `${importe.toFixed(2)} €` ]);
                      partidasFinales.push({ concepto: item.concepto, cantidad: item.cantidad, precio: precio });
                  }
              });
          }

          autoTable(pdfDoc, {
              startY: 75, head: [['Concepto / Unidad de Obra', 'Cant.', 'Precio Ud.', 'Importe Total']], body: datosTabla,
              theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' },
              columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
              styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
              alternateRowStyles: { fillColor: [245, 245, 245] }
          });

          const finalY = (pdfDoc.lastAutoTable ? pdfDoc.lastAutoTable.finalY : 120) + 15;
          pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "bold");
          pdfDoc.text(`TOTAL CERTIFICADO: ${totalCertificacion.toFixed(2)} €`, 196, finalY, { align: 'right' });

          const nuevaCert = {
              obra: certObraSeleccionada, referencia: numCert, totalHoras: 0, totalImporte: totalCertificacion,
              fecha: new Date().toLocaleDateString(), timestamp: Date.now(), facturado: false, papelera: false,
              modo: 'libre', partidas: partidasFinales, partesIds: esModoLibre ? [] : certPartesSeleccionados,
              albaranes: esModoLibre ? [] : albaranesSeleccionadosData
          };

          const docRef = await addDoc(collection(db, 'certificaciones'), nuevaCert);
          
          if (!esModoLibre) {
              for (let id of certPartesSeleccionados) { 
                  await updateDoc(doc(db, 'partes_de_trabajo', id), { certificado: true, idCertificacion: docRef.id }); 
              }
          }

          // Inyectamos a la memoria visual para no recargar
          setCertsNuevasLocales([{ id: docRef.id, ...nuevaCert }, ...certsNuevasLocales]);
          setPartesCertificadosLocales([...partesCertificadosLocales, ...(esModoLibre ? [] : certPartesSeleccionados)]);

          // Limpiamos los paneles
          setPartidasLibres([]); setPreciosAlbaranes({}); setCertPartesSeleccionados([]); setCertObraSeleccionada('');
          
          pdfDoc.save(`Certificacion_Valorada_${certObraSeleccionada.replace(/[^a-zA-Z0-9]/g, '_')}_${numCert}.pdf`);

      } else {
          // CERTIFICACIÓN DE HORAS NORMAL
          if(certPartesSeleccionados.length === 0) { alert("Selecciona al menos un albarán."); return; }
          
          pdfDoc.text("CERTIFICACIÓN DE OBRA", 14, 25);
          const numCert = `CERT-${Date.now().toString().slice(-6).toUpperCase()}`;

          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal");
          pdfDoc.text(`Referencia: ${numCert}`, 14, 33);
          pdfDoc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 38);
          pdfDoc.setFontSize(11); pdfDoc.setFont("helvetica", "bold");
          pdfDoc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' });
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal");
          pdfDoc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' });
          pdfDoc.setDrawColor(0, 0, 0); pdfDoc.setLineWidth(0.8); pdfDoc.line(14, 45, 196, 45);
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "bold");
          pdfDoc.text("PROYECTO / HOTEL:", 14, 55);
          pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "normal");
          pdfDoc.text(certObraSeleccionada, 14, 62);

          let datosTabla = [];
          const totalHorasCert = albaranesSeleccionadosData.reduce((acc, p) => acc + (Number(p.horasTotales) || 0), 0);

          albaranesSeleccionadosData.forEach(p => {
              const equipo = p.cuadrilla?.length > 0 ? p.cuadrilla.map(c => `${c.nombre} (${c.horas}h)`).join(', ') : (p.nombreTrabajador || 'Sin asignar');
              let textoTareas = p.tareasRealizadas?.length > 0 ? p.tareasRealizadas.map(t => `• [${t.ubicacion}]: ${t.descripcion}`).join('\n') : (p.trabajo || 'Sin especificar');
              datosTabla.push([ p.fecha || '', equipo, textoTareas, `${p.horasTotales?.toString() || '0'}h` ]);
          });

          autoTable(pdfDoc, { 
              startY: 75, head: [['Fecha', 'Personal Asignado', 'Habitaciones y Tareas Realizadas', 'Horas']], body: datosTabla, 
              theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' }, 
              columnStyles: { 3: { halign: 'center' } }, 
              styles: { fontSize: 9, cellPadding: 5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, overflow: 'linebreak' }, 
              alternateRowStyles: { fillColor: [245, 245, 245] } 
          });

          const finalY = (pdfDoc.lastAutoTable ? pdfDoc.lastAutoTable.finalY : 120) + 15; 
          pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "bold"); 
          pdfDoc.text(`TOTAL HORAS CERTIFICADAS: ${totalHorasCert} h`, 196, finalY, { align: 'right' }); 

          const nuevaCert = { obra: certObraSeleccionada, partesIds: certPartesSeleccionados, referencia: numCert, totalHoras: totalHorasCert, fecha: new Date().toLocaleDateString(), timestamp: Date.now(), facturado: false, papelera: false, albaranes: albaranesSeleccionadosData };
          const docRef = await addDoc(collection(db, 'certificaciones'), nuevaCert);
          
          for (let id of certPartesSeleccionados) { await updateDoc(doc(db, 'partes_de_trabajo', id), { certificado: true, idCertificacion: docRef.id }); }
          
          // Inyectamos a la memoria visual
          setCertsNuevasLocales([{ id: docRef.id, ...nuevaCert }, ...certsNuevasLocales]);
          setPartesCertificadosLocales([...partesCertificadosLocales, ...certPartesSeleccionados]);

          // Limpiamos la pantalla
          setCertPartesSeleccionados([]); setCertObraSeleccionada(''); setPreciosAlbaranes({});
          
          pdfDoc.save(`Certificacion_${certObraSeleccionada.replace(/[^a-zA-Z0-9]/g, '_')}_${numCert}.pdf`); 
      }
  };

  return (
      <div style={blockStyle}>
          
          {/* VISTAS PREVIAS (Modales) */}
          {certPreview && ( 
              <div style={modalOverlayStyle}> 
                  <div style={modalBoxStyle}> 
                      <div style={modalHeaderStyle}> 
                          <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Detalles de Certificación</h3> 
                          <button type="button" onClick={() => setCertPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button> 
                      </div> 
                      
                      <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a', flex: 1, display: 'flex', flexDirection: 'column' }}> 
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '20px' }}> 
                              <div><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>HOTEL / PROYECTO</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{certPreview.obra}</p></div> 
                              <div style={{ textAlign: 'right' }}><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>REF / FECHA</p><p style={{ margin: 0, fontSize: '14px' }}>{certPreview.referencia} <br/> {certPreview.fecha}</p></div> 
                          </div> 

                          <div style={{ marginBottom: '25px', display: 'flex', gap: '15px' }}>
                              <div style={{ flex: 1, padding: '15px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                      {certPreview.modo === 'libre' ? 'Importe Total' : 'Horas Totales'}
                                  </p> 
                                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                                      {certPreview.modo === 'libre' ? `${certPreview.totalImporte?.toFixed(2)} €` : `${certPreview.totalHoras} h`}
                                  </p>
                              </div>
                              {certPreview.modo !== 'libre' && (
                                  <div style={{ flex: 1, padding: '15px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                                      <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Coste Materiales Extra</p> 
                                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>{calcularTotalMaterialesCert(certPreview).toFixed(2)} €</p>
                                  </div>
                              )}
                          </div> 
                          
                          <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #1a1a1a', paddingBottom: '5px' }}>Desglose de Trabajos</p> 
                          
                          {certPreview.modo === 'libre' ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                      <tr style={{ borderBottom: '2px solid #1a1a1a', textTransform: 'uppercase' }}>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>Concepto</th><th style={{ padding: '8px', textAlign: 'center' }}>Cant.</th><th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {certPreview.partidas?.map((p, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                              <td style={{ padding: '8px' }}>{p.concepto}</td><td style={{ padding: '8px', textAlign: 'center' }}>{p.cantidad}</td><td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{(p.cantidad * p.precio).toFixed(2)} €</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}> 
                                  {certPreview.albaranes && certPreview.albaranes.map((alb, idx) => {
                                      const costeMatDia = alb.materialesUsados?.reduce((sum, m) => sum + (parseFloat(m.cantidad||0)*parseFloat(m.precio||0)), 0) || 0;
                                      return ( 
                                          <div key={idx} style={{ padding: '0', backgroundColor: '#fff', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}> 
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', padding: '10px 15px', borderBottom: '1px solid #e5e7eb' }}>
                                                  <strong style={{ fontSize: '12px', color: '#1a1a1a' }}>DÍA: {alb.fecha}</strong>
                                                  <div><span style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '10px' }}>Mat: {costeMatDia.toFixed(2)}€</span><span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#1a1a1a', color: '#fff', padding: '4px 8px' }}>{alb.horas || alb.horasTotales || 0} H</span></div>
                                              </div>
                                              <div style={{ padding: '15px', borderBottom: '1px dashed #e5e7eb' }}>
                                                  {alb.tareasRealizadas && alb.tareasRealizadas.length > 0 ? (
                                                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>{alb.tareasRealizadas.map((t, i) => <li key={i}><strong>{t.ubicacion}:</strong> {t.descripcion}</li>)}</ul>
                                                  ) : ( <p style={{ margin: 0, fontSize: '12px' }}>{alb.trabajo || 'Sin detalles.'}</p> )}
                                              </div>
                                          </div> 
                                      );
                                  })} 
                              </div> 
                          )}
                      </div> 
                      <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafafa', position: 'sticky', bottom: 0, zIndex: 10 }}><button type="button" onClick={() => setCertPreview(null)} style={btnCloseStyle}>Cerrar</button></div> 
                  </div> 
              </div> 
          )}

          {albaranPreview && (
              <div style={modalOverlayStyle}>
                  <div style={{ ...modalBoxStyle, minHeight: 'auto' }}>
                      <div style={modalHeaderStyle}>
                          <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase' }}>Vista Previa Albarán</h3>
                          <button type="button" onClick={() => setAlbaranPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button>
                      </div>
                      <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a' }}>
                          <p><strong>Proyecto:</strong> {albaranPreview.obra} | <strong>Fecha:</strong> {albaranPreview.fecha}</p>
                          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '15px 0' }}/>
                          <p><strong>Materiales:</strong></p>
                          {albaranPreview.materialesUsados?.length > 0 ? <ul>{albaranPreview.materialesUsados.map((m, i) => <li key={i}>{m.cantidad}x {m.nombre} ({m.precio||0}€/u)</li>)}</ul> : <p>Ninguno.</p>}
                          <p><strong>Tareas:</strong></p>
                          {albaranPreview.tareasRealizadas?.length > 0 ? <ul>{albaranPreview.tareasRealizadas.map((t, i) => <li key={i}><strong>{t.ubicacion}:</strong> {t.descripcion}</li>)}</ul> : <p>{albaranPreview.trabajo}</p>}
                      </div>
                      <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafafa' }}><button onClick={() => setAlbaranPreview(null)} style={btnCloseStyle}>Cerrar</button></div>
                  </div>
              </div>
          )}

          {/* CABECERA PRINCIPAL */}
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Generador de Certificaciones</h3>
          <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '25px' }}>Emite el justificante oficial de la obra para el cobro del hotel.</p>

          {/* BOTONES SELECTORES DE MODO */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => { setModoCert('albaranes'); setPreciosAlbaranes({}); setCertPartesSeleccionados([]); }} style={{ flex: 1, minWidth: '200px', padding: '14px', backgroundColor: modoCert === 'albaranes' ? '#1a1a1a' : '#ffffff', color: modoCert === 'albaranes' ? 'white' : '#64748b', border: modoCert === 'albaranes' ? '1px solid #1a1a1a' : '1px solid #e5e7eb', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                  <FileText size={16} /> Certificar desde Albaranes
              </button>
              <button onClick={() => { setModoCert('libre'); setPreciosAlbaranes({}); setCertPartesSeleccionados([]); }} style={{ flex: 1, minWidth: '200px', padding: '14px', backgroundColor: modoCert === 'libre' ? '#1a1a1a' : '#ffffff', color: modoCert === 'libre' ? 'white' : '#64748b', border: modoCert === 'libre' ? '1px solid #1a1a1a' : '1px solid #e5e7eb', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                  <PenTool size={16} /> Certificación Valorada (Libre)
              </button>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', padding: '20px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px' }}>
                  <label style={labelStyle}>Seleccionar Hotel / Proyecto</label>
                  <select value={certObraSeleccionada} onChange={(e) => { setCertObraSeleccionada(e.target.value); setCertPartesSeleccionados([]); setPreciosAlbaranes({}); }} style={inputStyle}>
                      <option value="">-- Elige un proyecto --</option>
                      {obrasList.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
                  </select>
              </div>
              <button type="button" onClick={generarPDFCertificacion} style={{...btnBlackStyle, height: '43px', backgroundColor: '#10b981', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'}}>
                  <FileCheck size={16}/> Generar Documento PDF
              </button>
          </div>

          {/* ÁREA DE TRABAJO DINÁMICA SEGÚN EL MODO */}
          {modoCert === 'albaranes' ? (
              <>
                  {certObraSeleccionada && partesRealesPendientes.length === 0 && <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed #cbd5e1', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>No hay albaranes pendientes para este hotel.</div>}
                  
                  {certObraSeleccionada && partesRealesPendientes.length > 0 && (
                      <div style={{ marginBottom: '40px' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Paso 1: Selecciona los Albaranes a incluir</h4>
                          
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                              <div style={{ flex: 2, minWidth: '150px', display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '0 10px' }}><Search size={14} color="#94a3b8" /><input type="text" placeholder="Buscar operario..." value={filtroPendientesTexto} onChange={(e) => setFiltroPendientesTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none', fontSize: '12px', padding: '8px' }} /></div>
                          </div>

                          <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
                              {pendientesFiltrados.slice(0, limitePendientes).map(p => (
                                  <div key={p.id} onClick={() => toggleParteCertificacion(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: certPartesSeleccionados.includes(p.id) ? '2px solid #1a1a1a' : '1px solid #e5e7eb', backgroundColor: certPartesSeleccionados.includes(p.id) ? '#fafafa' : '#ffffff', cursor: 'pointer' }}>
                                      <div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: certPartesSeleccionados.includes(p.id) ? '#1a1a1a' : 'transparent' }}>{certPartesSeleccionados.includes(p.id) && <CheckSquare size={14} color="#ffffff" />}</div>
                                      <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>FECHA: {p.fecha} <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>| {p.horasTotales || p.horas || 0} h</span></div>
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {/* LA TABLA MÁGICA DE PRECIOS */}
                          {certPartesSeleccionados.length > 0 && itemsAValorar.length > 0 && (
                              <div style={{ marginTop: '30px', borderTop: '2px solid #1a1a1a', paddingTop: '20px' }}>
                                  <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>Paso 2: Valorar Tareas y Horas (Opcional)</h4>
                                  <p style={{ margin: '0 0 15px 0', fontSize: '11px', color: '#64748b' }}>Si dejas los precios en blanco, se generará el PDF clásico de horas. Si escribes un precio, se generará una Certificación Valorada en Euros.</p>
                                  
                                  <div style={{ border: '1px solid #1a1a1a' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                          <thead>
                                              <tr style={{ backgroundColor: '#1a1a1a', color: 'white', textTransform: 'uppercase' }}>
                                                  <th style={{ padding: '12px', textAlign: 'left' }}>Concepto Extraído</th>
                                                  <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>Cant.</th>
                                                  <th style={{ padding: '12px', width: '130px' }}>Precio Ud. (€)</th>
                                                  <th style={{ padding: '12px', textAlign: 'right', width: '100px' }}>Total (€)</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {itemsAValorar.map(item => {
                                                  const precio = parseFloat(preciosAlbaranes[item.idKey]) || 0;
                                                  return (
                                                      <tr key={item.idKey} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
                                                          <td style={{ padding: '12px' }}>{item.concepto}</td>
                                                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{item.cantidad}</td>
                                                          <td style={{ padding: '8px' }}>
                                                              <input type="number" step="0.01" style={{...inputStyle, padding: '8px', fontSize: '12px'}} placeholder="Dejar vacío = 0€" value={preciosAlbaranes[item.idKey] || ''} onChange={(e) => setPreciosAlbaranes({...preciosAlbaranes, [item.idKey]: e.target.value})} />
                                                          </td>
                                                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: precio > 0 ? '#10b981' : '#1a1a1a' }}>
                                                              {(item.cantidad * precio).toFixed(2)} €
                                                          </td>
                                                      </tr>
                                                  )
                                              })}
                                          </tbody>
                                      </table>
                                      <div style={{ padding: '15px', backgroundColor: '#fafafa', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #1a1a1a' }}>
                                          SUBTOTAL VALORADO: {itemsAValorar.reduce((sum, item) => sum + (item.cantidad * (parseFloat(preciosAlbaranes[item.idKey]) || 0)), 0).toFixed(2)} €
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
              </>
          ) : (
              certObraSeleccionada ? (
                  <div style={{ marginBottom: '40px' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Añadir Partidas o Unidades de Obra:</h4>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <input type="text" placeholder="Concepto (Ej: Instalación de 10 puertas...)" value={libConcepto} onChange={e => setLibConcepto(e.target.value)} style={{...inputStyle, flex: 3, minWidth: '200px'}} />
                          <input type="number" placeholder="Cant." value={libCantidad} onChange={e => setLibCantidad(e.target.value)} min="1" style={{...inputStyle, flex: 1, minWidth: '70px'}} />
                          <input type="number" placeholder="Precio Ud. €" step="0.01" value={libPrecio} onChange={e => setLibPrecio(e.target.value)} style={{...inputStyle, flex: 1, minWidth: '100px'}} />
                          <button type="button" onClick={agregarPartida} style={{ padding: '0 20px', backgroundColor: '#1a1a1a', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Plus size={18}/> Añadir
                          </button>
                      </div>
                      
                      {partidasLibres.length > 0 && (
                          <div style={{ border: '1px solid #1a1a1a' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                  <thead>
                                      <tr style={{ backgroundColor: '#1a1a1a', color: 'white', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '11px' }}>
                                          <th style={{ padding: '15px', textAlign: 'left' }}>Concepto</th><th style={{ padding: '15px', textAlign: 'center' }}>Cant.</th><th style={{ padding: '15px', textAlign: 'right' }}>Precio Ud.</th><th style={{ padding: '15px', textAlign: 'right' }}>Total</th><th style={{ padding: '15px', textAlign: 'center' }}></th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {partidasLibres.map((p, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
                                              <td style={{ padding: '15px' }}>{p.concepto}</td><td style={{ padding: '15px', textAlign: 'center' }}>{p.cantidad}</td><td style={{ padding: '15px', textAlign: 'right' }}>{p.precio.toFixed(2)} €</td><td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold' }}>{(p.cantidad * p.precio).toFixed(2)} €</td><td style={{ padding: '15px', textAlign: 'center' }}><button type="button" onClick={() => quitarPartida(p.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18}/></button></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                              <div style={{ padding: '15px', backgroundColor: '#fafafa', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderTop: '2px solid #1a1a1a' }}>SUBTOTAL A CERTIFICAR: {partidasLibres.reduce((sum, p) => sum + (p.cantidad * p.precio), 0).toFixed(2)} €</div>
                          </div>
                      )}
                  </div>
              ) : ( <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed #cbd5e1', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '40px', color: '#64748b' }}>Selecciona un hotel para empezar a añadir partidas libres.</div> )
          )}

          {/* HISTORIAL */}
          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', borderTop: '1px solid #e5e7eb', paddingTop: '30px' }}>Historial de Certificaciones Emitidas</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', backgroundColor: '#fff', padding: '0 10px' }}><Search size={16} color="#64748b" /><input type="text" placeholder="Buscar por hotel o referencia..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none' }} /></div>
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', paddingRight: '2px' }}>
              {certificacionesFiltradas.length === 0 ? <div style={{ padding: '20px', backgroundColor: '#fff', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>No se han encontrado certificaciones.</div> : (
                  <>
                      {certificacionesFiltradas.slice(0, limiteCertificaciones).map(cert => (
                          <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 20px', borderLeft: cert.modo === 'libre' ? '4px solid #10b981' : '4px solid #1a1a1a' }}>
                              <div style={{ flex: 1 }}>
                                  <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{cert.obra}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>| {cert.fecha}</span> 
                                  <br/>
                                  <span style={{ fontSize: '11px', letterSpacing: '1px' }}>REF: {cert.referencia} | {cert.modo === 'libre' ? `IMPORTE: ${cert.totalImporte?.toFixed(2)}€` : `TOTAL HORAS: ${cert.totalHoras}h`}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <button type="button" onClick={() => setCertPreview(cert)} style={{ background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                                  <span style={{ border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: cert.facturado ? 'white' : '#1a1a1a', backgroundColor: cert.facturado ? '#1a1a1a' : 'transparent' }}>{cert.facturado ? 'FACTURADO' : 'PENDIENTE'}</span>
                                  <button type="button" onClick={() => handleDeleteCert(cert.id, cert.partesIds || [])} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                              </div>
                          </div>
                      ))}
                  </>
              )}
          </div>
      </div>
  );
}