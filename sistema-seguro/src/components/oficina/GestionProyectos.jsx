import React, { useState } from 'react';
import { Trash2, X, History, User, CheckCircle, Search, ListChecks, Check } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { color } from '../../estilos/tokens';
import Insignia from '../../ui/Insignia';
import Modal from '../../ui/Modal';

export default function GestionProyectos({ blockStyle, labelStyle, inputStyle, btnBlackStyle, nuevaObra, setNuevaObra, numPlantas, setNumPlantas, configHabitaciones, setConfigHabitaciones, generarHotelInteligente, obrasList, obraActiva, setObraActiva, borrarObra, obtenerEstadisticasHotel, marcarTareaHotel }) {
  
  // Estados para el Modal
  const [habitacionActiva, setHabitacionActiva] = useState(null);
  const [historialList, setHistorialList] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  
  // NUEVOS ESTADOS PARA LA SELECCIÓN MÚLTIPLE
  const [modoRapido, setModoRapido] = useState(false); 
  const [seleccionMultiple, setSeleccionMultiple] = useState([]); 

  // Activa o desactiva el modo de selección múltiple limpiando las que estuvieran marcadas
  const alternarModoRapido = () => {
      setModoRapido(!modoRapido);
      setSeleccionMultiple([]);
  };

  // Función que confirma y guarda todas las habitaciones seleccionadas a la vez
  // Función que confirma y guarda todas las habitaciones seleccionadas
// Función que confirma y guarda todas las habitaciones seleccionadas a la vez
  const confirmarSeleccionMultiple = () => {
      // Le mandamos el array entero de golpe a la base de datos
      marcarTareaHotel(seleccionMultiple);
      
      setSeleccionMultiple([]); // Vaciamos la selección
      setModoRapido(false); // Apagamos el modo rápido al terminar
  };

  // Función inteligente que abre el modal
  const abrirModalHabitacion = async (tarea) => {
      setHabitacionActiva(tarea);
      setLoadingHistorial(true);
      try {
          // Sin orderBy a propósito: combinar la igualdad sobre `obra` con un orden por
          // `timestamp` exigiría un índice compuesto que no existe en el proyecto.
          // El historial resultante se ordena en cliente unas líneas más abajo.
          const q = query(collection(db, 'partes_de_trabajo'), where("obra", "==", obraActiva.nombre), limit(200));
          const querySnapshot = await getDocs(q);
          
          let historial = [];

          querySnapshot.forEach((doc) => {
              const data = doc.data();
              if (data.tareasRealizadas && Array.isArray(data.tareasRealizadas)) {
                  data.tareasRealizadas.forEach(t => {
                      const nombreHab = tarea.nombre.toLowerCase().trim(); 
                      const ubic = (t.ubicacion || '').toLowerCase().trim(); 
                      
                      let esCoincidencia = false;

                      if (ubic.includes(nombreHab) || nombreHab.includes(ubic)) {
                          esCoincidencia = true;
                      } else {
                          const numerosCaja = nombreHab.match(/\d+/g)?.map(Number) || [];
                          const numerosInput = ubic.match(/\d+/g)?.map(Number) || [];
                          const rangos = [...ubic.matchAll(/(\d+)\s*(?:-|al|a)\s*(\d+)/g)];

                          for (const numCaja of numerosCaja) {
                              for (const rango of rangos) {
                                  const inicio = Math.min(Number(rango[1]), Number(rango[2]));
                                  const fin = Math.max(Number(rango[1]), Number(rango[2]));
                                  if (numCaja >= inicio && numCaja <= fin) {
                                      esCoincidencia = true;
                                      break;
                                  }
                              }
                              if (numerosInput.includes(numCaja)) {
                                  esCoincidencia = true;
                                  break;
                              }
                          }
                      }

                      if (esCoincidencia) {
                          historial.push({
                              fecha: data.fecha,
                              trabajador: data.nombreTrabajador || data.creador,
                              descripcion: t.descripcion,
                              timestamp: data.timestamp
                          });
                      }
                  });
              }
          });

          historial.sort((a, b) => b.timestamp - a.timestamp);
          setHistorialList(historial);
      } catch (error) {
          console.error("Error cargando el historial:", error);
      }
      setLoadingHistorial(false);
  };

  return (
      <div style={blockStyle}>
        <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Gestión de Proyectos y Hoteles</h3>
        
        {/* PANEL DE CREACIÓN */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap', backgroundColor: color.fondo, padding: '20px', border: `1px solid ${color.linea}` }}>
          <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Identificador Proyecto</label><input type="text" value={nuevaObra} onChange={(e) => setNuevaObra(e.target.value)} placeholder="Hotel / Obra..." style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '100px' }}><label style={labelStyle}>Nº Plantas</label><input type="number" value={numPlantas} onChange={(e) => setNumPlantas(e.target.value)} min="1" style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '100px' }}><label style={labelStyle}>Unidades/Planta</label><input type="text" value={configHabitaciones} onChange={(e) => setConfigHabitaciones(e.target.value)} placeholder="Ej: 10, 15, 8" style={inputStyle} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={generarHotelInteligente} style={btnBlackStyle}>Inicializar</button></div>
        </div>
        
        {/* LISTADO DE PROYECTOS / HOTELES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          {obrasList.map(obra => { 
              const tareasTotales = obra.tareas?.length || 0; 
              const tareasHechas = obra.tareas?.filter(t => t.completada).length || 0; 
              const porcentaje = tareasTotales === 0 ? 0 : Math.round((tareasHechas / tareasTotales) * 100); 
              return ( 
                  <div key={obra.id} onClick={() => setObraActiva(obra)} style={{ backgroundColor: obraActiva?.id === obra.id ? color.fondo : color.superficie, border: obraActiva?.id === obra.id ? `2px solid ${color.petroleo}` : `1px solid ${color.linea}`, padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><h4 style={{ margin: '0 0 15px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>{obra.nombre}</h4><button onClick={(e) => { e.stopPropagation(); borrarObra(obra.id); }} style={{ color: color.texto, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button></div>
                      <div style={{ backgroundColor: color.linea, height: '4px', overflow: 'hidden' }}><div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: color.petroleo, transition: 'width 0.5s ease-in-out' }}></div></div>
                      <p style={{ margin: '10px 0 0 0', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Progreso: {tareasHechas} / {tareasTotales} ({porcentaje}%)</p>
                  </div> 
              ); 
          })}
        </div>

        {/* DETALLE DEL HOTEL ACTIVO */}
        {obraActiva && ( 
            <div style={{ marginTop: '30px', padding: '30px', backgroundColor: color.fondo, border: `1px solid ${color.linea}` }}>
                <h4 style={{ margin: '0 0 20px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ficha Global: {obraActiva.nombre}</h4>
                
                {/* ESTADÍSTICAS GLOBALES */}
                {(() => {
                    const stats = obtenerEstadisticasHotel(obraActiva.nombre, obraActiva.id);
                    return (
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' }}>
                            <div style={{ padding: '20px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, minWidth: '150px' }}>
                                <div style={labelStyle}>Horas Totales Invertidas</div>
                                <div style={{ fontSize: '24px', fontWeight: '300' }}>{stats.horas}h</div>
                            </div>
                            <div style={{ padding: '20px', border: `1px solid ${color.linea}`, backgroundColor: color.superficie, flex: 1 }}>
                                <div style={labelStyle}>Desglose de Material Acumulado</div>
                                {stats.materiales.length === 0 ? <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Sin consumo registrado</span> : <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{stats.materiales.map(([n, c], i) => <Insignia key={i} tono="neutra">{c}x {n}</Insignia> )}</div>}
                            </div>
                        </div>
                    );
                })()}

                {/* MAPA DE HABITACIONES Y CONTROLES DE SELECCIÓN */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                        <p style={{...labelStyle, margin: 0}}>
                            Mapa de Unidades {modoRapido && <span style={{color: color.vidrio, fontWeight: 'bold'}}> (Modo Selección Activado)</span>}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {/* Botón de Confirmar (Solo aparece si hay habitaciones seleccionadas) */}
                            {modoRapido && seleccionMultiple.length > 0 && (
                                <button 
                                    onClick={confirmarSeleccionMultiple}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', 
                                        backgroundColor: color.exito, // Verde confirmación
                                        color: color.textoSobreOscuro, 
                                        border: 'none', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 4px 6px rgba(47, 124, 135, 0.30)'
                                    }}>
                                    <Check size={16} />
                                    Confirmar {seleccionMultiple.length} Habitaciones
                                </button>
                            )}

                            {/* Botón para Activar/Cancelar el Modo de Selección */}
                            <button 
                                onClick={alternarModoRapido}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', 
                                    backgroundColor: modoRapido ? color.superficieHundida : color.superficie, 
                                    color: color.texto, 
                                    border: `1px solid ${color.petroleo}`, fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                {modoRapido ? <X size={16} /> : <ListChecks size={16} />}
                                {modoRapido ? 'Cancelar Selección' : 'Selección Múltiple'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                        {obraActiva.tareas?.map(tarea => {
                            // Lógica visual para saber si la habitación está en el "carrito" de seleccionadas
                            const estaSeleccionada = seleccionMultiple.includes(tarea.id);
                            
                            // Colores dinámicos
                            let bgColor = tarea.completada ? color.petroleo : color.superficie;
                            let textColor = tarea.completada ? color.textoSobreOscuro : color.petroleo;
                            let borderColor = `${color.petroleo}`;

                            // Si está seleccionada, la pintamos de azul para que destaque
                            if (estaSeleccionada) {
                                bgColor = `${color.vidrio}`; // Azul
                                textColor = color.textoSobreOscuro;
                                borderColor = `${color.vidrio}`;
                            }

                            return (
                                <div key={tarea.id} 
                                    onClick={() => {
                                        if (modoRapido) {
                                            // Si está seleccionada, la quitamos. Si no, la añadimos.
                                            if (estaSeleccionada) {
                                                setSeleccionMultiple(seleccionMultiple.filter(id => id !== tarea.id));
                                            } else {
                                                setSeleccionMultiple([...seleccionMultiple, tarea.id]);
                                            }
                                        } else {
                                            // Si el modo rápido está apagado, abre la ficha normal
                                            abrirModalHabitacion(tarea);
                                        }
                                    }} 
                                    style={{ 
                                        padding: '12px 5px', 
                                        backgroundColor: bgColor, 
                                        color: textColor, 
                                        border: `1px solid ${borderColor}`, 
                                        cursor: 'pointer', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', userSelect: 'none', transition: 'all 0.2s', 
                                        boxShadow: estaSeleccionada ? '0 0 10px rgba(47, 124, 135, 0.40)' : '0 2px 4px rgba(12, 42, 49, 0.06)' 
                                    }}>
                                    {tarea.nombre}
                                </div> 
                            );
                        })}
                    </div>
                </div>
            </div> 
        )}

        {/* === MODAL / FICHA TÉCNICA DE LA HABITACIÓN === */}
        {habitacionActiva && (
            <Modal
                abierto
                titulo={'Ficha: ' + habitacionActiva.nombre}
                onCerrar={() => setHabitacionActiva(null)}
            >

                    <button onClick={() => {
                        marcarTareaHotel(habitacionActiva.id);
                        setHabitacionActiva({...habitacionActiva, completada: !habitacionActiva.completada});
                    }} style={{ width: '100%', padding: '15px', backgroundColor: habitacionActiva.completada ? color.petroleo : color.superficie, color: habitacionActiva.completada ? color.superficie : color.petroleo, border: `1px solid ${color.petroleo}`, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '25px', transition: 'all 0.3s' }}>
                        <CheckCircle size={18}/>
                        {habitacionActiva.completada ? 'Habitación Completada (Click para reabrir)' : 'Marcar como Completada'}
                    </button>

                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: color.textoSuave, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <History size={16}/> Historial de Operarios
                    </h4>

                    {loadingHistorial ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: color.textoSuave }}>
                            <Search size={24} className="animate-spin" /> 
                        </div>
                    ) : historialList.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {historialList.map((item, idx) => (
                                <div key={idx} style={{ padding: '15px', border: `1px solid ${color.linea}`, backgroundColor: color.fondo, borderLeft: `4px solid ${color.petroleo}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: color.texto }}>{item.fecha}</span>
                                        <span style={{ fontSize: '11px', color: color.textoSuave, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
                                            <User size={12}/> {item.trabajador}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '13px', color: color.texto }}>{item.descripcion}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '30px 20px', textAlign: 'center', border: `1px dashed ${color.canto}`, fontSize: '12px', color: color.textoSuave, backgroundColor: color.superficieTenida }}>
                            No hay trabajos registrados en esta habitación todavía. <br/>
                            <span style={{fontSize: '10px'}}>(Los operarios deben añadir "{habitacionActiva.nombre}" en su parte diario).</span>
                        </div>
                    )}
            </Modal>
        )}
      </div> 
  );
}