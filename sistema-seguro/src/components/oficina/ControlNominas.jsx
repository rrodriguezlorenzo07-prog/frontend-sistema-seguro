// @ts-check
import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Euro, User, CalendarOff, RotateCcw, PencilLine, Lock, Archive, AlertTriangle } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { DIAS_TRABAJABLES_MES, diasPagadosDelPeriodo, importeBaseDelPeriodo, tieneCategoria, plantillaDelPeriodo, claveDeTrabajador } from '../../utils/nomina';
import { agregarHorasExtraDelPeriodo } from '../../utils/horasPeriodo';
import { contarPorTrabajador } from '../../logica/ausencias';
import { categoriaDe } from '../../logica/categorias';
import {
    esPeriodoValido, idDePeriodo, limitesDelMes, esPeriodoPasado,
    nombreDelPeriodo, idDeCierre, siguienteVersion, cierreVigente,
    primerDiaISO, ultimoDiaISO
} from '../../utils/periodos';
import { construirCSV, descargarCSV, textoCSV, numeroCSV, enteroCSV } from '../../utils/csv';
import { color, espacio } from '../../estilos/tokens';
import Insignia from '../../ui/Insignia';

// El estado de ajustes se indexa por id de trabajador, no por nombre: dos homónimos
// compartían ajustes y renombrar a uno le borraba los suyos en mitad de la liquidación.
const claveDe = claveDeTrabajador;

