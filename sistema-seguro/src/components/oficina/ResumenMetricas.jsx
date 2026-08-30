import React from 'react';
import { color } from '../../estilos/tokens';

export default function ResumenMetricas({ partesDeHoy, totalHorasHoy, trabajadoresHoy, porcentajeGlobal }) {
  return (
      <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Métricas del Día</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '30px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, textAlign: 'center' }}><p style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Documentos</p><p style={{ margin: '0', fontSize: '36px', fontWeight: '300' }}>{partesDeHoy.length}</p></div>
              <div style={{ padding: '30px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, textAlign: 'center' }}><p style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Horas Ejecutadas</p><p style={{ margin: '0', fontSize: '36px', fontWeight: '300' }}>{totalHorasHoy}</p></div>
              <div style={{ padding: '30px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, textAlign: 'center' }}><p style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Personal Activo</p><p style={{ margin: '0', fontSize: '36px', fontWeight: '300' }}>{trabajadoresHoy}</p></div>
              <div style={{ padding: '30px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, textAlign: 'center' }}><p style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Avance Global</p><p style={{ margin: '0', fontSize: '36px', fontWeight: '300' }}>{porcentajeGlobal}%</p></div>
          </div>
      </div> 
  );
}