import { useState, useEffect } from 'react';
import { db, auth, authSecundario } from '../firebase'; 
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, getDoc } from 'firebase/firestore';
import { signOut, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth'; 
import { Building2, FileText, Users, Calculator, Inbox, CheckCircle, Package, FolderOpen, AlertTriangle, Settings } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// IMPORTACIÓN DE COMPONENTES TROCEADOS
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
  // ESTADO DE CARGA (NUEVO)
  const [cargando, setCargando] = useState(true);

  const [partes, setPartes] = useState([]);
  const [obrasList, setObrasList] = useState([]);
  const [materialesList, setMaterialesList] = useState([]);
  const [presupuestosList, setPresupuestosList] = useState([]); 
  const [trabajadoresList, setTrabajadoresList] = useState([]);
  const [certificacionesList, setCertificacionesList] = useState([]);
  const [facturasList, setFacturasList] = useState([]);
  
  const [categoriaActiva, setCategoriaActiva] = useState('validacion');
  const [pestañaActiva, setPestañaActiva] = useState('bandeja');
  
  const [nuevaObra, setNuevaObra] = useState('');
  const [numPlantas, setNumPlantas] = useState(1);
  const [configHabitaciones, setConfigHabitaciones] = useState('10'); 
  const [obraActiva, setObraActiva] = useState(null);

  const [parteAValidar, setParteAValidar] = useState(null);
  const [cuadrilla, setCuadrilla] = useState([]);
  const [nuevoOperario, setNuevoOperario] = useState('');

  const [nuevoTrabajadorNombre, setNuevoTrabajadorNombre] = useState('');
  const [nuevoTrabajadorEmail, setNuevoTrabajadorEmail] = useState('');
  const [nuevoTrabajadorPass, setNuevoTrabajadorPass] = useState(''); 
  const [editandoTrabId, setEditandoTrabId] = useState(null);
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

  const cargarDatos = async () => {
    setCargando(true); // Arrancamos el spinner
    try {
      const queryPartes = await getDocs(query(collection(db, 'partes_de_trabajo')));
      setPartes(queryPartes.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
      const queryObras = await getDocs(collection(db, 'obras'));
      const listaObrasFrescas = queryObras.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setObrasList(listaObrasFrescas);
      setObraActiva(prev => { if (!prev) return null; return listaObrasFrescas.find(o => o.id === prev.id) || prev; });
      const queryMateriales = await getDocs(collection(db, 'inventario'));
      setMaterialesList(queryMateriales.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const queryPresu = await getDocs(collection(db, 'presupuestos'));
      setPresupuestosList(queryPresu.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
      const queryTrab = await getDocs(collection(db, 'trabajadores'));
      setTrabajadoresList(queryTrab.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      const queryCert = await getDocs(collection(db, 'certificaciones'));
      setCertificacionesList(queryCert.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
      const queryFacturas = await getDocs(collection(db, 'facturas'));
      setFacturasList(queryFacturas.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) { 
      console.error("Error:", error); 
      mostrarToast("Error cargando base de datos", "error"); 
    } finally {
      setCargando(false); // Apagamos el spinner al terminar
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  // ====== FILTROS PAPELERA (ACTIVOS VS ELIMINADOS) ======
  const trabajadoresActivos = trabajadoresList.filter(t => !t.papelera);
  const trabajadoresPapelera = trabajadoresList.filter(t => t.papelera);
  
  const partesActivos = partes.filter(p => !p.papelera);
  const partesPapelera = partes.filter(p => p.papelera);
  
  const certificacionesActivas = certificacionesList.filter(c => !c.papelera);
  const certificacionesPapelera = certificacionesList.filter(c => c.papelera);
  // ======================================================

  const partesPendientes = partesActivos.filter(p => p.estado === 'pendiente');
  const partesHistorial = partesActivos.filter(p => p.estado !== 'pendiente');

  const decodificarRangos = (textoRango) => {
      if (!textoRango) return []; let resultado = [];
      textoRango.split(',').forEach(p => {
          if (p.includes('-')) { const [inicio, fin] = p.split('-').map(Number); if (!isNaN(inicio) && !isNaN(fin) && inicio <= fin) { for (let i = inicio; i <= fin; i++) resultado.push(i); } } 
          else { const num = Number(p.trim()); if (!isNaN(num) && num !== 0) resultado.push(num); }
      }); return resultado;
  };

  const abrirValidacion = (parte) => { setParteAValidar(parte); setCuadrilla([{ nombre: parte.nombreTrabajador || parte.creador, horas: 8, horasExtra: 0 }]); };
  const agregarOperarioCuadrilla = () => { if(!nuevoOperario) return; if(cuadrilla.some(op => op.nombre === nuevoOperario)) return; setCuadrilla([...cuadrilla, { nombre: nuevoOperario, horas: 8, horasExtra: 0 }]); setNuevoOperario(''); };
  const cambiarHoras = (index, cantidad, tipo) => { const nueva = [...cuadrilla]; const actual = Number(nueva[index][tipo]) || 0; nueva[index][tipo] = Math.max(0, actual + cantidad); setCuadrilla(nueva); };
  const setHorasDirecto = (index, valor, tipo) => { const nueva = [...cuadrilla]; nueva[index][tipo] = valor === '' ? '' : Math.max(0, parseInt(valor, 10) || 0); setCuadrilla(nueva); };
  const quitarOperario = (index) => { const nueva = [...cuadrilla]; nueva.splice(index, 1); setCuadrilla(nueva); };

  const registrarTrabajador = async () => {
      if(!nuevoTrabajadorNombre) { mostrarToast("Escribe el nombre del trabajador.", "error"); return; }
      try {
          if (nuevoTrabajadorEmail && nuevoTrabajadorPass) {
              if (nuevoTrabajadorPass.length < 6) { mostrarToast("La contraseña debe tener al menos 6 caracteres.", "error"); return; }
              const credenciales = await createUserWithEmailAndPassword(authSecundario, nuevoTrabajadorEmail, nuevoTrabajadorPass);
              await sendEmailVerification(credenciales.user);
          }
          await addDoc(collection(db, 'trabajadores'), { nombre: nuevoTrabajadorNombre.trim(), email: nuevoTrabajadorEmail.trim().toLowerCase(), papelera: false });
          setNuevoTrabajadorNombre(''); setNuevoTrabajadorEmail(''); setNuevoTrabajadorPass(''); cargarDatos(); mostrarToast("Trabajador registrado en plantilla.");
      } catch (error) { mostrarToast("Error: " + error.message, "error"); }
  };
  
  const enviarResetPass = (email) => { if (!email) return; pedirConfirmacion("Resetear Contraseña", `¿Enviar un enlace oficial a ${email} para cambiar su contraseña?`, async () => { try { await sendPasswordResetEmail(auth, email); mostrarToast(`Enlace enviado con éxito a ${email}`); } catch (error) { mostrarToast("Error: " + error.message, "error"); } }); };
  const iniciarEdicionTrabajador = (trab) => { setEditandoTrabId(trab.id); setTrabEditado(trab); };
  const guardarEdicionTrabajador = async () => { await updateDoc(doc(db, 'trabajadores', editandoTrabId), { nombre: trabEditado.nombre, email: trabEditado.email }); setEditandoTrabId(null); cargarDatos(); mostrarToast("Datos actualizados."); };
  const borrarTrabajador = (id) => { pedirConfirmacion("Baja de Personal", "¿Estás seguro de querer dar de baja a este trabajador?", async () => { await updateDoc(doc(db, 'trabajadores', id), { papelera: true }); cargarDatos(); mostrarToast("Trabajador enviado a la papelera."); }); };

  const confirmarValidacionParte = async () => {
      if (parteAValidar.materialesUsados && parteAValidar.materialesUsados.length > 0) {
          for (let matUsado of parteAValidar.materialesUsados) { const docRef = doc(db, 'inventario', matUsado.id); const docSnap = await getDoc(docRef); if (docSnap.exists()) { await updateDoc(docRef, { stock: docSnap.data().stock - matUsado.cantidad }); } }
      }
      if (parteAValidar.habitacionesRango && parteAValidar.obra) {
          const obraAsociada = obrasList.find(o => o.nombre === parteAValidar.obra);
          if (obraAsociada && obraAsociada.tareas) {
              const habsCompletadas = decodificarRangos(parteAValidar.habitacionesRango); let huboCambios = false;
              const tareasActualizadas = obraAsociada.tareas.map(tarea => { const numbers = tarea.nombre.match(/\d+/g); const numTarea = tarea.numeroHabitacion !== undefined ? tarea.numeroHabitacion : (numbers ? parseInt(numbers[numbers.length - 1]) : null); if (numTarea !== null && habsCompletadas.includes(numTarea) && !tarea.completada) { huboCambios = true; return { ...tarea, completada: true }; } return tarea; });
              if (huboCambios) { await updateDoc(doc(db, 'obras', obraAsociada.id), { tareas: tareasActualizadas }); }
          }
      }
      const cuadrillaNumerica = cuadrilla.map(op => ({ ...op, horas: Number(op.horas) || 0, horasExtra: Number(op.horasExtra) || 0 }));
      const totalHorasCuadrilla = cuadrillaNumerica.reduce((sum, op) => sum + op.horas + op.horasExtra, 0);
      await updateDoc(doc(db, 'partes_de_trabajo', parteAValidar.id), { estado: 'aprobado', cuadrilla: cuadrillaNumerica, horasTotales: totalHorasCuadrilla, fechaValidacion: new Date().toLocaleDateString(), certificado: false, facturado: false, papelera: false });
      setParteAValidar(null); setCuadrilla([]); cargarDatos(); mostrarToast("Albarán validado y guardado.");
  };

  const generarHotelInteligente = async () => {
    if(!nuevaObra) { mostrarToast("Introduce un nombre para el proyecto.", "error"); return; }
    let configs = configHabitaciones.split(',').map(s => parseInt(s.trim()) || 0); let tareasGeneradas = [];
    for (let p = 1; p <= numPlantas; p++) { let habsEnEstaPlanta = configs[p-1] || configs[0] || 10; for (let h = 1; h <= habsEnEstaPlanta; h++) { let numHab = p * 100 + h; tareasGeneradas.push({ id: `T-${p}-${h}-${Date.now()}`, nombre: `P${p} - Hab ${numHab}`, numeroHabitacion: numHab, completada: false }); } }
    await addDoc(collection(db, 'obras'), { nombre: nuevaObra, tareas: tareasGeneradas }); setNuevaObra(''); setNumPlantas(1); setConfigHabitaciones('10'); cargarDatos(); mostrarToast("Proyecto creado con éxito.");
  };

  const marcarTareaHotel = async (tareaId) => { if(!obraActiva) return; const tareasNuevas = obraActiva.tareas.map(t => t.id === tareaId ? { ...t, completada: !t.completada } : t); await updateDoc(doc(db, 'obras', obraActiva.id), { tareas: tareasNuevas }); setObraActiva({...obraActiva, tareas: tareasNuevas}); cargarDatos(); };
  const borrarObra = (id) => { pedirConfirmacion("Cerrar Proyecto", "Vas a eliminar el seguimiento de este hotel. ¿Proceder?", async () => { await deleteDoc(doc(db, 'obras', id)); setObraActiva(null); cargarDatos(); mostrarToast("Proyecto eliminado."); }); };
  const borrarParte = (id) => { pedirConfirmacion("Eliminar Documento", "¿Enviar este albarán a la papelera?", async () => { await updateDoc(doc(db, 'partes_de_trabajo', id), { papelera: true }); cargarDatos(); mostrarToast("Albarán en papelera."); }); };

  const agregarMaterial = async () => {
    if(!nuevoMatNombre || !nuevoMatStock) { mostrarToast("Falta nombre o unidades", "error"); return; }
    const matExistente = materialesList.find(m => m.nombre.toLowerCase().trim() === nuevoMatNombre.toLowerCase().trim());
    if(matExistente) { await updateDoc(doc(db, 'inventario', matExistente.id), { stock: matExistente.stock + parseInt(nuevoMatStock) }); } else { await addDoc(collection(db, 'inventario'), { nombre: nuevoMatNombre.trim(), stock: parseInt(nuevoMatStock) }); }
    setNuevoMatNombre(''); setNuevoMatStock(''); cargarDatos(); mostrarToast("Inventario actualizado.");
  };
  const iniciarEdicionMat = (mat) => { setEditandoMatId(mat.id); setMatEditado(mat); };
  const guardarEdicionMat = async () => { await updateDoc(doc(db, 'inventario', editandoMatId), { nombre: matEditado.nombre, stock: parseInt(matEditado.stock) }); setEditandoMatId(null); cargarDatos(); mostrarToast("Material guardado."); };
  const borrarMaterial = (id) => { pedirConfirmacion("Eliminar Material", "¿Quitar este material del inventario?", async () => { await deleteDoc(doc(db, 'inventario', id)); cargarDatos(); mostrarToast("Material eliminado."); }); };

  const getTimeRango = () => { const start = new Date(fechaInicio).getTime(); const end = new Date(fechaFin).getTime() + 86399999; return { start, end }; };
  const partesHistorialFiltradosFecha = partesHistorial.filter(parte => { const { start, end } = getTimeRango(); return parte.timestamp >= start && parte.timestamp <= end; });

  const partesDeHoy = partesHistorial.filter(p => p.fecha === new Date().toLocaleDateString());
  const totalHorasHoy = partesDeHoy.reduce((total, p) => total + (Number(p.horasTotales) || Number(p.horas) || 0), 0);
  const trabajadoresHoy = new Set(partesDeHoy.map(p => p.creador)).size;
  let totalTareas = 0, tareasCompletadas = 0; obrasList.forEach(obra => { totalTareas += (obra.tareas?.length || 0); tareasCompletadas += (obra.tareas?.filter(t => t.completada).length || 0); });
  const porcentajeGlobal = totalTareas === 0 ? 0 : Math.round((tareasCompletadas / totalTareas) * 100);

  const partesCoincidentes = partesHistorialFiltradosFecha.filter(parte => { const texto = filtroBuscador.toLowerCase(); const nombrePersona = parte.nombreTrabajador || parte.creador || ''; return (parte.obra?.toLowerCase().includes(texto) || nombrePersona.toLowerCase().includes(texto) || parte.trabajo?.toLowerCase().includes(texto)); }).sort((a, b) => { if (ordenPartes === 'antiguos') return a.timestamp - b.timestamp; return b.timestamp - a.timestamp; });
  const partesAMostrar = partesCoincidentes.slice(0, limitePartes);
  const materialesCoincidentes = materialesList.filter(m => m.nombre.toLowerCase().includes(filtroMateriales.toLowerCase())).sort((a, b) => { if (ordenMateriales === 'menor') return a.stock - b.stock; if (ordenMateriales === 'mayor') return b.stock - a.stock; return a.nombre.localeCompare(b.nombre); });

  const calcularHorasPorTrabajador = () => {
      const resumen = {};
      partesHistorialFiltradosFecha.forEach(parte => {
          if (parte.cuadrilla && parte.cuadrilla.length > 0) { parte.cuadrilla.forEach(op => { if(!resumen[op.nombre]) resumen[op.nombre] = { horas: 0, horasExtra: 0 }; resumen[op.nombre].horas += (Number(op.horas) || 0); resumen[op.nombre].horasExtra += (Number(op.horasExtra) || 0); }); } 
          else { const nombre = parte.nombreTrabajador || parte.creador; const horas = Number(parte.horasTotales) || Number(parte.horas) || 0; if(!resumen[nombre]) resumen[nombre] = { horas: 0, horasExtra: 0 }; resumen[nombre].horas += horas; }
      }); return Object.entries(resumen).sort((a, b) => (b[1].horas + b[1].horasExtra) - (a[1].horas + a[1].horasExtra)); 
  };
  const horasTrabajadores = calcularHorasPorTrabajador();

  const obtenerEstadisticasHotel = (nombreHotel) => {
      const partesDelHotel = partesHistorial.filter(p => p.obra === nombreHotel); let horasTotal = 0; const materialesMap = {};
      partesDelHotel.forEach(p => {
          if (p.cuadrilla && p.cuadrilla.length > 0) { horasTotal += p.cuadrilla.reduce((sum, c) => sum + (Number(c.horas) || 0) + (Number(c.horasExtra) || 0), 0); } else { horasTotal += Number(p.horasTotales) || Number(p.horas) || 0; }
          if (p.materialesUsados && p.materialesUsados.length > 0) { p.materialesUsados.forEach(m => { materialesMap[m.nombre] = (materialesMap[m.nombre] || 0) + (Number(m.cantidad) || 0); }); }
      }); return { horas: horasTotal, materiales: Object.entries(materialesMap) };
  };

  const exportarHorasExcel = () => { let csv = "Trabajador;Horas Normales;Horas Extra;Total Pagar (€)\n"; horasTrabajadores.forEach(([nombre, data]) => { const pago = (data.horas * pagoHoraNormal) + (data.horasExtra * pagoHoraExtra); csv += `${nombre};${data.horas};${data.horasExtra};${pago}\n`; }); const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `Nominas_Pagos_${fechaInicio}_a_${fechaFin}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); mostrarToast("Excel generado"); };
  const exportarPartesExcel = () => { let csv = "Fecha;Operarios (Horas);Total Horas;Hotel/Obra;Habitaciones;Material Utilizado;Trabajo Realizado\n"; partesCoincidentes.forEach(p => { const fecha = p.fecha || ''; let textoCuadrilla = p.nombreTrabajador || p.creador; if (p.cuadrilla && p.cuadrilla.length > 0) { textoCuadrilla = p.cuadrilla.map(c => `${c.nombre} (${c.horas}h norm + ${c.horasExtra||0}h ext)`).join(' - '); } const horasTotal = p.horasTotales || p.horas || '0'; const obra = p.obra || ''; const habs = p.habitacionesRango || ''; let textoMateriales = p.materialesUsados?.map(m => `${m.cantidad}x ${m.nombre}`).join(', ') || (p.material || '').replace(/;/g, ' - ').replace(/\n/g, ' '); const trabajo = (p.trabajo || '').replace(/;/g, ' - ').replace(/\n/g, ' '); csv += `${fecha};${textoCuadrilla};${horasTotal};${obra};${habs};${textoMateriales};${trabajo}\n`; }); const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `Albaranes_${fechaInicio}_a_${fechaFin}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); mostrarToast("Excel generado"); };
  const exportarAlmacenExcel = () => { let csv = "Material;Stock Actual\n"; materialesCoincidentes.forEach(m => { const nombreMat = (m.nombre || '').replace(/;/g, ' - ').replace(/\n/g, ' '); csv += `${nombreMat};${m.stock}\n`; }); const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `Inventario_Almacen_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); mostrarToast("Excel generado"); };

  const partesPendientesCertificar = partesHistorial.filter(p => p.obra === certObraSeleccionada && p.certificado !== true && p.facturado !== true);
  const toggleParteCertificacion = (id) => { setCertPartesSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const generarPDFCertificacion = async () => {
      if(!certObraSeleccionada) { mostrarToast("Selecciona un proyecto primero.", "error"); return; }
      if(certPartesSeleccionados.length === 0) { mostrarToast("Selecciona al menos un albarán.", "error"); return; }
      const partesSeleccionadosData = partesHistorial.filter(p => certPartesSeleccionados.includes(p.id));
      const totalHorasCert = partesSeleccionadosData.reduce((acc, p) => acc + (Number(p.horasTotales) || 0), 0);
      try {
          const pdfDoc = new jsPDF();
          pdfDoc.setTextColor(0, 0, 0); pdfDoc.setFontSize(22); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text("CERTIFICACIÓN DE OBRA", 14, 25);
          const numCert = `CERT-${Date.now().toString().slice(-6).toUpperCase()}`;
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal"); pdfDoc.text(`Referencia: ${numCert}`, 14, 33); pdfDoc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 38);
          pdfDoc.setFontSize(11); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' });
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal"); pdfDoc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' });
          pdfDoc.setDrawColor(0, 0, 0); pdfDoc.setLineWidth(0.8); pdfDoc.line(14, 45, 196, 45);
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text("PROYECTO / CLIENTE:", 14, 55);
          pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "normal"); pdfDoc.text(certObraSeleccionada, 14, 62);
          let datosTabla = partesSeleccionadosData.map(p => { let equipo = p.cuadrilla?.length > 0 ? p.cuadrilla.map(c=>c.nombre).join(', ') : p.nombreTrabajador; return [ p.fecha, equipo, p.habitacionesRango || '-', p.horasTotales?.toString() || '0' ]; });
          autoTable(pdfDoc, { startY: 75, head: [['Fecha', 'Personal Asignado', 'Habitaciones', 'Horas Totales']], body: datosTabla, theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' }, columnStyles: { 3: { halign: 'center' } }, styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 }, alternateRowStyles: { fillColor: [245, 245, 245] } });
          const finalY = (pdfDoc.lastAutoTable ? pdfDoc.lastAutoTable.finalY : 120) + 15;
          pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text(`TOTAL HORAS CERTIFICADAS: ${totalHorasCert}h`, 196, finalY, { align: 'right' });
          pdfDoc.setFontSize(8); pdfDoc.setFont("helvetica", "italic"); pdfDoc.setTextColor(80, 80, 80); pdfDoc.text("• Esta certificación agrupa los albaranes de trabajo detallados para su posterior facturación.", 14, 275);
          const nuevaCert = { obra: certObraSeleccionada, partesIds: certPartesSeleccionados, referencia: numCert, totalHoras: totalHorasCert, fecha: new Date().toLocaleDateString(), timestamp: Date.now(), facturado: false, papelera: false };
          const docRef = await addDoc(collection(db, 'certificaciones'), nuevaCert);
          for (let id of certPartesSeleccionados) { await updateDoc(doc(db, 'partes_de_trabajo', id), { certificado: true, idCertificacion: docRef.id }); }
          setCertPartesSeleccionados([]); setCertObraSeleccionada(''); cargarDatos();
          pdfDoc.save(`Certificacion_${certObraSeleccionada.replace(/[^a-zA-Z0-9]/g, '_')}_${numCert}.pdf`);
          mostrarToast("Certificación generada y bloqueada.");
      } catch (error) { console.error(error); mostrarToast(`Fallo al generar PDF`, "error"); }
  };

  const borrarCertificacion = (id, partesIds) => { pedirConfirmacion("Anular Certificación", "Al anular, los albaranes quedan libres. La certificación irá a la papelera.", async () => { await updateDoc(doc(db, 'certificaciones', id), { papelera: true }); for (let pId of partesIds) { await updateDoc(doc(db, 'partes_de_trabajo', pId), { certificado: false, idCertificacion: null }); } cargarDatos(); mostrarToast("Certificación en la papelera."); }); };
  
  const toggleItemFacturacion = (id) => { setItemsAFacturar(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const generarPDFFactura = async () => {
      if(!facturaCliente) { mostrarToast("Escribe el nombre del cliente/entidad.", "error"); return; }
      if(itemsAFacturar.length === 0) { mostrarToast("Selecciona al menos un documento para facturar.", "error"); return; }
      let horasTotales = 0; let conceptos = [];
      if (modoFacturacion === 'albaranes') { const albs = partesHistorial.filter(p => itemsAFacturar.includes(p.id)); horasTotales = albs.reduce((acc, p) => acc + (Number(p.horasTotales) || 0), 0); conceptos = albs.map(a => `Albarán Ref. ${a.fecha} - ${a.obra}`); } 
      else { const certs = certificacionesActivas.filter(c => itemsAFacturar.includes(c.id)); horasTotales = certs.reduce((acc, c) => acc + (Number(c.totalHoras) || 0), 0); conceptos = certs.map(c => `Certificación Ref. ${c.referencia} - ${c.obra}`); }
      const tarifa = parseFloat(facTarifaHora) || 0; const extraMat = parseFloat(facImporteMateriales) || 0;
      const subtotalHoras = horasTotales * tarifa; const baseImponible = subtotalHoras + extraMat; const iva = baseImponible * 0.21; const total = baseImponible + iva;
      try {
          const pdfDoc = new jsPDF();
          pdfDoc.setTextColor(0, 0, 0); pdfDoc.setFontSize(24); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text("FACTURA", 14, 25);
          const numFactura = `F-${new Date().getFullYear()}-${Date.now().toString().slice(-4).toUpperCase()}`;
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal"); pdfDoc.text(`Nº Factura: ${numFactura}`, 14, 33); pdfDoc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 38);
          pdfDoc.setFontSize(11); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' });
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal"); pdfDoc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' }); pdfDoc.text("NIF: B-12345678", 196, 37, { align: 'right' });
          pdfDoc.setDrawColor(0, 0, 0); pdfDoc.setLineWidth(0.8); pdfDoc.line(14, 45, 196, 45);
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text("FACTURADO A:", 14, 55); pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "normal"); pdfDoc.text(facturaCliente, 14, 62);
          let datosTabla = [];
          if (horasTotales > 0) datosTabla.push(["Mano de obra y ejecución técnica", `${horasTotales} h`, `${tarifa.toFixed(2)} €`, `${subtotalHoras.toFixed(2)} €`]);
          if (extraMat > 0) datosTabla.push(["Materiales, suministros y extras", "-", "-", `${extraMat.toFixed(2)} €`]);
          conceptos.forEach(c => datosTabla.push([c, "-", "-", "-"]));
          autoTable(pdfDoc, { startY: 75, head: [['Concepto / Descripción', 'Cantidad', 'Precio Unit.', 'Importe']], body: datosTabla, theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } }, styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 }, alternateRowStyles: { fillColor: [245, 245, 245] } });
          const finalY = (pdfDoc.lastAutoTable ? pdfDoc.lastAutoTable.finalY : 120) + 15; const boxX = 130;
          pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "normal"); pdfDoc.text("Base Imponible:", boxX, finalY); pdfDoc.text(`${baseImponible.toFixed(2)} €`, 196, finalY, { align: 'right' });
          pdfDoc.text("IVA (21%):", boxX, finalY + 8); pdfDoc.text(`${iva.toFixed(2)} €`, 196, finalY + 8, { align: 'right' });
          pdfDoc.setDrawColor(0, 0, 0); pdfDoc.setLineWidth(0.5); pdfDoc.line(boxX, finalY + 12, 196, finalY + 12);
          pdfDoc.setFontSize(12); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text("TOTAL FACTURA:", boxX - 15, finalY + 20); pdfDoc.text(`${total.toFixed(2)} €`, 196, finalY + 20, { align: 'right' });
          const nuevaFactura = { cliente: facturaCliente, referencia: numFactura, tipo: modoFacturacion, itemsIds: itemsAFacturar, base: baseImponible, iva: iva, total: total, fecha: new Date().toLocaleDateString(), timestamp: Date.now() };
          await addDoc(collection(db, 'facturas'), nuevaFactura);
          for (let id of itemsAFacturar) { if (modoFacturacion === 'albaranes') { await updateDoc(doc(db, 'partes_de_trabajo', id), { facturado: true }); } else { await updateDoc(doc(db, 'certificaciones', id), { facturado: true }); } }
          setItemsAFacturar([]); setFacturaCliente(''); setFacTarifaHora(''); setFacImporteMateriales(''); cargarDatos();
          pdfDoc.save(`Factura_${facturaCliente.replace(/[^a-zA-Z0-9]/g, '_')}_${numFactura}.pdf`); mostrarToast("Factura emitida y contabilizada.");
      } catch(e) { console.error(e); mostrarToast("Error al emitir factura", "error"); }
  };

  const borrarFactura = (factura) => { pedirConfirmacion("Anular Factura", "Al borrar esta factura, los documentos que agrupaba volverán a estar pendientes. ¿Estás seguro?", async () => { await deleteDoc(doc(db, 'facturas', factura.id)); for (let id of factura.itemsIds) { if (factura.tipo === 'albaranes') { await updateDoc(doc(db, 'partes_de_trabajo', id), { facturado: false }); } else { await updateDoc(doc(db, 'certificaciones', id), { facturado: false }); } } cargarDatos(); mostrarToast("Factura anulada."); }); };
  const agregarItemPresupuesto = () => { if(!presuSelectMat || !presuCantMat || !presuPrecioMat) { mostrarToast("Completa los datos del concepto.", "error"); return; } setPresuItems([...presuItems, { id: Date.now(), nombre: presuSelectMat, cantidad: parseFloat(presuCantMat), precioUnitario: parseFloat(presuPrecioMat), total: parseFloat(presuCantMat) * parseFloat(presuPrecioMat) }]); setPresuSelectMat(''); setPresuCantMat(1); setPresuPrecioMat(''); };
  const quitarItemPresupuesto = (id) => { setPresuItems(presuItems.filter(item => item.id !== id)); };

  const generarPDFPresupuesto = (datos) => {
      const { cliente, items, horasEstimadas, precioHora, fecha, id } = datos;
      try {
          const doc = new jsPDF(); doc.setTextColor(0, 0, 0); doc.setFontSize(24); doc.setFont("helvetica", "bold"); doc.text("PRESUPUESTO", 14, 25);
          const numPresupuesto = id ? `PR-${id.toString().slice(-6).toUpperCase()}` : `PR-${Date.now().toString().slice(-6).toUpperCase()}`;
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Referencia: ${numPresupuesto}`, 14, 33); doc.text(`Fecha de Emisión: ${fecha || new Date().toLocaleDateString()}`, 14, 38);
          doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("GestiónPro Software & Maintenance", 196, 25, { align: 'right' }); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("Soporte Técnico y Reformas", 196, 31, { align: 'right' }); doc.text("contacto@gestionpro.com", 196, 37, { align: 'right' }); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.8); doc.line(14, 45, 196, 45);
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("DATOS DEL CLIENTE:", 14, 55); doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text(cliente, 14, 62);
          let datosTabla = (items || []).map(item => [ item.nombre, item.cantidad.toString(), `${parseFloat(item.precioUnitario).toFixed(2)} €`, `${parseFloat(item.total).toFixed(2)} €` ]);
          if (horasEstimadas && precioHora && parseFloat(horasEstimadas) > 0) { const totalHoras = parseFloat(horasEstimadas) * parseFloat(precioHora); datosTabla.push([ "Mano de Obra (Horas estimadas de trabajo)", horasEstimadas.toString(), `${parseFloat(precioHora).toFixed(2)} €`, `${totalHoras.toFixed(2)} €` ]); }
          autoTable(doc, { startY: 75, head: [['Concepto / Material', 'Cant.', 'Precio Unit.', 'Total']], body: datosTabla, theme: 'grid', headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } }, styles: { fontSize: 10, cellPadding: 6, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 }, alternateRowStyles: { fillColor: [245, 245, 245] } });
          const sumItems = (items || []).reduce((acc, item) => acc + parseFloat(item.total), 0); const sumHoras = (parseFloat(horasEstimadas) || 0) * (parseFloat(precioHora) || 0); const calcSubtotal = sumItems + sumHoras; const calcIva = calcSubtotal * 0.21; const calcTotal = calcSubtotal + calcIva;
          const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 15; const boxX = 130; 
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("Base Imponible:", boxX, finalY); doc.text(`${calcSubtotal.toFixed(2)} €`, 196, finalY, { align: 'right' }); doc.text("IVA (21%):", boxX, finalY + 8); doc.text(`${calcIva.toFixed(2)} €`, 196, finalY + 8, { align: 'right' }); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.line(boxX, finalY + 12, 196, finalY + 12); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("TOTAL PRESUPUESTO:", boxX - 15, finalY + 20); doc.text(`${calcTotal.toFixed(2)} €`, 196, finalY + 20, { align: 'right' });
          doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(80, 80, 80); doc.text("• Este presupuesto tiene una validez de 30 días naturales desde su fecha de emisión.", 14, 270);
          doc.save(`Presupuesto_${cliente.replace(/[^a-zA-Z0-9]/g, '_')}_${numPresupuesto}.pdf`);
      } catch (error) { console.error(error); mostrarToast("Fallo técnico al emitir PDF", "error"); }
  };

  const guardarYValidarPresupuesto = async () => { if(!presuCliente || presuCliente.trim() === '') { mostrarToast("Escribe el nombre del Cliente.", "error"); return; } const subtotal = presuItems.reduce((acc, item) => acc + item.total, 0) + ((parseFloat(presuHoras) || 0) * (parseFloat(presuPrecioHora) || 0)); const iva = subtotal * 0.21; const totalFinal = subtotal + iva; const nuevoPresu = { cliente: presuCliente, items: presuItems, horasEstimadas: parseFloat(presuHoras) || 0, precioHora: parseFloat(presuPrecioHora) || 0, total: totalFinal, estado: 'validado', fecha: new Date().toLocaleDateString(), timestamp: Date.now() }; const docRef = await addDoc(collection(db, 'presupuestos'), nuevoPresu); cargarDatos(); generarPDFPresupuesto({ ...nuevoPresu, id: docRef.id }); setPresuCliente(''); setPresuItems([]); setPresuHoras(''); setPresuPrecioHora(''); mostrarToast("Presupuesto guardado en el historial."); };
  const cambiarEstadoPresupuesto = async (id, estadoActual) => { const nuevoEstado = estadoActual === 'validado' ? 'pendiente' : 'validado'; await updateDoc(doc(db, 'presupuestos', id), { estado: nuevoEstado }); cargarDatos(); };
  const borrarPresupuesto = (id) => { pedirConfirmacion("Eliminar Presupuesto", "¿Estás seguro de querer borrar esta oferta del sistema?", async () => { await deleteDoc(doc(db, 'presupuestos', id)); cargarDatos(); mostrarToast("Presupuesto eliminado."); }); };
  const descargarPresupuestoExistente = (presupuesto) => { generarPDFPresupuesto(presupuesto); };

  // ===============================================
  // FUNCIONES DE LA PAPELERA (RESTAURAR Y DESTRUIR)
  // ===============================================
  const restaurarElemento = async (id, coleccion) => { await updateDoc(doc(db, coleccion, id), { papelera: false }); cargarDatos(); mostrarToast("Elemento restaurado con éxito."); };
  const destruirElementoFisico = (id, coleccion) => { pedirConfirmacion("Destrucción Definitiva", "Esta acción es irreversible y los datos se perderán de la base de datos para siempre. ¿Continuar?", async () => { await deleteDoc(doc(db, coleccion, id)); cargarDatos(); mostrarToast("Elemento destruido permanentemente."); }); };

  // ESTILOS COMUNES PARA MÓVIL Y ESCRITORIO
  const catActivaStyle = (isActive) => ({ padding: '14px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', color: isActive ? '#1a1a1a' : '#94a3b8', borderBottom: isActive ? '2px solid #1a1a1a' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', backgroundColor: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', outline: 'none', whiteSpace: 'nowrap' });
  const subMenuBtnStyle = (isActive) => ({ padding: '8px 16px', border: '1px solid #1a1a1a', background: isActive ? '#1a1a1a' : 'transparent', color: isActive ? 'white' : '#1a1a1a', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '50px' });
  // El "clamp" hace que el margen sea de 15px en móviles y 30px en ordenador automáticamente
  const blockStyle = { backgroundColor: '#ffffff', padding: 'clamp(15px, 4vw, 30px)', border: '1px solid #e5e7eb', boxSizing: 'border-box', width: '100%' };
  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '13px', backgroundColor: '#fafafa', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' };
  const btnBlackStyle = { padding: '12px 20px', backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' };

  const navegar = (cat, tab) => { setCategoriaActiva(cat); setPestañaActiva(tab); };

  return (
    <div style={{ width: '100%', fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: '#1a1a1a', boxSizing: 'border-box' }}>
      
      {/* PANTALLA DE CARGA (SPINNER) */}
      {cargando && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)', zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #1a1a1a', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '12px', color: '#1a1a1a' }}>Sincronizando datos...</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
      )}

      {/* UI FLOTANTE: TOASTS Y MODALES */}
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

      {/* MENÚ PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', marginBottom: '15px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => navegar('validacion', 'bandeja')} style={catActivaStyle(categoriaActiva === 'validacion')}><Inbox size={16} /> Validación</button>
              <button onClick={() => navegar('proyectos', 'obras')} style={catActivaStyle(categoriaActiva === 'proyectos')}><Building2 size={16} /> Proyectos</button>
              <button onClick={() => navegar('documentos', 'partes')} style={catActivaStyle(categoriaActiva === 'documentos')}><FolderOpen size={16} /> Docs y Facturación</button>
              <button onClick={() => navegar('presupuestos', 'presupuestos')} style={catActivaStyle(categoriaActiva === 'presupuestos')}><Calculator size={16} /> Presupuestos</button>
              <button onClick={() => navegar('personal', 'trabajadores')} style={catActivaStyle(categoriaActiva === 'personal')}><Users size={16} /> Personal</button>
              <button onClick={() => navegar('almacen', 'almacen')} style={catActivaStyle(categoriaActiva === 'almacen')}><Package size={16} /> Almacén</button>
              <button onClick={() => navegar('sistema', 'papelera')} style={catActivaStyle(categoriaActiva === 'sistema')}><Settings size={16} /> Sistema</button>
          </div>
          <button onClick={cambiarVista} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', backgroundColor: 'transparent', color: '#1a1a1a', border: '1px solid #1a1a1a', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}><FileText size={14} /> Modo Operario</button>
      </div>

      {/* SUB-MENÚ DINÁMICO */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', paddingLeft: '10px', flexWrap: 'wrap' }}>
          {categoriaActiva === 'proyectos' && (
              <><button onClick={()=>setPestañaActiva('obras')} style={subMenuBtnStyle(pestañaActiva === 'obras')}>Gestión de Hoteles / Obras</button><button onClick={()=>setPestañaActiva('resumen')} style={subMenuBtnStyle(pestañaActiva === 'resumen')}>Métricas y Dashboard</button></>
          )}
          {categoriaActiva === 'documentos' && (
              <><button onClick={()=>setPestañaActiva('partes')} style={subMenuBtnStyle(pestañaActiva === 'partes')}>Albaranes Históricos</button><button onClick={()=>setPestañaActiva('certificaciones')} style={subMenuBtnStyle(pestañaActiva === 'certificaciones')}>Certificaciones Mensuales</button><button onClick={()=>setPestañaActiva('facturacion')} style={subMenuBtnStyle(pestañaActiva === 'facturacion')}>Generar Factura</button></>
          )}
          {categoriaActiva === 'personal' && (
              <><button onClick={()=>setPestañaActiva('trabajadores')} style={subMenuBtnStyle(pestañaActiva === 'trabajadores')}>Plantilla Activa</button><button onClick={()=>setPestañaActiva('horas')} style={subMenuBtnStyle(pestañaActiva === 'horas')}>Control de Nóminas</button></>
          )}
          {categoriaActiva === 'sistema' && (
              <><button onClick={()=>setPestañaActiva('papelera')} style={subMenuBtnStyle(pestañaActiva === 'papelera')}>Papelera de Reciclaje</button></>
          )}
      </div>

      {/* RENDERIZADO DINÁMICO DE COMPONENTES HIJOS */}
      {pestañaActiva === 'bandeja' && ( <BandejaValidacion partesPendientes={partesPendientes} parteAValidar={parteAValidar} setParteAValidar={setParteAValidar} nuevoOperario={nuevoOperario} setNuevoOperario={setNuevoOperario} trabajadoresList={trabajadoresActivos} agregarOperarioCuadrilla={agregarOperarioCuadrilla} cuadrilla={cuadrilla} cambiarHoras={cambiarHoras} setHorasDirecto={setHorasDirecto} quitarOperario={quitarOperario} confirmarValidacionParte={confirmarValidacionParte} borrarParte={borrarParte} abrirValidacion={abrirValidacion} decodificarRangos={decodificarRangos} btnBlackStyle={btnBlackStyle} /> )}
      {pestañaActiva === 'resumen' && ( <ResumenMetricas partesDeHoy={partesDeHoy} totalHorasHoy={totalHorasHoy} trabajadoresHoy={trabajadoresHoy} porcentajeGlobal={porcentajeGlobal} /> )}
      {pestañaActiva === 'obras' && ( <GestionProyectos blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} nuevaObra={nuevaObra} setNuevaObra={setNuevaObra} numPlantas={numPlantas} setNumPlantas={setNumPlantas} configHabitaciones={configHabitaciones} setConfigHabitaciones={setConfigHabitaciones} generarHotelInteligente={generarHotelInteligente} obrasList={obrasList} obraActiva={obraActiva} setObraActiva={setObraActiva} borrarObra={borrarObra} obtenerEstadisticasHotel={obtenerEstadisticasHotel} marcarTareaHotel={marcarTareaHotel} /> )}
      {pestañaActiva === 'trabajadores' && ( <PlantillaPersonal blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} nuevoTrabajadorNombre={nuevoTrabajadorNombre} setNuevoTrabajadorNombre={setNuevoTrabajadorNombre} nuevoTrabajadorEmail={nuevoTrabajadorEmail} setNuevoTrabajadorEmail={setNuevoTrabajadorEmail} nuevoTrabajadorPass={nuevoTrabajadorPass} setNuevoTrabajadorPass={setNuevoTrabajadorPass} registrarTrabajador={registrarTrabajador} trabajadoresList={trabajadoresActivos} editandoTrabId={editandoTrabId} trabEditado={trabEditado} setTrabEditado={setTrabEditado} guardarEdicionTrabajador={guardarEdicionTrabajador} enviarResetPass={enviarResetPass} setEditandoTrabId={setEditandoTrabId} iniciarEdicionTrabajador={iniciarEdicionTrabajador} borrarTrabajador={borrarTrabajador} /> )}
      {pestañaActiva === 'horas' && ( <ControlNominas blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} exportarHorasExcel={exportarHorasExcel} labelStyle={labelStyle} inputStyle={inputStyle} fechaInicio={fechaInicio} setFechaInicio={setFechaInicio} fechaFin={fechaFin} setFechaFin={setFechaFin} pagoHoraNormal={pagoHoraNormal} setPagoHoraNormal={setPagoHoraNormal} pagoHoraExtra={pagoHoraExtra} setPagoHoraExtra={setPagoHoraExtra} horasTrabajadores={horasTrabajadores} /> )}
      {pestañaActiva === 'almacen' && ( <InventarioAlmacen blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} inputStyle={inputStyle} exportarAlmacenExcel={exportarAlmacenExcel} nuevoMatNombre={nuevoMatNombre} setNuevoMatNombre={setNuevoMatNombre} materialesList={materialesList} nuevoMatStock={nuevoMatStock} setNuevoMatStock={setNuevoMatStock} agregarMaterial={agregarMaterial} filtroMateriales={filtroMateriales} setFiltroMateriales={setFiltroMateriales} ordenMateriales={ordenMateriales} setOrdenMateriales={setOrdenMateriales} materialesCoincidentes={materialesCoincidentes} editandoMatId={editandoMatId} matEditado={matEditado} setMatEditado={setMatEditado} guardarEdicionMat={guardarEdicionMat} setEditandoMatId={setEditandoMatId} iniciarEdicionMat={iniciarEdicionMat} borrarMaterial={borrarMaterial} /> )}
      {pestañaActiva === 'partes' && ( <HistorialAlbaranes blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} exportarPartesExcel={exportarPartesExcel} labelStyle={labelStyle} inputStyle={inputStyle} fechaInicio={fechaInicio} setFechaInicio={setFechaInicio} fechaFin={fechaFin} setFechaFin={setFechaFin} filtroBuscador={filtroBuscador} setFiltroBuscador={setFiltroBuscador} setLimitePartes={setLimitePartes} ordenPartes={ordenPartes} setOrdenPartes={setOrdenPartes} partesAMostrar={partesAMostrar} /> )}
      {pestañaActiva === 'certificaciones' && ( <GeneradorCertificaciones blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} certObraSeleccionada={certObraSeleccionada} setCertObraSeleccionada={setCertObraSeleccionada} setCertPartesSeleccionados={setCertPartesSeleccionados} obrasList={obrasList} generarPDFCertificacion={generarPDFCertificacion} partesPendientesCertificar={partesPendientesCertificar} toggleParteCertificacion={toggleParteCertificacion} certPartesSeleccionados={certPartesSeleccionados} certificacionesList={certificacionesActivas} borrarCertificacion={borrarCertificacion} /> )}
      {pestañaActiva === 'facturacion' && ( <EmisionFacturas blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} modoFacturacion={modoFacturacion} setModoFacturacion={setModoFacturacion} setItemsAFacturar={setItemsAFacturar} facturaCliente={facturaCliente} setFacturaCliente={setFacturaCliente} facTarifaHora={facTarifaHora} setFacTarifaHora={setFacTarifaHora} facImporteMateriales={facImporteMateriales} setFacImporteMateriales={setFacImporteMateriales} partesHistorial={partesHistorial} certificacionesList={certificacionesActivas} itemsAFacturar={itemsAFacturar} toggleItemFacturacion={toggleItemFacturacion} generarPDFFactura={generarPDFFactura} facturasList={facturasList} borrarFactura={borrarFactura} /> )}
      {pestañaActiva === 'presupuestos' && ( <PresupuestosOfertas blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} labelStyle={labelStyle} inputStyle={inputStyle} guardarYValidarPresupuesto={guardarYValidarPresupuesto} presuCliente={presuCliente} setPresuCliente={setPresuCliente} presuSelectMat={presuSelectMat} setPresuSelectMat={setPresuSelectMat} presuCantMat={presuCantMat} setPresuCantMat={setPresuCantMat} presuPrecioMat={presuPrecioMat} setPresuPrecioMat={setPresuPrecioMat} agregarItemPresupuesto={agregarItemPresupuesto} presuItems={presuItems} quitarItemPresupuesto={quitarItemPresupuesto} presuHoras={presuHoras} setPresuHoras={setPresuHoras} presuPrecioHora={presuPrecioHora} setPresuPrecioHora={setPresuPrecioHora} presupuestosList={presupuestosList} descargarPresupuestoExistente={descargarPresupuestoExistente} cambiarEstadoPresupuesto={cambiarEstadoPresupuesto} borrarPresupuesto={borrarPresupuesto} /> )}
      
      {pestañaActiva === 'papelera' && ( <PapeleraReciclaje blockStyle={blockStyle} partesPapelera={partesPapelera} certificacionesPapelera={certificacionesPapelera} trabajadoresPapelera={trabajadoresPapelera} restaurarElemento={restaurarElemento} destruirElementoFisico={destruirElementoFisico} /> )}

    </div>
  );
}