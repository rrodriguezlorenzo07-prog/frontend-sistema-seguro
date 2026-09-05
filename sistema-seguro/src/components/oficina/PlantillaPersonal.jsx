import React from 'react';
import { Edit, Trash2, KeyRound } from 'lucide-react';
import { HORAS_BASE_POR_DEFECTO } from '../../utils/nomina';
import { color } from '../../estilos/tokens';

export default function PlantillaPersonal({ 
    blockStyle, labelStyle, inputStyle, btnBlackStyle, 
    nuevoTrabajadorNombre, setNuevoTrabajadorNombre, 
    nuevoTrabajadorEmail, setNuevoTrabajadorEmail, 
    nuevoTrabajadorPass, setNuevoTrabajadorPass, 
    registrarTrabajador, trabajadoresList, 
    editandoTrabId, trabEditado, setTrabEditado, 
    guardarEdicionTrabajador, enviarResetPass, 
    setEditandoTrabId, iniciarEdicionTrabajador, 
    borrarTrabajador, cambiarPermisoTrabajador, cambiandoPermiso
}) {
  /**
   * Un interruptor por permiso. Los DOS son independientes: administrar la obra no
   * implica ver lo que se paga, y por eso el de nóminas no se deshabilita para quien
   * no es admin — deshabilitarlo insinuaría una jerarquía que no existe. El aviso de
   * que todavía no le sirve va en la confirmación.
   */
  const Interruptor = ({ trab, permiso, activo, etiquetaSi, etiquetaNo }) => {
      const aplicando = cambiandoPermiso?.id === trab.id && cambiandoPermiso?.permiso === permiso;
      return (
          <button
              onClick={() => cambiarPermisoTrabajador(trab.id, permiso, activo, trab.nombre)}
              disabled={!!cambiandoPermiso}
              title={permiso === 'veNominas'
                  ? 'Ver las horas extra y los importes de toda la plantilla'
                  : 'Entrar al panel de oficina: validar partes, planificar y catálogos'}
              style={{
                  padding: '6px 12px', borderRadius: '50px', fontSize: '10px', fontWeight: 'bold',
                  letterSpacing: '1px', textTransform: 'uppercase',
                  cursor: cambiandoPermiso ? 'wait' : 'pointer',
                  opacity: cambiandoPermiso && !aplicando ? 0.4 : (aplicando ? 0.6 : 1),
                  border: activo ? `1px solid ${color.vidrio}` : `1px solid ${color.linea}`,
                  backgroundColor: activo ? color.infoSuave : color.fondo,
                  color: activo ? color.vidrio : color.textoSuave,
                  transition: 'all 0.2s ease-in-out'
              }}
          >
              {aplicando ? 'Aplicando...' : (activo ? etiquetaSi : etiquetaNo)}
          </button>
      );
  };

  return (
      <div style={blockStyle}>
          <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Centro de Recursos Humanos</h3>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap', backgroundColor: color.fondo, padding: '20px', border: `1px solid ${color.linea}` }}>
              <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Nombre del Empleado</label><input type="text" value={nuevoTrabajadorNombre} onChange={(e) => setNuevoTrabajadorNombre(e.target.value)} placeholder="Ej: Juan Pérez" style={inputStyle} /></div>
              <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Correo Corporativo</label><input type="email" value={nuevoTrabajadorEmail} onChange={(e) => setNuevoTrabajadorEmail(e.target.value)} placeholder="correo@empresa.com" style={inputStyle} /></div>
              <div style={{ flex: 2, minWidth: '150px' }}><label style={labelStyle}>Clave de Acceso Inicial</label><input type="text" value={nuevoTrabajadorPass} onChange={(e) => setNuevoTrabajadorPass(e.target.value)} placeholder="Min. 6 caracteres" style={inputStyle} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={registrarTrabajador} style={btnBlackStyle}>Registrar Empleado</button></div>
          </div>
          
          <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Plantilla Actual ({trabajadoresList.length})</h4>
          <div style={{ display: 'grid', gap: '1px', backgroundColor: color.linea, border: `1px solid ${color.linea}` }}>
              {trabajadoresList.map(trab => (
                  <div key={trab.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.superficie, padding: '15px 20px', flexWrap: 'wrap', gap: '15px' }}>
                      {editandoTrabId === trab.id ? (
                          <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
                              <input type="text" value={trabEditado.nombre} onChange={e => setTrabEditado({...trabEditado, nombre: e.target.value})} style={{ flex: 1, padding: '10px', border: `1px solid ${color.petroleo}`, outline: 'none', fontSize: '12px', minWidth: '150px' }} />
                              <input type="email" value={trabEditado.email} onChange={e => setTrabEditado({...trabEditado, email: e.target.value})} style={{ flex: 1, padding: '10px', border: `1px solid ${color.petroleo}`, outline: 'none', fontSize: '12px', minWidth: '150px' }} />
                              <input type="number" min="0" step="1" placeholder="Base mensual (h)" value={trabEditado.horasBaseMensuales ?? ''} onChange={e => setTrabEditado({...trabEditado, horasBaseMensuales: e.target.value})} style={{ width: '150px', padding: '10px', border: `1px solid ${color.petroleo}`, outline: 'none', fontSize: '12px' }} title={`Horas normales de contrato al mes. Vacío = valor por defecto (${HORAS_BASE_POR_DEFECTO} h)`} />
                              <div style={{ display: 'flex', gap: '5px' }}>
                                  <button onClick={guardarEdicionTrabajador} style={{ background: color.petroleo, color: color.textoSobreOscuro, border: 'none', padding: '10px 15px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Guardar</button>
                                  {trabEditado.email && ( 
                                      <button onClick={() => enviarResetPass(trabEditado.email)} style={{ background: color.fondo, color: color.texto, border: `1px solid ${color.linea}`, padding: '10px 15px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }} title="Enviar enlace para cambiar contraseña"><KeyRound size={14}/> Resetear</button> 
                                  )}
                                  <button onClick={() => setEditandoTrabId(null)} style={{ background: 'transparent', border: `1px solid ${color.petroleo}`, padding: '10px 15px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Cancelar</button>
                              </div>
                          </div> 
                      ) : (
                          <>
                              <div style={{ flex: 1, minWidth: '200px' }}>
                                  <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>{trab.nombre}</strong>
                                  <div style={{ fontSize: '11px', color: color.textoSuave, marginTop: '4px' }}>CUENTA VINCULADA: {trab.email ? trab.email : 'SIN VINCULAR'}</div>
                                  <div style={{ fontSize: '11px', color: trab.horasBaseMensuales ? color.textoSuave : color.aviso, marginTop: '2px' }}>BASE MENSUAL: {trab.horasBaseMensuales ? `${trab.horasBaseMensuales} h` : `${HORAS_BASE_POR_DEFECTO} h (por defecto, sin configurar)`}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>

                                  {/* DOS PERMISOS INDEPENDIENTES, un interruptor cada uno. */}
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <Interruptor
                                          trab={trab}
                                          permiso="admin"
                                          activo={trab.rol === 'admin'}
                                          etiquetaSi="Operativa"
                                          etiquetaNo="Sin oficina"
                                      />
                                      <Interruptor
                                          trab={trab}
                                          permiso="veNominas"
                                          activo={trab.veNominas === true}
                                          etiquetaSi="Nóminas"
                                          etiquetaNo="Sin nóminas"
                                      />
                                  </div>

                                  <button onClick={() => iniciarEdicionTrabajador(trab)} style={{ color: color.texto, background: 'none', border: 'none', cursor: 'pointer' }}><Edit size={16}/></button>
                                  <button onClick={() => borrarTrabajador(trab.id)} style={{ color: color.texto, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                              </div>
                          </>
                      )}
                  </div>
              ))}
          </div>
      </div>
  );
}