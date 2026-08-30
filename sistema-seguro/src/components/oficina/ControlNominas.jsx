// @ts-check
import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Euro, User, CalendarOff, RotateCcw, PencilLine, Lock, Archive, AlertTriangle } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { HORAS_BASE_POR_DEFECTO, baseMensualDe, tieneBaseConfigurada, horasNormalesDelPeriodo, plantillaDelPeriodo, claveDeTrabajador } from '../../utils/nomina';
import { agregarHorasExtraDelPeriodo } from '../../utils/horasPeriodo';
import {
    esPeriodoValido, idDePeriodo, limitesDelMes, esPeriodoPasado,
    nombreDelPeriodo, idDeCierre, siguienteVersion, cierreVigente
} from '../../utils/periodos';
import { construirCSV, descargarCSV, textoCSV, numeroCSV, enteroCSV } from '../../utils/csv';
import { color, espacio } from '../../estilos/tokens';
import Insignia from '../../ui/Insignia';

// El estado de ajustes se indexa por id de trabajador, no por nombre: dos homónimos
// compartían ajustes y renombrar a uno le borraba los suyos en mitad de la liquidación.
const claveDe = claveDeTrabajador;

/** Un id de documento no puede llevar barras. Solo afecta a fichas sin id. */
const idDeLinea = (clave) => String(clave).replace(/\//g, '_');

const CABECERAS_CSV = ['Trabajador', 'Base Mensual (h)', 'Origen de la Base', 'Días de Ausencia',
    'Horas Normales', 'H. Normales Calculadas', 'Ajuste Manual Normales',
    'Horas Extras', 'H. Extras de Albaranes', 'Ajuste Manual Extras',
    'Tarifa Normal (€)', 'Tarifa Extra (€)', 'Total Pagar (€)'];

export default function ControlNominas({ blockStyle, btnBlackStyle, labelStyle, inputStyle, pagoHoraNormal, setPagoHoraNormal, pagoHoraExtra, setPagoHoraExtra, trabajadoresList, trabajadoresTodos, pedirConfirmacion, mostrarToast }) {

  // Un periodo es un mes natural. El selector es de mes, no de rango: las reglas de
  // Firestore rechazan cualquier otra cosa, así que dejar elegir un rango libre solo
  // serviría para que el cierre fallara de forma incomprensible.
  const [periodo, setPeriodo] = useState(() => idDePeriodo());

  const [diasAusencia, setDiasAusencia] = useState({});
  const [horasManuales, setHorasManuales] = useState({});
  const [horasExtraManuales, setHorasExtraManuales] = useState({});
  const [tarifasOperarios, setTarifasOperarios] = useState({});

  // Ambos estados llevan sellado el periodo al que pertenecen, y solo se escriben
  // dentro de un then/catch. Así el "cargando" es un valor derivado en vez de un
  // setState síncrono dentro del efecto, y una respuesta que llegue tarde tras
  // cambiar de mes no puede pintar los datos del mes anterior.
  const [agregado, setAgregado] = useState({ periodo: null, resumen: [], albaranes: 0, error: false });
  const [cierre, setCierre] = useState({ periodo: null, lista: [], vigente: null, lineas: [], error: false });
  const [cerrando, setCerrando] = useState(false);

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
              if (!cancelado) setAgregado({ periodo, resumen: r.resumen, albaranes: r.albaranesComputados, error: false });
          })
          .catch((error) => {
              console.error('No se pudieron agregar las horas extra del periodo', error);
              if (!cancelado) setAgregado({ periodo, resumen: [], albaranes: 0, error: true });
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
      return { periodo: mes, lista, vigente: cabecera, lineas, error: false };
  }, []);

  useEffect(() => {
      if (!esPeriodoValido(periodo)) return undefined;
      let cancelado = false;
      leerCierres(periodo)
          .then((estado) => { if (!cancelado) setCierre(estado); })
          .catch((error) => {
              console.error('No se pudieron leer los cierres del periodo', error);
              if (!cancelado) setCierre({ periodo, lista: [], vigente: null, lineas: [], error: true });
          });
      return () => { cancelado = true; };
  }, [periodo, leerCierres]);

  /** Al cambiar de mes, los ajustes del anterior no se arrastran. */
  const cambiarPeriodo = (nuevo) => {
      setPeriodo(nuevo);
      setDiasAusencia({});
      setHorasManuales({});
      setHorasExtraManuales({});
      setTarifasOperarios({});
  };

  // ---- AJUSTES ------------------------------------------------------------

  const handleDiasLibres = (clave, valor) => {
      const num = parseFloat(valor) || 0;
      setDiasAusencia(prev => ({ ...prev, [clave]: num }));
      setHorasManuales(prev => { const nuev = {...prev}; delete nuev[clave]; return nuev; });
  };

  const restaurarNormales = (clave) => {
      setHorasManuales(prev => { const nuev = {...prev}; delete nuev[clave]; return nuev; });
  };

  const restaurarExtras = (clave) => {
      setHorasExtraManuales(prev => { const nuev = {...prev}; delete nuev[clave]; return nuev; });
  };

  const handleTarifaChange = (clave, tipo, valor) => {
      const num = parseFloat(valor) || 0;
      setTarifasOperarios(prev => ({
          ...prev,
          [clave]: {
              normal: tipo === 'normal' ? num : (prev[clave]?.normal ?? pagoHoraNormal),
              extra: tipo === 'extra' ? num : (prev[clave]?.extra ?? pagoHoraExtra)
          }
      }));
  };

  // ---- QUIÉN ENTRA EN LA NÓMINA -------------------------------------------

  const listaBase = plantillaDelPeriodo(trabajadoresList, trabajadoresTodos, horasTrabajadores);

  const datosCalculados = listaBase.map(trab => {
      const nombre = trab.nombre;
      const clave = claveDe(trab);

      // De los partes SOLO se toman las horas extra. Las normales jamás se derivan de un albarán.
      // Cruce por trabajadorId cuando la cuadrilla lo tiene; si no, por nombre.
      const datosPartes = horasTrabajadores.find(h =>
          (trab.id && h[1].trabajadorId) ? h[1].trabajadorId === trab.id : h[0] === nombre
      );
      const origE = datosPartes ? datosPartes[1].horasExtra : 0;

      const dLibres = diasAusencia[clave] || 0;

      const baseMensual = baseMensualDe(trab);
      const baseConfigurada = tieneBaseConfigurada(trab);
      const hNormalCalc = horasNormalesDelPeriodo(baseMensual, dLibres);

      const hNormal = horasManuales[clave] !== undefined ? horasManuales[clave] : hNormalCalc;
      const hExtra = horasExtraManuales[clave] !== undefined ? horasExtraManuales[clave] : origE;

      const normalManual = horasManuales[clave] !== undefined && horasManuales[clave] !== hNormalCalc;
      const extraManual = horasExtraManuales[clave] !== undefined && horasExtraManuales[clave] !== origE;

      const tarifaN = tarifasOperarios[clave]?.normal ?? pagoHoraNormal;
      const tarifaE = tarifasOperarios[clave]?.extra ?? pagoHoraExtra;
      const totalPagar = (hNormal * tarifaN) + (hExtra * tarifaE);

      return { clave, trabajadorId: trab.id || null, nombre, email: trab.email || '',
               enPapelera: !!trab.enPapelera, hNormal, hExtra, tarifaN, tarifaE, totalPagar,
               dLibres, origE, baseMensual, baseConfigurada, hNormalCalc, normalManual, extraManual };
  }).sort((a, b) => b.totalPagar - a.totalPagar);

  const totalGeneralNomina = datosCalculados.reduce((acc, item) => acc + item.totalPagar, 0);
  const totalAjustesManuales = datosCalculados.filter(item => item.normalManual || item.extraManual).length;
  const totalSinBaseConfigurada = datosCalculados.filter(item => !item.baseConfigurada).length;
  const totalEnPapelera = datosCalculados.filter(item => item.enPapelera).length;

  // ---- CIERRE. La ÚNICA escritura de esta pantalla. -----------------------

  const cerrarPeriodo = () => {
      if (!esPeriodoValido(periodo) || cerrando) return;
      if (datosCalculados.length === 0) { mostrarToast('No hay trabajadores que liquidar en este periodo.', 'error'); return; }
      if (cobertura.cargando || cobertura.error) {
          mostrarToast('Espera a que terminen de calcularse las horas extra del periodo antes de cerrar.', 'error');
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
                      tarifaNormalGlobal: Number(pagoHoraNormal) || 0,
                      tarifaExtraGlobal: Number(pagoHoraExtra) || 0,
                      totales: {
                          trabajadores: datosCalculados.length,
                          horasNormales: datosCalculados.reduce((s, i) => s + i.hNormal, 0),
                          horasExtra: datosCalculados.reduce((s, i) => s + i.hExtra, 0),
                          importe: totalGeneralNomina
                      },
                      cobertura: { albaranesComputados: cobertura.albaranes },
                      cerradoRetroactivamente: pasado,
                      sustituyeA: anterior ? anterior.id : null,
                      esquema: 1
                  });

                  datosCalculados.forEach((item) => {
                      const id = idDeLinea(item.trabajadorId || item.clave);
                      lote.set(doc(db, 'nominas', cierreId, 'lineas', id), {
                          trabajadorId: id,
                          nombre: item.nombre,          // el nombre de HOY: registro histórico
                          email: item.email,
                          baseMensual: item.baseMensual,
                          origenBase: item.baseConfigurada ? 'ficha' : 'defecto',
                          diasAusencia: item.dLibres,
                          horasNormalesCalculadas: item.hNormalCalc,
                          horasNormales: item.hNormal,
                          ajusteManualNormales: item.normalManual,
                          horasExtraDeAlbaranes: item.origE,
                          horasExtra: item.hExtra,
                          ajusteManualExtras: item.extraManual,
                          tarifaNormal: item.tarifaN,
                          tarifaExtra: item.tarifaE,
                          tarifaPersonalizada: item.tarifaN !== pagoHoraNormal || item.tarifaE !== pagoHoraExtra,
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
                  try {
                      const snap = await getDocs(query(collection(db, 'nominas'), where('periodo', '==', periodo)));
                      ocupado = snap.docs.some((d) => d.id === cierreId);
                  } catch { /* si tampoco se puede leer, se queda el mensaje genérico */ }

                  mostrarToast(
                      ocupado
                          ? 'Otro admin cerró este periodo mientras tanto, recarga y revisa.'
                          : `No se pudo cerrar la nómina: ${error?.message || 'error desconocido'}`,
                      'error'
                  );
                  await leerCierres(periodo).then(setCierre).catch(() => {});
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
      const filas = estaCerrado
          ? lineasCierre.map((l) => ([
              textoCSV(l.nombre), numeroCSV(l.baseMensual, 0),
              textoCSV(l.origenBase === 'ficha' ? 'Ficha del trabajador' : 'Por defecto (sin configurar)'),
              enteroCSV(l.diasAusencia), numeroCSV(l.horasNormales), numeroCSV(l.horasNormalesCalculadas),
              textoCSV(l.ajusteManualNormales ? 'SÍ' : ''), numeroCSV(l.horasExtra),
              numeroCSV(l.horasExtraDeAlbaranes), textoCSV(l.ajusteManualExtras ? 'SÍ' : ''),
              numeroCSV(l.tarifaNormal), numeroCSV(l.tarifaExtra), numeroCSV(l.total)
          ]))
          : datosCalculados.map((item) => ([
              textoCSV(item.nombre), numeroCSV(item.baseMensual, 0),
              textoCSV(item.baseConfigurada ? 'Ficha del trabajador' : 'Por defecto (sin configurar)'),
              enteroCSV(item.dLibres), numeroCSV(item.hNormal), numeroCSV(item.hNormalCalc),
              textoCSV(item.normalManual ? 'SÍ' : ''), numeroCSV(item.hExtra),
              numeroCSV(item.origE), textoCSV(item.extraManual ? 'SÍ' : ''),
              numeroCSV(item.tarifaN), numeroCSV(item.tarifaE), numeroCSV(item.totalPagar)
          ]));

      if (filas.length === 0) { mostrarToast('No hay datos para exportar.', 'error'); return; }

      const total = estaCerrado ? vigente.totales.importe : totalGeneralNomina;
      const ajustes = estaCerrado
          ? lineasCierre.filter((l) => l.ajusteManualNormales || l.ajusteManualExtras).length
          : totalAjustesManuales;

      filas.push([textoCSV('TOTAL GLOBAL A PAGAR'), ...Array(11).fill(textoCSV('')), numeroCSV(total)]);
      filas.push([textoCSV('Ajustes manuales en esta liquidación'), enteroCSV(ajustes)]);
      if (estaCerrado) {
          filas.push([textoCSV('Cierre'), textoCSV(`${vigente.id} · cerrado por ${vigente.cerradoPorEmail || '—'}`)]);
      }
      descargarCSV(`Nomina_${periodo}${estaCerrado ? `_v${vigente.version}` : '_provisional'}.csv`,
                   construirCSV(CABECERAS_CSV, filas));
  };

  // ---- ESTILOS ------------------------------------------------------------

  const btnRestaurarStyle = {
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      color: color.aviso, display: 'inline-flex', alignItems: 'center'
  };

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
              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Tarifa Normal (€)</label><input type="number" step="0.5" value={pagoHoraNormal} onFocus={e => e.target.select()} onChange={(e) => setPagoHoraNormal(Number(e.target.value))} disabled={estaCerrado} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={{...labelStyle, color: color.vidrio}}>Tarifa Extra (€)</label><input type="number" step="0.5" value={pagoHoraExtra} onFocus={e => e.target.select()} onChange={(e) => setPagoHoraExtra(Number(e.target.value))} disabled={estaCerrado} style={{...inputStyle, borderColor: color.vidrio, color: color.vidrio, fontWeight: 'bold'}} /></div>
          </div>

          <p style={{ margin: '-10px 0 10px 0', fontSize: '11px', color: color.textoSuave }}>
              Las horas normales salen de la <strong>base mensual de cada trabajador</strong> (su ficha en Plantilla), menos 8 h por día de ausencia. Las horas extra vienen de los albaranes validados del periodo.
              {totalSinBaseConfigurada > 0 && (
                  <span style={{ color: color.aviso, fontWeight: 'bold' }}> · {totalSinBaseConfigurada} trabajador(es) sin base configurada usan {HORAS_BASE_POR_DEFECTO} h por defecto.</span>
              )}
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

                                  {/* BASE MENSUAL DEL TRABAJADOR */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '10px', padding: '8px 10px', backgroundColor: item.baseConfigurada ? color.superficieTenida : color.avisoSuave, border: `1px solid ${item.baseConfigurada ? color.lineaSuave : color.aviso}`, borderRadius: '4px' }}>
                                      <span style={{ fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: color.textoSuave }}>Base mensual</span>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <strong style={{ fontSize: '12px', color: color.texto }}>{item.baseMensual} h</strong>
                                          {!item.baseConfigurada && (
                                              <span style={{ fontSize: '8px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', backgroundColor: color.aviso, color: color.aviso, padding: '1px 5px', borderRadius: '3px' }} title="Este trabajador no tiene base mensual configurada en su ficha; se aplica el valor por defecto">
                                                  Por defecto · sin configurar
                                              </span>
                                          )}
                                      </span>
                                  </div>

                                  <div style={{ display: 'flex', gap: '10px', backgroundColor: color.fondo, padding: '10px', border: `1px solid ${color.linea}`, borderRadius: '4px' }}>
                                      <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.error, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}><CalendarOff size={10}/> DÍAS LIBRES</label>
                                          <input type="number" value={item.dLibres} onFocus={e => e.target.select()} onChange={(e) => handleDiasLibres(item.clave, e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: color.superficie, borderColor: color.error }} title="Resta 8 horas por día" />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.texto, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', minHeight: '12px' }}>
                                              H. NORMALES
                                              {item.normalManual && (
                                                  <>
                                                      <Insignia tono="aviso" title={`Ajustado a mano. El cálculo automático da ${item.hNormalCalc} h`}><PencilLine size={8}/> Manual</Insignia>
                                                      <button type="button" onClick={() => restaurarNormales(item.clave)} style={btnRestaurarStyle} title={`Volver al valor calculado (${item.hNormalCalc} h)`}><RotateCcw size={10}/></button>
                                                  </>
                                              )}
                                          </label>
                                          <input type="number" step="0.5" value={item.hNormal} onFocus={e => e.target.select()} onChange={(e) => setHorasManuales(prev => ({...prev, [item.clave]: parseFloat(e.target.value)||0}))} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: item.normalManual ? color.avisoSuave : color.superficie, borderColor: item.normalManual ? color.aviso : undefined, fontWeight: 'bold' }} title={item.normalManual ? `Ajustado a mano. Cálculo automático: ${item.hNormalCalc} h` : `Base ${item.baseMensual} h − ${item.dLibres} día(s) × 8 h`} />
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

                                  <div style={{ display: 'flex', gap: '10px', backgroundColor: color.superficieTenida, padding: '10px', border: `1px solid ${color.lineaSuave}`, borderRadius: '4px' }}>
                                      <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.textoSuave, display: 'block', marginBottom: '3px' }}>€/H NORMAL</label>
                                          <input type="number" step="0.5" value={item.tarifaN} onFocus={e => e.target.select()} onChange={(e) => handleTarifaChange(item.clave, 'normal', e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: color.superficie }} />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px', fontWeight: 'bold', color: color.vidrio, display: 'block', marginBottom: '3px' }}>€/H EXTRA</label>
                                          <input type="number" step="0.5" value={item.tarifaE} onFocus={e => e.target.select()} onChange={(e) => handleTarifaChange(item.clave, 'extra', e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: color.superficie, borderColor: color.vidrio, color: color.vidrio, fontWeight: 'bold' }} />
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
