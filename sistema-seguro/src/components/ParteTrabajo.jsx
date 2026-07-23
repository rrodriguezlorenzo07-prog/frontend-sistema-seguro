import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

export default function ParteTrabajo({ usuario, nombreUsuario }) {
  const [obrasList, setObrasList] = useState([]);
  const [obraSeleccionada, setObraSeleccionada] = useState(null);
  const [esOtraObra, setEsOtraObra] = useState(false);
  const [obraNombreManual, setObraNombreManual] = useState('');
  const [tareasMarcadas, setTareasMarcadas] = useState([]); 

  const [horas, setHoras] = useState('');
  const [material, setMaterial] = useState('');
  const [trabajoLibre, setTrabajoLibre] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [vistaMisPartes, setVistaMisPartes] = useState(false);
  const [misPartes, setMisPartes] = useState([]);
  
  const [editandoId, setEditandoId] = useState(null);
  const [parteEditado, setParteEditado] = useState({});

  const cargarMisPartes = async () => {
    if (usuario) {
      const resPartes = await getDocs(query(collection(db, 'partes_de_trabajo'), where("creador", "==", usuario.email)));
      // Ordenamos para que los últimos enviados salgan primero
      const partesOrdenados = resPartes.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp);
      setMisPartes(partesOrdenados);
    }
  };

  useEffect(() => {
    const cargarObras = async () => {
      try {
        const resObras = await getDocs(collection(db, 'obras'));
        setObrasList(resObras.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { console.error(error); }
    };
    cargarObras();
    cargarMisPartes();
  }, [usuario, vistaMisPartes]);

  const manejarCambioObra = (e) => {
    const idObra = e.target.value;
    if (idObra === 'OTRA') {
      setEsOtraObra(true); setObraSeleccionada(null); setTareasMarcadas([]);
    } else if (idObra === '') {
      setEsOtraObra(false); setObraSeleccionada(null); setTareasMarcadas([]);
    } else {
      setEsOtraObra(false);
      const obraEncontrada = obrasList.find(o => o.id === idObra);
      setObraSeleccionada(obraEncontrada); setTareasMarcadas([]); 
    }
  };

  const toggleTarea = (idTarea) => {
    if (tareasMarcadas.includes(idTarea)) {
      setTareasMarcadas(tareasMarcadas.filter(id => id !== idTarea));
    } else {
      setTareasMarcadas([...tareasMarcadas, idTarea]);
    }
  };

  const enviarParte = async (e) => {
    e.preventDefault();
    try {
      const nombreFinalObra = esOtraObra ? obraNombreManual : obraSeleccionada.nombre;
      
      let resumenTrabajo = trabajoLibre;
      if (obraSeleccionada && tareasMarcadas.length > 0) {
        const nombresTareas = obraSeleccionada.tareas.filter(t => tareasMarcadas.includes(t.id)).map(t => t.nombre);
        resumenTrabajo = `[TAREAS: ${nombresTareas.join(', ')}] --- Notas: ${trabajoLibre}`;
      }

      // AHORA GUARDAMOS LA FECHA Y LA HORA EXACTA
      await addDoc(collection(db, 'partes_de_trabajo'), {
        obra: nombreFinalObra, 
        horas, 
        material, 
        trabajo: resumenTrabajo,
        creador: usuario.email, 
        nombreTrabajador: nombreUsuario || usuario.email,
        fecha: new Date().toLocaleDateString(), 
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), // <-- AÑADIDO: La hora (ej: 18:30)
        timestamp: new Date().getTime()
      });

      if (obraSeleccionada && tareasMarcadas.length > 0) {
        const tareasActualizadas = obraSeleccionada.tareas.map(tarea => {
          if (tareasMarcadas.includes(tarea.id)) return { ...tarea, completada: true, trabajador: nombreUsuario || usuario.email };
          return tarea;
        });
        await updateDoc(doc(db, 'obras', obraSeleccionada.id), { tareas: tareasActualizadas });
      }

      setMensaje('✅ ¡Parte enviado y progreso actualizado!');
      setObraSeleccionada(null); setEsOtraObra(false); setObraNombreManual('');
      setHoras(''); setMaterial(''); setTrabajoLibre(''); setTareasMarcadas([]);
      setTimeout(() => setMensaje(''), 3000);
      
    } catch (error) { setMensaje('❌ Error: ' + error.message); }
  };

  const iniciarEdicion = (parte) => {
    setEditandoId(parte.id);
    setParteEditado(parte);
  };

  const guardarEdicion = async () => {
    await updateDoc(doc(db, 'partes_de_trabajo', editandoId), {
      horas: parteEditado.horas,
      material: parteEditado.material,
      trabajo: parteEditado.trabajo
    });
    setEditandoId(null);
    cargarMisPartes(); 
  };

  const borrarParte = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este parte de trabajo?")) {
      await deleteDoc(doc(db, 'partes_de_trabajo', id));
      cargarMisPartes();
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
        <button onClick={() => setVistaMisPartes(false)} style={{ flex: 1, padding: '12px', background: !vistaMisPartes ? '#2563eb' : 'transparent', color: !vistaMisPartes ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>📝 Redactar Parte</button>
        <button onClick={() => setVistaMisPartes(true)} style={{ flex: 1, padding: '12px', background: vistaMisPartes ? '#10b981' : 'transparent', color: vistaMisPartes ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>📂 Mis Partes Enviados</button>
      </div>

      {!vistaMisPartes ? (
        <form onSubmit={enviarParte} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Hotel / Obra:</label>
            <select onChange={manejarCambioObra} value={esOtraObra ? 'OTRA' : (obraSeleccionada?.id || '')} required style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc' }}>
              <option value="">-- Selecciona dónde estás --</option>
              {obrasList.map((obra) => <option key={obra.id} value={obra.id}>{obra.nombre}</option>)}
              <option value="OTRA" style={{ fontWeight: 'bold', color: '#2563eb' }}>➕ Otra obra / Particular...</option>
            </select>
            {esOtraObra && <input type="text" value={obraNombreManual} onChange={(e) => setObraNombreManual(e.target.value)} required placeholder="Escribe el nombre de la obra..." style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '2px solid #2563eb', marginTop: '10px', outline: 'none' }} />}
          </div>

          {obraSeleccionada && obraSeleccionada.tareas && obraSeleccionada.tareas.filter(t => !t.completada).length > 0 && (
            <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#166534' }}>📋 Tareas pendientes en {obraSeleccionada.nombre}:</p>
              {obraSeleccionada.tareas.filter(t => !t.completada).map(tarea => (
                <label key={tarea.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#ffffff', borderRadius: '6px', marginBottom: '8px', cursor: 'pointer', border: '1px solid #dcfce3', transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={tareasMarcadas.includes(tarea.id)} onChange={() => toggleTarea(tarea.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  {tarea.nombre}
                </label>
              ))}
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Horas:</label>
            <input type="number" value={horas} onChange={(e) => setHoras(e.target.value)} required placeholder="Ej: 8" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Material gastado:</label>
            <textarea value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Ej: 2 tubos PVC..." rows="2" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Trabajo Extra / Notas:</label>
            <textarea value={trabajoLibre} onChange={(e) => setTrabajoLibre(e.target.value)} required={!esOtraObra && tareasMarcadas.length === 0} placeholder="Notas del día o explicaciones adicionales..." rows="3" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc', resize: 'vertical' }} />
          </div>

          <button type="submit" style={{ width: '100%', padding: '16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }}>📤 Enviar Parte</button>
          
          {mensaje && <div style={{ padding: '15px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #a7f3d0' }}>{mensaje}</div>}
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {misPartes.length === 0 ? <p style={{ textAlign: 'center', color: '#64748b' }}>No has enviado ningún parte aún.</p> : 
            misPartes.map(parte => (
              <div key={parte.id} style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #10b981', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                {editandoId === parte.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>Horas:</label>
                    <input type="number" value={parteEditado.horas} onChange={(e) => setParteEditado({...parteEditado, horas: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>Material:</label>
                    <textarea value={parteEditado.material} onChange={(e) => setParteEditado({...parteEditado, material: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>Trabajo:</label>
                    <textarea value={parteEditado.trabajo} onChange={(e) => setParteEditado({...parteEditado, trabajo: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button onClick={guardarEdicion} style={{ padding: '10px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>💾 Guardar</button>
                      <button onClick={() => setEditandoId(null)} style={{ padding: '10px 15px', background: '#94a3b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, color: '#1e3a8a', fontSize: '18px' }}>{parte.obra}</h4>
                      {/* AQUÍ ENSEÑAMOS LA FECHA Y LA HORA SI EXISTE */}
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>{parte.fecha} {parte.hora && `- ${parte.hora}`}</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}><strong>⏱️ Horas:</strong> {parte.horas}</p>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}><strong>🧱 Material:</strong> {parte.material}</p>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}><strong>📝 Trabajo:</strong> {parte.trabajo}</p>
                    
                    <div style={{ display: 'flex', gap: '15px', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
                      <button onClick={() => iniciarEdicion(parte)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: '600' }}>✏️ Editar</button>
                      <button onClick={() => borrarParte(parte.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: '600' }}>🗑️ Borrar</button>
                    </div>
                  </>
                )}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}