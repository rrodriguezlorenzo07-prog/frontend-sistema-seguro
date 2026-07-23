import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';

export default function PanelOficina() {
  const [partes, setPartes] = useState([]);
  const [obrasList, setObrasList] = useState([]);
  const [nuevaObra, setNuevaObra] = useState('');
  const [filtroBuscador, setFiltroBuscador] = useState('');
  
  const [obraActiva, setObraActiva] = useState(null);
  const [nuevaTarea, setNuevaTarea] = useState('');

  const [editandoParteId, setEditandoParteId] = useState(null);
  const [parteEditado, setParteEditado] = useState({});

  const cargarDatos = async () => {
    try {
      const queryPartes = await getDocs(query(collection(db, 'partes_de_trabajo')));
      const partesOrdenados = queryPartes.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp);
      setPartes(partesOrdenados);

      const queryObras = await getDocs(collection(db, 'obras'));
      setObrasList(queryObras.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error("Error:", error); }
  };

  useEffect(() => { cargarDatos(); }, []);

  const agregarObra = async () => {
    if(!nuevaObra) return;
    await addDoc(collection(db, 'obras'), { nombre: nuevaObra, tareas: [] });
    setNuevaObra(''); cargarDatos();
  };

  const borrarObra = async (id) => {
    if(window.confirm("¿Borrar este Hotel de la lista?")) {
      await deleteDoc(doc(db, 'obras', id)); cargarDatos();
    }
  };

  const agregarTareaAObra = async () => {
    if(!nuevaTarea || !obraActiva) return;
    const tareaNueva = { id: Date.now(), nombre: nuevaTarea, completada: false, trabajador: '' };
    const tareasActualizadas = [...(obraActiva.tareas || []), tareaNueva];
    
    await updateDoc(doc(db, 'obras', obraActiva.id), { tareas: tareasActualizadas });
    setNuevaTarea(''); cargarDatos();
    setObraActiva({...obraActiva, tareas: tareasActualizadas}); 
  };

  const iniciarEdicionParte = (parte) => {
    setEditandoParteId(parte.id);
    setParteEditado(parte);
  };

  const guardarEdicionParte = async () => {
    await updateDoc(doc(db, 'partes_de_trabajo', editandoParteId), {
      horas: parteEditado.horas,
      material: parteEditado.material,
      trabajo: parteEditado.trabajo
    });
    setEditandoParteId(null);
    cargarDatos(); 
  };

  const borrarParte = async (id) => {
    if(window.confirm("⚠️ ¿Estás seguro de que quieres BORRAR este parte del sistema?")) {
      await deleteDoc(doc(db, 'partes_de_trabajo', id));
      cargarDatos();
    }
  };

  const partesFiltrados = partes.filter(parte => {
    const texto = filtroBuscador.toLowerCase();
    const nombrePersona = parte.nombreTrabajador || parte.creador || '';
    return (parte.obra?.toLowerCase().includes(texto) || nombrePersona.toLowerCase().includes(texto) || parte.trabajo?.toLowerCase().includes(texto));
  });

  return (
    <div style={{ width: '100%', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      
      {/* --- SECCIÓN HOTELES --- */}
      <div style={{ backgroundColor: '#ffffff', padding: '25px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '20px' }}>🏢 Hoteles y Progreso</h3>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input type="text" value={nuevaObra} onChange={(e) => setNuevaObra(e.target.value)} placeholder="Nuevo Hotel (Ej: Hotel Meliá)" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none' }} />
          <button onClick={agregarObra} style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Crear Hotel</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
          {obrasList.map(obra => {
            const tareasTotales = obra.tareas?.length || 0;
            const tareasHechas = obra.tareas?.filter(t => t.completada).length || 0;
            const porcentaje = tareasTotales === 0 ? 0 : Math.round((tareasHechas / tareasTotales) * 100);

            return (
              <div key={obra.id} onClick={() => setObraActiva(obra)} style={{ backgroundColor: obraActiva?.id === obra.id ? '#eff6ff' : '#ffffff', border: obraActiva?.id === obra.id ? '2px solid #3b82f6' : '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', cursor: 'pointer', minWidth: '220px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '16px' }}>{obra.nombre}</h4>
                <div style={{ backgroundColor: '#e2e8f0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: porcentaje === 100 ? '#10b981' : '#3b82f6', transition: 'width 0.5s' }}></div>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Progreso: {porcentaje}% ({tareasHechas}/{tareasTotales})</p>
                <button onClick={(e) => { e.stopPropagation(); borrarObra(obra.id); }} style={{ marginTop: '12px', fontSize: '13px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: '600' }}>Eliminar Hotel</button>
              </div>
            );
          })}
        </div>

        {obraActiva && (
          <div style={{ marginTop: '25px', padding: '25px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #bae6fd' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#0f172a' }}>Gestión de Tareas: {obraActiva.nombre}</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input type="text" value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} placeholder="Añadir trabajo (Ej: Planta 1: Hab 001-020)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} />
              <button onClick={agregarTareaAObra} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Añadir Lote</button>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {obraActiva.tareas?.map(tarea => (
                <li key={tarea.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  {tarea.completada ? '✅' : '🔲'} 
                  <span style={{ textDecoration: tarea.completada ? 'line-through' : 'none', color: tarea.completada ? '#94a3b8' : '#1e293b', flex: 1 }}>{tarea.nombre}</span>
                  {tarea.completada && <span style={{ fontSize: '12px', backgroundColor: '#dcfce3', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontWeight: '600' }}>Hecho por: {tarea.trabajador}</span>}
                </li>
              ))}
              {(!obraActiva.tareas || obraActiva.tareas.length === 0) && <p style={{ fontSize: '14px', color: '#94a3b8' }}>Aún no hay trabajos asignados a este hotel.</p>}
            </ul>
          </div>
        )}
      </div>

      {/* --- SECCIÓN PARTES (CON EDICIÓN DE ADMIN Y HORA) --- */}
      <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '20px' }}>📑 Partes de Trabajo Diarios</h3>
      <input type="text" placeholder="🔍 Buscar por obra, trabajo o trabajador..." value={filtroBuscador} onChange={(e) => setFiltroBuscador(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '2px solid #e2e8f0', marginBottom: '20px', outline: 'none', fontSize: '15px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {partesFiltrados.map((parte) => (
          <div key={parte.id} style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #3b82f6', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            
            {editandoParteId === parte.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#ef4444' }}>⚙️ Modo Edición (Administrador)</p>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>Horas:</label>
                <input type="number" value={parteEditado.horas} onChange={(e) => setParteEditado({...parteEditado, horas: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>Material:</label>
                <textarea value={parteEditado.material} onChange={(e) => setParteEditado({...parteEditado, material: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>Trabajo:</label>
                <textarea value={parteEditado.trabajo} onChange={(e) => setParteEditado({...parteEditado, trabajo: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={guardarEdicionParte} style={{ padding: '10px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>💾 Guardar Cambios</button>
                  <button onClick={() => setEditandoParteId(null)} style={{ padding: '10px 15px', background: '#94a3b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                {/* AQUÍ AÑADIMOS LA HORA SI EXISTE */}
                <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a', fontSize: '18px' }}>
                  {parte.obra} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'normal' }}>- {parte.fecha} {parte.hora && `a las ${parte.hora}`}</span>
                </h4>
                
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', backgroundColor: '#f1f5f9', display: 'inline-block', padding: '6px 10px', borderRadius: '6px', color: '#334155', fontWeight: '500' }}>
                  👤 <strong>Trabajador:</strong> {parte.nombreTrabajador || parte.creador}
                </p>

                <p style={{ margin: '6px 0', fontSize: '15px', color: '#334155' }}><strong>⏱️ Horas:</strong> {parte.horas} | <strong>🧱 Material:</strong> {parte.material}</p>
                <p style={{ margin: '6px 0', fontSize: '15px', color: '#334155' }}><strong>📝 Trabajo:</strong> {parte.trabajo}</p>

                <div style={{ display: 'flex', gap: '15px', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
                  <button onClick={() => iniciarEdicionParte(parte)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: '600' }}>✏️ Editar Parte</button>
                  <button onClick={() => borrarParte(parte.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: '600' }}>🗑️ Borrar Parte</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}