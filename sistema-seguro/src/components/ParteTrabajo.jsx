import { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../firebase'; 
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage'; 
import { signOut } from 'firebase/auth';
import { FileText, FolderOpen, Send, Package, Trash2, PenTool, Plus, CheckSquare, LogOut, Building2 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

export default function ParteTrabajo({ usuario, esAdmin, volverOficina }) {
  const [obrasList, setObrasList] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [obraSeleccionada, setObraSeleccionada] = useState(null);
  const [esOtraObra, setEsOtraObra] = useState(false);
  const [obraNombreManual, setObraNombreManual] = useState('');
  
  const [trabajoLibre, setTrabajoLibre] = useState('');
  const [habitacionesRango, setHabitacionesRango] = useState('');
  const [materialesUsados, setMaterialesUsados] = useState([]);
  const [matSelectId, setMatSelectId] = useState('');
  const [matSelectCant, setMatSelectCant] = useState(1);

  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [vistaMisPartes, setVistaMisPartes] = useState(false);
  const [misPartes, setMisPartes] = useState([]);
  
  const [nombreOficial, setNombreOficial] = useState(usuario.email);
  const firmaRef = useRef(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const qTrab = query(collection(db, 'trabajadores'), where("email", "==", usuario.email.toLowerCase().trim()));
        const resTrab = await getDocs(qTrab);
        if (!resTrab.empty) { setNombreOficial(resTrab.docs[0].data().nombre); }

        const resObras = await getDocs(collection(db, 'obras'));
        setObrasList(resObras.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const resInv = await getDocs(collection(db, 'inventario'));
        setInventario(resInv.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) { console.error("Error:", error); }
    };
    cargarDatos();
    cargarMisPartes();
  }, [usuario, vistaMisPartes]);

  const cargarMisPartes = async () => {
    if (usuario) {
      const resPartes = await getDocs(query(collection(db, 'partes_de_trabajo'), where("creador", "==", usuario.email)));
      setMisPartes(resPartes.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
    }
  };

  const cerrarSesion = () => { signOut(auth).then(() => { window.location.reload(); }); };

  const agregarMaterialLista = () => {
      if(!matSelectId || matSelectCant < 1) return;
      const matInfo = inventario.find(m => m.id === matSelectId);
      if(matInfo) {
          setMaterialesUsados([...materialesUsados, { id: matInfo.id, nombre: matInfo.nombre, cantidad: parseInt(matSelectCant) }]);
          setMatSelectId(''); setMatSelectCant(1);
      }
  };

  const quitarMaterialLista = (index) => {
      const nuevaLista = [...materialesUsados];
      nuevaLista.splice(index, 1);
      setMaterialesUsados(nuevaLista);
  };

  const enviarParte = async (e) => {
    e.preventDefault();
    setMensaje({ texto: 'ENVIANDO DOCUMENTO...', tipo: 'warning' });
    
    let firmaUrlFinal = null;
    
    // Si hay firma, la subimos a Firebase Storage de forma obligatoria
    if (!firmaRef.current.isEmpty()) {
        try {
            const base64Firma = firmaRef.current.getCanvas().toDataURL('image/png');
            const nombreArchivo = `firmas/firma_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
            const firmaStorageRef = ref(storage, nombreArchivo);
            
            // Subimos la imagen al "trastero" de Firebase Storage
            await uploadString(firmaStorageRef, base64Firma, 'data_url');
            
            // Obtenemos el enlace web corto y limpio
            firmaUrlFinal = await getDownloadURL(firmaStorageRef);
        } catch (err) {
            console.error("Error al subir la firma a Storage:", err);
            setMensaje({ texto: 'ERROR AL SUBIR LA FIRMA', tipo: 'error' });
            setTimeout(() => setMensaje({ texto: '', tipo: '' }), 4000);
            return; // Cortamos el envío si la firma falla
        }
    }

    const nombreFinalObra = esOtraObra ? obraNombreManual : obraSeleccionada?.nombre;

    const payloadParte = {
        obra: nombreFinalObra, 
        habitacionesRango: habitacionesRango, 
        trabajo: trabajoLibre, 
        materialesUsados: materialesUsados, 
        firma: firmaUrlFinal, // <--- Aquí ya viaja solo el enlace web corto (ej: https://firebasestorage...)
        creador: usuario.email, 
        nombreTrabajador: nombreOficial,
        fecha: new Date().toLocaleDateString(), 
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().getTime(),
        estado: 'pendiente'
    };

    try {
        await addDoc(collection(db, 'partes_de_trabajo'), payloadParte);
        setMensaje({ texto: 'DOCUMENTO ENVIADO CON ÉXITO', tipo: 'success' });
        setObraSeleccionada(null); setEsOtraObra(false); setObraNombreManual('');
        setTrabajoLibre(''); setHabitacionesRango(''); setMaterialesUsados([]);
        firmaRef.current.clear();
    } catch (error) { 
        setMensaje({ texto: 'ERROR AL ENVIAR EL DOCUMENTO', tipo: 'error' }); 
    }
    setTimeout(() => setMensaje({ texto: '', tipo: '' }), 4000);
  };

  const btnStyle = (activo) => ({
      flex: 1, padding: '14px', backgroundColor: activo ? '#1a1a1a' : 'transparent', color: activo ? '#ffffff' : '#64748b',
      border: activo ? '1px solid #1a1a1a' : '1px solid #e5e7eb', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
  });

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      
      {/* NAVEGACIÓN SUPERIOR MINIMALISTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '200px' }}>
            <button onClick={() => setVistaMisPartes(false)} style={btnStyle(!vistaMisPartes)}><FileText size={16} /> Parte</button>
            <button onClick={() => setVistaMisPartes(true)} style={btnStyle(vistaMisPartes)}><FolderOpen size={16} /> Historial</button>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            {esAdmin && (
                <button onClick={volverOficina} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 15px', backgroundColor: '#ffffff', color: '#1a1a1a', border: '1px solid #1a1a1a', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold' }}>
                    <Building2 size={14} /> Oficina
                </button>
            )}
            <button onClick={cerrarSesion} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 15px', backgroundColor: 'transparent', color: '#1a1a1a', border: '1px solid #e5e7eb', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold' }}>
                <LogOut size={14} /> Salir
            </button>
        </div>
      </div>

      {!vistaMisPartes ? (
        <form onSubmit={enviarParte} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div style={{ padding: '15px', border: '1px solid #e5e7eb', fontSize: '12px', color: '#1a1a1a', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
              Operario activo: <strong>{nombreOficial}</strong>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#1a1a1a', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Lugar de Trabajo</label>
            <select onChange={(e) => {
                const val = e.target.value;
                if(val==='OTRA') { setEsOtraObra(true); setObraSeleccionada(null); }
                else { setEsOtraObra(false); setObraSeleccionada(obrasList.find(o => o.id === val)); }
            }} value={esOtraObra ? 'OTRA' : (obraSeleccionada?.id || '')} required style={{ width: '100%', padding: '15px', border: '1px solid #e5e7eb', outline: 'none', backgroundColor: '#fafafa', fontSize: '14px' }}>
              <option value="">-- Seleccionar Proyecto --</option>
              {obrasList.map((obra) => <option key={obra.id} value={obra.id}>{obra.nombre}</option>)}
              <option value="OTRA">+ Añadir nueva ubicación...</option>
            </select>
            {esOtraObra && <input type="text" value={obraNombreManual} onChange={(e) => setObraNombreManual(e.target.value)} required placeholder="Nombre del cliente o proyecto..." style={{ width: '100%', padding: '15px', border: '1px solid #1a1a1a', marginTop: '10px', boxSizing: 'border-box' }} />}
          </div>

          <div style={{ padding: '20px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', fontWeight: 'bold', color: '#1a1a1a', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}><Package size={16}/> Materiales Utilizados</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <select value={matSelectId} onChange={(e)=>setMatSelectId(e.target.value)} style={{ flex: 2, padding: '12px', border: '1px solid #e5e7eb', outline: 'none' }}>
                      <option value="">Buscar en inventario...</option>
                      {inventario.map(m => <option key={m.id} value={m.id}>{m.nombre} (Stock: {m.stock})</option>)}
                  </select>
                  <input type="number" value={matSelectCant} onChange={(e)=>setMatSelectCant(e.target.value)} min="1" style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', outline: 'none' }} />
                  <button type="button" onClick={agregarMaterialLista} style={{ padding: '0 20px', backgroundColor: '#1a1a1a', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}><Plus size={18}/></button>
              </div>
              {materialesUsados.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {materialesUsados.map((m, index) => (
                          <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 15px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', fontSize: '13px' }}>
                              <span><strong>{m.cantidad}x</strong> {m.nombre}</span>
                              <button type="button" onClick={()=>quitarMaterialLista(index)} style={{ color: '#1a1a1a', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                          </li>
                      ))}
                  </ul>
              )}
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 'bold', color: '#1a1a1a', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}><CheckSquare size={16}/> Habitaciones (Rangos)</label>
            <input type="text" value={habitacionesRango} onChange={(e) => setHabitacionesRango(e.target.value)} placeholder="Ej: 101, 103-105" style={{ width: '100%', padding: '15px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fafafa' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#1a1a1a', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Observaciones del Trabajo</label>
            <textarea value={trabajoLibre} onChange={(e) => setTrabajoLibre(e.target.value)} rows="3" placeholder="Descripción detallada de la intervención..." style={{ width: '100%', padding: '15px', border: '1px solid #e5e7eb', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }} />
          </div>

          <div style={{ padding: '20px', border: '1px solid #1a1a1a' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontWeight: 'bold', color: '#1a1a1a', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PenTool size={16}/> Firma de Conformidad</span>
                  <button type="button" onClick={(e) => { e.preventDefault(); firmaRef.current.clear(); }} style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Borrar</button>
              </label>
              <div style={{ border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                  <SignatureCanvas ref={firmaRef} penColor="black" canvasProps={{width: 500, height: 150, style: { width: '100%', height: '150px' }}} />
              </div>
          </div>

          <button type="submit" style={{ width: '100%', padding: '20px', backgroundColor: '#1a1a1a', color: '#ffffff', border: 'none', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s' }}>
              <Send size={18} /> Registrar Documento
          </button>
          
          {mensaje.texto && (
              <div style={{ padding: '15px', border: `1px solid ${mensaje.tipo === 'error' ? '#1a1a1a' : '#1a1a1a'}`, backgroundColor: mensaje.tipo === 'error' ? '#ffffff' : '#1a1a1a', color: mensaje.tipo === 'error' ? '#1a1a1a' : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 'bold', letterSpacing: '1px', fontSize: '12px', textTransform: 'uppercase' }}>
                  {mensaje.texto}
              </div>
          )}
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {misPartes.map(p => (
                <div key={p.id} style={{ padding: '20px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px', color: '#1a1a1a', textTransform: 'uppercase', marginBottom: '5px' }}>{p.obra}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{p.fecha}</div>
                    </div>
                    <span style={{ border: `1px solid ${p.estado === 'pendiente' ? '#64748b' : '#1a1a1a'}`, color: p.estado === 'pendiente' ? '#64748b' : '#1a1a1a', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {p.estado === 'pendiente' ? 'Pendiente' : 'Aprobado'}
                    </span>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}