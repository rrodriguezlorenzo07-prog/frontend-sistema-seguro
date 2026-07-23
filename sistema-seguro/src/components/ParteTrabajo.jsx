import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function ParteTrabajo() {
  const [obra, setObra] = useState('');
  const [horas, setHoras] = useState('');
  const [material, setMaterial] = useState('');
  const [trabajo, setTrabajo] = useState('');
  const [mensaje, setMensaje] = useState('');

  const enviarParte = async (e) => {
    e.preventDefault(); // Evita que la página recargue
    
    try {
      // Aquí enviamos los datos a tu "Excel" de Firebase
      await addDoc(collection(db, 'partes_de_trabajo'), {
        obra: obra,
        horas: horas,
        material: material,
        trabajo: trabajo,
        fecha: new Date().toLocaleDateString(), // Guarda la fecha del móvil automáticamente
      });

      setMensaje('✅ ¡Parte enviado correctamente a la oficina!');
      
      // Vaciamos las casillas para el siguiente parte
      setObra('');
      setHoras('');
      setMaterial('');
      setTrabajo('');
      
    } catch (error) {
      setMensaje('❌ Error al enviar: ' + error.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#2c3e50', textAlign: 'center' }}>Nuevo Parte de Trabajo</h2>
      
      <form onSubmit={enviarParte} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div>
          <label style={{ fontWeight: 'bold' }}>Nombre de la Obra / Cliente:</label>
          <input 
            type="text" 
            value={obra} 
            onChange={(e) => setObra(e.target.value)} 
            required 
            placeholder="Ej: Hotel Sol"
            style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 'bold' }}>Horas trabajadas:</label>
          <input 
            type="number" 
            value={horas} 
            onChange={(e) => setHoras(e.target.value)} 
            required 
            placeholder="Ej: 4"
            style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 'bold' }}>Material gastado:</label>
          <textarea 
            value={material} 
            onChange={(e) => setMaterial(e.target.value)} 
            required 
            placeholder="Ej: 2 metros de cable, 1 enchufe..."
            rows="3"
            style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px', border: '1px solid #ccc', resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 'bold' }}>Trabajo realizado:</label>
          <textarea 
            value={trabajo} 
            onChange={(e) => setTrabajo(e.target.value)} 
            required 
            placeholder="Ej: Instalación de cuadro eléctrico en recepción..."
            rows="4"
            style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px', border: '1px solid #ccc', resize: 'vertical' }}
          />
        </div>

        <button 
          type="submit" 
          style={{ padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
          Enviar Parte a la Oficina
        </button>

      </form>

      {/* Mensaje de éxito o error */}
      {mensaje && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f8f5', color: '#1abc9c', borderRadius: '5px', textAlign: 'center', fontWeight: 'bold' }}>
          {mensaje}
        </div>
      )}
    </div>
  );
}