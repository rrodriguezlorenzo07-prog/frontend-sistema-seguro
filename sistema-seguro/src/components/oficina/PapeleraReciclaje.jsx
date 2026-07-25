import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

export default function PapeleraReciclaje({ blockStyle, partesPapelera, certificacionesPapelera, trabajadoresPapelera, obrasPapelera, restaurarElemento, destruirElementoFisico }) {
  
  const renderItem = (item, tipo, titulo, subtitulo) => (
      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', padding: '15px 20px', border: '1px solid #e5e7eb', marginBottom: '5px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
              <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{titulo}</strong>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{subtitulo}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => restaurarElemento(item.id, tipo)} style={{ background: '#1a1a1a', color: '#fff', border: 'none', padding: '8px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase' }}><RefreshCw size={12}/> Restaurar</button>
              <button onClick={() => destruirElementoFisico(item.id, tipo)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase' }}><Trash2 size={12}/> Destruir</button>
          </div>
      </div>
  );

  return (
      <div style={blockStyle}>
          <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase', color: '#ef4444' }}>Papelera de Reciclaje</h3>
          <p style={{ color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '25px' }}>Los elementos eliminados se guardan aquí. Puedes restaurarlos o destruirlos definitivamente.</p>
          
          {/* NUEVA SECCIÓN PARA LOS HOTELES/OBRAS */}
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Proyectos / Hoteles Cerrados</h4>
          <div style={{ marginBottom: '30px', borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
              {obrasPapelera.length === 0 ? <p style={{ fontSize: '11px', color: '#64748b' }}>Vacío.</p> : obrasPapelera.map(o => renderItem(o, 'obras', o.nombre, `Habitaciones totales: ${o.tareas?.length || 0} unidades`))}
          </div>

          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Personal Dado de Baja</h4>
          <div style={{ marginBottom: '30px', borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
              {trabajadoresPapelera.length === 0 ? <p style={{ fontSize: '11px', color: '#64748b' }}>Vacío.</p> : trabajadoresPapelera.map(t => renderItem(t, 'trabajadores', t.nombre, t.email))}
          </div>

          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Albaranes Eliminados</h4>
          <div style={{ marginBottom: '30px', borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
              {partesPapelera.length === 0 ? <p style={{ fontSize: '11px', color: '#64748b' }}>Vacío.</p> : partesPapelera.map(p => renderItem(p, 'partes_de_trabajo', p.obra, `Fecha: ${p.fecha} | Operarios: ${p.cuadrilla?.map(c=>c.nombre).join(', ') || p.nombreTrabajador}`))}
          </div>

          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Certificaciones Anuladas</h4>
          <div style={{ marginBottom: '30px', borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
              {certificacionesPapelera.length === 0 ? <p style={{ fontSize: '11px', color: '#64748b' }}>Vacío.</p> : certificacionesPapelera.map(c => renderItem(c, 'certificaciones', `Ref: ${c.referencia}`, `Hotel: ${c.obra} | Horas: ${c.totalHoras}h`))}
          </div>
      </div>
  );
}