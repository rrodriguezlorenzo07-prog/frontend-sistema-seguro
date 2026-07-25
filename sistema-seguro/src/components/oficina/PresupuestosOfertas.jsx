import React from 'react';
import { Download, Trash2 } from 'lucide-react';

export default function PresupuestosOfertas({ blockStyle, btnBlackStyle, labelStyle, inputStyle, guardarYValidarPresupuesto, presuCliente, setPresuCliente, presuSelectMat, setPresuSelectMat, presuCantMat, setPresuCantMat, presuPrecioMat, setPresuPrecioMat, agregarItemPresupuesto, presuItems, quitarItemPresupuesto, presuHoras, setPresuHoras, presuPrecioHora, setPresuPrecioHora, presupuestosList, descargarPresupuestoExistente, cambiarEstadoPresupuesto, borrarPresupuesto }) {
  return (
      <div style={blockStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Presupuestos y Ofertas</h3>
              <button onClick={guardarYValidarPresupuesto} style={btnBlackStyle}>Emitir Documento</button>
          </div>
          
          <div style={{ marginBottom: '25px' }}>
              <label style={labelStyle}>Cliente / Entidad Receptora</label>
              <input type="text" value={presuCliente} onChange={(e) => setPresuCliente(e.target.value)} placeholder="Razón social..." style={inputStyle} />
          </div>
          
          <div style={{ padding: 'clamp(15px, 3vw, 20px)', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Líneas de Facturación</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input type="text" list="presupuesto-materiales" value={presuSelectMat} onChange={(e) => setPresuSelectMat(e.target.value)} placeholder="Concepto" style={{...inputStyle, flex: 3, minWidth: '150px'}} />
                  <input type="number" value={presuCantMat} onChange={(e) => setPresuCantMat(e.target.value)} placeholder="Cant." style={{...inputStyle, flex: 1, minWidth: '80px'}} />
                  <input type="number" value={presuPrecioMat} onChange={(e) => setPresuPrecioMat(e.target.value)} placeholder="Precio Ud. (€)" style={{...inputStyle, flex: 1, minWidth: '100px'}} />
                  <button onClick={agregarItemPresupuesto} style={btnBlackStyle}>Añadir</button>
              </div>
              
              {presuItems.length > 0 && ( 
                  <div style={{ marginTop: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #1a1a1a' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '500px' }}>
                          <thead style={{ backgroundColor: '#1a1a1a', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              <tr>
                                  <th style={{ padding: '10px', textAlign: 'left' }}>Concepto</th>
                                  <th style={{ padding: '10px' }}>Cant.</th>
                                  <th style={{ padding: '10px', textAlign: 'right' }}>Precio</th>
                                  <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                                  <th></th>
                              </tr>
                          </thead>
                          <tbody>
                              {presuItems.map(item => ( 
                                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
                                      <td style={{ padding: '10px' }}>{item.nombre}</td>
                                      <td style={{ padding: '10px', textAlign: 'center' }}>{item.cantidad}</td>
                                      <td style={{ padding: '10px', textAlign: 'right' }}>{item.precioUnitario} €</td>
                                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{item.total.toFixed(2)} €</td>
                                      <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => quitarItemPresupuesto(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button></td>
                                  </tr> 
                              ))}
                          </tbody>
                      </table>
                  </div> 
              )}
          </div>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Mano de Obra (Horas)</label><input type="number" value={presuHoras} onChange={(e) => setPresuHoras(e.target.value)} placeholder="0" style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Tarifa Hora (€)</label><input type="number" value={presuPrecioHora} onChange={(e) => setPresuPrecioHora(e.target.value)} placeholder="0.00" style={inputStyle} /></div>
          </div>
          
          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Documentos Emitidos</h4>
          <div style={{ display: 'grid', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
              {presupuestosList.length===0 ? <div style={{ padding: '20px', backgroundColor: '#fff', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>No hay presupuestos</div> : presupuestosList.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 20px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                          <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{p.cliente}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>| {p.fecha}</span> <br/>
                          <span style={{ fontSize: '11px', letterSpacing: '1px' }}>IMPORTE: {p.total?.toFixed(2)} €</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <button onClick={() => descargarPresupuestoExistente(p)} style={{ background: 'transparent', border: '1px solid #1a1a1a', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase' }}><Download size={12}/> PDF</button>
                          <button onClick={() => cambiarEstadoPresupuesto(p.id, p.estado)} style={{ background: p.estado === 'validado' ? '#1a1a1a' : 'transparent', color: p.estado === 'validado' ? 'white' : '#1a1a1a', border: '1px solid #1a1a1a', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}>{p.estado === 'validado' ? 'Aprobado' : 'Borrador'}</button>
                          <button onClick={() => borrarPresupuesto(p.id)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );
}