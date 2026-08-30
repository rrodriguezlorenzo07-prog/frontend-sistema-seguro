import React, { useState } from 'react';
import { CreditCard, CheckSquare, Trash2, Eye, Search } from 'lucide-react';
import { horasTotalesDocumento } from '../../utils/horasDocumento';
import { color } from '../../estilos/tokens';
import Insignia from '../../ui/Insignia';
import Modal from '../../ui/Modal';
import Boton from '../../ui/Boton';

export default function EmisionFacturas({ blockStyle, labelStyle, inputStyle, btnBlackStyle, modoFacturacion, setModoFacturacion, setItemsAFacturar, facturaCliente, setFacturaCliente, facTarifaHora, setFacTarifaHora, facImporteMateriales, setFacImporteMateriales, partesHistorial, certificacionesList, itemsAFacturar, toggleItemFacturacion, generarPDFFactura, facturasList, borrarFactura }) {
  
  const [certPreview, setCertPreview] = useState(null);
  const [albaranPreview, setAlbaranPreview] = useState(null);
  const [facturaPreview, setFacturaPreview] = useState(null);
  const [limiteFacturas, setLimiteFacturas] = useState(15);
  const [limitePendientes, setLimitePendientes] = useState(15);
  const [filtroTexto, setFiltroTexto] = useState(''); const [filtroDesde, setFiltroDesde] = useState(''); const [filtroHasta, setFiltroHasta] = useState('');
  const [filtroPendientesTexto, setFiltroPendientesTexto] = useState(''); const [filtroPendientesDesde, setFiltroPendientesDesde] = useState(''); const [filtroPendientesHasta, setFiltroPendientesHasta] = useState('');

  // Mismos valores que el componente Modal de src/ui/. Este modal conserva su
  // estructura propia —cabecera pegajosa y cuerpo con scroll— y solo cambia de aspecto;
  // unificarlo con la primitiva es trabajo aparte.

  const facturasFiltradas = facturasList.filter(fac => {
      let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
      if (filtroTexto) { const texto = filtroTexto.toLowerCase(); coincideTexto = (fac.cliente && fac.cliente.toLowerCase().includes(texto)) || (fac.referencia && fac.referencia.toLowerCase().includes(texto)); }
      const tsItem = fac.timestamp || (fac.fecha ? new Date(fac.fecha.split('/').reverse().join('-')).getTime() : 0);
      if (filtroDesde) coincideDesde = tsItem >= new Date(filtroDesde).getTime();
      if (filtroHasta) coincideHasta = tsItem <= (new Date(filtroHasta).getTime() + 86400000);
      return coincideTexto && coincideDesde && coincideHasta;
  });

  const filtrarPendientes = (lista) => {
      return lista.filter(item => {
          let coincideTexto = true; let coincideDesde = true; let coincideHasta = true;
          if (filtroPendientesTexto) { const texto = filtroPendientesTexto.toLowerCase(); coincideTexto = (item.obra && item.obra.toLowerCase().includes(texto)) || (item.referencia && item.referencia.toLowerCase().includes(texto)); }
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
          
          {/* MODAL ALBARÁN */}
          {albaranPreview && (
              <Modal
                  abierto
                  titulo="Vista Previa Albarán"
                  onCerrar={() => setAlbaranPreview(null)}
                  acciones={<Boton variante="secundario" onClick={() => setAlbaranPreview(null)}>Cerrar</Boton>}
              >
                  <div style={{ fontSize: '13px' }}>
                          <p><strong>Proyecto:</strong> {albaranPreview.obra} | <strong>Fecha:</strong> {albaranPreview.fecha}</p>
                          <hr style={{ border: 'none', borderTop: `1px solid ${color.linea}`, margin: '15px 0' }}/>
                          <p><strong>Materiales y Costes ({(albaranPreview.materialesUsados?.reduce((sum, m) => sum + (m.cantidad * parseFloat(m.precio||0)), 0) || 0).toFixed(2)} €):</strong></p>
                          {albaranPreview.materialesUsados?.length > 0 ? (
                              <ul>{albaranPreview.materialesUsados.map((m, i) => <li key={i}>{m.cantidad}x {m.nombre} ({m.precio||0}€/u)</li>)}</ul>
                          ) : <p>Ninguno.</p>}
                          <p><strong>Tareas y Habitaciones:</strong></p>
                          {albaranPreview.tareasRealizadas?.length > 0 ? (
                              <ul>{albaranPreview.tareasRealizadas.map((t, i) => <li key={i}><strong>{t.ubicacion}:</strong> {t.descripcion}</li>)}</ul>
                          ) : <p>{albaranPreview.trabajo}</p>}
                      </div>
              </Modal>
          )}

          {/* MODAL CERTIFICACIÓN ADAPTADO PARA EL MODO LIBRE Y ALBARANES */}
          {certPreview && ( 
              <Modal
                  abierto
                  titulo="Detalles de Certificación"
                  onCerrar={() => setCertPreview(null)}
                  ancho="ancho"
                  acciones={<Boton variante="secundario" onClick={() => setCertPreview(null)}>Cerrar</Boton>}
              >
                  <div style={{ fontSize: '13px' }}>
                          <p><strong>HOTEL / PROYECTO:</strong> {certPreview.obra}</p>
                          
                          {certPreview.modo === 'libre' ? (
                              <p style={{ fontSize: '16px' }}><strong>IMPORTE TOTAL:</strong> <span style={{ backgroundColor: color.petroleo, color: color.textoSobreOscuro, padding: '4px 8px' }}>{certPreview.totalImporte?.toFixed(2)} €</span></p>
                          ) : (
                              <p><strong>TOTAL HORAS:</strong> {certPreview.totalHoras} h | <strong>TOTAL MATERIALES:</strong> {(certPreview.albaranes?.reduce((total, alb) => total + (alb.materialesUsados?.reduce((sum, m) => sum + (parseFloat(m.cantidad||0)*parseFloat(m.precio||0)), 0)||0), 0) || 0).toFixed(2)} €</p>
                          )}
                          
                          <hr style={{ border: 'none', borderTop: `1px solid ${color.petroleo}`, margin: '15px 0' }}/>
                          <p><strong>Desglose de Trabajos:</strong></p>
                          
                          {certPreview.modo === 'libre' ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                      <tr style={{ borderBottom: `2px solid ${color.petroleo}`, textTransform: 'uppercase' }}>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>Concepto</th>
                                          <th style={{ padding: '8px', textAlign: 'center' }}>Cant.</th>
                                          <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {certPreview.partidas?.map((p, idx) => (
                                          <tr key={idx} style={{ borderBottom: `1px solid ${color.linea}` }}>
                                              <td style={{ padding: '8px' }}>{p.concepto}</td>
                                              <td style={{ padding: '8px', textAlign: 'center' }}>{p.cantidad}</td>
                                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{(p.cantidad * p.precio).toFixed(2)} €</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}> 
                                  {certPreview.albaranes?.map((alb, idx) => ( 
                                      <div key={idx} style={{ padding: '10px', backgroundColor: color.fondo, border: `1px solid ${color.linea}` }}> 
                                          <strong>DÍA: {alb.fecha}</strong> ({horasTotalesDocumento(alb)} h)
                                          {alb.tareasRealizadas?.length > 0 ? (
                                              <ul style={{ margin: '5px 0 0 20px', fontSize: '12px' }}>{alb.tareasRealizadas.map((t, i) => <li key={i}><strong>{t.ubicacion}:</strong> {t.descripcion}</li>)}</ul>
                                          ) : <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>{alb.trabajo}</p>}
                                      </div> 
                                  ))} 
                              </div>
                          )}
                      </div> 
              </Modal>
          )}

          {/* MODAL FACTURA */}
          {facturaPreview && (
              <Modal
                  abierto
                  titulo="Detalles de Factura"
                  onCerrar={() => setFacturaPreview(null)}
                  ancho="estrecho"
                  acciones={<Boton variante="secundario" onClick={() => setFacturaPreview(null)}>Cerrar</Boton>}
              >
                  <div style={{ fontSize: '13px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: color.textoSuave, fontWeight: 'bold', textTransform: 'uppercase' }}>Cliente Facturado</p>
                          <p style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>{facturaPreview.cliente}</p>
                          
                          <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: color.textoSuave, fontWeight: 'bold', textTransform: 'uppercase' }}>Importe Total Emitido</p>
                          <p style={{ margin: '0 0 20px 0', padding: '15px', backgroundColor: color.fondo, border: `2px solid ${color.petroleo}`, fontSize: '24px', fontWeight: 'bold' }}>{facturaPreview.total?.toFixed(2)} €</p>
                          
                          <p><strong>Modalidad:</strong> {facturaPreview.modo === 'albaranes' ? 'Albaranes Sueltos' : 'Certificaciones de Obra'} ({facturaPreview.items?.length || 0} docs)</p>
                      </div>
              </Modal>
          )}

          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Emisión de Facturas</h3>
          <p style={{ color: color.textoSuave, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '30px' }}>Factura directamente Albaranes sueltos o Certificaciones completas.</p>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap', backgroundColor: color.fondo, padding: '20px', border: `1px solid ${color.linea}` }}>
              <div style={{ flex: '100%', display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button type="button" onClick={() => { setModoFacturacion('albaranes'); setItemsAFacturar([]); }} style={{ flex: 1, padding: '12px', border: `1px solid ${color.petroleo}`, background: modoFacturacion === 'albaranes' ? color.petroleo : 'transparent', color: modoFacturacion === 'albaranes' ? color.textoSobreOscuro : color.petroleo, fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Facturar Albaranes Sueltos</button>
                  <button type="button" onClick={() => { setModoFacturacion('certificaciones'); setItemsAFacturar([]); }} style={{ flex: 1, padding: '12px', border: `1px solid ${color.petroleo}`, background: modoFacturacion === 'certificaciones' ? color.petroleo : 'transparent', color: modoFacturacion === 'certificaciones' ? color.textoSobreOscuro : color.petroleo, fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Facturar Certificaciones</button>
              </div>
              <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Cliente a facturar</label><input type="text" value={facturaCliente} onChange={(e) => setFacturaCliente(e.target.value)} placeholder="Razón social..." style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Tarifa por Hora (€)</label><input type="number" value={facTarifaHora} onChange={(e) => setFacTarifaHora(e.target.value)} placeholder="Ej: 25.50" style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Material Extra (€)</label><input type="number" value={facImporteMateriales} onChange={(e) => setFacImporteMateriales(e.target.value)} placeholder="Ej: 150.00" style={inputStyle} /></div>
          </div>

          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>{modoFacturacion === 'albaranes' ? 'Albaranes pendientes:' : 'Certificaciones pendientes:'}</h4>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', padding: '10px', backgroundColor: color.superficieTenida, border: `1px solid ${color.lineaSuave}`, borderRadius: '4px' }}>
              <div style={{ flex: 2, minWidth: '150px', display: 'flex', alignItems: 'center', backgroundColor: color.superficie, border: `1px solid ${color.canto}`, padding: '0 10px' }}><Search size={14} color={color.canto} /><input type="text" placeholder="Buscar..." value={filtroPendientesTexto} onChange={(e) => setFiltroPendientesTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none', fontSize: '12px', padding: '8px' }} /></div>
              <div style={{ flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', gap: '5px' }}><label style={{ fontSize: '10px', color: color.textoSuave, fontWeight: 'bold' }}>DESDE</label><input type="date" value={filtroPendientesDesde} onChange={(e) => setFiltroPendientesDesde(e.target.value)} style={{...inputStyle, padding: '6px', fontSize: '11px'}} /></div>
              <div style={{ flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', gap: '5px' }}><label style={{ fontSize: '10px', color: color.textoSuave, fontWeight: 'bold' }}>HASTA</label><input type="date" value={filtroPendientesHasta} onChange={(e) => setFiltroPendientesHasta(e.target.value)} style={{...inputStyle, padding: '6px', fontSize: '11px'}} /></div>
          </div>

          <div onScroll={(e) => { if (filtroPendientesTexto || filtroPendientesDesde || filtroPendientesHasta) return; const { scrollTop, clientHeight, scrollHeight } = e.currentTarget; if (scrollHeight - scrollTop <= clientHeight + 30) { if (limitePendientes < (modoFacturacion === 'albaranes' ? albaranesPendientes.length : certificacionesPendientes.length)) setLimitePendientes(prev => prev + 10); } }} style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px', paddingRight: '5px' }}>
              {(() => {
                  const listaActiva = modoFacturacion === 'albaranes' ? albaranesPendientes : certificacionesPendientes;
                  if (listaActiva.length === 0) return <div style={{ fontSize: '12px', color: color.textoSuave, padding: '20px', textAlign: 'center', backgroundColor: color.fondo, border: `1px dashed ${color.canto}` }}>No hay documentos pendientes.</div>;
                  return (filtroPendientesTexto || filtroPendientesDesde || filtroPendientesHasta ? listaActiva : listaActiva.slice(0, limitePendientes)).map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: itemsAFacturar.includes(item.id) ? `2px solid ${color.petroleo}` : `1px solid ${color.linea}`, backgroundColor: itemsAFacturar.includes(item.id) ? color.fondo : color.superficie, borderLeft: item.modo === 'libre' ? `4px solid ${color.exito}` : (itemsAFacturar.includes(item.id) ? `4px solid ${color.petroleo}` : `1px solid ${color.linea}`) }}>
                          <div onClick={() => toggleItemFacturacion(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, cursor: 'pointer' }}>
                              <div style={{ width: '20px', height: '20px', border: `2px solid ${color.petroleo}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: itemsAFacturar.includes(item.id) ? color.petroleo : 'transparent' }}>{itemsAFacturar.includes(item.id) && <CheckSquare size={14} color={color.superficie} />}</div>
                              <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.obra || `CERT: ${item.referencia}`} <span style={{ color: color.textoSuave, fontWeight: 'normal', marginLeft: '10px' }}>| {item.fecha || ''}</span></div>
                                  <div style={{ fontSize: '11px', color: color.textoSuave, marginTop: '4px' }}>
                                      {item.modo === 'libre' ? `IMPORTE CERTIFICADO: ${item.totalImporte?.toFixed(2)} €` : `HORAS: ${item.horasTotales || item.totalHoras || item.horas || 0}h`}
                                  </div>
                              </div>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); modoFacturacion === 'albaranes' ? setAlbaranPreview(item) : setCertPreview(item); }} style={{ background: 'transparent', border: `1px solid ${color.petroleo}`, color: color.texto, padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                      </div>
                  ));
              })()}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}><button type="button" onClick={(e) => generarPDFFactura(e)} style={{...btnBlackStyle, padding: '15px 30px', fontSize: '13px', backgroundColor: color.exito, boxShadow: '0 4px 6px rgba(47, 124, 135, 0.20)'}}><CreditCard size={18}/> Emitir Factura Oficial</button></div>

          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', borderTop: `1px solid ${color.linea}`, paddingTop: '30px' }}>Registro de Facturas Emitidas</h4>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, padding: '0 10px' }}><Search size={16} color={color.textoSuave} /><input type="text" placeholder="Buscar..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ ...inputStyle, border: 'none', boxShadow: 'none' }} /></div>
              <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: '10px', color: color.textoSuave, fontWeight: 'bold' }}>Desde</label><input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: '10px', color: color.textoSuave, fontWeight: 'bold' }}>Hasta</label><input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} style={inputStyle} /></div>
          </div>

          <div onScroll={(e) => { if (filtroTexto || filtroDesde || filtroHasta) return; const { scrollTop, clientHeight, scrollHeight } = e.currentTarget; if (scrollHeight - scrollTop <= clientHeight + 30) { if (limiteFacturas < facturasFiltradas.length) setLimiteFacturas(prev => prev + 10); } }} style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: color.linea, border: `1px solid ${color.linea}`, paddingRight: '2px' }}>
              {facturasFiltradas.length === 0 ? <div style={{ padding: '20px', backgroundColor: color.superficie, textAlign: 'center', fontSize: '12px', color: color.textoSuave }}>No se han encontrado facturas.</div> : (
                  <>
                      {(filtroTexto || filtroDesde || filtroHasta ? facturasFiltradas : facturasFiltradas.slice(0, limiteFacturas)).map(fac => (
                          <div key={fac.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.superficie, padding: '15px 20px' }}>
                              <div style={{ flex: 1 }}><strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{fac.cliente}</strong> <span style={{ fontSize: '11px', color: color.textoSuave }}>| {fac.fecha}</span> <br/><span style={{ fontSize: '11px', letterSpacing: '1px' }}>REF: {fac.referencia} | TOTAL: {fac.total?.toFixed(2)} €</span></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <button type="button" onClick={() => setFacturaPreview(fac)} style={{ border: `1px solid ${color.petroleo}`, padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Detalles</button>
                                  <Insignia tono="fuerte">Contabilizado</Insignia>
                                  <button type="button" onClick={() => borrarFactura(fac)} style={{ color: color.texto, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18}/></button>
                              </div>
                          </div>
                      ))}
                      {!(filtroTexto || filtroDesde || filtroHasta) && limiteFacturas < facturasFiltradas.length && <div onClick={() => setLimiteFacturas(prev => prev + 10)} style={{ padding: '12px', backgroundColor: color.fondo, textAlign: 'center', fontSize: '10px', color: color.textoSuave, cursor: 'pointer' }}>Desliza hacia abajo o pulsa aquí para cargar más...</div>}
                  </>
              )}
          </div>
      </div>
  );
}