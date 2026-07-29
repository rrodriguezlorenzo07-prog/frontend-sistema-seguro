import React, { useState } from 'react';
import { Plus, Trash2, FileText, Euro } from 'lucide-react';

export default function PresupuestosOfertas({ blockStyle, btnBlackStyle, labelStyle, inputStyle, inventario = [] }) {
  // Estado del presupuesto actual
  const [cliente, setCliente] = useState('');
  const [lineasPresupuesto, setLineasPresupuesto] = useState([
    { descripcion: '', cantidad: 1, precioUnitario: 0 }
  ]);
  const [ivaPorcentaje, setIvaPorcentaje] = useState(21);

  // Añadir una línea vacía o seleccionar un material del inventario
  const agregarLinea = () => {
    setLineasPresupuesto([...lineasPresupuesto, { descripcion: '', cantidad: 1, precioUnitario: 0 }]);
  };

  // Seleccionar un material del almacén para una línea concreta
  const seleccionarMaterialInventario = (index, nombreMaterial) => {
    const materialEncontrado = inventario.find(m => m.nombre === nombreMaterial);
    const nuevasLineas = [...lineasPresupuesto];
    
    if (materialEncontrado) {
      nuevasLineas[index] = {
        descripcion: materialEncontrado.nombre,
        cantidad: 1,
        precioUnitario: materialEncontrado.precioVenta || materialEncontrado.precio || 0
      };
    } else {
      nuevasLineas[index].descripcion = nombreMaterial;
    }
    setLineasPresupuesto(nuevasLineas);
  };

  const actualizarLinea = (index, campo, valor) => {
    const nuevasLineas = [...lineasPresupuesto];
    nuevasLineas[index][campo] = campo === 'cantidad' || campo === 'precioUnitario' ? Number(valor) : valor;
    setLineasPresupuesto(nuevasLineas);
  };

  const eliminarLinea = (index) => {
    setLineasPresupuesto(lineasPresupuesto.filter((_, i) => i !== index));
  };

  // Cálculos totales
  const subtotal = lineasPresupuesto.reduce((acc, item) => acc + (item.cantidad * item.precioUnitario), 0);
  const totalIva = subtotal * (ivaPorcentaje / 100);
  const totalPresupuesto = subtotal + totalIva;

  return (
    <div style={blockStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '300', letterSpacing: '2px', textTransform: 'uppercase' }}>Creación de Presupuestos y Ofertas</h3>
      </div>

      {/* DATOS DEL CLIENTE */}
      <div style={{ marginBottom: '25px', padding: '20px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <label style={labelStyle}>Cliente / Obra:</label>
          <input type="text" placeholder="Nombre del cliente o proyecto..." value={cliente} onChange={(e) => setCliente(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelStyle}>IVA (%)</label>
          <input type="number" value={ivaPorcentaje} onChange={(e) => setIvaPorcentaje(Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      {/* LÍNEAS DEL PRESUPUESTO */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>Partidas y Materiales</div>
        
        {lineasPresupuesto.map((linea, index) => (
          <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap', padding: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
            
            {/* SELECTOR DE MATERIAL DEL ALMACÉN (O escribir libre) */}
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ fontSize: '9px', color: '#64748b', display: 'block', marginBottom: '3px' }}>SELECCIONAR DEL ALMACÉN / DESCRIPCIÓN</label>
              <select 
                onChange={(e) => seleccionarMaterialInventario(index, e.target.value)}
                style={{ ...inputStyle, marginBottom: '5px', backgroundColor: '#f8fafc' }}
                defaultValue=""
              >
                <option value="" disabled>-- Elige del inventario o escribe abajo --</option>
                {inventario.map((mat, i) => (
                  <option key={i} value={mat.nombre}>{mat.nombre} ({mat.precio || mat.precioVenta}€)</option>
                ))}
              </select>
              <input 
                type="text" 
                placeholder="Descripción del concepto..." 
                value={linea.descripcion} 
                onChange={(e) => actualizarLinea(index, 'descripcion', e.target.value)} 
                style={inputStyle} 
              />
            </div>

            {/* CANTIDAD */}
            <div style={{ width: '90px' }}>
              <label style={{ fontSize: '9px', color: '#64748b', display: 'block', marginBottom: '3px' }}>CANTIDAD</label>
              <input type="number" min="1" value={linea.cantidad} onChange={(e) => actualizarLinea(index, 'cantidad', e.target.value)} style={inputStyle} />
            </div>

            {/* PRECIO UNITARIO */}
            <div style={{ width: '110px' }}>
              <label style={{ fontSize: '9px', color: '#64748b', display: 'block', marginBottom: '3px' }}>PRECIO (€)</label>
              <input type="number" step="0.01" value={linea.precioUnitario} onChange={(e) => actualizarLinea(index, 'precioUnitario', e.target.value)} style={inputStyle} />
            </div>

            {/* TOTAL LÍNEA */}
            <div style={{ width: '100px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
              {(linea.cantidad * linea.precioUnitario).toFixed(2)} €
            </div>

            {/* BOTÓN BORRAR LÍNEA */}
            <button onClick={() => eliminarLinea(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '5px' }}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}

        <button onClick={agregarLinea} style={{ ...btnBlackStyle, backgroundColor: '#ffffff', color: '#1a1a1a', border: '1px solid #1a1a1a', marginTop: '5px', cursor: 'pointer' }}>
          <Plus size={16} /> Añadir Línea Libre
        </button>
      </div>

      {/* RESUMEN TOTAL */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', padding: '15px', backgroundColor: '#1a1a1a', color: '#fff', marginTop: '20px' }}>
        <div style={{ fontSize: '12px' }}>Subtotal: <strong>{subtotal.toFixed(2)} €</strong></div>
        <div style={{ fontSize: '12px' }}>IVA ({ivaPorcentaje}%): <strong>{totalIva.toFixed(2)} €</strong></div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', borderTop: '1px solid #444', paddingTop: '5px', marginTop: '5px' }}>
          TOTAL PRESUPUESTO: {totalPresupuesto.toFixed(2)} €
        </div>
      </div>
    </div>
  );
}