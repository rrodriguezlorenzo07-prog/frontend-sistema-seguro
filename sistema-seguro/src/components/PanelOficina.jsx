import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function PanelOficina() {
  const [partes, setPartes] = useState([]);

  // Esta función va a Firebase y se trae todos los partes
  const cargarPartes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'partes_de_trabajo'));
      const listaPartes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPartes(listaPartes);
    } catch (error) {
      console.error("Error al cargar los partes:", error);
    }
  };

  // Le decimos a React que cargue los partes nada más abrir esta pantalla
  useEffect(() => {
    cargarPartes();
  }, []);

  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '10px' }}>Panel de Control - Oficina</h2>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <button 
          onClick={cargarPartes} 
          style={{ padding: '10px 20px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          🔄 Actualizar Datos
        </button>
      </div>

      {/* Si no hay partes, mostramos un aviso. Si los hay, creamos las tarjetas */}
      {partes.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>No hay partes de trabajo registrados todavía.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {partes.map((parte) => (
            <div key={parte.id} style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', borderLeft: '6px solid #10b981', border: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#1f2937' }}>🏗️ Obra: {parte.obra}</h3>
              <p style={{ margin: '5px 0' }}><strong>⏱️ Horas:</strong> {parte.horas}</p>
              <p style={{ margin: '5px 0' }}><strong>🧱 Material:</strong> {parte.material}</p>
              <p style={{ margin: '5px 0' }}><strong>📝 Trabajo:</strong> {parte.trabajo}</p>
              <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Enviado el: {parte.fecha}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}