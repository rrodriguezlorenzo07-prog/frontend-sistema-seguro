// @ts-check
import { useState, useEffect, useCallback } from 'react';
import { db, auth, authSecundario, functions } from '../firebase'; 
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, getDoc, writeBatch, increment, orderBy, limit, startAfter, where } from 'firebase/firestore';
import { signOut, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth'; 
import { Building2, FileText, Users, Calculator, Inbox, CheckCircle, Package, FolderOpen, AlertTriangle, Settings, Menu, X, ArrowLeftRight, CalendarRange } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { horasTotalesDocumento } from '../utils/horasDocumento';
import { HORAS_BASE_POR_DEFECTO } from '../utils/nomina';
import { cambioDeEstado, trocearParaConsulta } from '../logica/acopios';

import { construirCSV, descargarCSV, textoCSV, numeroCSV, enteroCSV, fechaParaNombre } from '../utils/csv';
import { hidratarPartes, rangoDeFechas, filtrarPorRango, buscarPartes, resumenDelDia, marcarFacturados } from '../logica/partes';
import { cuadrillaInicial, agregarOperario, ajustarHorasExtra, fijarHorasExtra, quitarOperario, normalizarCuadrilla } from '../logica/cuadrilla';
import { ubicacionCoincideConTarea, generarTareasDeHotel, alternarTareas, progresoDeObras, estadisticasDeObra } from '../logica/obras';
import { filtrarMateriales } from '../logica/inventario';
import { color, texto, peso, interletra, espacio, radio, sombra, transicion, objetivo, corte } from '../estilos/tokens';
import Boton from '../ui/Boton';
import Modal from '../ui/Modal';
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
import GestionCuadrillas from './oficina/GestionCuadrillas';
import GestionVehiculos from './oficina/GestionVehiculos';
import CuadranteDiario from './oficina/CuadranteDiario';
import AcopiosObra from './oficina/AcopiosObra';

export default function PanelOficina({ cambiarVista }) {
  const TAMANO_PAGINA = 300;
  const LIMITE_DOCUMENTOS = 200;

  const [cargando, setCargando] = useState(true);

  const [partes, setPartes] = useState([]);
  const [obrasList, setObrasList] = useState([]);
  const [materialesList, setMaterialesList] = useState([]);

  // --- Planificación (F1 y F2). Se carga aparte de cargarDatos(): solo hace falta
  // cuando se abre la categoría, y así la carga inicial del panel no paga por ello.
  const [cuadrillasList, setCuadrillasList] = useState([]);
  const [vehiculosList, setVehiculosList] = useState([]);
  const [cuadranteFecha, setCuadranteFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [asignaciones, setAsignaciones] = useState([]);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);

  // --- Unidades de obra propuestas por el operario en el parte que se está validando
  // (Pieza 3, D7). Se cargan al abrir el parte, no en la carga general del panel.
  const [unidadesPropuestas, setUnidadesPropuestas] = useState([]);
  const [unidadesAConfirmar, setUnidadesAConfirmar] = useState([]);

  // --- Acopios (Pieza 4). `acopiosDelDia` alimenta el aviso de lo que FALTA en el
  // tablero (A4); `acopiosDeLaObra` es la pantalla de planificación.
  const [obraAcopios, setObraAcopios] = useState(null);
  const [acopiosDeLaObra, setAcopiosDeLaObra] = useState([]);
  const [acopiosDelDia, setAcopiosDelDia] = useState([]);
  const [guardandoAcopio, setGuardandoAcopio] = useState(false);
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


  const [certObraSeleccionada, setCertObraSeleccionada] = useState('');
  // Id de la obra seleccionada para certificar, resuelto desde su nombre.
  const certObraId = obrasList.find(o => o.nombre === certObraSeleccionada)?.id ?? null;
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

  const mostrarToast = useCallback((mensaje, tipo = 'success') => { setToast({ visible: true, mensaje, tipo }); setTimeout(() => setToast({ visible: false, mensaje: '', tipo: 'success' }), 3000); }, []);
  const pedirConfirmacion = (titulo, mensaje, accionConfirmar) => { setModalConfirm({ visible: true, titulo, mensaje, onConfirm: accionConfirmar }); };
  const cerrarModal = () => setModalConfirm({ ...modalConfirm, visible: false });

  // Actualizaciones locales para no releer toda la base tras una escritura conocida.
  const actualizarEnLista = (setLista, id, cambios) => setLista(prev => prev.map(x => (x.id === id ? { ...x, ...cambios } : x)));
  const quitarDeLista = (setLista, id) => setLista(prev => prev.filter(x => x.id !== id));

  // Consultas reutilizadas por la carga inicial y por los refrescos puntuales.
  const consultaPartes = () => query(collection(db, 'partes_de_trabajo'), orderBy('timestamp', 'desc'), limit(TAMANO_PAGINA));
  const consultaCertificaciones = () => query(collection(db, 'certificaciones'), orderBy('timestamp', 'desc'), limit(LIMITE_DOCUMENTOS));
  const consultaFacturas = () => query(collection(db, 'facturas'), orderBy('timestamp', 'desc'), limit(LIMITE_DOCUMENTOS));
  const consultaValidaciones = () => query(collection(db, 'validaciones'), orderBy('timestamp', 'desc'), limit(TAMANO_PAGINA));

  const mapear = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const mapaDe = (snap) => new Map(snap.docs.map((d) => [d.id, d.data()]));


  // Para páginas arbitrarias (búsqueda por fechas, cargar más): se piden las
  // validaciones del mismo rango de timestamps que la página ya cargada.
  const traerValidacionesDe = async (partes) => {
      const marcas = partes.filter(p => p.estado === 'aprobado' && p.timestamp).map(p => Number(p.timestamp));
      if (marcas.length === 0) return new Map();
      const q = query(collection(db, 'validaciones'),
          where('timestamp', '>=', Math.min(...marcas)),
          where('timestamp', '<=', Math.max(...marcas)),
          orderBy('timestamp', 'desc'), limit(TAMANO_PAGINA));
      return mapaDe(await getDocs(q));
  };

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
  // ------------------------------------------------------------ planificación

  const refrescarCatalogosPlanificacion = useCallback(async () => {
      const [snapCuadrillas, snapVehiculos] = await Promise.all([
          getDocs(collection(db, 'cuadrillas')),
          getDocs(collection(db, 'vehiculos'))
      ]);
      setCuadrillasList(mapear(snapCuadrillas).filter(c => !c.papelera));
      setVehiculosList(mapear(snapVehiculos).filter(v => !v.papelera));
  }, []);

  /**
   * Asignaciones de un día. Se consulta por igualdad de `fecha` y se ordena por hora:
   * ese par exige el índice compuesto de firestore.indexes.json, que se despliega
   * ANTES que esta pantalla.
   */
  const refrescarAsignaciones = useCallback(async (dia) => {
      const snap = await getDocs(query(
          collection(db, 'cuadrantes'),
          where('fecha', '==', dia),
          orderBy('horaInicio')
      ));
      setAsignaciones(mapear(snap));
  }, []);

  const crearCuadrilla = async (nombre) => {
      await addDoc(collection(db, 'cuadrillas'), { nombre, operarios: [], papelera: false });
      refrescarCatalogosPlanificacion();
      mostrarToast('Cuadrilla creada.');
  };

  const actualizarOperariosCuadrilla = async (id, operarios) => {
      await updateDoc(doc(db, 'cuadrillas', id), { operarios });
      actualizarEnLista(setCuadrillasList, id, { operarios });
  };

  const borrarCuadrilla = (id) => {
      pedirConfirmacion('Eliminar cuadrilla', 'Las asignaciones ya hechas con esta cuadrilla no se tocan: conservan el nombre que tenían. ¿Proceder?', async () => {
          await updateDoc(doc(db, 'cuadrillas', id), { papelera: true });
          quitarDeLista(setCuadrillasList, id);
          mostrarToast('Cuadrilla eliminada.');
      });
  };

  const crearVehiculo = async ({ nombre, matricula }) => {
      await addDoc(collection(db, 'vehiculos'), { nombre, matricula: matricula || '', papelera: false });
      refrescarCatalogosPlanificacion();
      mostrarToast('Vehículo registrado.');
  };

  const guardarVehiculo = async (id, datos) => {
      const limpio = { nombre: String(datos.nombre || '').trim(), matricula: String(datos.matricula || '').trim() };
      if (!limpio.nombre) { mostrarToast('El vehículo necesita un nombre.', 'error'); return; }
      await updateDoc(doc(db, 'vehiculos', id), limpio);
      actualizarEnLista(setVehiculosList, id, limpio);
      mostrarToast('Vehículo guardado.');
  };

  const borrarVehiculo = (id) => {
      pedirConfirmacion('Eliminar vehículo', '¿Quitar este vehículo del catálogo?', async () => {
          await updateDoc(doc(db, 'vehiculos', id), { papelera: true });
          quitarDeLista(setVehiculosList, id);
          mostrarToast('Vehículo eliminado.');
      });
  };

  // ------------------------------------------------------------------ acopios

  const refrescarAcopiosDeObra = useCallback(async (obraId) => {
      if (!obraId) { setAcopiosDeLaObra([]); return; }
      const snap = await getDocs(query(
          collection(db, 'acopios'), where('obraId', '==', obraId), orderBy('creadoEn')
      ));
      setAcopiosDeLaObra(mapear(snap));
  }, []);

  /**
   * Los acopios de las obras que tienen asignación ese día, para el aviso del tablero.
   *
   * Se trocea en grupos de 30 porque el operador `in` de Firestore no admite más. Hoy
   * hay tres obras y no hace falta, pero una consulta que revienta el día que la
   * empresa crece fallaría en forma de pantalla en blanco, sin aviso.
   */
  const refrescarAcopiosDelDia = useCallback(async (asignacionesDelDia) => {
      const trozos = trocearParaConsulta(asignacionesDelDia.map((a) => a.obraId));
      if (trozos.length === 0) { setAcopiosDelDia([]); return; }
      try {
          const lotes = await Promise.all(trozos.map((ids) =>
              getDocs(query(collection(db, 'acopios'), where('obraId', 'in', ids)))
          ));
          setAcopiosDelDia(lotes.flatMap((snap) => mapear(snap)));
      } catch (error) {
          console.error('No se pudieron cargar los acopios del día:', error);
          setAcopiosDelDia([]);
      }
  }, []);

  const crearAcopio = async (acopio) => {
      setGuardandoAcopio(true);
      try {
          await addDoc(collection(db, 'acopios'), { ...acopio, creadoPor: auth.currentUser?.email ?? 'oficina', actualizadoPor: auth.currentUser?.email ?? 'oficina' });
          await refrescarAcopiosDeObra(acopio.obraId);
          mostrarToast('Acopio añadido.');
      } catch (error) {
          console.error(error);
          mostrarToast('No se pudo guardar el acopio: ' + error.message, 'error');
      } finally {
          setGuardandoAcopio(false);
      }
  };

  const moverEstadoAcopio = async (acopio, nuevoEstado) => {
      const { cambios, motivo } = cambioDeEstado(acopio, nuevoEstado, auth.currentUser?.email ?? 'oficina');
      if (!cambios) { mostrarToast(motivo, 'error'); return; }
      await updateDoc(doc(db, 'acopios', acopio.id), cambios);
      actualizarEnLista(setAcopiosDeLaObra, acopio.id, cambios);
  };

  const borrarAcopio = (id) => {
      pedirConfirmacion('Quitar acopio', '¿Quitar este material de la planificación de la obra?', async () => {
          await deleteDoc(doc(db, 'acopios', id));
          quitarDeLista(setAcopiosDeLaObra, id);
          mostrarToast('Acopio quitado.');
      });
  };

  const crearAsignacion = async (asignacion) => {
      setGuardandoAsignacion(true);
      try {
          // creadoPor se pone aquí y no en la lógica pura: la lógica no sabe quién ha
          // iniciado sesión, y no debe saberlo.
          await addDoc(collection(db, 'cuadrantes'), { ...asignacion, creadoPor: auth.currentUser?.email ?? 'oficina' });
          await refrescarAsignaciones(asignacion.fecha);
          mostrarToast('Asignación guardada.');
      } catch (error) {
          console.error(error);
          mostrarToast('No se pudo guardar la asignación: ' + error.message, 'error');
      } finally {
          setGuardandoAsignacion(false);
      }
  };

  const borrarAsignacion = (id) => {
      pedirConfirmacion('Quitar asignación', '¿Quitar esta asignación del cuadrante?', async () => {
          await deleteDoc(doc(db, 'cuadrantes', id));
          quitarDeLista(setAsignaciones, id);
          mostrarToast('Asignación quitada.');
      });
  };

  const refrescarInventario = async () => {
      setMaterialesList(mapear(await getDocs(collection(db, 'inventario'))));
  };


  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      // Las consultas van en paralelo: antes eran una cadena de await.
      const [snapPartes, snapObras, snapMateriales, snapTrab, snapCert, snapFacturas, snapValidaciones] = await Promise.all([
        getDocs(consultaPartes()),
        getDocs(collection(db, 'obras')),
        getDocs(collection(db, 'inventario')),
        getDocs(collection(db, 'trabajadores')),
        getDocs(consultaCertificaciones()),
        getDocs(consultaFacturas()),
        getDocs(consultaValidaciones())
      ]);

      if (!snapPartes.empty) {
          setUltimoDocPartes(snapPartes.docs[snapPartes.docs.length - 1]);
          setPartes(hidratarPartes(mapear(snapPartes), mapaDe(snapValidaciones)));
          setHayMasPartes(snapPartes.docs.length === TAMANO_PAGINA);
      } else {
          setPartes([]); setUltimoDocPartes(null); setHayMasPartes(false);
      }
      setModoBusqueda(false);

      const listaObrasFrescas = mapear(snapObras);
      setObrasList(listaObrasFrescas);
      setObraActiva(prev => (prev ? listaObrasFrescas.find(o => o.id === prev.id) || prev : null));

      setMaterialesList(mapear(snapMateriales));
      setTrabajadoresList(mapear(snapTrab).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCertificacionesList(mapear(snapCert));
      setFacturasList(mapear(snapFacturas));
    } catch (error) { console.error("Error:", error); mostrarToast("Error cargando base de datos", "error"); } finally { setCargando(false); }
  }, [mostrarToast]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Los catálogos de planificación se cargan solo al entrar en la categoría, no en la
  // carga inicial del panel: son datos que la mayoría de las pestañas no usa.
  useEffect(() => {
      if (categoriaActiva !== 'planificacion') return;
      refrescarCatalogosPlanificacion();
  }, [categoriaActiva, refrescarCatalogosPlanificacion]);

  // Los acopios de la obra elegida en la pantalla de planificación.
  useEffect(() => {
      if (categoriaActiva !== 'almacen') return;
      refrescarAcopiosDeObra(obraAcopios);
  }, [categoriaActiva, obraAcopios, refrescarAcopiosDeObra]);

  // Lo que falta para las obras del día, para el aviso del tablero (A4).
  useEffect(() => {
      if (categoriaActiva !== 'planificacion') return;
      refrescarAcopiosDelDia(asignaciones);
  }, [categoriaActiva, asignaciones, refrescarAcopiosDelDia]);

  // Las asignaciones se recargan al cambiar de día.
  useEffect(() => {
      if (categoriaActiva !== 'planificacion') return;
      refrescarAsignaciones(cuadranteFecha);
  }, [categoriaActiva, cuadranteFecha, refrescarAsignaciones]);

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
              const nuevos = hidratarPartes(mapear(res), await traerValidacionesDe(mapear(res)));
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
          const partesPagina = mapear(snap);
          setPartes(hidratarPartes(partesPagina, await traerValidacionesDe(partesPagina)));
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


  const cargarUnidadesDelParte = async (parteId) => {
      try {
          const snap = await getDocs(query(
              collection(db, 'unidades_obra'),
              where('parteId', '==', parteId),
              orderBy('orden')
          ));
          // Solo las que siguen sin confirmar: las ya confirmadas no se vuelven a ofrecer.
          const propuestas = mapear(snap).filter((u) => u.estado === 'propuesta');
          setUnidadesPropuestas(propuestas);
          // Vienen todas premarcadas: lo normal es que el operario acierte, y así la
          // oficina desmarca la excepción en vez de marcar la norma.
          setUnidadesAConfirmar(propuestas.map((u) => u.id));
      } catch (error) {
          console.error('No se pudieron cargar las unidades propuestas:', error);
          setUnidadesPropuestas([]);
          setUnidadesAConfirmar([]);
      }
  };

  const alternarUnidad = (id) => setUnidadesAConfirmar((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const alternarTodasLasUnidades = () => setUnidadesAConfirmar((prev) =>
      prev.length === unidadesPropuestas.length ? [] : unidadesPropuestas.map((u) => u.id));

  const abrirValidacion = (parte) => { cargarUnidadesDelParte(parte.id); setParteAValidar(parte); setCuadrilla(cuadrillaInicial(parte, trabajadoresList)); };
  // nuevoOperario es ahora el id del trabajador, no su nombre. El nombre se guarda
  // igualmente: es el registro histórico del albarán.
  const agregarOperarioCuadrilla = () => {
      const nueva = agregarOperario(cuadrilla, nuevoOperario, trabajadoresList);
      if (nueva === cuadrilla) return;
      setCuadrilla(nueva);
      setNuevoOperario('');
  };
  const cambiarHorasExtra = (index, cantidad) => setCuadrilla(ajustarHorasExtra(cuadrilla, index, cantidad));
  const setHorasExtraDirecto = (index, valor) => setCuadrilla(fijarHorasExtra(cuadrilla, index, valor));
  const quitarDeLaCuadrilla = (index) => setCuadrilla(quitarOperario(cuadrilla, index));

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
          // Stock: increment() resuelve la resta en el servidor, así que dos
          // validaciones simultáneas ya no se pisan. Se comprueba antes qué
          // materiales siguen existiendo, porque batch.update() sobre un documento
          // borrado haría fallar todo el lote.
          const materialesUsados = parteAValidar.materialesUsados || [];
          const existencias = await Promise.all(
              materialesUsados.map((mat) => getDoc(doc(db, 'inventario', mat.id)))
          );
          // Habitaciones terminadas: aquí SOLO se calcula. La escritura va abajo, dentro del
          // mismo lote que el stock, el estado y la validación. Antes esto era un updateDoc
          // suelto que ya había confirmado cuando el lote todavía podía fallar, así que un
          // fallo posterior dejaba habitaciones marcadas como terminadas por un parte que
          // nunca llegó a aprobarse.
          let obraAMarcar = null;
          let tareasActualizadas = null;
          if (parteAValidar.tareasRealizadas && parteAValidar.tareasRealizadas.length > 0 && parteAValidar.obra) {
              const obraAsociada = parteAValidar.obraId
                      ? obrasList.find(o => o.id === parteAValidar.obraId)
                      : obrasList.find(o => o.nombre === parteAValidar.obra);
              if (obraAsociada && obraAsociada.tareas) {
                  let huboCambios = false;
                  const tareas = obraAsociada.tareas.map(tarea => {
                      if (tarea.completada) return tarea;
                      const coincide = parteAValidar.tareasRealizadas.some(t => ubicacionCoincideConTarea(tarea, t.ubicacion));
                      if (coincide) { huboCambios = true; return { ...tarea, completada: true }; }
                      return tarea;
                  });
                  if (huboCambios) { obraAMarcar = obraAsociada.id; tareasActualizadas = tareas; }
              }
          }
          // Solo horas extra: las normales son base mensual fija y nunca se derivan de un parte.
          const { cuadrilla: cuadrillaNumerica, horasExtraAsignadas } = normalizarCuadrilla(cuadrilla);
          // Campos nuevos: no se pisa ninguno de los que escribe el operario.
          const fechaValidacion = new Date().toLocaleDateString();
          // LAS CUATRO ESCRITURAS VAN EN EL MISMO LOTE: habitaciones terminadas, descuento
          // de stock, estado del parte y documento de validación. O se confirman las cuatro
          // o no se confirma ninguna. Nunca puede quedar un parte aprobado sin validación,
          // ni una habitación marcada por un parte que no llegó a aprobarse.
          const lote = writeBatch(db);
          if (obraAMarcar && tareasActualizadas) {
              lote.update(doc(db, 'obras', obraAMarcar), { tareas: tareasActualizadas });
          }
          materialesUsados.forEach((mat, indice) => {
              if (!existencias[indice].exists()) return;
              lote.update(doc(db, 'inventario', mat.id), { stock: increment(-(Number(mat.cantidad) || 0)) });
          });
          // Las unidades confirmadas entran EN EL MISMO LOTE que el resto de la
          // aprobación: una unidad no puede quedar confirmada por un parte que no se
          // llegó a aprobar, porque confirmar es lo que habilitará certificarla.
          const correoOficina = auth.currentUser?.email ?? 'oficina';
          for (const unidadId of unidadesAConfirmar) {
              lote.update(doc(db, 'unidades_obra', unidadId), {
                  estado: 'confirmada',
                  confirmadaPor: correoOficina,
                  confirmadaEn: Date.now()
              });
          }
          lote.update(doc(db, 'partes_de_trabajo', parteAValidar.id), { estado: 'aprobado', fechaValidacion, certificado: false, facturado: false, papelera: false });
          lote.set(doc(db, 'validaciones', parteAValidar.id), {
              cuadrilla: cuadrillaNumerica,
              horasExtraAsignadas,
              timestamp: Number(parteAValidar.timestamp) || Date.now(),
              obra: parteAValidar.obra ?? null,
              obraId: parteAValidar.obraId ?? null,
              fechaValidacion
          }, { merge: true });
          await lote.commit();
          setParteAValidar(null); setCuadrilla([]);
          setUnidadesPropuestas([]); setUnidadesAConfirmar([]);
          cargarDatos(); mostrarToast("Albarán validado y guardado.");
      } catch (error) {
          console.error(error); mostrarToast("Error al validar el parte: " + error.message, "error");
      } finally {
          setValidandoParte(false);
      }
  };

  const generarHotelInteligente = async () => { if(!nuevaObra) { mostrarToast("Introduce un nombre para el proyecto.", "error"); return; } const tareasGeneradas = generarTareasDeHotel(numPlantas, configHabitaciones); await addDoc(collection(db, 'obras'), { nombre: nuevaObra, tareas: tareasGeneradas, papelera: false }); setNuevaObra(''); setNumPlantas(1); setConfigHabitaciones('10'); refrescarObras(); mostrarToast("Proyecto creado con éxito."); };
  const marcarTareaHotel = async (tareaIdOArray) => { 
      if(!obraActiva) return; 
      const tareasNuevas = alternarTareas(obraActiva.tareas, tareaIdOArray); 
      await updateDoc(doc(db, 'obras', obraActiva.id), { tareas: tareasNuevas }); 
      setObraActiva({...obraActiva, tareas: tareasNuevas}); actualizarEnLista(setObrasList, obraActiva.id, { tareas: tareasNuevas }); 
  };  
  const borrarObra = (id) => { pedirConfirmacion("Cerrar Proyecto", "Vas a enviar este hotel a la papelera. Podrás recuperarlo con todo su progreso. ¿Proceder?", async () => { await updateDoc(doc(db, 'obras', id), { papelera: true }); setObraActiva(null); actualizarEnLista(setObrasList, id, { papelera: true }); mostrarToast("Proyecto en papelera."); }); };
  const borrarParte = (id) => { pedirConfirmacion("Rechazar Parte", "El parte volverá al operario como rechazado y se guardará en la papelera. ¿Proceder?", async () => { await updateDoc(doc(db, 'partes_de_trabajo', id), { estado: 'rechazado', papelera: true }); actualizarEnLista(setPartes, id, { estado: 'rechazado', papelera: true }); mostrarToast("Parte rechazado."); }); };

  const agregarMaterial = async () => { if(!nuevoMatNombre || !nuevoMatStock) { mostrarToast("Falta nombre o unidades", "error"); return; } const matExistente = materialesList.find(m => m.nombre.toLowerCase().trim() === nuevoMatNombre.toLowerCase().trim()); if(matExistente) { await updateDoc(doc(db, 'inventario', matExistente.id), { stock: matExistente.stock + parseInt(nuevoMatStock) }); } else { await addDoc(collection(db, 'inventario'), { nombre: nuevoMatNombre.trim(), stock: parseInt(nuevoMatStock) }); } setNuevoMatNombre(''); setNuevoMatStock(''); refrescarInventario(); mostrarToast("Inventario actualizado."); };
  const iniciarEdicionMat = (mat) => { setEditandoMatId(mat.id); setMatEditado(mat); };
  const guardarEdicionMat = async () => { await updateDoc(doc(db, 'inventario', editandoMatId), { nombre: matEditado.nombre, stock: parseInt(matEditado.stock) }); actualizarEnLista(setMaterialesList, editandoMatId, { nombre: matEditado.nombre, stock: parseInt(matEditado.stock) }); setEditandoMatId(null); mostrarToast("Material guardado."); };
  const borrarMaterial = (id) => { pedirConfirmacion("Eliminar Material", "¿Quitar este material del inventario?", async () => { await deleteDoc(doc(db, 'inventario', id)); quitarDeLista(setMaterialesList, id); mostrarToast("Material eliminado."); }); };

  const getTimeRango = () => rangoDeFechas(fechaInicio, fechaFin);
  const { start: rangoInicio, end: rangoFin } = getTimeRango();
  const partesHistorialFiltradosFecha = filtrarPorRango(partesHistorial, rangoInicio, rangoFin);

  const { partes: partesDeHoy, horas: totalHorasHoy, trabajadores: trabajadoresHoy } = resumenDelDia(partesHistorial);
  const { porcentaje: porcentajeGlobal } = progresoDeObras(obrasActivas);

  const partesCoincidentes = buscarPartes(partesHistorialFiltradosFecha, filtroBuscador, ordenPartes);
  const partesAMostrar = partesCoincidentes.slice(0, limitePartes);
  const materialesCoincidentes = filtrarMateriales(materialesList, filtroMateriales, ordenMateriales);

  // El cálculo de horas extra del periodo vive ahora en ControlNominas: solo esa
  // pantalla lo necesita y solo se monta cuando su pestaña está activa, así que la
  // carga inicial del panel no paga por él.

  const obtenerEstadisticasHotel = (nombreHotel, obraId = null) => estadisticasDeObra(partesHistorial, nombreHotel, obraId);

  const exportarPartesExcel = () => {
      const cabeceras = ['Fecha', 'Operarios (H. Extra)', 'Horas Extra', 'Hotel/Obra', 'Material Utilizado', 'Trabajo Realizado'];
      const filas = partesCoincidentes.map((p) => {
          const equipo = p.cuadrilla?.length > 0
              ? p.cuadrilla.map(c => `${c.nombre}${(Number(c.horasExtra) || 0) > 0 ? ` (+${c.horasExtra}h extra)` : ''}`).join(' - ')
              : (p.nombreTrabajador || p.creador || '');
          const materiales = p.materialesUsados?.map(m => `${m.cantidad}x ${m.nombre}`).join(', ') || '';
          return [
              textoCSV(p.fecha || ''),
              textoCSV(equipo),
              numeroCSV(p.horasExtraAsignadas || 0),
              textoCSV(p.obra || ''),
              textoCSV(materiales),
              textoCSV(p.trabajo || '')
          ];
      });
      descargarCSV(`Albaranes_${fechaInicio}_a_${fechaFin}.csv`, construirCSV(cabeceras, filas));
      mostrarToast("Excel generado");
  };
  const exportarAlmacenExcel = () => {
      const filas = materialesCoincidentes.map((m) => [textoCSV(m.nombre || ''), enteroCSV(m.stock)]);
      descargarCSV(`Inventario_Almacen_${fechaParaNombre()}.csv`, construirCSV(['Material', 'Stock Actual'], filas));
      mostrarToast("Excel generado");
  };

  const partesPendientesCertificar = partesHistorial.filter(p => (certObraId && p.obraId ? p.obraId === certObraId : p.obra === certObraSeleccionada) && p.certificado !== true && p.facturado !== true);
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
          if (modoFacturacion === 'certificaciones') { setCertificacionesList(prev => marcarFacturados(prev, itemsAFacturar)); } else { setPartes(prev => marcarFacturados(prev, itemsAFacturar)); }
          alert("¡Factura emitida y elementos bloqueados con éxito!"); setItemsAFacturar([]); setFacturaCliente(''); setFacTarifaHora(''); setFacImporteMateriales('');
      } catch (error) { console.error("Error al emitir factura:", error); alert("Error al emitir la factura: " + error.message); }
  };

  const borrarFactura = (factura) => { pedirConfirmacion("Anular Factura", "Al borrar esta factura, los documentos que agrupaba volverán a estar pendientes. ¿Estás seguro?", async () => { try { const batch = writeBatch(db); const refFactura = doc(db, 'facturas', factura.id); batch.delete(refFactura); const arrayDeIds = factura.items || []; const nombreColeccion = factura.modo === 'albaranes' ? 'partes_de_trabajo' : 'certificaciones'; for (let id of arrayDeIds) { const refItem = doc(db, nombreColeccion, id); batch.update(refItem, { facturado: false }); } await batch.commit(); cargarDatos(); mostrarToast("Factura anulada correctamente."); } catch (error) { console.error("Error al anular factura:", error); mostrarToast("Hubo un error al anular la factura.", "error"); } }); };  


  const restaurarElemento = async (id, coleccion) => {
      // Restaurar un parte rechazado deshace el rechazo: vuelve a la bandeja.
      const esParteRechazado = coleccion === 'partes_de_trabajo'
          && partes.find(p => p.id === id)?.estado === 'rechazado';
      const cambios = esParteRechazado ? { papelera: false, estado: 'pendiente' } : { papelera: false };
      await updateDoc(doc(db, coleccion, id), cambios);
      cargarDatos();
      mostrarToast(esParteRechazado ? "Parte devuelto a la bandeja de validación." : "Elemento restaurado con éxito.");
  };
  const destruirElementoFisico = (id, coleccion) => { pedirConfirmacion("Destrucción Definitiva", "Esta acción es irreversible y los datos se perderán de la base de datos para siempre. ¿Continuar?", async () => { await deleteDoc(doc(db, coleccion, id)); if (coleccion === 'partes_de_trabajo') { await deleteDoc(doc(db, 'validaciones', id)); } cargarDatos(); mostrarToast("Elemento destruido permanentemente."); }); };

  // Estos seis objetos siguen viajando por props a los hijos: convertirlos a primitivas
  // dentro de cada componente es trabajo de la pasada siguiente. Definidos ya con
  // tokens, todas las pantallas que los reciben cambian de aspecto sin tocarlas.
  const catActivaStyle = (isActive) => ({ padding: `${espacio.sm} ${espacio.md}`, cursor: 'pointer', fontWeight: peso.fuerte, fontSize: texto.base, color: isActive ? color.petroleo : color.textoTenue, borderBottom: `2px solid ${isActive ? color.vidrio : 'transparent'}`, display: 'flex', alignItems: 'center', gap: espacio.xs, transition: `color ${transicion.normal}, border-color ${transicion.normal}`, backgroundColor: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', outline: 'none', whiteSpace: 'nowrap' });
  const subMenuBtnStyle = (isActive) => ({ padding: `${espacio.xs} ${espacio.md}`, border: `1px solid ${isActive ? color.petroleo : color.canto}`, background: isActive ? color.petroleo : 'transparent', color: isActive ? color.textoSobreOscuro : color.vidrio, fontWeight: peso.fuerte, fontSize: texto.menor, letterSpacing: interletra.etiqueta, textTransform: 'uppercase', cursor: 'pointer', borderRadius: radio.pastilla, whiteSpace: 'nowrap', transition: `background ${transicion.normal}, color ${transicion.normal}` });
  // El aire de Vidrio, pero contenido en pantallas estrechas: en oficina 32 px, en un
  // teléfono 16, porque si no la mitad de la tarjeta es margen.
  const blockStyle = { backgroundColor: color.superficie, padding: 'clamp(16px, 3vw, 32px)', border: `1px solid ${color.linea}`, borderRadius: radio.sutil, boxSizing: 'border-box', width: '100%' };
  const inputStyle = { width: '100%', padding: `${espacio.sm} ${espacio.md}`, border: `1px solid ${color.linea}`, borderRadius: radio.sutil, outline: 'none', fontSize: texto.base, color: color.texto, backgroundColor: color.superficie, boxSizing: 'border-box', minHeight: objetivo.comodo };
  const labelStyle = { display: 'block', fontSize: texto.etiqueta, fontWeight: peso.fuerte, color: color.textoSuave, marginBottom: espacio.xs, letterSpacing: interletra.etiqueta, textTransform: 'uppercase' };
  const btnBlackStyle = { padding: `${espacio.sm} ${espacio.lg}`, backgroundColor: color.petroleo, color: color.textoSobreOscuro, border: '1px solid transparent', borderRadius: radio.sutil, cursor: 'pointer', fontWeight: peso.fuerte, fontSize: texto.menor, letterSpacing: interletra.etiqueta, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: espacio.xs, whiteSpace: 'nowrap', minHeight: objetivo.comodo, boxShadow: sombra.sutil };

  const navegar = (cat, tab) => { setCategoriaActiva(cat); setPestañaActiva(tab); setMenuMovilAbierto(false); };

  return (
    <div style={{ width: '100%', color: color.texto, boxSizing: 'border-box' }}>
      {/* Lo único que no cabe en un objeto de estilo: pseudoelementos, media queries y
          keyframes. Los valores salen de los mismos tokens, interpolados. */}
      <style>{`
        .desktop-menu { display: flex; gap: ${espacio.xs}; overflow-x: auto; padding-bottom: ${espacio.xxs}; }
        .desktop-menu::-webkit-scrollbar { height: 4px; }
        .desktop-menu::-webkit-scrollbar-thumb { background: ${color.canto}; border-radius: ${radio.sutil}; }
        .mobile-toggle { display: none; background: none; border: none; cursor: pointer; color: ${color.petroleo}; padding: ${espacio.xxs}; }
        .mobile-dropdown { display: none; }
        .hide-on-mobile { display: inline-block; }
        @media (max-width: ${corte.escritorio}) {
            .desktop-menu { display: none !important; }
            .mobile-toggle { display: block !important; }
            .hide-on-mobile { display: none !important; }
            .mobile-dropdown.open { display: flex !important; flex-direction: column; gap: ${espacio.xxs}; background: ${color.superficieTenida}; padding: ${espacio.md}; border: 1px solid ${color.canto}; border-radius: ${radio.medio}; margin-bottom: ${espacio.md}; }
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {cargando && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(246, 248, 248, 0.88)', backdropFilter: 'blur(2px)', zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', border: `3px solid ${color.linea}`, borderTop: `3px solid ${color.vidrio}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: espacio.md, fontWeight: peso.fuerte, letterSpacing: interletra.etiqueta, textTransform: 'uppercase', fontSize: texto.menor, color: color.textoSuave }}>Sincronizando datos…</p>
          </div>
      )}

      {toast.visible && (
          <div style={{ position: 'fixed', bottom: espacio.lg, right: espacio.lg, maxWidth: 'calc(100vw - 48px)', backgroundColor: toast.tipo === 'error' ? color.error : color.petroleo, color: color.textoSobreOscuro, padding: `${espacio.sm} ${espacio.lg}`, borderRadius: radio.medio, display: 'flex', alignItems: 'center', gap: espacio.xs, boxShadow: sombra.elevada, zIndex: 9999 }}>
              {toast.tipo === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
              <span style={{ fontSize: texto.base, fontWeight: peso.medio, lineHeight: 1.4 }}>{toast.mensaje}</span>
          </div>
      )}

      <Modal
          abierto={modalConfirm.visible}
          titulo={modalConfirm.titulo}
          descripcion={modalConfirm.mensaje}
          onCerrar={cerrarModal}
          ancho="estrecho"
          acciones={<>
              <Boton variante="fantasma" onClick={cerrarModal}>Cancelar</Boton>
              <Boton onClick={() => { modalConfirm.onConfirm(); cerrarModal(); }}>Confirmar</Boton>
          </>}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: color.petroleo, color: color.textoSobreOscuro, padding: '6px 12px', borderRadius: '4px' }}>ERP</div><span>Oficina</span>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button className="hide-on-mobile" onClick={cambiarVista} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', backgroundColor: color.superficieHundida, color: color.texto, border: `1px solid ${color.linea}`, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}><ArrowLeftRight size={14} /> Vista Operario</button>
              <button className="mobile-toggle" onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}>{menuMovilAbierto ? <X size={26} /> : <Menu size={26} />}</button>
          </div>
      </div>

      <div className="desktop-menu" style={{ borderBottom: `1px solid ${color.linea}`, paddingBottom: '10px', marginBottom: '25px' }}>
          <button onClick={() => navegar('planificacion', 'cuadrante')} style={catActivaStyle(categoriaActiva === 'planificacion')}><CalendarRange size={16} /> Planificación</button>
          <button onClick={() => navegar('validacion', 'bandeja')} style={catActivaStyle(categoriaActiva === 'validacion')}><Inbox size={16} /> Validación</button>
          <button onClick={() => navegar('proyectos', 'obras')} style={catActivaStyle(categoriaActiva === 'proyectos')}><Building2 size={16} /> Proyectos</button>
          <button onClick={() => navegar('documentos', 'partes')} style={catActivaStyle(categoriaActiva === 'documentos')}><FolderOpen size={16} /> Docs y Facturas</button>
          <button onClick={() => navegar('presupuestos', 'presupuestos')} style={catActivaStyle(categoriaActiva === 'presupuestos')}><Calculator size={16} /> Presupuestos</button>
          <button onClick={() => navegar('personal', 'trabajadores')} style={catActivaStyle(categoriaActiva === 'personal')}><Users size={16} /> Personal</button>
          <button onClick={() => navegar('almacen', 'almacen')} style={catActivaStyle(categoriaActiva === 'almacen')}><Package size={16} /> Almacén</button>
          <button onClick={() => navegar('sistema', 'papelera')} style={catActivaStyle(categoriaActiva === 'sistema')}><Settings size={16} /> Sistema</button>
      </div>

      <div className={`mobile-dropdown ${menuMovilAbierto ? 'open' : ''}`}>
          <button onClick={() => navegar('planificacion', 'cuadrante')} style={catActivaStyle(categoriaActiva === 'planificacion')}><CalendarRange size={16} /> Planificación</button>
          <button onClick={() => navegar('validacion', 'bandeja')} style={catActivaStyle(categoriaActiva === 'validacion')}><Inbox size={16} /> Validación</button>
          <button onClick={() => navegar('proyectos', 'obras')} style={catActivaStyle(categoriaActiva === 'proyectos')}><Building2 size={16} /> Proyectos</button>
          <button onClick={() => navegar('documentos', 'partes')} style={catActivaStyle(categoriaActiva === 'documentos')}><FolderOpen size={16} /> Docs y Facturación</button>
          <button onClick={() => navegar('presupuestos', 'presupuestos')} style={catActivaStyle(categoriaActiva === 'presupuestos')}><Calculator size={16} /> Presupuestos</button>
          <button onClick={() => navegar('personal', 'trabajadores')} style={catActivaStyle(categoriaActiva === 'personal')}><Users size={16} /> Personal</button>
          <button onClick={() => navegar('almacen', 'almacen')} style={catActivaStyle(categoriaActiva === 'almacen')}><Package size={16} /> Almacén</button>
          <button onClick={() => navegar('sistema', 'papelera')} style={catActivaStyle(categoriaActiva === 'sistema')}><Settings size={16} /> Sistema</button>
          <div style={{ borderTop: `1px solid ${color.linea}`, margin: '10px 0' }}></div>
          <button onClick={cambiarVista} style={{...catActivaStyle(false), color: color.vidrio}}><ArrowLeftRight size={16} /> Cambiar a Vista Operario</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', paddingLeft: '10px', flexWrap: 'wrap' }}>
          {categoriaActiva === 'planificacion' && ( <><button onClick={()=>setPestañaActiva('cuadrante')} style={subMenuBtnStyle(pestañaActiva === 'cuadrante')}>Cuadrante</button><button onClick={()=>setPestañaActiva('cuadrillas')} style={subMenuBtnStyle(pestañaActiva === 'cuadrillas')}>Cuadrillas</button><button onClick={()=>setPestañaActiva('vehiculos')} style={subMenuBtnStyle(pestañaActiva === 'vehiculos')}>Vehículos</button></> )}
          {categoriaActiva === 'almacen' && ( <><button onClick={()=>setPestañaActiva('almacen')} style={subMenuBtnStyle(pestañaActiva === 'almacen')}>Inventario</button><button onClick={()=>setPestañaActiva('acopios')} style={subMenuBtnStyle(pestañaActiva === 'acopios')}>Acopios por Obra</button></> )}
          {categoriaActiva === 'proyectos' && ( <><button onClick={()=>setPestañaActiva('obras')} style={subMenuBtnStyle(pestañaActiva === 'obras')}>Gestión de Hoteles / Obras</button><button onClick={()=>setPestañaActiva('resumen')} style={subMenuBtnStyle(pestañaActiva === 'resumen')}>Métricas y Dashboard</button></> )}
          {categoriaActiva === 'documentos' && ( <><button onClick={()=>setPestañaActiva('partes')} style={subMenuBtnStyle(pestañaActiva === 'partes')}>Albaranes Históricos</button><button onClick={()=>setPestañaActiva('certificaciones')} style={subMenuBtnStyle(pestañaActiva === 'certificaciones')}>Certificaciones Mensuales</button><button onClick={()=>setPestañaActiva('facturacion')} style={subMenuBtnStyle(pestañaActiva === 'facturacion')}>Generar Factura</button></> )}
          {categoriaActiva === 'personal' && ( <><button onClick={()=>setPestañaActiva('trabajadores')} style={subMenuBtnStyle(pestañaActiva === 'trabajadores')}>Plantilla Activa</button><button onClick={()=>setPestañaActiva('horas')} style={subMenuBtnStyle(pestañaActiva === 'horas')}>Control de Nóminas</button></> )}
          {categoriaActiva === 'sistema' && ( <><button onClick={()=>setPestañaActiva('papelera')} style={subMenuBtnStyle(pestañaActiva === 'papelera')}>Papelera de Reciclaje</button></> )}
      </div>

      {pestañaActiva === 'acopios' && ( <AcopiosObra blockStyle={blockStyle} obrasActivas={obrasActivas} materialesList={materialesList} obraAcopios={obraAcopios} setObraAcopios={setObraAcopios} acopiosDeLaObra={acopiosDeLaObra} crearAcopio={crearAcopio} moverEstadoAcopio={moverEstadoAcopio} borrarAcopio={borrarAcopio} guardandoAcopio={guardandoAcopio} /> )}
      {pestañaActiva === 'cuadrante' && ( <CuadranteDiario blockStyle={blockStyle} fecha={cuadranteFecha} setFecha={setCuadranteFecha} asignaciones={asignaciones} cuadrillasList={cuadrillasList} vehiculosList={vehiculosList} obrasActivas={obrasActivas} crearAsignacion={crearAsignacion} borrarAsignacion={borrarAsignacion} guardando={guardandoAsignacion} acopiosDelDia={acopiosDelDia} /> )}
      {pestañaActiva === 'cuadrillas' && ( <GestionCuadrillas blockStyle={blockStyle} cuadrillasList={cuadrillasList} trabajadoresActivos={trabajadoresActivos} crearCuadrilla={crearCuadrilla} actualizarOperariosCuadrilla={actualizarOperariosCuadrilla} borrarCuadrilla={borrarCuadrilla} /> )}
      {pestañaActiva === 'vehiculos' && ( <GestionVehiculos blockStyle={blockStyle} vehiculosList={vehiculosList} crearVehiculo={crearVehiculo} guardarVehiculo={guardarVehiculo} borrarVehiculo={borrarVehiculo} /> )}
      {pestañaActiva === 'bandeja' && ( <BandejaValidacion partesPendientes={partesPendientes} parteAValidar={parteAValidar} setParteAValidar={setParteAValidar} nuevoOperario={nuevoOperario} setNuevoOperario={setNuevoOperario} trabajadoresList={trabajadoresActivos} agregarOperarioCuadrilla={agregarOperarioCuadrilla} cuadrilla={cuadrilla} cambiarHorasExtra={cambiarHorasExtra} setHorasExtraDirecto={setHorasExtraDirecto} validandoParte={validandoParte} quitarOperario={quitarDeLaCuadrilla} confirmarValidacionParte={confirmarValidacionParte} borrarParte={borrarParte} abrirValidacion={abrirValidacion} btnBlackStyle={btnBlackStyle} unidadesPropuestas={unidadesPropuestas} unidadesAConfirmar={unidadesAConfirmar} alternarUnidad={alternarUnidad} alternarTodasLasUnidades={alternarTodasLasUnidades} /> )}
      {pestañaActiva === 'resumen' && ( <ResumenMetricas partesDeHoy={partesDeHoy} totalHorasHoy={totalHorasHoy} trabajadoresHoy={trabajadoresHoy} porcentajeGlobal={porcentajeGlobal} /> )}
      {pestañaActiva === 'obras' && ( <GestionProyectos blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} nuevaObra={nuevaObra} setNuevaObra={setNuevaObra} numPlantas={numPlantas} setNumPlantas={setNumPlantas} configHabitaciones={configHabitaciones} setConfigHabitaciones={setConfigHabitaciones} generarHotelInteligente={generarHotelInteligente} obrasList={obrasActivas} obraActiva={obraActiva} setObraActiva={setObraActiva} borrarObra={borrarObra} obtenerEstadisticasHotel={obtenerEstadisticasHotel} marcarTareaHotel={marcarTareaHotel} /> )}
      {pestañaActiva === 'trabajadores' && ( <PlantillaPersonal cambiarRolTrabajador={cambiarRolTrabajador} cambiandoRolId={cambiandoRolId} blockStyle={blockStyle} labelStyle={labelStyle} inputStyle={inputStyle} btnBlackStyle={btnBlackStyle} nuevoTrabajadorNombre={nuevoTrabajadorNombre} setNuevoTrabajadorNombre={setNuevoTrabajadorNombre} nuevoTrabajadorEmail={nuevoTrabajadorEmail} setNuevoTrabajadorEmail={setNuevoTrabajadorEmail} nuevoTrabajadorPass={nuevoTrabajadorPass} setNuevoTrabajadorPass={setNuevoTrabajadorPass} registrarTrabajador={registrarTrabajador} trabajadoresList={trabajadoresActivos} editandoTrabId={editandoTrabId} trabEditado={trabEditado} setTrabEditado={setTrabEditado} guardarEdicionTrabajador={guardarEdicionTrabajador} enviarResetPass={enviarResetPass} setEditandoTrabId={setEditandoTrabId} iniciarEdicionTrabajador={iniciarEdicionTrabajador} borrarTrabajador={borrarTrabajador} /> )}
{pestañaActiva === 'horas' && ( <ControlNominas trabajadoresList={trabajadoresActivos} trabajadoresTodos={trabajadoresList} blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} labelStyle={labelStyle} inputStyle={inputStyle} pagoHoraNormal={pagoHoraNormal} setPagoHoraNormal={setPagoHoraNormal} pagoHoraExtra={pagoHoraExtra} setPagoHoraExtra={setPagoHoraExtra} pedirConfirmacion={pedirConfirmacion} mostrarToast={mostrarToast} /> )}      {pestañaActiva === 'almacen' && ( <InventarioAlmacen blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} inputStyle={inputStyle} exportarAlmacenExcel={exportarAlmacenExcel} nuevoMatNombre={nuevoMatNombre} setNuevoMatNombre={setNuevoMatNombre} materialesList={materialesList} nuevoMatStock={nuevoMatStock} setNuevoMatStock={setNuevoMatStock} agregarMaterial={agregarMaterial} filtroMateriales={filtroMateriales} setFiltroMateriales={setFiltroMateriales} ordenMateriales={ordenMateriales} setOrdenMateriales={setOrdenMateriales} materialesCoincidentes={materialesCoincidentes} editandoMatId={editandoMatId} matEditado={matEditado} setMatEditado={setMatEditado} guardarEdicionMat={guardarEdicionMat} setEditandoMatId={setEditandoMatId} iniciarEdicionMat={iniciarEdicionMat} borrarMaterial={borrarMaterial} /> )}
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
      {pestañaActiva === 'presupuestos' && ( <PresupuestosOfertas inventario={materialesList} blockStyle={blockStyle} btnBlackStyle={btnBlackStyle} labelStyle={labelStyle} inputStyle={inputStyle} /> )}
      {pestañaActiva === 'papelera' && ( <PapeleraReciclaje blockStyle={blockStyle} partesPapelera={partesPapelera} certificacionesPapelera={certificacionesPapelera} trabajadoresPapelera={trabajadoresPapelera} obrasPapelera={obrasPapelera} restaurarElemento={restaurarElemento} destruirElementoFisico={destruirElementoFisico} /> )}

    </div>
  );
}