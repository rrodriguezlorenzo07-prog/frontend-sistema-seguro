import React, { useState } from 'react';
import { FileCheck, CheckSquare, Trash2, Eye, Search, Plus, FileText, PenTool } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../firebase';
import { horasTotalesDocumento } from '../../utils/horasDocumento';
import { color } from '../../estilos/tokens';
import Insignia from '../../ui/Insignia';
import Modal from '../../ui/Modal';
import Boton from '../../ui/Boton';
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

  // Mismos valores que el componente Modal de src/ui/.

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
      const horas = horasTotalesDocumento(alb);
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
          const totalHorasCert = albaranesSeleccionadosData.reduce((acc, p) => acc + horasTotalesDocumento(p), 0);

          albaranesSeleccionadosData.forEach(p => {
              const equipo = p.cuadrilla?.length > 0 ? p.cuadrilla.map(c => c.nombre).join(', ') : (p.nombreTrabajador || 'Sin asignar');
              let textoTareas = p.tareasRealizadas?.length > 0 ? p.tareasRealizadas.map(t => `• [${t.ubicacion}]: ${t.descripcion}`).join('\n') : (p.trabajo || 'Sin especificar');
              datosTabla.push([ p.fecha || '', equipo, textoTareas, `${horasTotalesDocumento(p)}h` ]);
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
              <Modal
                  abierto
                  titulo="Detalles de Certificación"
                  onCerrar={() => setCertPreview(null)}
                  ancho="ancho"
                  acciones={<Boton variante="secundario" onClick={() => setCertPreview(null)}>Cerrar</Boton>}
              >
                  <div style={{ fontSize: '13px', color: color.texto, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${color.linea}`, paddingBottom: '15px', marginBottom: '20px' }}> 
                              <div><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: color.textoSuave, fontWeight: 'bold' }}>HOTEL / PROYECTO</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{certPreview.obra}</p></div> 
                              <div style={{ textAlign: 'right' }}><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: color.textoSuave, fontWeight: 'bold' }}>REF / FECHA</p><p style={{ margin: 0, fontSize: '14px' }}>{certPreview.referencia} <br/> {certPreview.fecha}</p></div> 
                          </div> 

                          <div style={{ marginBottom: '25px', display: 'flex', gap: '15px' }}>
                              <div style={{ flex: 1, padding: '15px', backgroundColor: color.fondo, border: `1px solid ${color.petroleo}`, textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: color.textoSuave, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                      {certPreview.modo === 'libre' ? 'Importe Total' : 'Horas Totales'}
                                  </p> 
                                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                                      {certPreview.modo === 'libre' ? `${certPreview.totalImporte?.toFixed(2)} €` : `${certPreview.totalHoras} h`}
                                  </p>
                              </div>
                              {certPreview.modo !== 'libre' && (
                                  <div style={{ flex: 1, padding: '15px', backgroundColor: color.fondo, border: `1px solid ${color.petroleo}`, textAlign: 'center' }}>
                                      <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: color.textoSuave, fontWeight: 'bold', textTransform: 'uppercase' }}>Coste Materiales Extra</p> 
                                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>{calcularTotalMaterialesCert(certPreview).toFixed(2)} €</p>
                                  </div>
                              )}
                          </div> 
                          
                          <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: `1px solid ${color.petroleo}`, paddingBottom: '5px' }}>Desglose de Trabajos</p> 
                          
                          {certPreview.modo === 'libre' ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                      <tr style={{ borderBottom: `2px solid ${color.petroleo}`, textTransform: 'uppercase' }}>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>Concepto</th><th style={{ padding: '8px', textAlign: 'center' }}>Cant.</th><th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {certPreview.partidas?.map((p, idx) => (
                                          <tr key={idx} style={{ borderBottom: `1px solid ${color.linea}` }}>
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
                                          <div key={idx} style={{ padding: '0', backgroundColor: color.superficie, border: `1px solid ${color.linea}`, display: 'flex', flexDirection: 'column' }}> 
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.fondo, padding: '10px 15px', borderBottom: `1px solid ${color.linea}` }}>
                                                  <strong style={{ fontSize: '12px', color: color.texto }}>DÍA: {alb.fecha}</strong>
                                                  <div><span style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '10px' }}>Mat: {costeMatDia.toFixed(2)}€</span><Insignia tono="fuerte">{horasTotalesDocumento(alb)} H</Insignia></div>
                                              </div>
                                              <div style={{ padding: '15px', borderBottom: `1px dashed ${color.linea}` }}>
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
              </Modal>
          )}

          {albaranPreview && (
              <Modal
                  abierto
                  titulo="Vista Previa Albarán"
                  onCerrar={() => setAlbaranPreview(null)}
                  acciones={<Boton variante="secundario" onClick={() => setAlbaranPreview(null)}>Cerrar</Boton>}
              >
                  <div style={{ fontSize: '13px', color: color.texto }}>
                          <p><strong>Proyecto:</strong> {albaranPreview.obra} | <strong>Fecha:</strong> {albaranPreview.fecha}</p>
                          <hr style={{ border: 'none', borderTop: `1px solid ${color.linea}`, margin: '15px 0' }}/>
                          <p><strong>Materiales:</strong></p>
                          {albaranPreview.materialesUsados?.length > 0 ? <ul>{albaranPreview.materialesUsados.map((m, i) => <li key={i}>{m.cantidad}x {m.nombre} ({m.precio||0}€/u)</li>)}</ul> : <p>Ninguno.</p>}
                          <p><strong>Tareas:</strong></p>
                          {albaranPreview.tareasRealizadas?.length > 0 ? <ul>{albaranPreview.tareasRealizadas.map((t, i) => <li key={i}><strong>{t.ubicacion}:</strong> {t.descripcion}</li>)}</ul> : <p>{albaranPreview.trabajo}</p>}
                      </div>
              </Modal>
          )}

          {/* CABECERA PRINCIPAL */}
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Generador de Certificaciones</h3>
          <p style={{ color: color.textoSuave, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '25px' }}>Emite el justificante oficial de la obra para el cobro del hotel.</p>

          {/* BOTONES SELECTORES DE MODO */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => { setModoCert('albaranes'); setPreciosAlbaranes({}); setCertPartesSeleccionados([]); }} style={{ flex: 1, minWidth: '200px', padding: '14px', backgroundColor: modoCert === 'albaranes' ? color.petroleo : color.superficie, color: modoCert === 'albaranes' ? color.textoSobreOscuro : color.textoSuave, border: modoCert === 'albaranes' ? `1px solid ${color.petroleo}` : `1px solid ${color.linea}`, fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                  <FileText size={16} /> Certificar desde Albaranes
              </button>
              <button onClick={() => { setModoCert('libre'); setPreciosAlbaranes({}); setCertPartesSeleccionados([]); }} style={{ flex: 1, minWidth: '200px', padding: '14px', backgroundColor: modoCert === 'libre' ? color.petroleo : color.superficie, color: modoCert === 'libre' ? color.textoSobreOscuro : color.textoSuave, border: modoCert === 'libre' ? `1px solid ${color.petroleo}` : `1px solid ${color.linea}`, fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                  <PenTool size={16} /> Certificación Valorada (Libre)
              </button>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', padding: '20px', backgroundColor: color.fondo, border: `1px solid ${color.linea}`, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px' }}>
                  <label style={labelStyle}>Seleccionar Hotel / Proyecto</label>
                  <select value={certObraSeleccionada} onChange={(e) => { setCertObraSeleccionada(e.target.value); setCertPartesSeleccionados([]); setPreciosAlbaranes({}); }} style={inputStyle}>
                      <option value="">-- Elige un proyecto --</option>
                      {obrasList.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
                  </select>
              </div>
              <button type="button" onClick={generarPDFCertificacion} style={{...btnBlackStyle, height: '43px', backgroundColor: color.exito, boxShadow: '0 4px 6px rgba(47, 124, 135, 0.20)'}}>
                  <FileCheck size={16}/> Generar Documento PDF
              </button>
          </div>

          {/* ÁREA DE TRABAJO DINÁMICA SEGÚN EL MODO */}
          {modoCert === 'albaranes' ? (
              <>
                  {certObraSeleccionada && partesRealesPendientes.length === 0 && <div style={{ textAlign: 'center', padding: '30px', border: `1px dashed ${color.canto}`, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>No hay albaranes pendientes para este hotel.</div>}
                  
                  {certObraSeleccionada && partesRealesPendientes.length > 0 && (
                      <div style={{ marginBottom: '40px' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Paso 1: Selecciona los Albaranes a incluir</h4>
                          
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', padding: '10px', backgroundColor: color.superficieTenida, border: `1px solid ${color.lineaSuave}`, borderRadius: '4px' }}>
                              <div style={{ flex: 2, minWidth: '150px', display: 'flex', alignItems: 'center', backgroundColor: color.superficie, border: `1px solid ${color.canto}`, padding: '0 10px' }}><Search size={14} color={color.canto} /><input type="text" placeholder="Buscar operario..." value={filtroPendientesTexto} onChange={(e) => setFiltroPendientesTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none', fontSize: '12px', padding: '8px' }} /></div>
                          </div>

                          <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
                              {pendientesFiltrados.slice(0, limitePendientes).map(p => (
                                  <div key={p.id} onClick={() => toggleParteCertificacion(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: certPartesSeleccionados.includes(p.id) ? `2px solid ${color.petroleo}` : `1px solid ${color.linea}`, backgroundColor: certPartesSeleccionados.includes(p.id) ? color.fondo : color.superficie, cursor: 'pointer' }}>
                                      <div style={{ width: '20px', height: '20px', border: `2px solid ${color.petroleo}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: certPartesSeleccionados.includes(p.id) ? color.petroleo : 'transparent' }}>{certPartesSeleccionados.includes(p.id) && <CheckSquare size={14} color={color.superficie} />}</div>
                                      <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>FECHA: {p.fecha} <span style={{ color: color.textoSuave, fontWeight: 'normal', marginLeft: '10px' }}>| {horasTotalesDocumento(p)} h</span></div>
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {/* LA TABLA MÁGICA DE PRECIOS */}
                          {certPartesSeleccionados.length > 0 && itemsAValorar.length > 0 && (
                              <div style={{ marginTop: '30px', borderTop: `2px solid ${color.petroleo}`, paddingTop: '20px' }}>
                                  <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>Paso 2: Valorar Tareas y Horas (Opcional)</h4>
                                  <p style={{ margin: '0 0 15px 0', fontSize: '11px', color: color.textoSuave }}>Si dejas los precios en blanco, se generará el PDF clásico de horas. Si escribes un precio, se generará una Certificación Valorada en Euros.</p>
                                  
                                  <div style={{ border: `1px solid ${color.petroleo}` }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                          <thead>
                                              <tr style={{ backgroundColor: color.petroleo, color: color.textoSobreOscuro, textTransform: 'uppercase' }}>
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
                                                      <tr key={item.idKey} style={{ borderBottom: `1px solid ${color.linea}`, backgroundColor: color.superficie }}>
                                                          <td style={{ padding: '12px' }}>{item.concepto}</td>
                                                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{item.cantidad}</td>
                                                          <td style={{ padding: '8px' }}>
                                                              <input type="number" step="0.01" style={{...inputStyle, padding: '8px', fontSize: '12px'}} placeholder="Dejar vacío = 0€" value={preciosAlbaranes[item.idKey] || ''} onChange={(e) => setPreciosAlbaranes({...preciosAlbaranes, [item.idKey]: e.target.value})} />
                                                          </td>
                                                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: precio > 0 ? color.exito : color.petroleo }}>
                                                              {(item.cantidad * precio).toFixed(2)} €
                                                          </td>
                                                      </tr>
                                                  )
                                              })}
                                          </tbody>
                                      </table>
                                      <div style={{ padding: '15px', backgroundColor: color.fondo, textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderTop: `1px solid ${color.petroleo}` }}>
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
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', padding: '20px', backgroundColor: color.superficieTenida, border: `1px solid ${color.lineaSuave}` }}>
                          <input type="text" placeholder="Concepto (Ej: Instalación de 10 puertas...)" value={libConcepto} onChange={e => setLibConcepto(e.target.value)} style={{...inputStyle, flex: 3, minWidth: '200px'}} />
                          <input type="number" placeholder="Cant." value={libCantidad} onChange={e => setLibCantidad(e.target.value)} min="1" style={{...inputStyle, flex: 1, minWidth: '70px'}} />
                          <input type="number" placeholder="Precio Ud. €" step="0.01" value={libPrecio} onChange={e => setLibPrecio(e.target.value)} style={{...inputStyle, flex: 1, minWidth: '100px'}} />
                          <button type="button" onClick={agregarPartida} style={{ padding: '0 20px', backgroundColor: color.petroleo, color: color.textoSobreOscuro, border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Plus size={18}/> Añadir
                          </button>
                      </div>
                      
                      {partidasLibres.length > 0 && (
                          <div style={{ border: `1px solid ${color.petroleo}` }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                  <thead>
                                      <tr style={{ backgroundColor: color.petroleo, color: color.textoSobreOscuro, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '11px' }}>
                                          <th style={{ padding: '15px', textAlign: 'left' }}>Concepto</th><th style={{ padding: '15px', textAlign: 'center' }}>Cant.</th><th style={{ padding: '15px', textAlign: 'right' }}>Precio Ud.</th><th style={{ padding: '15px', textAlign: 'right' }}>Total</th><th style={{ padding: '15px', textAlign: 'center' }}></th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {partidasLibres.map((p, idx) => (
                                          <tr key={idx} style={{ borderBottom: `1px solid ${color.linea}`, backgroundColor: color.superficie }}>
                                              <td style={{ padding: '15px' }}>{p.concepto}</td><td style={{ padding: '15px', textAlign: 'center' }}>{p.cantidad}</td><td style={{ padding: '15px', textAlign: 'right' }}>{p.precio.toFixed(2)} €</td><td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold' }}>{(p.cantidad * p.precio).toFixed(2)} €</td><td style={{ padding: '15px', textAlign: 'center' }}><button type="button" onClick={() => quitarPartida(p.id)} style={{ color: color.error, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18}/></button></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                              <div style={{ padding: '15px', backgroundColor: color.fondo, textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderTop: `2px solid ${color.petroleo}` }}>SUBTOTAL A CERTIFICAR: {partidasLibres.reduce((sum, p) => sum + (p.cantidad * p.precio), 0).toFixed(2)} €</div>
                          </div>
                      )}
                  </div>
              ) : ( <div style={{ textAlign: 'center', padding: '40px', border: `1px dashed ${color.canto}`, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '40px', color: color.textoSuave }}>Selecciona un hotel para empezar a añadir partidas libres.</div> )
          )}

          {/* HISTORIAL */}
          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', borderTop: `1px solid ${color.linea}`, paddingTop: '30px' }}>Historial de Certificaciones Emitidas</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, padding: '0 10px' }}><Search size={16} color={color.textoSuave} /><input type="text" placeholder="Buscar por hotel o referencia..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none' }} /></div>
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: color.linea, border: `1px solid ${color.linea}`, paddingRight: '2px' }}>
              {certificacionesFiltradas.length === 0 ? <div style={{ padding: '20px', backgroundColor: color.superficie, textAlign: 'center', fontSize: '12px', color: color.textoSuave }}>No se han encontrado certificaciones.</div> : (
                  <>
                      {certificacionesFiltradas.slice(0, limiteCertificaciones).map(cert => (
                          <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.superficie, padding: '15px 20px', borderLeft: cert.modo === 'libre' ? `4px solid ${color.exito}` : `4px solid ${color.petroleo}` }}>
                              <div style={{ flex: 1 }}>
                                  <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{cert.obra}</strong> <span style={{ fontSize: '11px', color: color.textoSuave }}>| {cert.fecha}</span> 
                                  <br/>
                                  <span style={{ fontSize: '11px', letterSpacing: '1px' }}>REF: {cert.referencia} | {cert.modo === 'libre' ? `IMPORTE: ${cert.totalImporte?.toFixed(2)}€` : `TOTAL HORAS: ${cert.totalHoras}h`}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <button type="button" onClick={() => setCertPreview(cert)} style={{ background: 'transparent', border: `1px solid ${color.petroleo}`, color: color.texto, padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                                  <span style={{ border: `1px solid ${color.petroleo}`, padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: cert.facturado ? color.textoSobreOscuro : color.petroleo, backgroundColor: cert.facturado ? color.petroleo : 'transparent' }}>{cert.facturado ? 'FACTURADO' : 'PENDIENTE'}</span>
                                  <button type="button" onClick={() => handleDeleteCert(cert.id, cert.partesIds || [])} style={{ color: color.texto, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                              </div>
                          </div>
                      ))}
                  </>
              )}
          </div>
      </div>
  );
}