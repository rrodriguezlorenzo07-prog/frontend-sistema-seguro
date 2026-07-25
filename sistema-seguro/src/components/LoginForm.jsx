import { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; 
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';
import { Menu, X, ArrowRight, ShieldCheck, ArrowLeft, LogOut, FileText, Building2 } from 'lucide-react';

import PanelOficina from './PanelOficina';
import ParteTrabajo from './ParteTrabajo';
import LandingPage from './LandingPage';

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const [sesionIniciada, setSesionIniciada] = useState(false);
    const [vistaActiva, setVistaActiva] = useState('home'); 
    
    // Para enseñar la Landing o el Login
    const [mostrarLogin, setMostrarLogin] = useState(false);

    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
    const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

    const [usuarioLogueado, setUsuarioLogueado] = useState(null);
    const [nombreUsuario, setNombreUsuario] = useState('');
    const [esAdmin, setEsAdmin] = useState(false);
    const [errorLogin, setErrorLogin] = useState('');

    useEffect(() => {
        const manejarResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', manejarResize);
        return () => window.removeEventListener('resize', manejarResize);
    }, []);

    // LISTA DE JEFES VIP
    const CORREOS_ADMIN = [
        "rrodriguezlorenzo02@gmail.com", 
        "el_correo_de_tu_padre@gmail.com"
    ];

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
            if (usuario) {
                const isAdminCheck = CORREOS_ADMIN.includes(usuario.email);
                setEsAdmin(isAdminCheck);
                
                try {
                    // Si tienes el nombre guardado en Firebase, lo pillamos
                    const docRef = await getDoc(doc(db, 'usuarios', usuario.uid));
                    if (docRef.exists()) {
                        setNombreUsuario(docRef.data().nombre);
                    } else {
                        setNombreUsuario(usuario.email);
                    }
                } catch (error) { console.error(error); }
                
                setSesionIniciada(true);
                setUsuarioLogueado(usuario);
                setVistaActiva(isAdminCheck ? 'oficina' : 'redactar');
            } else {
                setSesionIniciada(false);
                setUsuarioLogueado(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const manejarEnvio = async (evento) => {
        evento.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setErrorLogin('');
        } catch (error) { 
            setErrorLogin('Credenciales incorrectas. Verifica tu acceso.');
        }
    };

    const recuperarContrasena = async (e) => {
        e.preventDefault();
        if (!email) { setErrorLogin("Escribe tu correo primero."); return; }
        try {
            await sendPasswordResetEmail(auth, email);
            setErrorLogin("Correo de recuperación enviado.");
        } catch (error) {
            setErrorLogin("Error al enviar el correo.");
        }
    };

    const cerrarSesion = async () => {
        await signOut(auth);
        setEmail(''); setPassword(''); setVistaActiva('home'); setMostrarLogin(false);
        setMenuMovilAbierto(false);
    };

    // SI NADIE HA INICIADO SESIÓN (LANDING O FORMULARIO)
    if (!sesionIniciada) {
        if (!mostrarLogin) {
            return <LandingPage onEntrar={() => setMostrarLogin(true)} />;
        }

        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', fontFamily: "'Inter', 'Helvetica Neue', sans-serif", position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button onClick={() => setMostrarLogin(false)} style={{ position: 'absolute', top: '30px', left: '30px', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer', color: '#1a1a1a' }}>
                    <ArrowLeft size={16}/> Volver al Inicio
                </button>
                
                <div style={{ width: '100%', maxWidth: '400px', padding: '50px 40px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
                    <h2 style={{ margin: '0 0 30px 0', fontSize: '24px', fontWeight: '300', letterSpacing: '4px', textTransform: 'uppercase', textAlign: 'center', color: '#1a1a1a' }}>
                        Acceso Portal
                    </h2>
                    
                    {errorLogin && (
                        <div style={{ padding: '15px', marginBottom: '25px', border: '1px solid #1a1a1a', color: '#1a1a1a', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {errorLogin}
                        </div>
                    )}

                    <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', color: '#64748b' }}>
                                Correo Electrónico
                            </label>
                            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} style={{ width: '100%', padding: '14px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fafafa', fontSize: '14px' }} required />
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', color: '#64748b' }}>
                                    Contraseña
                                </label>
                                <button type="button" onClick={recuperarContrasena} style={{ background: 'none', border: 'none', color: '#1a1a1a', fontSize: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>¿Olvidada?</button>
                            </div>
                            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} style={{ width: '100%', padding: '14px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fafafa', fontSize: '14px' }} required />
                        </div>
                        <button type="submit" style={{ padding: '18px', backgroundColor: '#1a1a1a', color: '#ffffff', border: 'none', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', marginTop: '10px', transition: 'background 0.3s' }}>
                            Entrar al Sistema
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // SI HAY SESIÓN INICIADA (MÓVIL O ADMIN)
    return (
        <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: '#1a1a1a' }}>
            
            {/* CABECERA CORPORATIVA BLANCA */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: esMovil ? '20px' : '20px 50px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ fontWeight: '900', fontSize: '20px', letterSpacing: '2px' }}>
                    GESTIÓN<span style={{color: '#94a3b8'}}>PRO</span>
                </div>
                
                {esMovil && (
                    <button onClick={() => setMenuMovilAbierto(!menuMovilAbierto)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a' }}>
                        {menuMovilAbierto ? <X size={24} /> : <Menu size={24} />}
                    </button>
                )}

                {!esMovil && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#1a1a1a', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>{nombreUsuario}</div>
                            <div style={{ color: '#64748b', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{esAdmin ? 'Administrador' : 'Operario'}</div>
                        </div>
                        <button onClick={cerrarSesion} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'transparent', color: '#1a1a1a', border: '1px solid #1a1a1a', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            <LogOut size={14} /> Salir
                        </button>
                    </div>
                )}
            </header>

            {/* MENÚ MÓVIL DESPLEGABLE */}
            {esMovil && menuMovilAbierto && (
                <div style={{ position: 'absolute', top: '65px', left: 0, width: '100%', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', zIndex: 40, padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={() => {setVistaActiva('redactar'); setMenuMovilAbierto(false);}} style={{ background: 'transparent', border: '1px solid #e5e7eb', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a', padding: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} /> Redactar Parte</button>
                    {esAdmin && (
                        <button onClick={() => {setVistaActiva('oficina'); setMenuMovilAbierto(false);}} style={{ background: '#1a1a1a', border: 'none', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#ffffff', padding: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><Building2 size={16} /> Panel Oficina</button>
                    )}
                    <button onClick={cerrarSesion} style={{ padding: '15px', backgroundColor: 'transparent', color: '#1a1a1a', border: '1px solid #1a1a1a', fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '10px' }}>Cerrar Sesión</button>
                </div>
            )}

            {/* CONTENIDO PRINCIPAL */}
            <main style={{ padding: esMovil ? '0px' : '40px' }}>
                {vistaActiva === 'redactar' && (
                    <ParteTrabajo usuario={usuarioLogueado} esAdmin={esAdmin} volverOficina={() => setVistaActiva('oficina')} />
                )}

                {vistaActiva === 'oficina' && esAdmin && (
                    <div style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', maxWidth: '1200px', margin: '0 auto' }}>
                        <PanelOficina cambiarVista={() => setVistaActiva('redactar')} />
                    </div>
                )}
            </main>

        </div>
    );
}