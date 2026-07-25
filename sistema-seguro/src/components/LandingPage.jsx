import React from 'react';
import { ArrowRight, Wrench, BarChart3, FileText, ChevronDown } from 'lucide-react';

export default function LandingPage({ onEntrar }) {
    return (
        <div style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: '#1a1a1a', backgroundColor: '#ffffff', minHeight: '100vh' }}>
            
            {/* BARRA DE NAVEGACIÓN */}
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px 50px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontWeight: '900', fontSize: '22px', letterSpacing: '2px' }}>
                    GESTIÓN<span style={{color: '#94a3b8'}}>PRO</span>
                </div>
                <button onClick={onEntrar} style={{ background: 'transparent', border: 'none', fontWeight: '600', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a1a1a' }}>
                    Acceso Portal <ArrowRight size={16} />
                </button>
            </nav>

            {/* SECCIÓN HERO (PORTADA) */}
            <header style={{ textAlign: 'center', padding: '120px 20px 100px 20px', backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ border: '2px solid #1a1a1a', padding: '40px', backgroundColor: '#ffffff' }}>
                        <h1 style={{ fontSize: '42px', fontWeight: '300', letterSpacing: '4px', textTransform: 'uppercase', margin: '0 0 15px 0' }}>
                            Plataforma de Control
                        </h1>
                        <p style={{ fontSize: '14px', color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
                            Soporte Técnico y Mantenimiento de Obras
                        </p>
                    </div>
                </div>
                <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'center' }}>
                    <ChevronDown size={24} color="#cbd5e1" style={{ animation: 'bounce 2s infinite' }} />
                </div>
            </header>

            {/* SECCIÓN DE CARACTERÍSTICAS (ESTILO ROMBOS MINIMALISTAS) */}
            <section style={{ padding: '100px 50px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '60px', textAlign: 'center' }}>
                    
                    {/* Bloque 1 */}
                    <div style={{ flex: 1, minWidth: '250px', maxWidth: '300px' }}>
                        <div style={{ width: '100px', height: '100px', margin: '0 auto 40px', transform: 'rotate(45deg)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                            <div style={{ transform: 'rotate(-45deg)' }}><Wrench size={32} color="#1a1a1a" /></div>
                        </div>
                        <h3 style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '15px', color: '#1a1a1a' }}>
                            Trabajo en Terreno
                        </h3>
                        <div style={{ height: '1px', width: '30px', backgroundColor: '#1a1a1a', margin: '0 auto 15px' }}></div>
                        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.8' }}>
                            Partes digitales, captura de firmas in-situ y control de material directamente desde el dispositivo móvil del operario.
                        </p>
                    </div>

                    {/* Bloque 2 */}
                    <div style={{ flex: 1, minWidth: '250px', maxWidth: '300px' }}>
                        <div style={{ width: '100px', height: '100px', margin: '0 auto 40px', transform: 'rotate(45deg)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                            <div style={{ transform: 'rotate(-45deg)' }}><BarChart3 size={32} color="#1a1a1a" /></div>
                        </div>
                        <h3 style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '15px', color: '#1a1a1a' }}>
                            Gestión Centralizada
                        </h3>
                        <div style={{ height: '1px', width: '30px', backgroundColor: '#1a1a1a', margin: '0 auto 15px' }}></div>
                        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.8' }}>
                            Validación de horas, cálculo automático de nóminas y estadísticas de avance de hoteles en un panel de control único.
                        </p>
                    </div>

                    {/* Bloque 3 */}
                    <div style={{ flex: 1, minWidth: '250px', maxWidth: '300px' }}>
                        <div style={{ width: '100px', height: '100px', margin: '0 auto 40px', transform: 'rotate(45deg)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                            <div style={{ transform: 'rotate(-45deg)' }}><FileText size={32} color="#1a1a1a" /></div>
                        </div>
                        <h3 style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '15px', color: '#1a1a1a' }}>
                            Documentación
                        </h3>
                        <div style={{ height: '1px', width: '30px', backgroundColor: '#1a1a1a', margin: '0 auto 15px' }}></div>
                        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.8' }}>
                            Generación instantánea de presupuestos formales, control de stock y exportación de bases de datos a formato Excel.
                        </p>
                    </div>

                </div>
            </section>

            {/* FOOTER Y LLAMADA A LA ACCIÓN */}
            <footer style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '300', letterSpacing: '2px', margin: '0 0 30px 0' }}>Accede al sistema corporativo</h2>
                <button onClick={onEntrar} style={{ padding: '16px 40px', backgroundColor: '#ffffff', color: '#1a1a1a', border: 'none', fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s' }}>
                    Iniciar Sesión
                </button>
            </footer>
        </div>
    );
}