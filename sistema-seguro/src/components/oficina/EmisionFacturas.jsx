import React from 'react';
import { CreditCard, CheckSquare, Trash2 } from 'lucide-react';

export default function EmisionFacturas({ blockStyle, labelStyle, inputStyle, btnBlackStyle, modoFacturacion, setModoFacturacion, setItemsAFacturar, facturaCliente, setFacturaCliente, facTarifaHora, setFacTarifaHora, facImporteMateriales, setFacImporteMateriales, partesHistorial, certificacionesList, itemsAFacturar, toggleItemFacturacion, generarPDFFactura, facturasList, borrarFactura }) {
  return (
      <div style={blockStyle}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Emisión de Facturas</h3>
          <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '30px' }}>Factura directamente Albaranes sueltos o Certificaciones completas.</p>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap', backgroundColor: '#fafafa', padding: '20px', border: '1px solid #e5e7eb' }}>
              <div style={{ flex: '100%', display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button onClick={() => { setModoFacturacion('albaranes'); setItemsAFacturar([]); }} style={{ flex: 1, padding: '12px', border: '1px solid #1a1a1a', background: modoFacturacion === 'albaranes' ? '#1a1a1a' : 'transparent', color: modoFacturacion === 'albaranes' ? 'white' : '#1a1a1a', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Facturar Albaranes Sueltos</button>
                  <button onClick={() => { setModoFacturacion('certificaciones'); setItemsAFacturar([]); }} style={{ flex: 1, padding: '12px', border: '1px solid #1a1a1a', background: modoFacturacion === 'certificaciones' ? '#1a1a1a' : 'transparent', color: modoFacturacion === 'certificaciones' ? 'white' : '#1a1a1a', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Facturar Certificaciones</button>
              </div>
              <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Cliente a facturar</label><input type="text" value={facturaCliente} onChange={(e) => setFacturaCliente(e.target.value)} placeholder="Razón social..." style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Tarifa por Hora (€)</label><input type="number" value={facTarifaHora} onChange={(e) => setFacTarifaHora(e.target.value)} placeholder="Ej: 25.50" style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Material Extra (€)</label><input type="number" value={facImporteMateriales} onChange={(e) => setFacImporteMateriales(e.target.value)} placeholder="Ej: 150.00" style={inputStyle} /></div>
          </div>

          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>{modoFacturacion === 'albaranes' ? 'Albaranes pendientes:' : 'Certificaciones pendientes:'}</h4>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '30px' }}>
              {modoFacturacion === 'albaranes' ? (
                  partesHistorial.filter(p => !p.certificado && !p.facturado).length === 0 ? <div style={{ fontSize: '12px', color: '#64748b' }}>No hay albaranes libres.</div> :
                  partesHistorial.filter(p => !p.certificado && !p.facturado).map(p => (
                      <div key={p.id} onClick={() => toggleItemFacturacion(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: itemsAFacturar.includes(p.id) ? '2px solid #1a1a1a' : '1px solid #e5e7eb', backgroundColor: itemsAFacturar.includes(p.id) ? '#fafafa' : '#ffffff', cursor: 'pointer' }}><div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: itemsAFacturar.includes(p.id) ? '#1a1a1a' : 'transparent' }}>{itemsAFacturar.includes(p.id) && <CheckSquare size={14} color="#ffffff" />}</div><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{p.obra} <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>| {p.fecha}</span></div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>HORAS: {p.horasTotales || p.horas || 0}h</div></div></div>
                  ))
              ) : (
                  certificacionesList.filter(c => !c.facturado).length === 0 ? <div style={{ fontSize: '12px', color: '#64748b' }}>No hay certificaciones pendientes.</div> :
                  certificacionesList.filter(c => !c.facturado).map(c => (
                      <div key={c.id} onClick={() => toggleItemFacturacion(c.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: itemsAFacturar.includes(c.id) ? '2px solid #1a1a1a' : '1px solid #e5e7eb', backgroundColor: itemsAFacturar.includes(c.id) ? '#fafafa' : '#ffffff', cursor: 'pointer' }}><div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: itemsAFacturar.includes(c.id) ? '#1a1a1a' : 'transparent' }}>{itemsAFacturar.includes(c.id) && <CheckSquare size={14} color="#ffffff" />}</div><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>CERT. REF: {c.referencia} <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>| Proyecto: {c.obra}</span></div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>TOTAL HORAS: {c.totalHoras}h</div></div></div>
                  ))
              )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}><button onClick={generarPDFFactura} style={{...btnBlackStyle, padding: '15px 30px', fontSize: '13px'}}><CreditCard size={18}/> Emitir Factura Oficial</button></div>

          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', borderTop: '1px solid #e5e7eb', paddingTop: '30px' }}>Registro de Facturas Emitidas</h4>
          <div style={{ display: 'grid', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
              {facturasList.length === 0 ? <div style={{ padding: '20px', backgroundColor: '#fff', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>Aún no hay facturas</div> : facturasList.map(fac => (
                  <div key={fac.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 20px' }}>
                      <div><strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{fac.cliente}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>| {fac.fecha}</span> <br/><span style={{ fontSize: '11px', letterSpacing: '1px' }}>REF: {fac.referencia} | TOTAL: {fac.total?.toFixed(2)} €</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Contabilizado</span><button onClick={() => borrarFactura(fac)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }} title="Anular y borrar factura"><Trash2 size={16}/></button></div>
                  </div>
              ))}
          </div>
      </div>
  );
}