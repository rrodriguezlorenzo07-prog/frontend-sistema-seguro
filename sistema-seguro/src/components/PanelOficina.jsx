import { useState, useEffect } from 'react';
import { db, auth, authSecundario, functions } from '../firebase'; 
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, getDoc, writeBatch, orderBy, limit, startAfter, where } from 'firebase/firestore';
import { signOut, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth'; 
import { Building2, FileText, Users, Calculator, Inbox, CheckCircle, Package, FolderOpen, AlertTriangle, Settings, Menu, X, ArrowLeftRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { horasTotalesDocumento } from '../utils/horasDocumento';
import { HORAS_BASE_POR_DEFECTO } from '../utils/nomina';
import BandejaValidacion from './oficina/BandejaValidacion';
import ResumenMetricas from './oficina/ResumenMetricas';
import GestionProyectos from './oficina/GestionProyectos';
import PlantillaPersonal from './oficina/PlantillaPersonal';
import ControlNominas from './oficina/ControlNominas';
import InventarioAlmacen from './oficina/InventarioAlmacen';
import HistorialAlbaranes from './oficina/HistorialAlbaranes';
import GeneradorCertificaciones from './oficina/GeneradorCertificaciones';
import EmisionFacturas from './oficina/EmisionFacturas';
import PresupuestosOfertas from './oficina/PresupuestosOfertas';
import PapeleraReciclaje from './oficina/PapeleraReciclaje';

export default function PanelOficina({ cambiarVista }) {
  const TAMANO_PAGINA = 300;
  const LIMITE_DOCUMENTOS = 200;

  const [cargando, setCargando] = useState(true);

  const [partes, setPartes] = useState([]);
  const [obrasList, setObrasList] = useState([]);
  const [materialesList, setMaterialesList] = useState([]);
  const [presupuestosList, setPresupuestosList] = useState([]); 
  const [trabajadoresList, setTrabajadoresList] = useState([]);
  const [certificacionesList, setCertificacionesList] = useState([]);
  const [facturasList, setFacturasList] = useState([]);
  
  const [ultimoDocPartes, setUltimoDocPartes] = useState(null);
  const [hayMasPartes, setHayMasPartes] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [modoBusqueda, setModoBusqueda] = useState(false);
  
  const [categoriaActiva, setCategoriaActiva] = useState('validacion');
  const [pestañaActiva, setPestañaActiva] = useState('bandeja');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  
  const [nuevaObra, setNuevaObra] = useState('');
  const [numPlantas, setNumPlantas] = useState(1);
  const [configHabitaciones, setConfigHabitaciones] = useState('10'); 
  const [obraActiva, setObraActiva] = useState(null);

  const [parteAValidar, setParteAValidar] = useState(null);
  const [cuadrilla, setCuadrilla] = useState([]);
  const [validandoParte, setValidandoParte] = useState(false);
  const [nuevoOperario, setNuevoOperario] = useState('');

  const [nuevoTrabajadorNombre, setNuevoTrabajadorNombre] = useState('');
  const [nuevoTrabajadorEmail, setNuevoTrabajadorEmail] = useState('');
  const [nuevoTrabajadorPass, setNuevoTrabajadorPass] = useState(''); 
  const [editandoTrabId, setEditandoTrabId] = useState(null);
  const [cambiandoRolId, setCambiandoRolId] = useState(null);
  const [trabEditado, setTrabEditado] = useState({});

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const hoyStr = hoy.toISOString().split('T')[0];

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(hoyStr);
  const [filtroBuscador, setFiltroBuscador] = useState('');
  const [ordenPartes, setOrdenPartes] = useState('recientes');
  const [limitePartes, setLimitePartes] = useState(50);

  const [filtroMateriales, setFiltroMateriales] = useState('');
  const [ordenMateriales, setOrdenMateriales] = useState('alfabetico');
  const [nuevoMatNombre, setNuevoMatNombre] = useState('');
  const [nuevoMatStock, setNuevoMatStock] = useState('');
  const [editandoMatId, setEditandoMatId] = useState(null);
  const [matEditado, setMatEditado] = useState({});

  const [presuCliente, setPresuCliente] = useState('');
  const [presuItems, setPresuItems] = useState([]); 
  const [presuSelectMat, setPresuSelectMat] = useState('');
  const [presuCantMat, setPresuCantMat] = useState(1);
  const [presuPrecioMat, setPresuPrecioMat] = useState('');
  const [presuHoras, setPresuHoras] = useState('');
  const [presuPrecioHora, setPresuPrecioHora] = useState('');

  const [certObraSeleccionada, setCertObraSeleccionada] = useState('');
  const [certPartesSeleccionados, setCertPartesSeleccionados] = useState([]);

  const [modoFacturacion, setModoFacturacion] = useState('albaranes'); 
  const [facturaCliente, setFacturaCliente] = useState('');
  const [itemsAFacturar, setItemsAFacturar] = useState([]);
  const [facTarifaHora, setFacTarifaHora] = useState('');
  const [facImporteMateriales, setFacImporteMateriales] = useState('');

  const [pagoHoraNormal, setPagoHoraNormal] = useState(10);
  const [pagoHoraExtra, setPagoHoraExtra] = useState(15);

  const [toast, setToast] = useState({ visible: false, mensaje: '', tipo: 'success' });
  const [modalConfirm, setModalConfirm] = useState({ visible: false, titulo: '', mensaje: '', onConfirm: null });

  const mostrarToast = (mensaje, tipo = 'success') => { setToast({ visible: true, mensaje, tipo }); setTimeout(() => setToast({ visible: false, mensaje: '', tipo: 'success' }), 3000); };
  const pedirConfirmacion = (titulo, mensaje, accionConfirmar) => { setModalConfirm({ visible: true, titulo, mensaje, onConfirm: accionConfirmar }); };
  const cerrarModal = () => setModalConfirm({ ...modalConfirm, visible: false });

  // Actualizaciones locales para no releer toda la base tras una escritura conocida.
  const actualizarEnLista = (setLista, id, cambios) => setLista(prev => prev.map(x => (x.id === id ? { ...x, ...cambios } : x)));
  const quitarDeLista = (setLista, id) => setLista(prev => prev.filter(x => x.id !== id));

  // Consultas reutilizadas por la carga inicial y por los refrescos puntuales.
  const consultaPartes = () => query(collection(db, 'partes_de_trabajo'), orderBy('timestamp', 'desc'), limit(TAMANO_PAGINA));
  const consultaPresupuestos = () => query(collection(db, 'presupuestos'), orderBy('timestamp', 'desc'), limit(LIMITE_DOCUMENTOS));
  const consultaCertificaciones = () => query(collection(db, 'certificaciones'), orderBy('timestamp', 'desc'), limit(LIMITE_DOCUMENTOS));
  const consultaFacturas = () => query(collection(db, 'facturas'), orderBy('timestamp', 'desc'), limit(LIMITE_DOCUMENTOS));

  const mapear = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Refrescos de una sola colección, para no releer las siete tras cada escritura.
  const refrescarTrabajadores = async () => {
      const snap = await getDocs(collection(db, 'trabajadores'));
      setTrabajadoresList(mapear(snap).sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const refrescarObras = async () => {
      const snap = await getDocs(collection(db, 'obras'));
      const frescas = mapear(snap);
      setObrasList(frescas);
      setObraActiva(prev => (prev ? frescas.find(o => o.id === prev.id) || prev : null));
  };
  const refrescarInventario = async () => {
      setMaterialesList(mapear(await getDocs(collection(db, 'inventario'))));
  };
  const refrescarPresupuestos = async () => {
      setPresupuestosList(mapear(await getDocs(consultaPresupuestos())));
  };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Las siete consultas van en paralelo: antes eran siete await encadenados.
      const [snapPartes, snapObras, snapMateriales, snapPresu, snapTrab, snapCert, snapFacturas] = await Promise.all([
        getDocs(consultaPartes()),
        getDocs(collection(db, 'obras')),
        getDocs(collection(db, 'inventario')),
        getDocs(consultaPresupuestos()),
        getDocs(collection(db, 'trabajadores')),
        getDocs(consultaCertificaciones()),
        getDocs(consultaFacturas())
      ]);

      if (!snapPartes.empty) {
          setUltimoDocPartes(snapPartes.docs[snapPartes.docs.length - 1]);
          setPartes(mapear(snapPartes));
          setHayMasPartes(snapPartes.docs.length === TAMANO_PAGINA);
      } else {
          setPartes([]); setUltimoDocPartes(null); setHayMasPartes(false);
      }
      setModoBusqueda(false);

      const listaObrasFrescas = mapear(snapObras);
      setObrasList(listaObrasFrescas);
      setObraActiva(prev => (prev ? listaObrasFrescas.find(o => o.id === prev.id) || prev : null));

      setMaterialesList(mapear(snapMateriales));
      setPresupuestosList(mapear(snapPresu));
      setTrabajadoresList(mapear(snapTrab).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCertificacionesList(mapear(snapCert));
      setFacturasList(mapear(snapFacturas));
    } catch (error) { console.error("Error:", error); mostrarToast("Error cargando base de datos", "error"); } finally { setCargando(false); }
  };

  useEffect(() => { cargarDatos(); }, []);

  const cargarMasPartes = async () => {
      if (!ultimoDocPartes) return;
      setCargandoMas(true);
      try {
          const rango = modoBusqueda ? getTimeRango() : null;
          const q = modoBusqueda
              ? query(collection(db, 'partes_de_trabajo'), where('timestamp', '>=', rango.start), where('timestamp', '<=', rango.end), orderBy('timestamp', 'desc'), startAfter(ultimoDocPartes), limit(TAMANO_PAGINA))
              : query(collection(db, 'partes_de_trabajo'), orderBy('timestamp', 'desc'), startAfter(ultimoDocPartes), limit(TAMANO_PAGINA));
          const res = await getDocs(q);
          if (!res.empty) {
              setUltimoDocPartes(res.docs[res.docs.length - 1]);
              const nuevos = res.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setPartes(prev => [...prev, ...nuevos]);
              if (res.docs.length < TAMANO_PAGINA) setHayMasPartes(false);
          } else { setHayMasPartes(false); }
      } catch (error) { console.error(error); mostrarToast("Error al descargar más historial", "error"); }
      setCargandoMas(false);
  };

  const buscarPartesPorFechas = async () => {
      const inicioMs = new Date(fechaInicio).getTime();
      const finMs = new Date(fechaFin).getTime();
      if (!fechaInicio || !fechaFin || Number.isNaN(inicioMs) || Number.isNaN(finMs)) {
          mostrarToast("Indica una fecha de inicio y otra de fin válidas antes de buscar.", "error");
          return;
      }
      if (inicioMs > finMs) {
          mostrarToast("La fecha de inicio es posterior a la de fin.", "error");
          return;
      }
      mostrarToast("Buscando en el archivo histórico...", "success");
      try {
          const { start, end } = getTimeRango();
          // El orderBy va sobre el mismo campo que la desigualdad: no necesita índice compuesto.
          const q = query(collection(db, 'partes_de_trabajo'), where('timestamp', '>=', start), where('timestamp', '<=', end), orderBy('timestamp', 'desc'), limit(TAMANO_PAGINA));
          const snap = await getDocs(q);
          setPartes(mapear(snap));
          setUltimoDocPartes(snap.empty ? null : snap.docs[snap.docs.length - 1]);
          setHayMasPartes(snap.docs.length === TAMANO_PAGINA);
          setModoBusqueda(true);
          mostrarToast(`Se han cargado ${snap.size} partes de ese periodo${snap.docs.length === TAMANO_PAGINA ? ', hay más disponibles' : ''}.`);
      } catch (error) {
          console.error(error); mostrarToast("Error al buscar en esas fechas", "error");
      }
  };

  const trabajadoresActivos = trabajadoresList.filter(t => !t.papelera);
  const trabajadoresPapelera = trabajadoresList.filter(t => t.papelera);
  const partesActivos = partes.filter(p => !p.papelera);
  const partesPapelera = partes.filter(p => p.papelera);
  const certificacionesActivas = certificacionesList.filter(c => !c.papelera);
  const certificacionesPapelera = certificacionesList.filter(c => c.papelera);
  const obrasActivas = obrasList.filter(o => !o.papelera);
  const obrasPapelera = obrasList.filter(o => o.papelera);

  const partesPendientes = partesActivos.filter(p => p.estado === 'pendiente');
  const partesHistorial = partesActivos.filter(p => p.estado === 'aprobado');

  // Emparejador de ubicaciones replicado de GestionProyectos.jsx (abrirModalHabitacion).
  // No se importa de allí porque allí vive en línea dentro del componente; unificar ambos
  // es tarea del futuro módulo de lógica compartida.
  // Diferencia deliberada: se prioriza tarea.numeroHabitacion cuando existe, para no arrastrar
  // el número de planta del nombre ("P1 - Hab 101" -> [1, 101]) al emparejamiento.
  const ubicacionCoincideConTarea = (tarea, ubicacion) => {
      const nombreHab = (tarea.nombre || '').toLowerCase().trim();
      const ubic = (ubicacion || '').toLowerCase().trim();
      if (!ubic || !nombreHab) return false;
      if (ubic.includes(nombreHab) || nombreHab.includes(ubic)) return true;

      const numerosCaja = tarea.numeroHabitacion !== undefined ? [Number(tarea.numeroHabitacion)] : (nombreHab.match(/\d+/g)?.map(Number) || []);
      const numerosInput = ubic.match(/\d+/g)?.map(Number) || [];
      const rangos = [...ubic.matchAll(/(\d+)\s*(?:-|al|a)\s*(\d+)/g)];

      for (const numCaja of numerosCaja) {
          if (numerosInput.includes(numCaja)) return true;
          for (const rango of rangos) {
              const inicio = Math.min(Number(rango[1]), Number(rango[2]));
              const fin = Math.max(Number(rango[1]), Number(rango[2]));
              if (numCaja >= inicio && numCaja <= fin) return true;
          }
      }
      return false;
  };

  const abrirValidacion = (parte) => { setParteAValidar(parte); setCuadrilla([{ nombre: parte.nombreTrabajador || parte.creador, horasExtra: 0 }]); };
  const agregarOperarioCuadrilla = () => { if(!nuevoOperario) return; if(cuadrilla.some(op => op.nombre === nuevoOperario)) return; setCuadrilla([...cuadrilla, { nombre: nuevoOperario, horasExtra: 0 }]); setNuevoOperario(''); };
  const cambiarHorasExtra = (index, cantidad) => { const nueva = [...cuadrilla]; const actual = Number(nueva[index].horasExtra) || 0; nueva[index] = { ...nueva[index], horasExtra: Math.max(0, actual + cantidad) }; setCuadrilla(nueva); };
  const setHorasExtraDirecto = (index, valor) => { const nueva = [...cuadrilla]; nueva[index] = { ...nueva[index], horasExtra: valor === '' ? '' : Math.max(0, parseFloat(valor) || 0) }; setCuadrilla(nueva); };
  const quitarOperario = (index) => { const nueva = [...cuadrilla]; nueva.splice(index, 1); setCuadrilla(nueva); };

  const registrarTrabajador = async () => { if(!nuevoTrabajadorNombre) { mostrarToast("Escribe el nombre del trabajador.", "error"); return; } try { if (nuevoTrabajadorEmail && nuevoTrabajadorPass) { if (nuevoTrabajadorPass.length < 6) { mostrarToast("La contraseña debe tener al menos 6 caracteres.", "error"); return; } const credenciales = await createUserWithEmailAndPassword(authSecundario, nuevoTrabajadorEmail, nuevoTrabajadorPass); await sendEmailVerification(credenciales.user); } await addDoc(collection(db, 'trabajadores'), { nombre: nuevoTrabajadorNombre.trim(), email: nuevoTrabajadorEmail.trim().toLowerCase(), rol: 'operario', papelera: false, horasBaseMensuales: HORAS_BASE_POR_DEFECTO }); setNuevoTrabajadorNombre(''); setNuevoTrabajadorEmail(''); setNuevoTrabajadorPass(''); refrescarTrabajadores(); mostrarToast("Trabajador registrado en plantilla."); } catch (error) { mostrarToast("Error: " + error.message, "error"); } };
  
  const cambiarRolTrabajador = (id, rolActual, nombre) => {
      const trabajador = trabajadoresList.find(t => t.id === id);
      const nuevoRol = (rolActual === 'admin') ? 'operario' : 'admin';

      // El permiso real vive en roles/{uid de Auth}, y la ficha solo guarda el email.
      if (!trabajador?.email) {
          mostrarToast(`${nombre} no tiene cuenta de acceso vinculada: no se le puede dar permiso.`, "error");
          return;
      }

      pedirConfirmacion("Cambiar Permisos", `¿Convertir a ${nombre} en ${nuevoRol.toUpperCase()}?`, async () => {
          if (cambiandoRolId) return;
          setCambiandoRolId(id);
          try {
              // 1. Permiso efectivo: roles/{uid} está cerrado a los clientes por reglas,
              //    así que solo lo escribe la Cloud Function con el Admin SDK.
              const asignarRolAdmin = httpsCallable(functions, 'asignarRolAdmin');
              const respuesta = await asignarRolAdmin({ email: trabajador.email, esAdmin: nuevoRol === 'admin' });

              // 2. Rol visible en la ficha, solo para la interfaz.
              await updateDoc(doc(db, 'trabajadores', id), { rol: nuevoRol });
              actualizarEnLista(setTrabajadoresList, id, { rol: nuevoRol });

              const aplicado = respuesta?.data?.admin === true ? 'con acceso de administrador' : 'sin acceso de administrador';
              mostrarToast(`${nombre} queda ${aplicado}.`);
          } catch (error) {
              // La lista no se ha tocado todavía, así que no hay nada que revertir.
              console.error(error);
              mostrarToast(`No se pudo cambiar el permiso: ${error?.message || 'error desconocido'}`, "error");
          } finally {
              setCambiandoRolId(null);
          }
      });
  };

  const enviarResetPass = (email) => { if (!email) return; pedirConfirmacion("Resetear Contraseña", `¿Enviar un enlace oficial a ${email} para cambiar su contraseña?`, async () => { try { await sendPasswordResetEmail(auth, email); mostrarToast(`Enlace enviado con éxito a ${email}`); } catch (error) { mostrarToast("Error: " + error.message, "error"); } }); };
  const iniciarEdicionTrabajador = (trab) => { setEditandoTrabId(trab.id); setTrabEditado(trab); };
  const guardarEdicionTrabajador = async () => { await updateDoc(doc(db, 'trabajadores', editandoTrabId), { nombre: trabEditado.nombre, email: trabEditado.email, horasBaseMensuales: Number(trabEditado.horasBaseMensuales) || HORAS_BASE_POR_DEFECTO }); actualizarEnLista(setTrabajadoresList, editandoTrabId, { nombre: trabEditado.nombre, email: trabEditado.email, horasBaseMensuales: Number(trabEditado.horasBaseMensuales) || HORAS_BASE_POR_DEFECTO }); setEditandoTrabId(null); mostrarToast("Datos actualizados."); };
  const borrarTrabajador = (id) => { pedirConfirmacion("Baja de Personal", "¿Estás seguro de querer dar de baja a este trabajador?", async () => { await updateDoc(doc(db, 'trabajadores', id), { papelera: true }); actualizarEnLista(setTrabajadoresList, id, { papelera: true }); mostrarToast("Trabajador enviado a la papelera."); }); };

  const confirmarValidacionParte = async () => {
      if (validandoParte) return;
      if (!parteAValidar || parteAValidar.estado !== 'pendiente') {
          mostrarToast("Este parte ya no está pendiente: puede haberse validado desde otra sesión.", "error");
          setParteAValidar(null); setCuadrilla([]); cargarDatos();
          return;
      }
      if (cuadrilla.length === 0) {
          mostrarToast("Asigna al menos un operario a la cuadrilla antes de aprobar el parte.", "error");
          return;
      }
      setValidandoParte(true);
      try {
          if (parteAValidar.materialesUsados && parteAValidar.materialesUsados.length > 0) { for (let matUsado of parteAValidar.materialesUsados) { const docRef = doc(db, 'inventario', matUsado.id); const docSnap = await getDoc(docRef); if (docSnap.exists()) { await updateDoc(docRef, { stock: docSnap.data().stock - matUsado.cantidad }); } } }
          if (parteAValidar.tareasRealizadas && parteAValidar.tareasRealizadas.length > 0 && parteAValidar.obra) {
              const obraAsociada = obrasList.find(o => o.nombre === parteAValidar.obra);
              if (obraAsociada && obraAsociada.tareas) {
                  let huboCambios = false;
                  const tareasActualizadas = obraAsociada.tareas.map(tarea => {
                      if (tarea.completada) return tarea;
                      const coincide = parteAValidar.tareasRealizadas.some(t => ubicacionCoincideConTarea(tarea, t.ubicacion));
                      if (coincide) { huboCambios = true; return { ...tarea, completada: true }; }
                      return tarea;
                  });
                  if (huboCambios) { await updateDoc(doc(db, 'obras', obraAsociada.id), { tareas: tareasActualizadas }); }
              }
          }
          // Solo horas extra: las normales son base mensual fija y nunca se derivan de un parte.
          const cuadrillaNumerica = cuadrilla.map(op => ({ nombre: op.nombre, horasExtra: Number(op.horasExtra) || 0 }));
          const horasExtraAsignadas = cuadrillaNumerica.reduce((sum, op) => sum + op.horasExtra, 0);
          // Campos nuevos: no se pisa ninguno de los que escribe el operario.
          await updateDoc(doc(db, 'partes_de_trabajo', parteAValidar.id), { estado: 'aprobado', cuadrilla: cuadrillaNumerica, horasExtraAsignadas, fechaValidacion: new Date().toLocaleDateString(), certificado: false, facturado: false, papelera: false });
          setParteAValidar(null); setCuadrilla([]); cargarDatos(); mostrarToast("Albarán validado y guardado.");
      } catch (error) {
          console.error(error); mostrarToast("Error al validar el parte: " + error.message, "error");
      } finally {
          setValidandoParte(false);
      }
  };

  const generarHotelInteligente = async () => { if(!nuevaObra) { mostrarToast("Introduce un nombre para el proyecto.", "error"); return; } let configs = configHabitaciones.split(',').map(s => parseInt(s.trim()) || 0); let tareasGeneradas = []; for (let p = 1; p <= numPlantas; p++) { let habsEnEstaPlanta = configs[p-1] || configs[0] || 10; for (let h = 1; h <= habsEnEstaPlanta; h++) { let numHab = p * 100 + h; tareasGeneradas.push({ id: `T-${p}-${h}-${Date.now()}`, nombre: `P${p} - Hab ${numHab}`, numeroHabitacion: numHab, completada: false }); } } await addDoc(collection(db, 'obras'), { nombre: nuevaObra, tareas: tareasGeneradas, papelera: false }); setNuevaObra(''); setNumPlantas(1); setConfigHabitaciones('10'); refrescarObras(); mostrarToast("Proyecto creado con éxito."); };
  const marcarTareaHotel = async (tareaIdOArray) => { 
      if(!obraActiva) return; 
      const idsAModificar = Array.isArray(tareaIdOArray) ? tareaIdOArray : [tareaIdOArray];
      const tareasNuevas = obraActiva.tareas.map(t => idsAModificar.includes(t.id) ? { ...t, completada: !t.completada } : t ); 
      await updateDoc(doc(db, 'obras', obraActiva.id), { tareas: tareasNuevas }); 
      setObraActiva({...obraActiva, tareas: tareasNuevas}); actualizarEnLista(setObrasList, obraActiva.id, { tareas: tareasNuevas }); 
  };  
  const borrarObra = (id) => { pedirConfirmacion("Cerrar Proyecto", "Vas a enviar este hotel a la papelera. Podrás recuperarlo con todo su progreso. ¿Proceder?", async () => { await updateDoc(doc(db, 'obras', id), { papelera: true }); setObraActiva(null); actualizarEnLista(setObrasList, id, { papelera: true }); mostrarToast("Proyecto en papelera."); }); };
  const borrarParte = (id) => { pedirConfirmacion("Eliminar Documento", "¿Enviar este albarán a la papelera?", async () => { await updateDoc(doc(db, 'partes_de_trabajo', id), { papelera: true }); actualizarEnLista(setPartes, id, { papelera: true }); mostrarToast("Albarán en papelera."); }); };

  const agregarMaterial = async () => { if(!nuevoMatNombre || !nuevoMatStock) { mostrarToast("Falta nombre o unidades", "error"); return; } const matExistente = materialesList.find(m => m.nombre.toLowerCase().trim() === nuevoMatNombre.toLowerCase().trim()); if(matExistente) { await updateDoc(doc(db, 'inventario', matExistente.id), { stock: matExistente.stock + parseInt(nuevoMatStock) }); } else { await addDoc(collection(db, 'inventario'), { nombre: nuevoMatNombre.trim(), stock: parseInt(nuevoMatStock) }); } setNuevoMatNombre(''); setNuevoMatStock(''); refrescarInventario(); mostrarToast("Inventario actualizado."); };
  const iniciarEdicionMat = (mat) => { setEditandoMatId(mat.id); setMatEditado(mat); };
  const guardarEdicionMat = async () => { await updateDoc(doc(db, 'inventario', editandoMatId), { nombre: matEditado.nombre, stock: parseInt(matEditado.stock) }); actualizarEnLista(setMaterialesList, editandoMatId, { nombre: matEditado.nombre, stock: parseInt(matEditado.stock) }); setEditandoMatId(null); mostrarToast("Material guardado."); };
  const borrarMaterial = (id) => { pedirConfirmacion("Eliminar Material", "¿Quitar este material del inventario?", async () => { await deleteDoc(doc(db, 'inventario', id)); quitarDeLista(setMaterialesList, id); mostrarToast("Material eliminado."); }); };

  const getTimeRango = () => { const start = new Date(fechaInicio).getTime(); const end = new Date(fechaFin).getTime() + 86399999; return { start, end }; };
  const partesHistorialFiltradosFecha = partesHistorial.filter(parte => { const { start, end } = getTimeRango(); return parte.timestamp >= start && parte.timestamp <= end; });

  const partesDeHoy = partesHistorial.filter(p => p.fecha === new Date().toLocaleDateString());
  const totalHorasHoy = partesDeHoy.reduce((total, p) => total + horasTotalesDocumento(p), 0);
  const trabajadoresHoy = new Set(partesDeHoy.map(p => p.creador)).size;
  let totalTareas = 0, tareasCompletadas = 0; obrasActivas.forEach(obra => { totalTareas += (obra.tareas?.length || 0); tareasCompletadas += (obra.tareas?.filter(t => t.completada).length || 0); });
  const porcentajeGlobal = totalTareas === 0 ? 0 : Math.round((tareasCompletadas / totalTareas) * 100);

  const partesCoincidentes = partesHistorialFiltradosFecha.filter(parte => { const texto = filtroBuscador.toLowerCase(); const nombrePersona = parte.nombreTrabajador || parte.creador || ''; return (parte.obra?.toLowerCase().includes(texto) || nombrePersona.toLowerCase().includes(texto) || parte.trabajo?.toLowerCase().includes(texto)); }).sort((a, b) => { if (ordenPartes === 'antiguos') return a.timestamp - b.timestamp; return b.timestamp - a.timestamp; });
  const partesAMostrar = partesCoincidentes.slice(0, limitePartes);
  const materialesCoincidentes = materialesList.filter(m => m.nombre.toLowerCase().includes(filtroMateriales.toLowerCase())).sort((a, b) => { if (ordenMateriales === 'menor') return a.stock - b.stock; if (ordenMateriales === 'mayor') return b.stock - a.stock; return a.nombre.localeCompare(b.nombre); });

  const calcularHorasPorTrabajador = () => { const resumen = {}; partesHistorialFiltradosFecha.forEach(parte => { if (parte.cuadrilla && parte.cuadrilla.length > 0) { parte.cuadrilla.forEach(op => { if(!resumen[op.nombre]) resumen[op.nombre] = { horasExtra: 0 }; resumen[op.nombre].horasExtra += (Number(op.horasExtra) || 0); }); } }); return Object.entries(resumen).sort((a, b) => b[1].horasExtra - a[1].horasExtra); };
  const horasTrabajadores = calcularHorasPorTrabajador();
  const obtenerEstadisticasHotel = (nombreHotel) => { const partesDelHotel = partesHistorial.filter(p => p.obra === nombreHotel); let horasTotal = 0; const materialesMap = {}; partesDelHotel.forEach(p => { horasTotal += horasTotalesDocumento(p); if (p.materialesUsados && p.materialesUsados.length > 0) { p.materialesUsados.forEach(m => { materialesMap[m.nombre] = (materialesMap[m.nombre] || 0) + (Number(m.cantidad) || 0); }); } }); return { horas: horasTotal, materiales: Object.entries(materialesMap) }; };

  const exportarPartesExcel = () => { let csv = "Fecha;Operarios (H. Extra);Horas Extra;Hotel/Obra;Habitaciones;Material Utilizado;Trabajo Realizado\n"; partesCoincidentes.forEach(p => { const fecha = p.fecha || ''; let textoCuadrilla = p.nombreTrabajador || p.creador; if (p.cuadrilla && p.cuadrilla.length > 0) { textoCuadrilla = p.cuadrilla.map(c => `${c.nombre}${(Number(c.horasExtra) || 0) > 0 ? ` (+${c.horasExtra}h extra)` : ''}`).join(' - '); } const horasExtraParte = Number(p.horasExtraAsignadas) || 0; const obra = p.obra || ''; const habs = p.habitacionesRango || ''; let textoMateriales = p.materialesUsados?.map(m => `${m.cantidad}x ${m.nombre}`).join(', ') || (p.material || '').replace(/;/g, ' - ').replace(/\n/g, ' '); const trabajo = (p.trabajo || '').replace(/;/g, ' - ').replace(/\n/g, ' '); csv += `${fecha};${textoCuadrilla};${horasExtraParte};${obra};${habs};${textoMateriales};${trabajo}\n`; }); const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `Albaranes_${fechaInicio}_a_${fechaFin}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); mostrarToast("Excel generado"); };
  const exportarAlmacenExcel = () => { let csv = "Material;Stock Actual\n"; materialesCoincidentes.forEach(m => { const nombreMat = (m.nombre || '').replace(/;/g, ' - ').replace(/\n/g, ' '); csv += `${nombreMat};${m.stock}\n`; }); const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `Inventario_Almacen_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); mostrarToast("Excel generado"); };

  const partesPendientesCertificar = partesHistorial.filter(p => p.obra === certObraSeleccionada && p.certificado !== true && p.facturado !== true);
  const toggleParteCertificacion = (id) => { setCertPartesSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const borrarCertificacion = (id, partesIds) => { pedirConfirmacion("Anular Certificación", "Al anular, los albaranes quedan libres. La certificación irá a la papelera.", async () => { await updateDoc(doc(db, 'certificaciones', id), { papelera: true }); for (let pId of partesIds) { await updateDoc(doc(db, 'partes_de_trabajo', pId), { certificado: false, idCertificacion: null }); } cargarDatos(); mostrarToast("Certificación en la papelera."); }); };
  const toggleItemFacturacion = (id) => { setItemsAFacturar(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  
  const generarPDFFactura = async (e) => {
      if (e) e.preventDefault();
      if (!facturaCliente || facturaCliente.trim() === '') { alert("¡Error! Es obligatorio introducir el nombre o razón social del cliente."); return; }
      if (!itemsAFacturar || itemsAFacturar.length === 0) { alert("Por favor, selecciona al menos un albarán o certificación para facturar."); return; }
      const tarifa = parseFloat(facTarifaHora) || 0;
      const clienteFinal = facturaCliente.trim();
      try {
          const docPdf = new jsPDF(); docPdf.setTextColor(0, 0, 0); docPdf.setFontSize(22); docPdf.setFont("helvetica", "bold"); docPdf.text("FACTURA OFICIAL", 14, 25);
          const referenciaFac = `FAC-${Date.now().toString().slice(-6).toUpperCase()}`;
          docPdf.setFontSize(10); docPdf.setFont("helvetica", "normal"); docPdf.text(`Nº Factura: ${referenciaFac}`, 14, 33); docPdf.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 38); docPdf.text(`Cliente: ${clienteFinal}`, 14, 43);
          docPdf.setDrawColor(0, 0, 0); docPdf.setLineWidth(0.8); docPdf.line(14, 50, 196, 50);
          let cuerpoTabla = []; let totalHorasGlobal = 0; let acumuladorMateriales = {}; let totalPartidasLibres = 0; 
          if (modoFacturacion === 'albaranes') {
              const albaranesSeleccionados = partesHistorial.filter(p => itemsAFacturar.includes(p.id));
              albaranesSeleccionados.forEach(p => {
                  const horas = horasTotalesDocumento(p); totalHorasGlobal += horas;
                  if (p.materialesUsados && p.materialesUsados.length > 0) { p.materialesUsados.forEach(m => { const clave = m.nombre.toLowerCase().trim(); const precioU = parseFloat(m.precio || 0); const cant = parseFloat(m.cantidad || 0); if (!acumuladorMateriales[clave]) { acumuladorMateriales[clave] = { nombre: m.nombre, cantidad: 0, precio: precioU }; } acumuladorMateriales[clave].cantidad += cant; }); }
              });
          } else {
              const certificacionesSeleccionadas = certificacionesList.filter(c => itemsAFacturar.includes(c.id));
              certificacionesSeleccionadas.forEach(c => {
                  if (c.modo === 'libre') {
                      if (c.partidas) { c.partidas.forEach(p => { const totalPartida = p.cantidad * p.precio; totalPartidasLibres += totalPartida; cuerpoTabla.push([ `[Certificación] - ${p.concepto} (${p.precio.toFixed(2)} €/u)`, `${p.cantidad} uds`, `${totalPartida.toFixed(2)} €` ]); }); }
                  } else {
                      const horas = parseFloat(c.totalHoras || 0); totalHorasGlobal += horas;
                      if (c.albaranes) { c.albaranes.forEach(p => { if (p.materialesUsados) { p.materialesUsados.forEach(m => { const clave = m.nombre.toLowerCase().trim(); const precioU = parseFloat(m.precio || 0); const cant = parseFloat(m.cantidad || 0); if (!acumuladorMateriales[clave]) { acumuladorMateriales[clave] = { nombre: m.nombre, cantidad: 0, precio: precioU }; } acumuladorMateriales[clave].cantidad += cant; }); } }); }
                  }
              });
          }
          if (totalHorasGlobal > 0) { const subtotalManoObra = totalHorasGlobal * tarifa; cuerpoTabla.push([ `Mano de Obra / Servicios (${totalHorasGlobal}h a ${tarifa.toFixed(2)} €/h)`, `${totalHorasGlobal}h`, `${subtotalManoObra.toFixed(2)} €` ]); }
          let totalMaterialesCalculado = 0;
          Object.values(acumuladorMateriales).forEach(mat => { const subtotalMat = mat.cantidad * mat.precio; totalMaterialesCalculado += subtotalMat; cuerpoTabla.push([ `Material Suministrado: ${mat.nombre} (${mat.precio.toFixed(2)} €/u)`, `${mat.cantidad} uds`, `${subtotalMat.toFixed(2)} €` ]); });
          const matExtraManual = parseFloat(facImporteMateriales) || 0;
          if (matExtraManual > 0) { cuerpoTabla.push(['Suministros o Conceptos Extra (Varios)', '1 ud', `${matExtraManual.toFixed(2)} €`]); }
          autoTable(docPdf, { startY: 60, head: [['Concepto / Descripción', 'Cantidad', 'Importe']], body: cuerpoTabla, theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 } });
          let finalY = docPdf.lastAutoTable.finalY + 15;
          const subtotalManoObra = totalHorasGlobal * tarifa; const totalGeneral = subtotalManoObra + totalMaterialesCalculado + matExtraManual + totalPartidasLibres;
          docPdf.setFontSize(11); docPdf.setFont("helvetica", "bold"); docPdf.text(`TOTAL A PAGAR: ${totalGeneral.toFixed(2)} €`, 196, finalY, { align: 'right' });
          const nuevaFacturaData = { referencia: referenciaFac, cliente: clienteFinal, fecha: new Date().toLocaleDateString(), total: totalGeneral, items: itemsAFacturar, modo: modoFacturacion, timestamp: Date.now() };
          const docRef = await addDoc(collection(db, 'facturas'), nuevaFacturaData);
          const nombreColeccion = modoFacturacion === 'albaranes' ? 'partes_de_trabajo' : 'certificaciones';
          for (const idItem of itemsAFacturar) { const refItem = doc(db, nombreColeccion, idItem); await updateDoc(refItem, { facturado: true }); }
          docPdf.save(`Factura_${referenciaFac}.pdf`);
          if (typeof setFacturasList === 'function') { setFacturasList(prev => [{ id: docRef.id, ...nuevaFacturaData }, ...prev]); }
          if (modoFacturacion === 'certificaciones') { if (typeof setCertificacionesList === 'function') { setCertificacionesList(prev => prev.map(c => itemsAFacturar.includes(c.id) ? { ...c, facturado: true } : c)); } } else { if (typeof setPartesHistorial === 'function') { setPartesHistorial(prev => prev.map(p => itemsAFacturar.includes(p.id) ? { ...p, facturado: true } : p)); } }
          alert("¡Factura emitida y elementos bloqueados con éxito!"); setItemsAFacturar([]); setFacturaCliente(''); setFacTarifaHora(''); setFacImporteMateriales('');
      } catch (error) { console.error("Error al emitir factura:", error); alert("Error al emitir la factura: " + error.message); }
  };

  const borrarFactura = (factura) => { pedirConfirmacion("Anular Factura", "Al borrar esta factura, los documentos que agrupaba volverán a estar pendientes. ¿Estás seguro?", async () => { try { const batch = writeBatch(db); const refFactura = doc(db, 'facturas', factura.id); batch.delete(refFactura); const arrayDeIds = factura.items || []; const nombreColeccion = factura.modo === 'albaranes' ? 'partes_de_trabajo' : 'certificaciones'; for (let id of arrayDeIds) { const refItem = doc(db, nombreColeccion, id); batch.update(refItem, { facturado: false }); } await batch.commit(); cargarDatos(); mostrarToast("Factura anulada correctamente."); } catch (error) { console.error("Error al anular factura:", error); mostrarToast("Hubo un error al anular la factura.", "error"); } }); };  
  const agregarItemPresupuesto = () => { if(!presuSelectMat || !presuCantMat || !presuPrecioMat) { mostrarToast("Completa los datos del concepto.", "error"); return; } setPresuItems([...presuItems, { id: Date.now(), nombre: presuSelectMat, cantidad: parseFloat(presuCantMat), precioUnitario: parseFloat(presuPrecioMat), total: parseFloat(presuCantMat) * parseFloat(presuPrecioMat) }]); setPresuSelectMat(''); setPresuCantMat(1); setPresuPrecioMat(''); };
  const quitarItemPresupuesto = (id) => { setPresuItems(presuItems.filter(item => item.id !== id)); };
  
  const generarPDFPresupuesto = (datos) => {
      const { cliente, items, horasEstimadas, precioHora, fecha, id } = datos;
      try {
          const doc = new jsPDF(); doc.setTextColor(0, 0, 0); doc.setFontSize(24); doc.setFont("helvetica", "bold"); doc.text("PRESUPUESTO", 14, 25);
          const numPresupuesto = id ? `PR-${id.toString().slice(-6).toUpperCase()}` : `PR-${Date.now().toString().slice(-6).toUpperCase()}`;
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Referencia: ${numPresupuesto}`, 14, 33); doc.text(`Fecha de Emisión: ${fecha || new Date().toLocaleDateString()}`, 14, 38); doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' }); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' }); doc.text("contacto@gestionpro.com", 196, 37, { align: 'right' }); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.8); doc.line(14, 45, 196, 45); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("DATOS DEL CLIENTE:", 14, 55); doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text(cliente, 14, 62);
          let datosTabla = (items || []).map(item => [ item.nombre, item.cantidad.toString(), `${parseFloat(item.precioUnitario).toFixed(2)} €`, `${parseFloat(item.total).toFixed(2)} €` ]);
          if (horasEstimadas && precioHora && parseFloat(horasEstimadas) > 0) { const totalHoras = parseFloat(horasEstimadas) * parseFloat(precioHora); datosTabla.push([ "Mano de Obra (Horas estimadas de trabajo)", horasEstimadas.toString(), `${parseFloat(precioHora).toFixed(2)} €`, `${totalHoras.toFixed(2)} €` ]); }
          autoTable(doc, { startY: 75, head: [['Concepto / Material', 'Cant.', 'Precio Unit.', 'Total']], body: datosTabla, theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } }, styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 }, alternateRowStyles: { fillColor: [245, 245, 245] } });
          const sumItems = (items || []).reduce((acc, item) => acc + parseFloat(item.total), 0); const sumHoras = (parseFloat(horasEstimadas) || 0) * (parseFloat(precioHora) || 0); const calcSubtotal = sumItems + sumHoras; const calcIva = calcSubtotal * 0.21; const calcTotal = calcSubtotal + calcIva;
          const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 15; const boxX = 130; doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("Base Imponible:", boxX, finalY); doc.text(`${calcSubtotal.toFixed(2)} €`, 196, finalY, { align: 'right' }); doc.text("IVA (21%):", boxX, finalY + 8); doc.text(`${calcIva.toFixed(2)} €`, 196, finalY + 8, { align: 'right' }); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.line(boxX, finalY + 12, 196, finalY + 12); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("TOTAL PRESUPUESTO:", boxX - 15, finalY + 20); doc.text(`${calcTotal.toFixed(2)} €`, 196, finalY + 20, { align: 'right' });
          doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(80, 80, 80); doc.text("• Este presupuesto tiene una validez de 30 días naturales desde su fecha de emisión.", 14, 270);
          doc.save(`Presupuesto_${cliente.replace(/[^a-zA-Z0-9]/g, '_')}_${numPresupuesto}.pdf`);
      } catch (error) { console.error(error); mostrarToast("Fallo técnico al emitir PDF", "error"); }
  };

  const guardarYValidarPresupuesto = async () => { if(!presuCliente || presuCliente.trim() === '') { mostrarToast("Escribe el nombre del Cliente.", "error"); return; } const subtotal = presuItems.reduce((acc, item) => acc + item.total, 0) + ((parseFloat(presuHoras) || 0) * (parseFloat(presuPrecioHora) || 0)); const iva = subtotal * 0.21; const totalFinal = subtotal + iva; const nuevoPresu = { cliente: presuCliente, items: presuItems, horasEstimadas: parseFloat(presuHoras) || 0, precioHora: parseFloat(presuPrecioHora) || 0, total: totalFinal, estado: 'validado', fecha: new Date().toLocaleDateString(), timestamp: Date.now() }; const docRef = await addDoc(collection(db, 'presupuestos'), nuevoPresu); refrescarPresupuestos(); generarPDFPresupuesto({ ...nuevoPresu, id: docRef.id }); setPresuCliente(''); setPresuItems([]); setPresuHoras(''); setPresuPrecioHora(''); mostrarToast("Presupuesto guardado en el historial."); };
  const cambiarEstadoPresupuesto = async (id, estadoActual) => { const nuevoEstado = estadoActual === 'validado' ? 'pendiente' : 'validado'; await updateDoc(doc(db, 'presupuestos', id), { estado: nuevoEstado }); actualizarEnLista(setPresupuestosList, id, { estado: nuevoEstado }); };
  const borrarPresupuesto = (id) => { pedirConfirmacion("Eliminar Presupuesto", "¿Estás seguro de querer borrar esta oferta del sistema?", async () => { await deleteDoc(doc(db, 'presupuestos', id)); quitarDeLista(setPresupuestosList, id); mostrarToast("Presupuesto eliminado."); }); };
  const descargarPresupuestoExistente = (presupuesto) => { generarPDFPresupuesto(presupuesto); };

  const restaurarElemento = async (id, coleccion) => { await updateDoc(doc(db, coleccion, id), { papelera: false }); cargarDatos(); mostrarToast("Elemento restaurado con éxito."); };
  const destruirElementoFisico = (id, coleccion) => { pedirConfirmacion("Destrucción Definitiva", "Esta acción es irreversible y los datos se perderán de la base de datos para siempre. ¿Continuar?", async () => { await deleteDoc(doc(db, coleccion, id)); cargarDatos(); mostrarToast("Elemento destruido permanentemente."); }); };

  const catActivaStyle = (isActive) => ({ padding: '10px 15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', color: isActive ? '#1a1a1a' : '#94a3b8', borderBottom: isActive ? '2px solid #1a1a1a' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', backgroundColor: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', outline: 'none', whiteSpace: 'nowrap' });
  const subMenuBtnStyle = (isActive) => ({ padding: '8px 16px', border: '1px solid #1a1a1a', background: isActive ? '#1a1a1a' : 'transparent', color: isActive ? 'white' : '#1a1a1a', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '50px', whiteSpace: 'nowrap' });
  const blockStyle = { backgroundColor: '#ffffff', padding: 'clamp(15px, 4vw, 30px)', border: '1px solid #e5e7eb', boxSizing: 'border-box', width: '100%' };
  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '13px', backgroundColor: '#fafafa', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' };
  const btnBlackStyle = { padding: '12px 20px', backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' };

  const navegar = (cat, tab) => { setCategoriaActiva(cat); setPestañaActiva(tab); setMenuMovilAbierto(false); };

  return (
    <div style={{ width: '100%', fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: '#1a1a1a', boxSizing: 'border-box' }}>
      <style>{`
        .desktop-menu { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px; }
        .desktop-menu::-webkit-scrollbar { height: 4px; }
        .desktop-menu::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .mobile-toggle { display: none; background: none; border: none; cursor: pointer; color: #1a1a1a; padding: 5px; }
        .mobile-dropdown { display: none; }
        .hide-on-mobile { display: inline-block; }
        @media (max-width: 1024px) {
            .desktop-menu { display: none !important; }
            .mobile-toggle { display: block !important; }
            .hide-on-mobile { display: none !important; }
            .mobile-dropdown.open { display: flex !important; flex-direction: column; gap: 5px; background: #fafafa; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; }
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {cargando && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)', zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #1a1a1a', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '12px', color: '#1a1a1a' }}>Sincronizando datos...</p>
          </div>
      )}

      {toast.visible && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', backgroundColor: toast.tipo === 'error' ? '#ef4444' : '#1a1a1a', color: '#fff', padding: '15px 25px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 9999, transition: 'all 0.3s ease-out' }}>
              {toast.tipo === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
              <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{toast.mensaje}</span>
          </div>
      )}

      {modalConfirm.visible && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
              <div style={{ backgroundColor: '#fff', padding: '30px', border: '1px solid #1a1a1a', width: '90%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '300', textTransform: 'uppercase', letterSpacing: '2px' }}>{modalConfirm.titulo}</h3>
                  <p style={{ margin: '0 0 25px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>{modalConfirm.mensaje}</p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button onClick={cerrarModal} style={{ padding: '10px 15px', background: 'transparent', border: '1px solid #1a1a1a', color: '#1a1a1a', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={() => { modalConfirm.onConfirm(); cerrarModal(); }} style={{ padding: '10px 15px', background: '#1a1a1a', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}>Confirmar</button>
                  </div>
              </div>
          </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#1a1a1a', color: 'white', padding: '6px 12px', borderRadius: '4px' }}>ERP</div><span>Oficina</span>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button className="hide-on-mobile" onClick={cambiarVista} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', backgroundColor: '#f1f5f9', color: '#1a1a1a', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}><ArrowLeftRight size={14} /> Vista Operario</button>
              <button className="mobile-toggle" onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}>{menuMovilAbierto ? <X size={26} /> : <Menu size={26} />}</button>
          </div>
      </div>

      <div className="desktop-menu" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '25px' }}>
          <button onClick={() => navegar('validacion', 'bandeja')} style={catActivaStyle(categoriaActiva === 'validacion')}><Inbox size={16} /> Validación</button>
          <button onClick={() => navegar('proyectos', 'obras')} style={catActivaStyle(categoriaActiva === 'proyectos')}><Building2 size={16} /> Proyectos</button>
          <button onClick={() => navegar('documentos', 'partes')} style={catActivaStyle(categoriaActiva === 'documentos')}><FolderOpen size={16} /> Docs y Facturas</button>
          <button onClick={() => navegar('presupuestos', 'presupuestos')} style={catActivaStyle(categoriaActiva === 'presupuestos')}><Calculator size={16} /> Presupuestos</button>
          <button onClick={() => navegar('personal', 'trabajadores')} style={catActivaStyle(categoriaActiva === 'personal')}><Users size={16} /> Personal</button>
          <button onClick={() => navegar('almacen', 'almacen')} style={catActivaStyle(categoriaActiva === 'almacen')}><Package size={16} /> Almacén</button>
          <button onClick={() => navegar('sistema', 'papelera')} style={catActivaStyle(categoriaActiva === 'sistema')}><Settings size={16} /> Sistema</button>
      </div>

      <div className={`mobile-dropdown ${menuMovilAbierto ? 'open' : ''}`}>
          <button onClick={() => navegar('validacion', 'bandeja')} style={catActivaStyle(categoriaActiva === 'validacion')}><Inbox size={16} /> Validación</button>
          <button onClick={() => navegar('proyectos', 'obras')} style={catActivaStyle(categoriaActiva === 'proyectos')}><Building2 size={16} /> Proyectos</button>
          <button onClick={() => navegar('documentos', 'partes')} style={catActivaStyle(categoriaActiva === 'documentos')}><FolderOpen size={16} /> Docs y Facturación</button>
          <button onClick={() => navegar('presupuestos', 'presupuestos')} style={catActivaStyle(categoriaActiva === 'presupuestos')}><Calculator size={16} /> Presupuestos</button>
          <button onClick={() => navegar('personal', 'trabajadores')} style={catActivaStyle(categoriaActiva === 'personal')}><Users size={16} /> Personal</button>
          <button onClick={() => navegar('almacen', 'almacen')} style={catActivaStyle(categoriaActiva === 'almacen')}><Package size={16} /> Almacén</button>
          <button onClick={() => navegar('sistema', 'papelera')} style={catActivaStyle(categoriaActiva === 'sistema')}><Settings size={16} /> Sistema</button>
          <div style={{ borderTop: '1px solid #e5e7eb', margin: '10px 0' }}></div>
          <button onClick={cambiarVista} style={{...catActivaStyle(false), color: '#2563eb'}}><ArrowLeftRight size={16} /> Cambiar a Vista Operario</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', paddingLeft: '10px', flexWrap: 'wrap' }}>
          {categoriaActiva === 'proyectos' && ( <><button onClick={()=>setPestañaActiva('obras')} style={subMenuBtnStyle(pestañaActiva === 'obras')}>Gestión de Hoteles / Obras</button><button onClick={()=>setPestañaActiva('resumen')} style={subMenuBtnStyle(pestañaActiva === 'resumen')}>Métricas y Dashboard</button></> )}
          {categoriaActiva === 'documentos' && ( <><button onClick={()=>setPestañaActiva('partes')} style={subMenuBtnStyle(pestañaActiva === 'partes')}>Albaranes Históricos</button><button onClick={()=>setPestañaActiva('certificaciones')} style={subMenuBtnStyle(pestañaActiva === 'certificaciones')}>Certificaciones Mensuales</button><button onClick={()=>setPestañaActiva('facturacion')} style={subMenuBtnStyle(pestañaActiva === 'facturacion')}>Generar Factura</button></> )}
          {categoriaActiva === 'personal' && ( <><button onClick={()=>setPestañaActiva('trabajadores')} style={subMenuBtnStyle(pestañaActiva === 'trabajadores')}>Plantilla Activa</button><button onClick={()=>setPestañaActiva('horas')} style={subMenuBtnStyle(pestañaActiva === 'horas')}>Control de Nóminas</button></> )}
          {categoriaActiva === 'sistema' && ( <><button onClick={()=>setPestañaActiva('papelera')} style={subMenuBtnStyle(pestañaActiva === 'papelera')}>Papelera de Reciclaje</button></> )}
      </div>

      {pestañaActiva === 'bandeja' && ( <BandejaValidacion partesPendientes={partesPendientes} parteAValidar={parteAValidar} setParteAValidar={setParteAValidar} nuevoOperario={nuevoOperario} setNuevoOperario={setNuevoOperario} trabajadoresList={trabajadoresActivos} agregarOperarioCuadrilla={agregarOperarioCuadrilla} cuadrilla={cuadrilla} cambiarHorasExtra={cambiarHorasExtra} setHorasExtraDirecto={setHorasExtraDirecto} validandoParte={validandoParte} quitarOperario={quitarOperario} confirmarValidacionParte={confirmarValidacionParte} borrarParte={borrarParte} abrirValidacion={abrirValidacion} btnBlackStyle={btnBlackStyle} /> )}
      {pestañaActiva === 'resumen' && ( <ResumenMetricas partesDeHoy={partesDeHoy} totalHorasHoy={totalHorasHoy} trabajadoresHoy={trabajadoresHoy} porcentajeGlobal={porcentajeGlobal} /> )}
      {pestañaActiva === 'obras' && ( <GestionProyectos blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} nuevaObra={nuevaObra} setNuevaObra={setNuevaObra} numPlantas={numPlantas} setNumPlantas={setNumPlantas} configHabitaciones={configHabitaciones} setConfigHabitaciones={setConfigHabitaciones} generarHotelInteligente={generarHotelInteligente} obrasList={obrasActivas} obraActiva={obraActiva} setObraActiva={setObraActiva} borrarObra={borrarObra} obtenerEstadisticasHotel={obtenerEstadisticasHotel} marcarTareaHotel={marcarTareaHotel} /> )}
      {pestañaActiva === 'trabajadores' && ( <PlantillaPersonal cambiarRolTrabajador={cambiarRolTrabajador} cambiandoRolId={cambiandoRolId} blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} nuevoTrabajadorNombre={nuevoTrabajadorNombre} setNuevoTrabajadorNombre={setNuevoTrabajadorNombre} nuevoTrabajadorEmail={nuevoTrabajadorEmail} setNuevoTrabajadorEmail={setNuevoTrabajadorEmail} nuevoTrabajadorPass={nuevoTrabajadorPass} setNuevoTrabajadorPass={setNuevoTrabajadorPass} registrarTrabajador={registrarTrabajador} trabajadoresList={trabajadoresActivos} editandoTrabId={editandoTrabId} trabEditado={trabEditado} setTrabEditado={setTrabEditado} guardarEdicionTrabajador={guardarEdicionTrabajador} enviarResetPass={enviarResetPass} setEditandoTrabId={setEditandoTrabId} iniciarEdicionTrabajador={iniciarEdicionTrabajador} borrarTrabajador={borrarTrabajador} /> )}
{pestañaActiva === 'horas' && ( <ControlNominas trabajadoresList={trabajadoresActivos} buscarPartesPorFechas={buscarPartesPorFechas} blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} labelStyle={labelStyle} inputStyle={inputStyle} fechaInicio={fechaInicio} setFechaInicio={setFechaInicio} fechaFin={fechaFin} setFechaFin={setFechaFin} pagoHoraNormal={pagoHoraNormal} setPagoHoraNormal={setPagoHoraNormal} pagoHoraExtra={pagoHoraExtra} setPagoHoraExtra={setPagoHoraExtra} horasTrabajadores={horasTrabajadores} /> )}      {pestañaActiva === 'almacen' && ( <InventarioAlmacen blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} inputStyle={inputStyle} exportarAlmacenExcel={exportarAlmacenExcel} nuevoMatNombre={nuevoMatNombre} setNuevoMatNombre={setNuevoMatNombre} materialesList={materialesList} nuevoMatStock={nuevoMatStock} setNuevoMatStock={setNuevoMatStock} agregarMaterial={agregarMaterial} filtroMateriales={filtroMateriales} setFiltroMateriales={setFiltroMateriales} ordenMateriales={ordenMateriales} setOrdenMateriales={setOrdenMateriales} materialesCoincidentes={materialesCoincidentes} editandoMatId={editandoMatId} matEditado={matEditado} setMatEditado={setMatEditado} guardarEdicionMat={guardarEdicionMat} setEditandoMatId={setEditandoMatId} iniciarEdicionMat={iniciarEdicionMat} borrarMaterial={borrarMaterial} /> )}
      {pestañaActiva === 'partes' && ( 
          <HistorialAlbaranes 
              blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} exportarPartesExcel={exportarPartesExcel} 
              labelStyle={labelStyle} inputStyle={inputStyle} fechaInicio={fechaInicio} 
              setFechaInicio={setFechaInicio} fechaFin={fechaFin} setFechaFin={setFechaFin} 
              filtroBuscador={filtroBuscador} setFiltroBuscador={setFiltroBuscador} 
              setLimitePartes={setLimitePartes} ordenPartes={ordenPartes} setOrdenPartes={setOrdenPartes} 
              partesAMostrar={partesAMostrar}
              cargarMasPartes={cargarMasPartes}
              hayMasPartes={hayMasPartes}
              cargandoMas={cargandoMas}
              buscarPartesPorFechas={buscarPartesPorFechas}
          /> 
      )}
      {pestañaActiva === 'certificaciones' && ( <GeneradorCertificaciones blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} certObraSeleccionada={certObraSeleccionada} setCertObraSeleccionada={setCertObraSeleccionada} setCertPartesSeleccionados={setCertPartesSeleccionados} obrasList={obrasActivas} partesPendientesCertificar={partesPendientesCertificar} toggleParteCertificacion={toggleParteCertificacion} certPartesSeleccionados={certPartesSeleccionados} certificacionesList={certificacionesActivas} borrarCertificacion={borrarCertificacion} /> )}
      {pestañaActiva === 'facturacion' && ( <EmisionFacturas blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} modoFacturacion={modoFacturacion} setModoFacturacion={setModoFacturacion} setItemsAFacturar={setItemsAFacturar} facturaCliente={facturaCliente} setFacturaCliente={setFacturaCliente} facTarifaHora={facTarifaHora} setFacTarifaHora={setFacTarifaHora} facImporteMateriales={facImporteMateriales} setFacImporteMateriales={setFacImporteMateriales} partesHistorial={partesHistorial} certificacionesList={certificacionesActivas} itemsAFacturar={itemsAFacturar} toggleItemFacturacion={toggleItemFacturacion} generarPDFFactura={generarPDFFactura} facturasList={facturasList} borrarFactura={borrarFactura} /> )}
      {pestañaActiva === 'presupuestos' && ( <PresupuestosOfertas inventario={materialesList} blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} labelStyle={labelStyle} inputStyle={inputStyle} guardarYValidarPresupuesto={guardarYValidarPresupuesto} presuCliente={presuCliente} setPresuCliente={setPresuCliente} presuSelectMat={presuSelectMat} setPresuSelectMat={setPresuSelectMat} presuCantMat={presuCantMat} setPresuCantMat={setPresuCantMat} presuPrecioMat={presuPrecioMat} setPresuPrecioMat={setPresuPrecioMat} agregarItemPresupuesto={agregarItemPresupuesto} presuItems={presuItems} quitarItemPresupuesto={quitarItemPresupuesto} presuHoras={presuHoras} setPresuHoras={setPresuHoras} presuPrecioHora={presuPrecioHora} setPresuPrecioHora={setPresuPrecioHora} presupuestosList={presupuestosList} descargarPresupuestoExistente={descargarPresupuestoExistente} cambiarEstadoPresupuesto={cambiarEstadoPresupuesto} borrarPresupuesto={borrarPresupuesto} /> )}
      {pestañaActiva === 'papelera' && ( <PapeleraReciclaje blockStyle={blockStyle} partesPapelera={partesPapelera} certificacionesPapelera={certificacionesPapelera} trabajadoresPapelera={trabajadoresPapelera} obrasPapelera={obrasPapelera} restaurarElemento={restaurarElemento} destruirElementoFisico={destruirElementoFisico} /> )}

    </div>
  );
}