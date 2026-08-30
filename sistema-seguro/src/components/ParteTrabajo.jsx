// @ts-check
import { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage, auth } from '../firebase'; 
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';
import { signOut } from 'firebase/auth';
import { FileText, FolderOpen, Send, Package, Trash2, PenTool, Plus, CheckSquare, LogOut, Building2, MapPin } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { color, texto, peso, interletra, espacio, radio, objetivo } from '../estilos/tokens';
import Boton from '../ui/Boton';
import Insignia from '../ui/Insignia';

export default function ParteTrabajo({ usuario, esAdmin, volverOficina }) {
  const [obrasList, setObrasList] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [obraSeleccionada, setObraSeleccionada] = useState(null);
  const [esOtraObra, setEsOtraObra] = useState(false);
  const [obraNombreManual, setObraNombreManual] = useState('');
  
  // ESTADOS DE TAREAS Y TRABAJO (Modificado para Habitaciones)
  const [trabajoLibre, setTrabajoLibre] = useState('');
  const [tareasRealizadas, setTareasRealizadas] = useState([]);
  const [tareaUbicacion, setTareaUbicacion] = useState('');
  const [tareaDescripcion, setTareaDescripcion] = useState('');

  // ESTADOS DE MATERIALES
  const [materialesUsados, setMaterialesUsados] = useState([]);
  const [matSelectId, setMatSelectId] = useState('');
  const [matSelectCant, setMatSelectCant] = useState('1');
  const [matSelectPrecio, setMatSelectPrecio] = useState('');

  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [vistaMisPartes, setVistaMisPartes] = useState(false);
  const [misPartes, setMisPartes] = useState([]);
  
  const [nombreOficial, setNombreOficial] = useState(usuario.email);
  const [trabajadorId, setTrabajadorId] = useState(null);
  const firmaRef = useRef(null);
  // Identifica el envío en curso: evita que el acuse del servidor repinte un
  // mensaje cuando el operario ya está con el parte siguiente.
  const envioRef = useRef(0);

  const cargarMisPartes = useCallback(async () => {
    if (!usuario) return;
    const resPartes = await getDocs(query(collection(db, 'partes_de_trabajo'), where("creador", "==", usuario.email)));
    setMisPartes(resPartes.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
  }, [usuario]);

  // Catálogos y ficha del operario: se cargan UNA vez por usuario y quedan en estado.
  // Antes se volvían a descargar enteros cada vez que se alternaba Parte / Historial.
  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        const [resTrab, resObras, resInv] = await Promise.all([
          getDocs(query(collection(db, 'trabajadores'), where("email", "==", usuario.email.toLowerCase().trim()))),
          getDocs(collection(db, 'obras')),
          getDocs(collection(db, 'inventario'))
        ]);
        if (!resTrab.empty) { setNombreOficial(resTrab.docs[0].data().nombre); setTrabajadorId(resTrab.docs[0].id); }
        setObrasList(resObras.docs.map(d => ({ id: d.id, ...d.data() })));
        setInventario(resInv.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) { console.error("Error:", error); }
    };
    cargarCatalogos();
  }, [usuario]);

  // El historial propio sí se refresca al entrar en esa pestaña.
  useEffect(() => { cargarMisPartes(); }, [cargarMisPartes, vistaMisPartes]);

  const cerrarSesion = () => { signOut(auth).then(() => { window.location.reload(); }); };

  // Un parte rechazado sigue siendo visible para su autor: sin este caso se le
  // mostraba como "Aprobado", que es justo lo contrario de lo que ocurrió.
  // Devuelve el TONO de la insignia, no un color suelto: el color de un estado lo
  // decide el sistema de diseño, no cada pantalla.
  const insigniaEstado = (estado) => {
      if (estado === 'aprobado') return { tono: 'exito', texto: 'Aprobado' };
      if (estado === 'rechazado') return { tono: 'error', texto: 'Rechazado' };
      return { tono: 'info', texto: 'Pendiente' };
  };

  // === LÓGICA DE MATERIALES ===
  const agregarMaterialLista = () => {
      if(!matSelectId || Number(matSelectCant) < 1) return;
      const matInfo = inventario.find(m => m.id === matSelectId);
      if(matInfo) {
          setMaterialesUsados([...materialesUsados, { 
              id: matInfo.id, 
              nombre: matInfo.nombre, 
              cantidad: parseInt(matSelectCant),
              precio: parseFloat(matSelectPrecio || '0')
          }]);
          setMatSelectId(''); setMatSelectCant('1'); setMatSelectPrecio('');
      }
  };

  const quitarMaterialLista = (index) => {
      const nuevaLista = [...materialesUsados];
      nuevaLista.splice(index, 1);
      setMaterialesUsados(nuevaLista);
  };

  // === LÓGICA DE TAREAS / HABITACIONES ===
  const agregarTareaLista = () => {
      if(!tareaUbicacion.trim() || !tareaDescripcion.trim()) return;
      setTareasRealizadas([...tareasRealizadas, { 
          ubicacion: tareaUbicacion.trim(), 
          descripcion: tareaDescripcion.trim() 
      }]);
      setTareaUbicacion(''); setTareaDescripcion('');
  };

  const quitarTareaLista = (index) => {
      const nuevaLista = [...tareasRealizadas];
      nuevaLista.splice(index, 1);
      setTareasRealizadas(nuevaLista);
  };

  // === ENVÍO DEL PARTE ===
  const enviarParte = async (e) => {
    e.preventDefault();
    if (tareasRealizadas.length === 0 && !trabajoLibre.trim()) {
        setMensaje({ texto: 'DEBES AÑADIR AL MENOS UNA HABITACIÓN O TAREA', tipo: 'error' });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3000);
        return;
    }

    setMensaje({ texto: 'ENVIANDO DOCUMENTO...', tipo: 'warning' });
    
    let rutaFirma = null;
    let firmaSinSubir = false;

    if (!firmaRef.current.isEmpty()) {
        const base64Firma = firmaRef.current.getCanvas().toDataURL('image/png');
        try {
            const nombreArchivo = `firmas/firma_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
            const firmaStorageRef = ref(storage, nombreArchivo);

            // El metadato `creador` es lo que permite a storage.rules saber de quién
            // es cada firma: el nombre del archivo no lo dice y las reglas no pueden
            // consultar Firestore por él. Se guarda en minúsculas para que la
            // comparación de la regla no dependa de cómo escriba el correo el usuario.
            await uploadString(firmaStorageRef, base64Firma, 'data_url', {
                contentType: 'image/png',
                customMetadata: { creador: usuario.email.toLowerCase().trim() }
            });
            // Se guarda la RUTA, no la URL de descarga: esa URL lleva un token
            // permanente y acabaría circulando en cada lectura del parte. Además
            // esto ahorra una llamada de red en el peor momento posible, con el
            // operario en obra y mala cobertura.
            rutaFirma = nombreArchivo;
        } catch (err) {
            // Storage NO tiene cola offline; Firestore sí. Antes esto hacía return y
            // se perdía el parte entero —obra, tareas, materiales y notas tecleadas a
            // mano en la obra— por no poder subir una imagen de 3 KB.
            //
            // La firma viaja dentro del documento en base64. resolverFirma() ya trata
            // ese formato, así que la oficina la ve igual, sin esperar a nada; y la
            // Cloud Function subirFirmaPendiente la mueve a Storage en cuanto el parte
            // llegue al servidor.
            console.error("No se pudo subir la firma, viaja en el parte:", err);
            rutaFirma = base64Firma;
            firmaSinSubir = true;
        }
    }

    const nombreFinalObra = esOtraObra ? obraNombreManual : obraSeleccionada?.nombre;

    const payloadParte = {
        obra: nombreFinalObra,
        // Referencias por id junto al nombre. Si la obra se escribió a mano,
        // obraId queda en null a propósito: es texto libre, no un proyecto del catálogo.
        obraId: esOtraObra ? null : (obraSeleccionada?.id ?? null),
        trabajadorId,
        tareasRealizadas: tareasRealizadas, // Array estructurado: [{ubicacion, descripcion}]
        trabajo: trabajoLibre,
        materialesUsados: materialesUsados,
        firma: rutaFirma,
        creador: usuario.email, 
        nombreTrabajador: nombreOficial,
        fecha: new Date().toLocaleDateString(), 
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().getTime(),
        estado: 'pendiente'
    };

    // NO se espera al servidor. Con persistentLocalCache la escritura es firme en
    // IndexedDB en cuanto se llama, y Firestore garantiza el envío posterior aunque
    // se cierre la aplicación. Sin cobertura, la promesa de addDoc no se rechaza:
    // simplemente no se resuelve nunca, así que esperarla dejaba al operario mirando
    // "ENVIANDO DOCUMENTO..." indefinidamente sobre un parte que ya estaba guardado
    // —y probablemente volviendo a darle a enviar—.
    const referencia = doc(collection(db, 'partes_de_trabajo'));
    const confirmacionDelServidor = setDoc(referencia, payloadParte);

    const envio = envioRef.current + 1;
    envioRef.current = envio;

    setMensaje({
        texto: firmaSinSubir ? 'GUARDADO · PENDIENTE DE SINCRONIZAR' : 'PARTE GUARDADO',
        tipo: firmaSinSubir ? 'warning' : 'success'
    });

    setObraSeleccionada(null); setEsOtraObra(false); setObraNombreManual('');
    setTrabajoLibre(''); setTareasRealizadas([]); setMaterialesUsados([]);
    firmaRef.current.clear();

    confirmacionDelServidor
        .then(() => {
            // Llegó al servidor mientras el aviso seguía en pantalla: se afina. Si no
            // llega, el mensaje que ya hay es correcto y el parte está a salvo igual.
            if (envioRef.current === envio && !firmaSinSubir) {
                setMensaje({ texto: 'DOCUMENTO ENVIADO CON ÉXITO', tipo: 'success' });
            }
        })
        .catch((error) => {
            // Un rechazo de verdad (reglas, datos inválidos) llega tarde, con el
            // formulario ya limpio. Es el precio de no bloquear al operario.
            console.error('El parte quedó guardado en el móvil pero el servidor lo rechazó:', error);
            if (envioRef.current === envio) {
                setMensaje({ texto: 'GUARDADO EN EL MÓVIL · EL SERVIDOR LO RECHAZÓ', tipo: 'error' });
            }
        });

    setTimeout(() => {
        // Invalida el envío: un acuse que llegue tardísimo ya no repinta nada.
        envioRef.current += 1;
        setMensaje({ texto: '', tipo: '' });
    }, 4000);
  };

  const btnStyle = (activo) => ({
      flex: 1, padding: espacio.md, minHeight: objetivo.amplio, borderRadius: radio.sutil, backgroundColor: activo ? color.petroleo : color.superficie, color: activo ? color.textoSobreOscuro : color.textoSuave,
      border: `1px solid ${activo ? color.petroleo : color.linea}`, fontSize: texto.menor, fontWeight: peso.fuerte, letterSpacing: interletra.etiqueta, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: espacio.xs
  });

  return (
    <div style={{ maxWidth: '620px', margin: '0 auto', padding: espacio.md }}>
      
      {/* NAVEGACIÓN SUPERIOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.lg, borderBottom: `1px solid ${color.linea}`, paddingBottom: espacio.md, flexWrap: 'wrap', gap: espacio.sm }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '200px' }}>
            <button onClick={() => setVistaMisPartes(false)} style={btnStyle(!vistaMisPartes)}><FileText size={16} /> Parte</button>
            <button onClick={() => setVistaMisPartes(true)} style={btnStyle(vistaMisPartes)}><FolderOpen size={16} /> Historial</button>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            {esAdmin && (
                <Boton variante="secundario" onClick={volverOficina}>
                    <Building2 size={14} /> Oficina
                </Boton>
            )}
            <Boton variante="fantasma" onClick={cerrarSesion}>
                <LogOut size={14} /> Salir
            </Boton>
        </div>
      </div>

      {!vistaMisPartes ? (
        <form onSubmit={enviarParte} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div style={{ padding: '15px', border: `1px solid ${color.linea}`, fontSize: '12px', color: color.texto, letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
              Operario activo: <strong>{nombreOficial}</strong>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: color.texto, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Lugar de Trabajo / Hotel</label>
            <select onChange={(e) => {
                const val = e.target.value;
                if(val==='OTRA') { setEsOtraObra(true); setObraSeleccionada(null); }
                else { setEsOtraObra(false); setObraSeleccionada(obrasList.find(o => o.id === val)); }
            }} value={esOtraObra ? 'OTRA' : (obraSeleccionada?.id || '')} required style={{ width: '100%', padding: '15px', border: `1px solid ${color.linea}`, outline: 'none', backgroundColor: color.fondo, fontSize: '14px' }}>
              <option value="">-- Seleccionar Proyecto --</option>
              {obrasList.map((obra) => <option key={obra.id} value={obra.id}>{obra.nombre}</option>)}
              <option value="OTRA">+ Añadir nueva ubicación...</option>
            </select>
            {esOtraObra && <input type="text" value={obraNombreManual} onChange={(e) => setObraNombreManual(e.target.value)} required placeholder="Nombre del cliente o proyecto..." style={{ width: '100%', padding: '15px', border: `1px solid ${color.petroleo}`, marginTop: '10px', boxSizing: 'border-box' }} />}
          </div>

          {/* === SECCIÓN MEJORADA DE HABITACIONES Y TAREAS === */}
          <div style={{ padding: '20px', border: `1px solid ${color.linea}`, backgroundColor: color.fondo }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', fontWeight: 'bold', color: color.texto, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  <MapPin size={16}/> Registro por Habitaciones
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  <input type="text" placeholder="Ej: Habitación 101 o Pasillo 2" value={tareaUbicacion} onChange={(e) => setTareaUbicacion(e.target.value)} style={{ width: '100%', padding: '15px', border: `1px solid ${color.linea}`, outline: 'none', boxSizing: 'border-box', fontSize: '14px' }} />
                  <input type="text" placeholder="Ej: Instalación de puerta de paso" value={tareaDescripcion} onChange={(e) => setTareaDescripcion(e.target.value)} style={{ width: '100%', padding: '15px', border: `1px solid ${color.linea}`, outline: 'none', boxSizing: 'border-box', fontSize: '14px' }} />
                  
                  <button type="button" onClick={agregarTareaLista} style={{ padding: '15px', backgroundColor: color.petroleo, color: color.textoSobreOscuro, border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', marginTop: '5px' }}>
                      <Plus size={16}/> Añadir Habitación / Trabajo
                  </button>
              </div>

              {tareasRealizadas.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tareasRealizadas.map((t, index) => (
                          <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: `1px solid ${color.petroleo}`, backgroundColor: color.superficie }}>
                              <div>
                                  <strong style={{ display: 'block', marginBottom: '4px', color: color.texto, fontSize: '14px' }}>{t.ubicacion}</strong>
                                  <span style={{ color: color.textoSuave, fontSize: '13px' }}>{t.descripcion}</span>
                              </div>
                              <button type="button" onClick={()=>quitarTareaLista(index)} style={{ color: color.error, background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}><Trash2 size={18}/></button>
                          </li>
                      ))}
                  </ul>
              )}
          </div>

          {/* === SECCIÓN DE MATERIALES (Intacta) === */}
          <div style={{ padding: '20px', border: `1px solid ${color.linea}`, backgroundColor: color.fondo }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', fontWeight: 'bold', color: color.texto, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}><Package size={16}/> Material Extra Utilizado</label>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <select value={matSelectId} onChange={(e)=>setMatSelectId(e.target.value)} style={{ flex: 2, minWidth: '150px', padding: '12px', border: `1px solid ${color.linea}`, outline: 'none' }}>
                      <option value="">Buscar en inventario...</option>
                      {inventario.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                  <input type="number" placeholder="Cant." value={matSelectCant} onChange={(e)=>setMatSelectCant(e.target.value)} min="1" style={{ width: '70px', padding: '12px', border: `1px solid ${color.linea}`, outline: 'none' }} />
                  <input type="number" placeholder="Precio €" step="0.01" value={matSelectPrecio} onChange={(e)=>setMatSelectPrecio(e.target.value)} style={{ width: '90px', padding: '12px', border: `1px solid ${color.linea}`, outline: 'none' }} />
                  <button type="button" onClick={agregarMaterialLista} style={{ padding: '0 20px', backgroundColor: color.petroleo, color: color.textoSobreOscuro, border: 'none', fontWeight: 'bold', cursor: 'pointer' }}><Plus size={18}/></button>
              </div>

              {materialesUsados.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {materialesUsados.map((m, index) => (
                          <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 15px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, fontSize: '13px' }}>
                              <span><strong>{m.cantidad}x</strong> {m.nombre} <span style={{ color: color.textoSuave, marginLeft: '10px' }}>({m.precio.toFixed(2)}€/u &rarr; <strong>{(m.cantidad * m.precio).toFixed(2)}€</strong>)</span></span>
                              <button type="button" onClick={()=>quitarMaterialLista(index)} style={{ color: color.texto, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                          </li>
                      ))}
                  </ul>
              )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: color.texto, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Notas Extras / Observaciones Generales</label>
            <textarea value={trabajoLibre} onChange={(e) => setTrabajoLibre(e.target.value)} rows={2} placeholder="Información adicional que no encaje en las tareas..." style={{ width: '100%', padding: '15px', border: `1px solid ${color.linea}`, outline: 'none', backgroundColor: color.fondo, boxSizing: 'border-box' }} />
          </div>

          <div style={{ padding: '20px', border: `1px solid ${color.petroleo}` }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontWeight: 'bold', color: color.texto, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PenTool size={16}/> Firma de Conformidad</span>
                  <button type="button" onClick={(e) => { e.preventDefault(); firmaRef.current.clear(); }} style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: color.textoSuave, background: 'none', border: 'none', cursor: 'pointer' }}>Borrar</button>
              </label>
              <div style={{ border: `1px solid ${color.linea}`, backgroundColor: color.fondo }}>
                  {/* Los atributos width/height son la resolución INTERNA del lienzo,
                      no su tamaño en pantalla: de ahí sale el PNG de la firma. Tocarlos
                      cambia lo que se captura, así que se quedan como estaban.
                      touchAction evita que el dedo haga scroll mientras se firma. */}
                  <SignatureCanvas ref={firmaRef} penColor={color.petroleo} canvasProps={{ width: 500, height: 150, style: { width: '100%', height: '150px', touchAction: 'none' } }} />
              </div>
          </div>

          <button type="submit" style={{ width: '100%', padding: '20px', backgroundColor: color.petroleo, color: color.textoSobreOscuro, border: 'none', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s' }}>
              <Send size={18} /> Registrar Documento
          </button>
          
          {mensaje.texto && (
              <div style={{ padding: '15px', border: `1px solid ${mensaje.tipo === 'error' ? color.petroleo : color.petroleo}`, backgroundColor: mensaje.tipo === 'error' ? color.superficie : color.petroleo, color: mensaje.tipo === 'error' ? color.petroleo : color.superficie, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 'bold', letterSpacing: '1px', fontSize: '12px', textTransform: 'uppercase' }}>
                  {mensaje.texto}
              </div>
          )}
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {misPartes.map(p => (
                <div key={p.id} style={{ padding: '20px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px', color: color.texto, textTransform: 'uppercase', marginBottom: '5px' }}>{p.obra}</div>
                        <div style={{ fontSize: '12px', color: color.textoSuave }}>{p.fecha}</div>
                    </div>
                    <Insignia tono={insigniaEstado(p.estado).tono}>
                        {insigniaEstado(p.estado).texto}
                    </Insignia>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}