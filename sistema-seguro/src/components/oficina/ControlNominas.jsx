import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Euro, User, CalendarOff } from 'lucide-react';

export default function ControlNominas({ blockStyle, btnBlackStyle, labelStyle, inputStyle, fechaInicio, setFechaInicio, fechaFin, setFechaFin, pagoHoraNormal, setPagoHoraNormal, pagoHoraExtra, setPagoHoraExtra, horasTrabajadores, buscarPartesPorFechas, trabajadoresList }) {
  
  const [horasBasePeriodo, setHorasBasePeriodo] = useState(160); 
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
      
      // Buscamos si tiene horas extras en los partes (ignorando las horas normales de obra para oficina/fijos)
      const datosPartes = horasTrabajadores.find(h => h[0] === nombre);
      const origE = datosPartes ? datosPartes[1].horasExtra : 0;
      
      const dLibres = diasAusencia[nombre] || 0;
      const hNormalCalc = Math.max(0, horasBasePeriodo - (dLibres * 8)); 
      
      const hNormal = horasManuales[nombre] !== undefined ? horasManuales[nombre] : hNormalCalc;
      const hExtra = horasExtraManuales[nombre] !== undefined ? horasExtraManuales[nombre] : origE;

      const tarifaN = tarifasOperarios[nombre]?.normal ?? pagoHoraNormal;
      const tarifaE = tarifasOperarios[nombre]?.extra ?? pagoHoraExtra;
      const totalPagar = (hNormal * tarifaN) + (hExtra * tarifaE);

      return { nombre, hNormal, hExtra, tarifaN, tarifaE, totalPagar, dLibres, origE };
  }).sort((a, b) => b.totalPagar - a.totalPagar);

  const totalGeneralNomina = datosCalculados.reduce((acc, item) => acc + item.totalPagar, 0);

  const exportarExcelPersonalizado = () => {
      if (datosCalculados.length === 0) { alert("No hay datos para exportar."); return; }
      let csvContent = "\uFEFFTrabajador;Días de Ausencia;Horas Normales;Horas Extras;Tarifa Normal (€);Tarifa Extra (€);Total Pagar (€)\n";
      datosCalculados.forEach(item => {
          csvContent += `"${item.nombre}";${item.dLibres};${item.hNormal};${item.hExtra};${item.tarifaN};${item.tarifaE};${item.totalPagar.toFixed(2)}\n`;
      });
      csvContent += `\n"TOTAL GLOBAL A PAGAR";"";"";"";"";"";"${totalGeneralNomina.toFixed(2)}"\n`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.setAttribute("href", url);
      link.setAttribute("download", `Nomina_${fechaInicio || 'periodo'}_al_${fechaFin || 'actual'}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
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

              <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{...labelStyle, color: '#1a1a1a'}}>Horas Base del Mes</label>
                  <input type="number" value={horasBasePeriodo} onFocus={e => e.target.select()} onChange={(e) => setHorasBasePeriodo(Number(e.target.value))} style={{...inputStyle, border: '1px solid #1a1a1a', fontWeight: 'bold'}} />
              </div>

              <div style={{ flex: 1, minWidth: '120px' }}><label style={labelStyle}>Tarifa Normal (€)</label><input type="number" step="0.5" value={pagoHoraNormal} onFocus={e => e.target.select()} onChange={(e) => setPagoHoraNormal(Number(e.target.value))} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '120px' }}><label style={{...labelStyle, color: '#2563eb'}}>Tarifa Extra (€)</label><input type="number" step="0.5" value={pagoHoraExtra} onFocus={e => e.target.select()} onChange={(e) => setPagoHoraExtra(Number(e.target.value))} style={{...inputStyle, borderColor: '#2563eb', color: '#2563eb', fontWeight: 'bold'}} /></div>
          </div>

          {datosCalculados.length > 0 && (
              <div style={{ marginBottom: '25px', padding: '15px 20px', backgroundColor: '#1a1a1a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Total a liquidar en plantilla ({datosCalculados.length} empleados):</span>
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
                          
                          <div style={{ display: 'flex', gap: '10px', backgroundColor: '#fafafa', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}><CalendarOff size={10}/> DÍAS LIBRES</label>
                                  <input type="number" value={item.dLibres} onFocus={e => e.target.select()} onChange={(e) => handleDiasLibres(item.nombre, e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: '#fff', borderColor: '#ef4444' }} title="Resta 8 horas por día" />
                              </div>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#1a1a1a', display: 'block', marginBottom: '3px' }}>H. NORMALES</label>
                                  <input type="number" step="0.5" value={item.hNormal} onFocus={e => e.target.select()} onChange={(e) => setHorasManuales(prev => ({...prev, [item.nombre]: parseFloat(e.target.value)||0}))} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: '#fff', fontWeight: 'bold' }} title="Horas Base - Faltas" />
                              </div>
                              <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#2563eb', display: 'block', marginBottom: '3px' }}>H. EXTRAS</label>
                                  <input type="number" step="0.5" value={item.hExtra} onFocus={e => e.target.select()} onChange={(e) => setHorasExtraManuales(prev => ({...prev, [item.nombre]: parseFloat(e.target.value)||0}))} style={{ ...inputStyle, padding: '6px', fontSize: '11px', backgroundColor: '#fff', borderColor: '#2563eb', color: '#2563eb' }} title={`Extraídas de albaranes: ${item.origE}h`} />
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