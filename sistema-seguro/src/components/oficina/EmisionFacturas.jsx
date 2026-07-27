import React, { useState } from 'react';
import { CreditCard, CheckSquare, Trash2, Eye, X, Search } from 'lucide-react';

export default function EmisionFacturas({ blockStyle, labelStyle, inputStyle, btnBlackStyle, modoFacturacion, setModoFacturacion, setItemsAFacturar, facturaCliente, setFacturaCliente, facTarifaHora, setFacTarifaHora, facImporteMateriales, setFacImporteMateriales, partesHistorial, certificacionesList, itemsAFacturar, toggleItemFacturacion, generarPDFFactura, facturasList, borrarFactura }) {
  
  const [certPreview, setCertPreview] = useState(null);
  const [albaranPreview, setAlbaranPreview] = useState(null);
  const [facturaPreview, setFacturaPreview] = useState(null);

  // FILTROS PARA EL HISTORIAL
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  // FILTROS PARA LOS PENDIENTES
  const [filtroPendientesTexto, setFiltroPendientesTexto] = useState('');
  const [filtroPendientesDesde, setFiltroPendientesDesde] = useState('');
  const [filtroPendientesHasta, setFiltroPendientesHasta] = useState('');

  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box' };
  const modalBoxStyle = { backgroundColor: '#fff', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #1a1a1a', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
  const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10 };
  const btnCloseStyle = { padding: '12px 20px', background: '#1a1a1a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' };

  // 1. LÓGICA DE FILTRADO PARA HISTORIAL DE FACTURAS
  const facturasFiltradas = facturasList.filter(fac => {
      let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
      if (filtroTexto) {
          const texto = filtroTexto.toLowerCase();
          coincideTexto = (fac.cliente && fac.cliente.toLowerCase().includes(texto)) || (fac.referencia && fac.referencia.toLowerCase().includes(texto));
      }
      const tsItem = fac.timestamp || (fac.fecha ? new Date(fac.fecha.split('/').reverse().join('-')).getTime() : 0);
      if (filtroDesde) coincideDesde = tsItem >= new Date(filtroDesde).getTime();
      if (filtroHasta) coincideHasta = tsItem <= (new Date(filtroHasta).getTime() + 86400000);
      return coincideTexto && coincideDesde && coincideHasta;
  });

  // 2. LÓGICA DE FILTRADO PARA ELEMENTOS PENDIENTES
  const filtrarPendientes = (lista) => {
      return lista.filter(item => {
          let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
          if (filtroPendientesTexto) {
              const texto = filtroPendientesTexto.toLowerCase();
              coincideTexto = (item.obra && item.obra.toLowerCase().includes(texto)) || (item.referencia && item.referencia.toLowerCase().includes(texto));
          }
          const tsItem = item.timestamp || (item.fecha ? new Date(item.fecha.split('/').reverse().join('-')).getTime() : 0);
          if (filtroPendientesDesde) coincideDesde = tsItem >= new Date(filtroPendientesDesde).getTime();
          if (filtroPendientesHasta) coincideHasta = tsItem <= (new Date(filtroPendientesHasta).getTime() + 86400000);
          return coincideTexto && coincideDesde && coincideHasta;
      });
  };

  const albaranesPendientes = filtrarPendientes(partesHistorial.filter(p => !p.certificado && !p.facturado));
  const certificacionesPendientes = filtrarPendientes(certificacionesList.filter(c => !c.facturado));

  return (
      <div style={blockStyle}>
          
          {/* MODALES DE VISTA PREVIA (Omitidos los interiores por brevedad en el texto, pero son los mismos) */}
          {certPreview && ( <div style={modalOverlayStyle}> <div style={modalBoxStyle}> <div style={modalHeaderStyle}> <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Vista Previa - Certificación</h3> <button type="button" onClick={() => setCertPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button> </div> <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a' }}> <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '15px' }}> <div><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Proyecto / Obra</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{certPreview.obra}</p></div> <div style={{ textAlign: 'right' }}><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Referencia</p><p style={{ margin: 0, fontSize: '14px' }}>{certPreview.referencia}</p></div> </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Resumen de Horas Totales</p> <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', fontSize: '16px', fontWeight: 'bold' }}>{certPreview.totalHoras} h</p> </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 10px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Albaranes Incluidos</p> <ul style={{ margin: 0, padding: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}> {certPreview.albaranes && certPreview.albaranes.map((alb, idx) => ( <li key={idx} style={{ padding: '10px', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', fontSize: '12px' }}> <strong>{alb.fecha}</strong> - {alb.trabajo ? alb.trabajo.substring(0, 50) + '...' : 'Sin notas'} <strong style={{ float: 'right' }}>{alb.horas || alb.horasTotales || 0}h</strong> </li> ))} </ul> </div> </div> <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafafa', position: 'sticky', bottom: 0 }}> <button type="button" onClick={() => setCertPreview(null)} style={btnCloseStyle}>Cerrar</button> </div> </div> </div> )}
          {albaranPreview && ( <div style={modalOverlayStyle}> <div style={modalBoxStyle}> <div style={modalHeaderStyle}> <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Vista Previa - Albarán</h3> <button type="button" onClick={() => setAlbaranPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button> </div> <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a' }}> <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '15px' }}> <div><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Proyecto</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{albaranPreview.obra}</p></div> <div style={{ textAlign: 'right' }}><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Fecha</p><p style={{ margin: 0, fontSize: '14px' }}>{albaranPreview.fecha}</p></div> </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Personal Asignado</p> <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a' }}>{albaranPreview.cuadrilla?.length > 0 ? albaranPreview.cuadrilla.map(c=>`${c.nombre} (${c.horas}h)`).join(' - ') : albaranPreview.nombreTrabajador}</p> </div> {albaranPreview.materialesUsados && albaranPreview.materialesUsados.length > 0 && ( <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Material Empleado</p> <ul style={{ margin: 0, padding: '10px 10px 10px 25px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a' }}> {albaranPreview.materialesUsados.map((m, i) => <li key={i}>{m.cantidad}x {m.nombre}</li>)} </ul> </div> )} <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Trabajo Realizado</p> <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', whiteSpace: 'pre-wrap' }}>{albaranPreview.trabajo || 'Sin notas'}</p> </div> </div> <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafafa', position: 'sticky', bottom: 0 }}> <button type="button" onClick={() => setAlbaranPreview(null)} style={btnCloseStyle}>Cerrar</button> </div> </div> </div> )}
          {facturaPreview && ( <div style={modalOverlayStyle}> <div style={modalBoxStyle}> <div style={modalHeaderStyle}> <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Detalles de Factura</h3> <button type="button" onClick={() => setFacturaPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}><X size={20}/></button> </div> <div style={{ padding: '30px', fontSize: '13px', color: '#1a1a1a' }}> <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '15px' }}> <div><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Cliente Facturado</p><p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{facturaPreview.cliente}</p></div> <div style={{ textAlign: 'right' }}><p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>REF / Fecha</p><p style={{ margin: 0, fontSize: '14px' }}>{facturaPreview.referencia} <br/> {facturaPreview.fecha}</p></div> </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Importe Total</p> <p style={{ margin: 0, padding: '15px', backgroundColor: '#fafafa', border: '2px solid #1a1a1a', fontSize: '20px', fontWeight: 'bold', textAlign: 'center' }}>{facturaPreview.total?.toFixed(2)} €</p> </div> <div style={{ marginBottom: '20px' }}> <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Tipo de Facturación</p> <p style={{ margin: 0, padding: '10px', backgroundColor: '#fafafa', border: '1px solid #1a1a1a', textTransform: 'uppercase' }}>Basada en: {facturaPreview.modo === 'albaranes' ? 'Albaranes Sueltos' : 'Certificaciones de Obra'} ({facturaPreview.items?.length || 0} elementos)</p> </div> </div> <div style={{ padding: '20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafafa', position: 'sticky', bottom: 0 }}> <button type="button" onClick={() => setFacturaPreview(null)} style={btnCloseStyle}>Cerrar</button> </div> </div> </div> )}


          {/* === PANEL DE EMISIÓN === */}
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Emisión de Facturas</h3>
          <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '30px' }}>Factura directamente Albaranes sueltos o Certificaciones completas.</p>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap', backgroundColor: '#fafafa', padding: '20px', border: '1px solid #e5e7eb' }}>
              <div style={{ flex: '100%', display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button type="button" onClick={() => { setModoFacturacion('albaranes'); setItemsAFacturar([]); }} style={{ flex: 1, padding: '12px', border: '1px solid #1a1a1a', background: modoFacturacion === 'albaranes' ? '#1a1a1a' : 'transparent', color: modoFacturacion === 'albaranes' ? 'white' : '#1a1a1a', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Facturar Albaranes Sueltos</button>
                  <button type="button" onClick={() => { setModoFacturacion('certificaciones'); setItemsAFacturar([]); }} style={{ flex: 1, padding: '12px', border: '1px solid #1a1a1a', background: modoFacturacion === 'certificaciones' ? '#1a1a1a' : 'transparent', color: modoFacturacion === 'certificaciones' ? 'white' : '#1a1a1a', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Facturar Certificaciones</button>
              </div>
              <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Cliente a facturar</label><input type="text" value={facturaCliente} onChange={(e) => setFacturaCliente(e.target.value)} placeholder="Razón social..." style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Tarifa por Hora (€)</label><input type="number" value={facTarifaHora} onChange={(e) => setFacTarifaHora(e.target.value)} placeholder="Ej: 25.50" style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Material Extra (€)</label><input type="number" value={facImporteMateriales} onChange={(e) => setFacImporteMateriales(e.target.value)} placeholder="Ej: 150.00" style={inputStyle} /></div>
          </div>

          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>{modoFacturacion === 'albaranes' ? 'Albaranes pendientes:' : 'Certificaciones pendientes:'}</h4>
          
          {/* === NUEVA BARRA DE FILTRO PARA LOS PENDIENTES === */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <div style={{ flex: 2, minWidth: '150px', display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '0 10px' }}>
                  <Search size={14} color="#94a3b8" />
                  <input type="text" placeholder="Buscar por obra o referencia..." value={filtroPendientesTexto} onChange={(e) => setFiltroPendientesTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none', fontSize: '12px', padding: '8px' }} />
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

          {/* LISTA DE PENDIENTES FILTRADA */}
          <div style={{ display: 'grid', gap: '10px', marginBottom: '30px' }}>
              {modoFacturacion === 'albaranes' ? (
                  albaranesPendientes.length === 0 ? <div style={{ fontSize: '12px', color: '#64748b', padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #cbd5e1' }}>No hay albaranes libres que coincidan con la búsqueda.</div> :
                  albaranesPendientes.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: itemsAFacturar.includes(p.id) ? '2px solid #1a1a1a' : '1px solid #e5e7eb', backgroundColor: itemsAFacturar.includes(p.id) ? '#fafafa' : '#ffffff' }}>
                          <div onClick={() => toggleItemFacturacion(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, cursor: 'pointer' }}>
                              <div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: itemsAFacturar.includes(p.id) ? '#1a1a1a' : 'transparent' }}>{itemsAFacturar.includes(p.id) && <CheckSquare size={14} color="#ffffff" />}</div>
                              <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{p.obra} <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>| {p.fecha}</span></div>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>HORAS: {p.horasTotales || p.horas || 0}h</div>
                              </div>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setAlbaranPreview(p); }} style={{ background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                      </div>
                  ))
              ) : (
                  certificacionesPendientes.length === 0 ? <div style={{ fontSize: '12px', color: '#64748b', padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #cbd5e1' }}>No hay certificaciones pendientes que coincidan con la búsqueda.</div> :
                  certificacionesPendientes.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: itemsAFacturar.includes(c.id) ? '2px solid #1a1a1a' : '1px solid #e5e7eb', backgroundColor: itemsAFacturar.includes(c.id) ? '#fafafa' : '#ffffff' }}>
                          <div onClick={() => toggleItemFacturacion(c.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, cursor: 'pointer' }}>
                              <div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: itemsAFacturar.includes(c.id) ? '#1a1a1a' : 'transparent' }}>{itemsAFacturar.includes(c.id) && <CheckSquare size={14} color="#ffffff" />}</div>
                              <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>CERT. REF: {c.referencia} <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>| Proyecto: {c.obra}</span></div>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>TOTAL HORAS: {c.totalHoras}h</div>
                              </div>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setCertPreview(c); }} style={{ background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                      </div>
                  ))
              )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
              <button type="button" onClick={(e) => generarPDFFactura(e)} style={{...btnBlackStyle, padding: '15px 30px', fontSize: '13px'}}><CreditCard size={18}/> Emitir Factura Oficial</button>
          </div>

          {/* === HISTORIAL === */}
          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', borderTop: '1px solid #e5e7eb', paddingTop: '30px' }}>Registro de Facturas Emitidas</h4>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', backgroundColor: '#fff', padding: '0 10px' }}>
                  <Search size={16} color="#64748b" />
                  <input type="text" placeholder="Buscar por cliente o referencia..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none' }} />
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
              {facturasFiltradas.length === 0 ? <div style={{ padding: '20px', backgroundColor: '#fff', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>No se han encontrado facturas con estos filtros.</div> : facturasFiltradas.map(fac => (
                  <div key={fac.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 20px' }}>
                      <div style={{ flex: 1 }}><strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{fac.cliente}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>| {fac.fecha}</span> <br/><span style={{ fontSize: '11px', letterSpacing: '1px' }}>REF: {fac.referencia} | TOTAL: {fac.total?.toFixed(2)} €</span></div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button type="button" onClick={() => setFacturaPreview(fac)} style={{ border: '1px solid #1a1a1a', padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                          <span style={{ border: '1px solid #1a1a1a', backgroundColor: '#1a1a1a', color: '#fff', padding: '6px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Contabilizado</span>
                          <button type="button" onClick={() => borrarFactura(fac)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }} title="Anular y borrar factura"><Trash2 size={18}/></button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );
}