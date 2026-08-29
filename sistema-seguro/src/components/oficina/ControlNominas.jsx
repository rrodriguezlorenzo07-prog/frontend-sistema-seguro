import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Euro, User, CalendarOff, RotateCcw, PencilLine } from 'lucide-react';
import { HORAS_BASE_POR_DEFECTO, baseMensualDe, tieneBaseConfigurada, horasNormalesDelPeriodo } from '../../utils/nomina';
import { construirCSV, descargarCSV, textoCSV, numeroCSV, enteroCSV } from '../../utils/csv';

export default function ControlNominas({ blockStyle, btnBlackStyle, labelStyle, inputStyle, fechaInicio, setFechaInicio, fechaFin, setFechaFin, pagoHoraNormal, setPagoHoraNormal, pagoHoraExtra, setPagoHoraExtra, horasTrabajadores, buscarPartesPorFechas, trabajadoresList }) {

  const [diasAusencia, setDiasAusencia] = useState({});
  const [horasManuales, setHorasManuales] = useState({});
  const [horasExtraManuales, setHorasExtraManuales] = useState({});
  const [tarifasOperarios, setTarifasOperarios] = useState({});

  useEffect(() => {
      setDiasAusencia({});
      setHorasManuales({});
      setHorasExtraManuales({});
      setTarifasOperarios({});
  }, [fechaInicio, fechaFin]);

  const handleDiasLibres = (nombre, valor) => {
      const num = parseFloat(valor) || 0;
      setDiasAusencia(prev => ({ ...prev, [nombre]: num }));
      setHorasManuales(prev => { const nuev = {...prev}; delete nuev[nombre]; return nuev; });
  };

  const restaurarNormales = (nombre) => {
      setHorasManuales(prev => { const nuev = {...prev}; delete nuev[nombre]; return nuev; });
  };

  const restaurarExtras = (nombre) => {
      setHorasExtraManuales(prev => { const nuev = {...prev}; delete nuev[nombre]; return nuev; });
  };

  const handleTarifaChange = (nombre, tipo, valor) => {
      const num = parseFloat(valor) || 0;
      setTarifasOperarios(prev => ({
          ...prev,
          [nombre]: {
              normal: tipo === 'normal' ? num : (prev[nombre]?.normal ?? pagoHoraNormal),
              extra: tipo === 'extra' ? num : (prev[nombre]?.extra ?? pagoHoraExtra)
          }
      }));
  };

  const listaBase = trabajadoresList && trabajadoresList.length > 0 ? trabajadoresList : horasTrabajadores.map(h => ({ nombre: h[0] }));

  const datosCalculados = listaBase.map(trab => {
      const nombre = trab.nombre;

      // De los partes SOLO se toman las horas extra. Las normales jamás se derivan de un albarán.
      const datosPartes = horasTrabajadores.find(h => h[0] === nombre);
      const origE = datosPartes ? datosPartes[1].horasExtra : 0;

      const dLibres = diasAusencia[nombre] || 0;

      // Base mensual propia del trabajador; si no la tiene, el valor por defecto.
      const baseMensual = baseMensualDe(trab);
      const baseConfigurada = tieneBaseConfigurada(trab);
      const hNormalCalc = horasNormalesDelPeriodo(baseMensual, dLibres);

      const hNormal = horasManuales[nombre] !== undefined ? horasManuales[nombre] : hNormalCalc;
      const hExtra = horasExtraManuales[nombre] !== undefined ? horasExtraManuales[nombre] : origE;

      // Trazabilidad: ¿el valor que se va a pagar difiere del calculado automáticamente?
      const normalManual = horasManuales[nombre] !== undefined && horasManuales[nombre] !== hNormalCalc;
      const extraManual = horasExtraManuales[nombre] !== undefined && horasExtraManuales[nombre] !== origE;

      const tarifaN = tarifasOperarios[nombre]?.normal ?? pagoHoraNormal;
      const tarifaE = tarifasOperarios[nombre]?.extra ?? pagoHoraExtra;
      const totalPagar = (hNormal * tarifaN) + (hExtra * tarifaE);

      return { nombre, hNormal, hExtra, tarifaN, tarifaE, totalPagar, dLibres, origE,
               baseMensual, baseConfigurada, hNormalCalc, normalManual, extraManual };
  }).sort((a, b) => b.totalPagar - a.totalPagar);

  const totalGeneralNomina = datosCalculados.reduce((acc, item) => acc + item.totalPagar, 0);
  const totalAjustesManuales = datosCalculados.filter(item => item.normalManual || item.extraManual).length;
  const totalSinBaseConfigurada = datosCalculados.filter(item => !item.baseConfigurada).length;

  const exportarExcelPersonalizado = () => {
      if (datosCalculados.length === 0) { alert("No hay datos para exportar."); return; }
      const cabeceras = ['Trabajador', 'Base Mensual (h)', 'Origen de la Base', 'Días de Ausencia',
          'Horas Normales', 'H. Normales Calculadas', 'Ajuste Manual Normales',
          'Horas Extras', 'H. Extras de Albaranes', 'Ajuste Manual Extras',
          'Tarifa Normal (€)', 'Tarifa Extra (€)', 'Total Pagar (€)'];
      const filas = datosCalculados.map((item) => ([
          textoCSV(item.nombre),
          numeroCSV(item.baseMensual, 0),
          textoCSV(item.baseConfigurada ? 'Ficha del trabajador' : 'Por defecto (sin configurar)'),
          enteroCSV(item.dLibres),
          numeroCSV(item.hNormal),
          numeroCSV(item.hNormalCalc),
          textoCSV(item.normalManual ? 'SÍ' : ''),
          numeroCSV(item.hExtra),
          numeroCSV(item.origE),
          textoCSV(item.extraManual ? 'SÍ' : ''),
          numeroCSV(item.tarifaN),
          numeroCSV(item.tarifaE),
          numeroCSV(item.totalPagar)
      ]));
      filas.push([textoCSV('TOTAL GLOBAL A PAGAR'), ...Array(11).fill(textoCSV('')), numeroCSV(totalGeneralNomina)]);
      filas.push([textoCSV('Ajustes manuales en esta liquidación'), enteroCSV(totalAjustesManuales)]);
      descargarCSV(`Nomina_${fechaInicio || 'periodo'}_al_${fechaFin || 'actual'}.csv`, construirCSV(cabeceras, filas));
  };

  const badgeManualStyle = {
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '8px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase',
      backgroundColor: '#f59e0b', color: '#ffffff', padding: '1px 5px', borderRadius: '3px'
  };

  const btnRestaurarStyle = {
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      color: '#f59e0b', display: 'inline-flex', alignItems: 'center'
  };

  return (
      <div style={blockStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Cálculo de Nóminas y Horas</h3>
              <button onClick={exportarExcelPersonalizado} style={{ ...btnBlackStyle, backgroundColor: '#ffffff', color: '#1a1a1a', border: '1px solid #1a1a1a', cursor: 'pointer' }}><FileSpreadsheet size={16} /> Exportar Pagos a Excel</button>
          </div>

          <div style={{ marginBottom: '25px', display: 'flex', gap: '15px', padding: '20px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Desde la fecha:</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Hasta la fecha:</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} /></div>

              <button onClick={buscarPartesPorFechas} style={{ ...btnBlackStyle, flex: 1, minWidth: '120px', justifyContent: 'center', height: '42px' }}>Buscar Fechas</button>

              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Tarifa Normal (€)</label><input type="number" step="0.5" value={pagoHoraNormal} onFocus={e => e.target.select()} onChange={(e) => setPagoHoraNormal(Number(e.target.value))} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={{...labelStyle, color: '#2563eb'}}>Tarifa Extra (€)</label><input type="number" step="0.5" value={pagoHoraExtra} onFocus={e => e.target.select()} onChange={(e) => setPagoHoraExtra(Number(e.target.value))} style={{...inputStyle, borderColor: '#2563eb', color: '#2563eb', fontWeight: 'bold'}} /></div>
          </div>

          <p style={{ margin: '-10px 0 25px 0', fontSize: '11px', color: '#64748b' }}>
              Las horas normales salen de la <strong>base mensual de cada trabajador</strong> (su ficha en Plantilla), menos 8 h por día de ausencia. Las horas extra vienen de los albaranes validados del periodo.
              {totalSinBaseConfigurada > 0 && (
                  <span style={{ color: '#b45309', fontWeight: 'bold' }}> · {totalSinBaseConfigurada} trabajador(es) sin base configurada usan {HORAS_BASE_POR_DEFECTO} h por defecto.</span>
              )}
          </p>

          {datosCalculados.length > 0 && (
              <div style={{ marginBottom: '25px', padding: '15px 20px', backgroundColor: '#1a1a1a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      Total a liquidar en plantilla ({datosCalculados.length} empleados):
                      {totalAjustesManuales > 0 && (
                          <span style={{ ...badgeManualStyle, marginLeft: '10px' }}><PencilLine size={9}/> {totalAjustesManuales} ajuste(s) manual(es)</span>
                      )}
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>{totalGeneralNomina.toFixed(2)} €</span>
              </div>
          )}

          {datosCalculados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', border: '1px dashed #cbd5e1' }}>Añade trabajadores a tu plantilla para calcular nóminas</div>
          ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '15px' }}>
                  {datosCalculados.map((item, index) => (
                      <div key={index} style={{ padding: '20px', border: '1px solid #1a1a1a', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <User size={16} color="#1a1a1a" /> {item.nombre}
                          </div>

                          {/* BASE MENSUAL DEL TRABAJADOR */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '10px', padding: '8px 10px', backgroundColor: item.baseConfigurada ? '#f8fafc' : '#fffbeb', border: `1px solid ${item.baseConfigurada ? '#e2e8f0' : '#fcd34d'}`, borderRadius: '4px' }}>
                              <span style={{ fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b' }}>Base mensual</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong style={{ fontSize: '12px', color: '#1a1a1a' }}>{item.baseMensual} h</strong>
                                  {!item.baseConfigurada && (
                                      <span style={{ fontSize: '8px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', backgroundColor: '#fcd34d', color: '#78350f', padding: '1px 5px', borderRadius: '3px' }} title="Este trabajador no tiene base mensual configurada en su ficha; se aplica el valor por defecto">
                                          Por defecto · sin configurar
                                      </span>
                                  )}
                              </span>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', backgroundColor: '#fafafa', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}><CalendarOff size={10}/> DÍAS LIBRES</label>
                                  <input type="number" value={item.dLibres} onFocus={e => e.target.select()} onChange={(e) => handleDiasLibres(item.nombre, e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: '#fff', borderColor: '#ef4444' }} title="Resta 8 horas por día" />
                              </div>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', minHeight: '12px' }}>
                                      H. NORMALES
                                      {item.normalManual && (
                                          <>
                                              <span style={badgeManualStyle} title={`Ajustado a mano. El cálculo automático da ${item.hNormalCalc} h`}><PencilLine size={8}/> Manual</span>
                                              <button type="button" onClick={() => restaurarNormales(item.nombre)} style={btnRestaurarStyle} title={`Volver al valor calculado (${item.hNormalCalc} h)`}><RotateCcw size={10}/></button>
                                          </>
                                      )}
                                  </label>
                                  <input type="number" step="0.5" value={item.hNormal} onFocus={e => e.target.select()} onChange={(e) => setHorasManuales(prev => ({...prev, [item.nombre]: parseFloat(e.target.value)||0}))} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: item.normalManual ? '#fffbeb' : '#fff', borderColor: item.normalManual ? '#f59e0b' : undefined, fontWeight: 'bold' }} title={item.normalManual ? `Ajustado a mano. Cálculo automático: ${item.hNormalCalc} h` : `Base ${item.baseMensual} h − ${item.dLibres} día(s) × 8 h`} />
                              </div>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', minHeight: '12px' }}>
                                      H. EXTRAS
                                      {item.extraManual && (
                                          <>
                                              <span style={badgeManualStyle} title={`Ajustado a mano. En los albaranes hay ${item.origE} h`}><PencilLine size={8}/> Manual</span>
                                              <button type="button" onClick={() => restaurarExtras(item.nombre)} style={btnRestaurarStyle} title={`Volver al valor de los albaranes (${item.origE} h)`}><RotateCcw size={10}/></button>
                                          </>
                                      )}
                                  </label>
                                  <input type="number" step="0.5" value={item.hExtra} onFocus={e => e.target.select()} onChange={(e) => setHorasExtraManuales(prev => ({...prev, [item.nombre]: parseFloat(e.target.value)||0}))} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: item.extraManual ? '#fffbeb' : '#fff', borderColor: item.extraManual ? '#f59e0b' : '#2563eb', color: item.extraManual ? '#b45309' : '#2563eb' }} title={`Extraídas de albaranes: ${item.origE}h`} />
                              </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', backgroundColor: '#f8fafc', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '3px' }}>€/H NORMAL</label>
                                  <input type="number" step="0.5" value={item.tarifaN} onFocus={e => e.target.select()} onChange={(e) => handleTarifaChange(item.nombre, 'normal', e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: '#fff' }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#2563eb', display: 'block', marginBottom: '3px' }}>€/H EXTRA</label>
                                  <input type="number" step="0.5" value={item.tarifaE} onFocus={e => e.target.select()} onChange={(e) => handleTarifaChange(item.nombre, 'extra', e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: '#fff', borderColor: '#2563eb', color: '#2563eb', fontWeight: 'bold' }} />
                              </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', paddingTop: '10px', borderTop: '1px dashed #e5e7eb' }}>
                              <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL A PAGAR:</span>
                              <div style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>{item.totalPagar.toFixed(2)} <Euro size={16}/></div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
  );
}