/** Un id de documento no puede llevar barras. Solo afecta a fichas sin id. */
const idDeLinea = (clave) => String(clave).replace(/\//g, '_');

// DOS JUEGOS DE CABECERAS, uno por esquema, y NUNCA el mismo para los dos.
//
// Exportar un cierre viejo con las cabeceras nuevas daría un Excel con las columnas
// mal etiquetadas y los números correctos, que es la peor combinación posible: nadie
// lo nota. Se elige según el esquema de LO QUE SE EXPORTA, no según el modelo de hoy.
const CABECERAS_ESQUEMA_1 = ['Trabajador', 'Base Mensual (h)', 'Origen de la Base', 'Días de Ausencia',
    'Horas Normales', 'H. Normales Calculadas', 'Ajuste Manual Normales',
    'Horas Extras', 'H. Extras de Albaranes', 'Ajuste Manual Extras',
    'Tarifa Normal (€)', 'Tarifa Extra (€)', 'Total Pagar (€)'];

const CABECERAS_ESQUEMA_2 = ['Trabajador', 'Categoría', 'Tarifa Diaria (€)',
    'Días Trabajables', 'Días de Ausencia', 'Días Pagados', 'Importe Base (€)',
    'Horas Extras', 'H. Extras de Albaranes', 'Ajuste Manual Extras',
    'Tarifa Hora Extra (€)', 'Importe Horas Extra (€)', 'Total Pagar (€)'];

/** Un cierre sin el campo es de antes de que existiera: esquema 1. */
const esquemaDe = (cierre) => Number(cierre?.esquema) === 2 ? 2 : 1;

export default function ControlNominas({ blockStyle, btnBlackStyle, labelStyle, inputStyle, categoriasList, trabajadoresList, trabajadoresTodos, pedirConfirmacion, mostrarToast }) {

  // Un periodo es un mes natural. El selector es de mes, no de rango: las reglas de
  // Firestore rechazan cualquier otra cosa, así que dejar elegir un rango libre solo
  // serviría para que el cierre fallara de forma incomprensible.
  const [periodo, setPeriodo] = useState(() => idDePeriodo());

  // Los días de ausencia YA NO SE TECLEAN: se cuentan desde la colección `ausencias`.
  // Antes eran un número escrito de memoria al cerrar el mes y que se perdía al cambiar
  // de mes; con la tarifa diaria cada uno vale una jornada entera, así que el dato
  // viene ahora de un registro con autor y fecha.
  const [horasExtraManuales, setHorasExtraManuales] = useState({});
  const [tarifasOperarios, setTarifasOperarios] = useState({});

  // Ausencias del periodo, selladas con su mes como todo lo demás de esta pantalla.
  const [ausencias, setAusencias] = useState({ periodo: null, lista: [], error: false, sinPermiso: false });

  // Ambos estados llevan sellado el periodo al que pertenecen, y solo se escriben
  // dentro de un then/catch. Así el "cargando" es un valor derivado en vez de un
  // setState síncrono dentro del efecto, y una respuesta que llegue tarde tras
  // cambiar de mes no puede pintar los datos del mes anterior.
  const [agregado, setAgregado] = useState({ periodo: null, resumen: [], albaranes: 0, error: false, sinPermiso: false });
  const [cierre, setCierre] = useState({ periodo: null, lista: [], vigente: null, lineas: [], error: false, sinPermiso: false });
  const [cerrando, setCerrando] = useState(false);

  /**
   * ¿El fallo es que le han retirado el permiso, o es otra cosa?
   *
   * Importa distinguirlo: «no se pudo leer» invita a reintentar, y aquí reintentar no
   * va a servir de nada. El claim del token puede seguir diciendo que sí durante un
   * rato —un claim no se puede desactivar a media vida— mientras la regla ya lee
   * roles/{uid} en vivo y deniega. La pantalla tiene que contar eso, no un error
   * genérico que haga pensar en un fallo de red.
   */
  const esPermisoDenegado = (error) => error?.code === 'permission-denied';

  const alDia = agregado.periodo === periodo;
  const horasTrabajadores = alDia ? agregado.resumen : [];
  const cobertura = {
      cargando: esPeriodoValido(periodo) && !alDia,
      albaranes: alDia ? agregado.albaranes : 0,
      error: !esPeriodoValido(periodo) || (alDia && agregado.error)
  };

  const cierreAlDia = cierre.periodo === periodo;
  const cierreCargando = esPeriodoValido(periodo) && !cierreAlDia;
  const listaCierres = cierreAlDia ? cierre.lista : [];
  const vigente = cierreAlDia ? cierre.vigente : null;
  const lineasCierre = cierreAlDia ? cierre.lineas : [];
  const estaCerrado = !!vigente;

  // ---- LECTURAS. Ninguna de estas rutas escribe nada. ----------------------

  /** Horas extra del periodo COMPLETO, recorrido con cursores. Nunca de la página cargada. */
  useEffect(() => {
      if (!esPeriodoValido(periodo)) return undefined;
      let cancelado = false;
      const { inicio, fin } = limitesDelMes(periodo);
      agregarHorasExtraDelPeriodo(db, inicio, fin)
          .then((r) => {
              if (!cancelado) setAgregado({ periodo, resumen: r.resumen, albaranes: r.albaranesComputados, error: false, sinPermiso: false });
          })
          .catch((error) => {
              console.error('No se pudieron agregar las horas extra del periodo', error);
              if (!cancelado) setAgregado({ periodo, resumen: [], albaranes: 0, error: true, sinPermiso: esPermisoDenegado(error) });
          });
      return () => { cancelado = true; };
  }, [periodo]);

  /**
   * Las ausencias del periodo, para descontarlas de los días pagados.
   *
   * Se filtra por rango de `fecha` (una cadena AAAA-MM-DD, que ordena igual que la
   * fecha). Es una desigualdad sobre un único campo, así que no necesita índice
   * compuesto: el de trabajadorId + fecha existe para la ficha, no para esto.
   */
  useEffect(() => {
      if (!esPeriodoValido(periodo)) return undefined;
      let cancelado = false;
      const desde = primerDiaISO(periodo);
      const hasta = ultimoDiaISO(periodo);
      getDocs(query(collection(db, 'ausencias'), where('fecha', '>=', desde), where('fecha', '<=', hasta)))
          .then((snap) => {
              if (cancelado) return;
              setAusencias({ periodo, lista: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: false, sinPermiso: false });
          })
          .catch((error) => {
              console.error('No se pudieron leer las ausencias del periodo', error);
              if (!cancelado) setAusencias({ periodo, lista: [], error: true, sinPermiso: esPermisoDenegado(error) });
          });
      return () => { cancelado = true; };
  }, [periodo]);

  /**
   * ¿Está ya cerrado este mes? El vigente es el de versión más alta.
   * Devuelve el estado en vez de fijarlo, para que el setState quede siempre dentro
   * de un then y nunca en el cuerpo síncrono del efecto.
   */
  const leerCierres = useCallback(async (mes) => {
      const snap = await getDocs(query(collection(db, 'nominas'), where('periodo', '==', mes)));
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const cabecera = cierreVigente(lista);
      const lineas = cabecera
          ? (await getDocs(collection(db, 'nominas', cabecera.id, 'lineas'))).docs.map((d) => ({ id: d.id, ...d.data() }))
          : [];
      return { periodo: mes, lista, vigente: cabecera, lineas, error: false, sinPermiso: false };
  }, []);

  useEffect(() => {
      if (!esPeriodoValido(periodo)) return undefined;
      let cancelado = false;
      leerCierres(periodo)
          .then((estado) => { if (!cancelado) setCierre(estado); })
          .catch((error) => {
              console.error('No se pudieron leer los cierres del periodo', error);
              if (!cancelado) setCierre({ periodo, lista: [], vigente: null, lineas: [], error: true, sinPermiso: esPermisoDenegado(error) });
          });
      return () => { cancelado = true; };
  }, [periodo, leerCierres]);

  /** Al cambiar de mes, los ajustes del anterior no se arrastran. */
  const cambiarPeriodo = (nuevo) => {
      setPeriodo(nuevo);
      setHorasExtraManuales({});
      setTarifasOperarios({});
  };

  // ---- AJUSTES ------------------------------------------------------------

  const restaurarExtras = (clave) => {
      setHorasExtraManuales(prev => { const nuev = {...prev}; delete nuev[clave]; return nuev; });
  };

  /**
   * Ajuste manual de la tarifa de hora extra, para el caso excepcional.
   *
   * LA CADENA DE PRIORIDAD NO CAMBIA, solo el valor que hay al final: antes el
   * defecto era una tarifa global tecleada en la pantalla, ahora es la de la
   * categoria del trabajador. Lo que la oficina escriba aquí sigue mandando sobre
   * las dos.
   */
  const handleTarifaExtra = (clave, valor) => {
      const num = parseFloat(valor) || 0;
      setTarifasOperarios(prev => ({ ...prev, [clave]: { extra: num } }));
  };

  const restaurarTarifaExtra = (clave) => {
      setTarifasOperarios(prev => { const nuev = { ...prev }; delete nuev[clave]; return nuev; });
  };

  // ---- QUIÉN ENTRA EN LA NÓMINA -------------------------------------------

  const listaBase = plantillaDelPeriodo(trabajadoresList, trabajadoresTodos, horasTrabajadores);

  // Ausencias del periodo, contadas por persona desde la colección. Ya no se teclean.
  const ausenciasAlDia = ausencias.periodo === periodo;
  const ausenciasPorTrabajador = ausenciasAlDia
      ? contarPorTrabajador(ausencias.lista, primerDiaISO(periodo), ultimoDiaISO(periodo))
      : {};

  const datosCalculados = listaBase.map(trab => {
      const nombre = trab.nombre;
      const clave = claveDe(trab);

      // De los partes SOLO se toman las horas extra. La base jamás se deriva de un albarán.
      // Cruce por trabajadorId cuando la cuadrilla lo tiene; si no, por nombre.
      const datosPartes = horasTrabajadores.find(h =>
          (trab.id && h[1].trabajadorId) ? h[1].trabajadorId === trab.id : h[0] === nombre
      );
      const origE = datosPartes ? datosPartes[1].horasExtra : 0;

      // LA BASE, POR DÍAS. Sin categoría no hay tarifa diaria y no se inventa ninguna:
      // el cierre se bloquea más abajo y se dice a quién le falta. Pagar 0 € porque
      // falta rellenar un campo sería un error caro que nadie notaría.
      const categoria = categoriaDe(trab, categoriasList);
      const conCategoria = tieneCategoria(trab) && !!categoria;

      const diasTrabajables = DIAS_TRABAJABLES_MES;
      const diasAusencia = ausenciasPorTrabajador[trab.id] || 0;
      const diasPagados = diasPagadosDelPeriodo(diasTrabajables, diasAusencia);
      const tarifaDiaria = categoria?.tarifaDiaria ?? 0;
      const importeBase = importeBaseDelPeriodo(diasPagados, tarifaDiaria);

      // Las horas extra siguen siendo horas, y siguen saliendo de los albaranes.
      const hExtra = horasExtraManuales[clave] !== undefined ? horasExtraManuales[clave] : origE;
      const extraManual = horasExtraManuales[clave] !== undefined && horasExtraManuales[clave] !== origE;

      // Misma cadena de prioridad de siempre; lo único que cambia es el último eslabón.
      const tarifaCategoria = categoria?.tarifaHoraExtra ?? 0;
      const tarifaE = tarifasOperarios[clave]?.extra ?? tarifaCategoria;
      const tarifaExtraManual = tarifasOperarios[clave]?.extra !== undefined && tarifasOperarios[clave].extra !== tarifaCategoria;

      const importeExtra = hExtra * tarifaE;
      const totalPagar = importeBase + importeExtra;

      return { clave, trabajadorId: trab.id || null, nombre, email: trab.email || '',
               enPapelera: !!trab.enPapelera,
               categoriaId: trab.categoriaId ?? null,
               categoriaNombre: categoria?.nombre ?? trab.categoriaNombre ?? '',
               conCategoria, tarifaDiaria,
               diasTrabajables, diasAusencia, diasPagados, importeBase,
               origE, hExtra, extraManual, tarifaE, tarifaCategoria, tarifaExtraManual, importeExtra,
               totalPagar };
  }).sort((a, b) => b.totalPagar - a.totalPagar);

  const totalGeneralNomina = datosCalculados.reduce((acc, item) => acc + item.totalPagar, 0);
  const totalAjustesManuales = datosCalculados.filter(item => item.extraManual || item.tarifaExtraManual).length;
  const sinCategoria = datosCalculados.filter(item => !item.conCategoria);
  const totalEnPapelera = datosCalculados.filter(item => item.enPapelera).length;

  // ---- CIERRE. La ÚNICA escritura de esta pantalla. -----------------------

  const cerrarPeriodo = () => {
      if (!esPeriodoValido(periodo) || cerrando) return;
      if (datosCalculados.length === 0) { mostrarToast('No hay trabajadores que liquidar en este periodo.', 'error'); return; }
      if (cobertura.cargando || cobertura.error) {
          mostrarToast('Espera a que terminen de calcularse las horas extra del periodo antes de cerrar.', 'error');
          return;
      }
      if (!ausenciasAlDia || ausencias.error) {
          mostrarToast('Espera a que terminen de leerse las ausencias del periodo antes de cerrar.', 'error');
          return;
      }
      // SIN CATEGORÍA NO SE CIERRA. Se dice exactamente a quién le falta, en vez de
      // liquidarle a 0 € y que el error aparezca en una nómina.
      if (sinCategoria.length > 0) {
          mostrarToast(
              `No se puede cerrar: ${sinCategoria.length} trabajador(es) sin categoría asignada (${sinCategoria.map((i) => i.nombre).join(', ')}). Asígnasela en Plantilla.`,
              'error'
          );
          return;
      }

      const version = siguienteVersion(listaCierres);
      const anterior = vigente;
      const pasado = esPeriodoPasado(periodo);

      const lineasResumen = [
          `Periodo: ${nombreDelPeriodo(periodo)}`,
          `Trabajadores: ${datosCalculados.length}${totalEnPapelera > 0 ? ` (${totalEnPapelera} de baja con actividad)` : ''}`,
          `Total a liquidar: ${totalGeneralNomina.toFixed(2)} €`,
          `Ajustes manuales: ${totalAjustesManuales}`,
          `Calculado sobre ${cobertura.albaranes} albarán(es) aprobado(s).`,
          version > 1
              ? `Será la versión ${version}. La ${anterior.version} NO se borra: queda como histórico.`
              : 'Será el primer cierre de este mes.',
          pasado
              ? 'AVISO: es un mes ya pasado. Se usan las fichas, las bases mensuales y las tarifas de HOY, no las que hubiera entonces.'
              : ''
      ].filter(Boolean);

      pedirConfirmacion(
          version > 1 ? `Cerrar de nuevo ${nombreDelPeriodo(periodo)}` : `Cerrar ${nombreDelPeriodo(periodo)}`,
          `${lineasResumen.join(' · ')} — Un cierre no se puede modificar ni borrar. ¿Continuar?`,
          async () => {
              setCerrando(true);
              const cierreId = idDeCierre(periodo, version);
              const { inicio, fin } = limitesDelMes(periodo);
              try {
                  // Cabecera y líneas en un solo lote: o entra la liquidación entera o
                  // no entra nada. El límite del lote son 500 escrituras.
                  const lote = writeBatch(db);
                  lote.set(doc(db, 'nominas', cierreId), {
                      periodo, version,
                      rangoInicio: inicio, rangoFin: fin,
                      estado: 'cerrado',
                      cerradoPor: auth.currentUser?.uid || '',
                      cerradoPorEmail: auth.currentUser?.email || '',
                      cerradoEn: serverTimestamp(),
                      // Ya no hay tarifas globales: cada uno cobra por su categoría.
                      diasTrabajables: DIAS_TRABAJABLES_MES,
                      totales: {
                          trabajadores: datosCalculados.length,
                          diasPagados: datosCalculados.reduce((s, i) => s + i.diasPagados, 0),
                          diasAusencia: datosCalculados.reduce((s, i) => s + i.diasAusencia, 0),
                          horasExtra: datosCalculados.reduce((s, i) => s + i.hExtra, 0),
                          importeBase: datosCalculados.reduce((s, i) => s + i.importeBase, 0),
                          importe: totalGeneralNomina
                      },
                      cobertura: { albaranesComputados: cobertura.albaranes },
                      cerradoRetroactivamente: pasado,
                      sustituyeA: anterior ? anterior.id : null,
                      esquema: 2
                  });

                  datosCalculados.forEach((item) => {
                      const id = idDeLinea(item.trabajadorId || item.clave);
                      lote.set(doc(db, 'nominas', cierreId, 'lineas', id), {
                          trabajadorId: id,
                          nombre: item.nombre,          // el nombre de HOY: registro histórico
                          email: item.email,
                          // La categoría y su tarifa se CONGELAN aquí. Si el convenio sube
                          // el año que viene, esta liquidación sigue diciendo lo que se pagó.
                          categoriaId: item.categoriaId,
                          categoriaNombre: item.categoriaNombre,
                          tarifaDiaria: item.tarifaDiaria,
                          diasTrabajables: item.diasTrabajables,
                          diasAusencia: item.diasAusencia,
                          diasPagados: item.diasPagados,
                          importeBase: item.importeBase,
                          horasExtraDeAlbaranes: item.origE,
                          horasExtra: item.hExtra,
                          ajusteManualExtras: item.extraManual,
                          tarifaExtra: item.tarifaE,
                          tarifaPersonalizada: item.tarifaExtraManual,
                          importeExtra: item.importeExtra,
                          total: item.totalPagar,
                          enPapelera: item.enPapelera
                      });
                  });

                  await lote.commit();
                  setCierre(await leerCierres(periodo));
                  mostrarToast(`${nombreDelPeriodo(periodo)} cerrado (versión ${version}).`);
              } catch (error) {
                  // Las reglas son de solo-creación: si otro admin cerró mientras
                  // calculábamos, nuestro id ya existe y el lote entero se rechaza.
                  // "Permiso denegado" no explicaría nada de lo que pasó.
                  console.error('No se pudo cerrar el periodo', error);
                  let ocupado = false;
                  let lecturaDenegada = false;
                  try {
                      const snap = await getDocs(query(collection(db, 'nominas'), where('periodo', '==', periodo)));
                      ocupado = snap.docs.some((d) => d.id === cierreId);
                  } catch (fallo) {
                      // Si tampoco se puede LEER, el motivo no es que el id esté ocupado:
                      // es que ya no hay permiso. Distinguirlo evita echarle la culpa a un
                      // compañero que no ha hecho nada.
                      lecturaDenegada = esPermisoDenegado(fallo);
                  }

                  mostrarToast(
                      lecturaDenegada || esPermisoDenegado(error)
                          ? 'Te han retirado el permiso para ver nóminas. La liquidación NO se ha cerrado. Cierra sesión y vuelve a entrar.'
                          : ocupado
                              ? 'Otro admin cerró este periodo mientras tanto, recarga y revisa.'
                              : `No se pudo cerrar la nómina: ${error?.message || 'error desconocido'}`,
                      'error'
                  );
                  await leerCierres(periodo).then(setCierre).catch((fallo) => {
                      // Deja constancia en el estado para que el render corte con el
                      // aviso de permiso en vez de volver a pintar la tabla.
                      setCierre({ periodo, lista: [], vigente: null, lineas: [], error: true, sinPermiso: esPermisoDenegado(fallo) });
                  });
              } finally {
                  setCerrando(false);
              }
          }
      );
  };

  // ---- EXPORTACIÓN --------------------------------------------------------

  // Si el periodo está cerrado, el CSV sale del snapshot congelado, no de un cálculo
  // nuevo: un recálculo hoy podría dar otro número y el papel dejaría de coincidir
  // con la liquidación que se pagó.
  const exportarExcelPersonalizado = () => {
      // El esquema de LO QUE SE EXPORTA manda: un cierre viejo sale con sus columnas de
      // horas, uno nuevo con las de días. Nunca se mezclan.
      const esquema = estaCerrado ? esquemaDe(vigente) : 2;
      const cabeceras = esquema === 1 ? CABECERAS_ESQUEMA_1 : CABECERAS_ESQUEMA_2;

      const filas = estaCerrado
          ? (esquema === 1
              ? lineasCierre.map((l) => ([
                  textoCSV(l.nombre), numeroCSV(l.baseMensual, 0),
                  textoCSV(l.origenBase === 'ficha' ? 'Ficha del trabajador' : 'Por defecto (sin configurar)'),
                  enteroCSV(l.diasAusencia), numeroCSV(l.horasNormales), numeroCSV(l.horasNormalesCalculadas),
                  textoCSV(l.ajusteManualNormales ? 'SÍ' : ''), numeroCSV(l.horasExtra),
                  numeroCSV(l.horasExtraDeAlbaranes), textoCSV(l.ajusteManualExtras ? 'SÍ' : ''),
                  numeroCSV(l.tarifaNormal), numeroCSV(l.tarifaExtra), numeroCSV(l.total)
              ]))
              : lineasCierre.map((l) => ([
                  textoCSV(l.nombre), textoCSV(l.categoriaNombre), numeroCSV(l.tarifaDiaria),
                  enteroCSV(l.diasTrabajables), enteroCSV(l.diasAusencia), enteroCSV(l.diasPagados),
                  numeroCSV(l.importeBase), numeroCSV(l.horasExtra),
                  numeroCSV(l.horasExtraDeAlbaranes), textoCSV(l.ajusteManualExtras ? 'SÍ' : ''),
                  numeroCSV(l.tarifaExtra), numeroCSV(l.importeExtra), numeroCSV(l.total)
              ]))
          )
          : datosCalculados.map((item) => ([
              textoCSV(item.nombre), textoCSV(item.categoriaNombre), numeroCSV(item.tarifaDiaria),
              enteroCSV(item.diasTrabajables), enteroCSV(item.diasAusencia), enteroCSV(item.diasPagados),
              numeroCSV(item.importeBase), numeroCSV(item.hExtra),
              numeroCSV(item.origE), textoCSV(item.extraManual ? 'SÍ' : ''),
              numeroCSV(item.tarifaE), numeroCSV(item.importeExtra), numeroCSV(item.totalPagar)
          ]));

      if (filas.length === 0) { mostrarToast('No hay datos para exportar.', 'error'); return; }

      const total = estaCerrado ? vigente.totales.importe : totalGeneralNomina;
      const ajustes = estaCerrado
          ? lineasCierre.filter((l) => l.ajusteManualNormales || l.ajusteManualExtras).length   // el esquema 1 tenía los dos
          : totalAjustesManuales;

      filas.push([textoCSV('TOTAL GLOBAL A PAGAR'), ...Array(11).fill(textoCSV('')), numeroCSV(total)]);
      filas.push([textoCSV('Ajustes manuales en esta liquidación'), enteroCSV(ajustes)]);
      if (estaCerrado) {
          filas.push([textoCSV('Cierre'), textoCSV(`${vigente.id} · cerrado por ${vigente.cerradoPorEmail || '—'}`)]);
      }
      descargarCSV(`Nomina_${periodo}${estaCerrado ? `_v${vigente.version}` : '_provisional'}.csv`,
                   construirCSV(cabeceras, filas));
  };

  // ---- ESTILOS ------------------------------------------------------------

  const btnRestaurarStyle = {
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      color: color.aviso, display: 'inline-flex', alignItems: 'center'
  };

  // ---- PERMISO RETIRADO EN CALIENTE ---------------------------------------
  //
  // Se puede llegar aquí con la pestaña ya abierta y el permiso recién retirado. La
  // pestaña sigue a la vista porque se pinta con el claim del token, y un claim no se
  // puede desactivar a media vida; pero la regla lee roles/{uid} en vivo y ya deniega.
  //
  // Sin esto, la pantalla enseñaría la tabla entera con ceros y un aviso de «no se
  // pudieron leer las horas extra»: parecería que nadie hizo horas extra ese mes, que es
  // peor que un error. Se corta antes de pintar nada calculable.
  if (agregado.sinPermiso || cierre.sinPermiso) {
      return (
          <div style={blockStyle}>
              <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Cálculo de Nóminas y Horas
              </h3>
              <div style={{ padding: '20px', border: `1px solid ${color.aviso}`, backgroundColor: color.avisoSuave, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <Lock size={18} color={color.aviso} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '12px', color: color.aviso, lineHeight: '1.6' }}>
                      <strong style={{ display: 'block', marginBottom: '6px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          Ya no tienes permiso para ver las nóminas
                      </strong>
                      Alguien te ha retirado el acceso mientras tenías esta pantalla abierta, así que
                      no se puede mostrar nada: ni las horas extra ni los importes.
                      <span style={{ display: 'block', marginTop: '8px', color: color.textoSuave }}>
                          Cierra sesión y vuelve a entrar para que la aplicación se ponga al día.
                          Si crees que es un error, habla con quien lleve los permisos.
                      </span>
                  </div>
              </div>
          </div>
      );
  }

  return (
      <div style={blockStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Cálculo de Nóminas y Horas</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={exportarExcelPersonalizado} style={{ ...btnBlackStyle, backgroundColor: color.superficie, color: color.texto, border: `1px solid ${color.petroleo}`, cursor: 'pointer' }}><FileSpreadsheet size={16} /> Exportar Pagos a Excel</button>
                  {!estaCerrado && (
                      <button onClick={cerrarPeriodo} disabled={cerrando || cobertura.cargando} style={{ ...btnBlackStyle, cursor: cerrando ? 'wait' : 'pointer', opacity: (cerrando || cobertura.cargando) ? 0.5 : 1 }}>
                          <Lock size={16} /> {cerrando ? 'Cerrando…' : 'Cerrar Nómina del Mes'}
                      </button>
                  )}
              </div>
          </div>

          <div style={{ marginBottom: '25px', display: 'flex', gap: '15px', padding: '20px', border: `1px solid ${color.linea}`, backgroundColor: color.fondo, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={labelStyle}>Mes de la nómina:</label>
                  <input type="month" value={periodo} onChange={(e) => cambiarPeriodo(e.target.value)} style={inputStyle} />
              </div>
              {/* Ya no hay tarifas globales por hora: cada uno cobra por la tarifa diaria
                  de SU categoría, y la de hora extra sale también de ahí. */}
          </div>

          <p style={{ margin: '-10px 0 10px 0', fontSize: '11px', color: color.textoSuave }}>
              La base sale de la <strong>tarifa diaria de la categoría</strong> de cada trabajador,
              por <strong>{DIAS_TRABAJABLES_MES} días</strong> menos sus ausencias registradas.
              Las horas extra vienen de los albaranes validados del periodo, a la tarifa de su categoría.
          </p>

          {/* SIN CATEGORÍA NO SE CIERRA, y se dice a quién le falta. Liquidar a 0 € a
              quien no la tiene sería un error caro que nadie notaría hasta la nómina. */}
          {sinCategoria.length > 0 && (
              <div style={{ marginBottom: '20px', padding: '15px 20px', border: `1px solid ${color.error}`, backgroundColor: color.errorSuave, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} color={color.error} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '11px', color: color.error, lineHeight: '1.5' }}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>
                          No se puede cerrar: {sinCategoria.length} trabajador(es) sin categoría profesional.
                      </strong>
                      {sinCategoria.map((i) => i.nombre).join(', ')}.
                      <span style={{ display: 'block', marginTop: '6px', color: color.textoSuave }}>
                          Asígnales una en <strong>Plantilla de Personal</strong>. Sin categoría no hay tarifa
                          diaria, y no se aplica ninguna por defecto a propósito.
                      </span>
                  </div>
              </div>
          )}

          {/* Que las ausencias vengan de la colección y no de la memoria de quien cierra
              es la mitad del cambio: conviene que se vea de dónde salen. */}
          <p style={{ margin: '0 0 20px 0', fontSize: '11px', color: ausencias.error ? color.error : color.textoSuave }}>
              {!ausenciasAlDia
                  ? 'Leyendo las ausencias del periodo…'
                  : ausencias.error
                      ? 'No se han podido leer las ausencias. Las cifras de abajo NO son fiables.'
                      : `${ausencias.lista.length} ausencia(s) registrada(s) en el periodo, contadas desde la pantalla de Ausencias.`}
          </p>

          {/* Las horas extra se agregan sobre el periodo completo, no sobre la página
              cargada. Se dice sobre cuántos albaranes: un total sin respaldo visible
              era el problema anterior. */}
          <p style={{ margin: '0 0 20px 0', fontSize: '11px', color: cobertura.error ? color.error : color.textoSuave }}>
              {cobertura.cargando
                  ? 'Calculando las horas extra del periodo completo…'
                  : cobertura.error
                      ? 'No se han podido leer las horas extra del periodo. Las cifras de abajo NO son fiables.'
                      : `Horas extra agregadas sobre los ${cobertura.albaranes} albarán(es) aprobado(s) del mes completo.`}
          </p>

          {esPeriodoPasado(periodo) && !estaCerrado && (
              <div style={{ marginBottom: '20px', padding: '12px 15px', border: `1px solid ${color.aviso}`, backgroundColor: color.avisoSuave, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} color={color.aviso} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '11px', color: color.aviso, lineHeight: '1.5' }}>
                      <strong>{nombreDelPeriodo(periodo)} es un mes ya pasado.</strong> Si lo cierras ahora se usan las fichas,
                      las bases mensuales y las tarifas <strong>de hoy</strong>, no las que hubiera entonces. Los ajustes
                      manuales que hicieras en su momento no están guardados en ninguna parte.
                  </span>
              </div>
          )}

          {/* Hasta saber si el mes está cerrado no se pinta ninguna de las dos vistas:
              enseñar la editable un instante sobre un periodo ya liquidado invitaría a
              tocar números que no se van a poder guardar. */}
          {cierreCargando ? (
              <div style={{ textAlign: 'center', padding: '30px', color: color.textoSuave, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', border: `1px dashed ${color.canto}` }}>
                  Comprobando si {nombreDelPeriodo(periodo)} ya está cerrado…
              </div>
          ) : estaCerrado ? (
              <>
                  <div style={{ marginBottom: '20px', padding: '15px 20px', border: `1px solid ${color.petroleo}`, backgroundColor: color.superficieTenida }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <Lock size={15} />
                          <strong style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                              {nombreDelPeriodo(periodo)} está cerrado · versión {vigente.version}
                          </strong>
                          {listaCierres.length > 1 && (
                              <Insignia tono="neutra">
                                  <Archive size={9} /> {listaCierres.length} versiones
                              </Insignia>
                          )}
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: '11px', color: color.textoSuave }}>
                          Cerrado por {vigente.cerradoPorEmail || '—'}
                          {vigente.sustituyeA ? ` · sustituye a ${vigente.sustituyeA}` : ''}
                          {vigente.cerradoRetroactivamente ? ' · cerrado retroactivamente' : ''}.
                          Un cierre no se modifica: para corregirlo se emite una versión nueva y esta queda como histórico.
                          Lo que se muestra y se exporta viene del snapshot guardado, no de un cálculo nuevo.
                      </p>
                  </div>

                  <div style={{ marginBottom: '25px', padding: '15px 20px', backgroundColor: color.petroleo, color: color.textoSobreOscuro, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          Liquidado ({vigente.totales?.trabajadores ?? lineasCierre.length} empleados):
                      </span>
                      <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{Number(vigente.totales?.importe ?? 0).toFixed(2)} €</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '15px' }}>
                      {[...lineasCierre].sort((a, b) => (b.total || 0) - (a.total || 0)).map((l) => (
                          <div key={l.id} style={{ padding: '20px', border: `1px solid ${color.canto}`, backgroundColor: color.superficieTenida, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: `1px solid ${color.linea}`, paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <User size={16} /> {l.nombre}
                                  {l.enPapelera && <Insignia tono="info">De baja</Insignia>}
                              </div>
                              <div style={{ fontSize: '11px', color: color.textoSuave, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span>Base {l.baseMensual} h {l.origenBase === 'defecto' && '(por defecto)'} · {l.diasAusencia} día(s) de ausencia</span>
                                  <span>
                                      {l.horasNormales} h normales × {l.tarifaNormal} €
                                      {l.ajusteManualNormales && <Insignia tono="aviso" style={{ marginLeft: espacio.xxs }}><PencilLine size={8} /> Manual</Insignia>}
                                  </span>
                                  <span style={{ color: color.vidrio }}>
                                      {l.horasExtra} h extra × {l.tarifaExtra} €
                                      {l.ajusteManualExtras && <Insignia tono="aviso" style={{ marginLeft: espacio.xxs }}><PencilLine size={8} /> Manual</Insignia>}
                                  </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: `1px dashed ${color.canto}` }}>
                                  <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL PAGADO:</span>
                                  <div style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>{Number(l.total).toFixed(2)} <Euro size={16} /></div>
                              </div>
                          </div>
                      ))}
                  </div>
              </>
          ) : (
              <>
                  {datosCalculados.length > 0 && (
                      <div style={{ marginBottom: '25px', padding: '15px 20px', backgroundColor: color.petroleo, color: color.textoSobreOscuro, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                              Total a liquidar en plantilla ({datosCalculados.length} empleados):
                              {totalAjustesManuales > 0 && (
                                  <Insignia tono="aviso" style={{ marginLeft: espacio.xs }}><PencilLine size={9}/> {totalAjustesManuales} ajuste(s) manual(es)</Insignia>
                              )}
                              {totalEnPapelera > 0 && (
                                  <Insignia tono="info" style={{ marginLeft: espacio.xs }}>{totalEnPapelera} de baja con actividad</Insignia>
                              )}
                          </span>
                          <span style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>{totalGeneralNomina.toFixed(2)} €</span>
                      </div>
                  )}

                  {datosCalculados.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: color.textoSuave, fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', border: `1px dashed ${color.canto}` }}>Añade trabajadores a tu plantilla para calcular nóminas</div>
                  ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '15px' }}>
                          {datosCalculados.map((item) => (
                              <div key={item.clave} style={{ padding: '20px', border: `1px solid ${color.petroleo}`, backgroundColor: color.superficie, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: `1px solid ${color.linea}`, paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <User size={16} color={color.petroleo} /> {item.nombre}
                                      {item.enPapelera && (
                                          <Insignia tono="info" title="Está en la papelera, pero tuvo actividad en este periodo y hay que liquidarle">De baja</Insignia>
                                      )}
                                  </div>

                                  {/* CATEGORÍA Y TARIFA DIARIA */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '10px', padding: '8px 10px', backgroundColor: item.conCategoria ? color.superficieTenida : color.errorSuave, border: `1px solid ${item.conCategoria ? color.lineaSuave : color.error}`, borderRadius: '4px' }}>
                                      <span style={{ fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: color.textoSuave }}>Categoría</span>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {item.conCategoria ? (
                                              <strong style={{ fontSize: '12px', color: color.texto }}>
                                                  {item.categoriaNombre} · {item.tarifaDiaria.toFixed(2)} €/día
                                              </strong>
                                          ) : (
                                              <strong style={{ fontSize: '11px', color: color.error }} title="Sin categoría no hay tarifa diaria: el cierre está bloqueado">
                                                  Sin categoría asignada
                                              </strong>
                                          )}
                                      </span>
                                  </div>

                                  <div style={{ display: 'flex', gap: '10px', backgroundColor: color.fondo, padding: '10px', border: `1px solid ${color.linea}`, borderRadius: '4px', flexWrap: 'wrap' }}>
                                      <div style={{ flex: 1, minWidth: '80px' }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.textoSuave, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>DÍAS MES</label>
                                          <div style={{ padding: '6px', fontSize: '11px', fontWeight: 'bold' }}>{item.diasTrabajables}</div>
                                      </div>
                                      <div style={{ flex: 1, minWidth: '80px' }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.error, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}><CalendarOff size={10}/> AUSENCIAS</label>
                                          <div
                                              style={{ padding: '6px', fontSize: '11px', fontWeight: 'bold', color: item.diasAusencia > 0 ? color.error : color.texto }}
                                              title="Contadas desde la pantalla de Ausencias. Ya no se teclean aquí."
                                          >
                                              {item.diasAusencia}
                                          </div>
                                      </div>
                                      <div style={{ flex: 1, minWidth: '80px' }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.texto, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>DÍAS PAGADOS</label>
                                          <div style={{ padding: '6px', fontSize: '11px', fontWeight: 'bold' }} title={`${item.diasTrabajables} − ${item.diasAusencia}`}>{item.diasPagados}</div>
                                      </div>
                                      <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.vidrio, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', minHeight: '12px' }}>
                                              H. EXTRAS
                                              {item.extraManual && (
                                                  <>
                                                      <Insignia tono="aviso" title={`Ajustado a mano. En los albaranes hay ${item.origE} h`}><PencilLine size={8}/> Manual</Insignia>
                                                      <button type="button" onClick={() => restaurarExtras(item.clave)} style={btnRestaurarStyle} title={`Volver al valor de los albaranes (${item.origE} h)`}><RotateCcw size={10}/></button>
                                                  </>
                                              )}
                                          </label>
                                          <input type="number" step="0.5" value={item.hExtra} onFocus={e => e.target.select()} onChange={(e) => setHorasExtraManuales(prev => ({...prev, [item.clave]: parseFloat(e.target.value)||0}))} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: item.extraManual ? color.avisoSuave : color.superficie, borderColor: item.extraManual ? color.aviso : color.vidrio, color: item.extraManual ? color.aviso : color.vidrio }} title={`Extraídas de albaranes: ${item.origE}h`} />
                                      </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: '10px', backgroundColor: color.superficieTenida, padding: '10px', border: `1px solid ${color.lineaSuave}`, borderRadius: '4px', flexWrap: 'wrap' }}>
                                      <div style={{ flex: 1, minWidth: '110px' }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.textoSuave, display: 'block', marginBottom: '3px' }}>IMPORTE BASE</label>
                                          <div style={{ padding: '6px', fontSize: '12px', fontWeight: 'bold' }} title={`${item.diasPagados} días × ${item.tarifaDiaria.toFixed(2)} €`}>
                                              {item.importeBase.toFixed(2)} €
                                          </div>
                                      </div>
                                      <div style={{ flex: 1, minWidth: '110px' }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.vidrio, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', minHeight: '12px' }}>
                                              €/H EXTRA
                                              {item.tarifaExtraManual && (
                                                  <>
                                                      <Insignia tono="aviso" title={`Ajustada a mano. Su categoría dice ${item.tarifaCategoria} €`}><PencilLine size={8}/> Manual</Insignia>
                                                      <button type="button" onClick={() => restaurarTarifaExtra(item.clave)} style={btnRestaurarStyle} title={`Volver a la de su categoría (${item.tarifaCategoria} €)`}><RotateCcw size={10}/></button>
                                                  </>
                                              )}
                                          </label>
                                          <input type="number" step="0.5" value={item.tarifaE} onFocus={e => e.target.select()} onChange={(e) => handleTarifaExtra(item.clave, e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: item.tarifaExtraManual ? color.avisoSuave : color.superficie, borderColor: item.tarifaExtraManual ? color.aviso : color.vidrio, color: item.tarifaExtraManual ? color.aviso : color.vidrio, fontWeight: 'bold' }} title={`De su categoría: ${item.tarifaCategoria} €/h`} />
                                      </div>
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', paddingTop: '10px', borderTop: `1px dashed ${color.linea}` }}>
                                      <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL A PAGAR:</span>
                                      <div style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>{item.totalPagar.toFixed(2)} <Euro size={16}/></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </>
          )}
      </div>
  );
}
