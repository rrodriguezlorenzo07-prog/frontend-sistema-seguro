import ParteTrabajo from './ParteTrabajo';
import PanelOficina from './PanelOficina';
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function LoginForm() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [esRegistro, setEsRegistro] = useState(false);
    
    const [sesionIniciada, setSesionIniciada] = useState(false);
    const [emailNoVerificado, setEmailNoVerificado] = useState(false);
    
    const [vistaActiva, setVistaActiva] = useState('home'); 
    const [menuDesplegado, setMenuDesplegado] = useState(false);

    const [usuarioLogueado, setUsuarioLogueado] = useState(null);
    const [nombreUsuario, setNombreUsuario] = useState('');
    const [rolUsuario, setRolUsuario] = useState('trabajador');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
            if (usuario) {
                if (usuario.emailVerified) {
                    try {
                        const docRef = await getDoc(doc(db, 'usuarios', usuario.uid));
                        if (docRef.exists()) {
                            setNombreUsuario(docRef.data().nombre);
                            setRolUsuario(docRef.data().rol);
                        } else {
                            setNombreUsuario(usuario.email);
                            setRolUsuario('admin');
                        }
                    } catch (error) { console.error(error); }
                    setSesionIniciada(true);
                    setEmailNoVerificado(false);
                    setUsuarioLogueado(usuario);
                } else {
                    setSesionIniciada(false);
                    setEmailNoVerificado(true);
                    signOut(auth); 
                }
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
            if (esRegistro) {
                const credenciales = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(credenciales.user, { displayName: nombre });
                await setDoc(doc(db, 'usuarios', credenciales.user.uid), { nombre: nombre, email: email, rol: 'trabajador' });
                await sendEmailVerification(credenciales.user);
                alert("¡Cuenta creada! Revisa tu correo (y el SPAM) para verificarla.");
                setEsRegistro(false); setNombre(''); setPassword(''); signOut(auth); 
            } else {
                const credenciales = await signInWithEmailAndPassword(auth, email, password);
                if (!credenciales.user.emailVerified) alert("Verifica tu correo antes de entrar.");
            }
        } catch (error) { alert("Hubo un error: Verifica tus datos."); }
    };

    const cerrarSesion = async () => {
        await signOut(auth);
        setEmail(''); setPassword(''); setNombre(''); setVistaActiva('home');
    };

    // DISEÑO ELEGANTE Y CORPORATIVO
    return (
        <div style={{ backgroundColor: '#fcfbf9', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, sans-serif", color: '#1a1a1a' }}>
            
            {/* --- HEADER (Elegante y Limpio) --- */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px 50px', backgroundColor: '#ffffff', borderBottom: '1px solid #f0f0f0' }}>
                
                {/* LOGO */}
                <div 
                    onClick={() => setVistaActiva('home')}
                    style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a1a', cursor: 'pointer', letterSpacing: '1px' }}>
                    GESTIÓN<span style={{ color: '#d92323' }}>PRO</span>
                </div>
                
                {/* MENÚ CENTRAL DESPLEGABLE */}
                {sesionIniciada && (
                    <nav style={{ display: 'flex', gap: '40px', fontWeight: '500', fontSize: '13px', color: '#4a4a4a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                        <div style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => setVistaActiva('home')} onMouseOver={(e) => e.target.style.color = '#d92323'} onMouseOut={(e) => e.target.style.color = '#4a4a4a'}>Inicio</div>
                        
                        <div 
                            onMouseEnter={() => setMenuDesplegado(true)}
                            onMouseLeave={() => setMenuDesplegado(false)}
                            style={{ position: 'relative', paddingBottom: '10px' }}
                        >
                            <div style={{ cursor: 'pointer', transition: 'color 0.2s', color: menuDesplegado ? '#d92323' : '#4a4a4a' }}>Partes y Presupuestos ▾</div>
                            
                            {menuDesplegado && (
                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ffffff', padding: '10px 0', borderRadius: '4px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0', width: '220px', zIndex: 100 }}>
                                    <div onClick={() => {setVistaActiva('redactar'); setMenuDesplegado(false);}} style={{ padding: '12px 20px', color: '#1a1a1a', cursor: 'pointer', textAlign: 'center', fontSize: '13px', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.backgroundColor = '#f9f9f9'} onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}>
                                        📝 Redactar Documento
                                    </div>
                                    
                                    {rolUsuario === 'admin' && (
                                        <div onClick={() => {setVistaActiva('oficina'); setMenuDesplegado(false);}} style={{ padding: '12px 20px', color: '#1a1a1a', cursor: 'pointer', textAlign: 'center', fontSize: '13px', borderTop: '1px solid #f0f0f0', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.backgroundColor = '#f9f9f9'} onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}>
                                            🏢 Panel de Dirección
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </nav>
                )}

                {/* USUARIO Y BOTÓN */}
                <div>
                    {sesionIniciada ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#1a1a1a', fontWeight: '600', fontSize: '14px' }}>{nombreUsuario}</div>
                                <div style={{ color: '#888', fontSize: '11px', fontWeight: '500', letterSpacing: '0.5px' }}>{rolUsuario === 'admin' ? 'ADMINISTRADOR' : 'TRABAJADOR'}</div>
                            </div>
                            <button onClick={cerrarSesion} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#1a1a1a', border: '1px solid #dcdcdc', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s' }} onMouseOver={(e) => {e.target.style.borderColor = '#1a1a1a'; e.target.style.backgroundColor = '#1a1a1a'; e.target.style.color = '#fff'}} onMouseOut={(e) => {e.target.style.borderColor = '#dcdcdc'; e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#1a1a1a'}}>
                                Cerrar
                            </button>
                        </div>
                    ) : (
                        <button style={{ padding: '10px 24px', backgroundColor: '#1a1a1a', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Acceso Empleados
                        </button>
                    )}
                </div>
            </header>


            {/* --- CUERPO PRINCIPAL --- */}
            <main style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
                
                {/* VISTA 1: LA PANTALLA DE INICIO (Elegante y Minimalista) */}
                {sesionIniciada && vistaActiva === 'home' && (
                    <div style={{ width: '100%', maxWidth: '900px', textAlign: 'center', animation: 'fadeIn 0.8s ease-out' }}>
                        
                        {/* Línea decorativa muy fina */}
                        <div style={{ width: '60px', height: '2px', backgroundColor: '#d92323', margin: '0 auto 30px auto' }}></div>
                        
                        <h1 style={{ fontSize: '3.5rem', color: '#1a1a1a', fontWeight: '300', letterSpacing: '-1px', marginBottom: '20px', lineHeight: '1.2' }}>
                            Gestión inteligente para <br />
                            <span style={{ fontWeight: '700' }}>proyectos de alto nivel.</span>
                        </h1>
                        
                        <p style={{ fontSize: '1.1rem', color: '#666', maxWidth: '600px', margin: '0 auto 50px auto', lineHeight: '1.8', fontWeight: '400' }}>
                            Centraliza los partes de trabajo, presupuestos y el control de obra en una única plataforma diseñada para la excelencia operativa.
                        </p>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                            <button onClick={() => setVistaActiva('redactar')} style={{ padding: '16px 32px', backgroundColor: '#d92323', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', letterSpacing: '1.5px', textTransform: 'uppercase', fontSize: '12px', transition: 'transform 0.2s', boxShadow: '0 4px 15px rgba(217, 35, 35, 0.2)' }} onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}>
                                Redactar Parte
                            </button>
                            
                            {rolUsuario === 'admin' && (
                                <button onClick={() => setVistaActiva('oficina')} style={{ padding: '16px 32px', backgroundColor: 'transparent', color: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', letterSpacing: '1.5px', textTransform: 'uppercase', fontSize: '12px', transition: 'all 0.2s' }} onMouseOver={(e) => {e.target.style.backgroundColor = '#1a1a1a'; e.target.style.color = '#fff'}} onMouseOut={(e) => {e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#1a1a1a'}}>
                                    Panel de Dirección
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* VISTA 2: FORMULARIO DE PARTES / PRESUPUESTOS */}
                {sesionIniciada && vistaActiva === 'redactar' && (
                    <div style={{ width: '100%' }}>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0', maxWidth: '800px', margin: '0 auto' }}>
                            <ParteTrabajo usuario={usuarioLogueado} nombreUsuario={nombreUsuario} />
                        </div>
                    </div>
                )}

                {/* VISTA 3: PANEL DE LA OFICINA */}
                {sesionIniciada && vistaActiva === 'oficina' && rolUsuario === 'admin' && (
                    <div style={{ width: '100%' }}>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0', maxWidth: '1000px', margin: '0 auto' }}>
                            <PanelOficina />
                        </div>
                    </div>
                )}

                {/* VISTA 4: LOGIN (ELEGANTE) */}
                {!sesionIniciada && (
                    <div style={{ backgroundColor: '#ffffff', padding: '50px 40px', borderRadius: '8px', boxShadow: '0 15px 35px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', width: '100%', maxWidth: '420px' }}>
                        <h2 style={{ textAlign: 'center', color: '#1a1a1a', marginBottom: '10px', fontSize: '22px', fontWeight: '700' }}>
                            {esRegistro ? 'Alta de Personal' : 'Acceso Corporativo'}
                        </h2>
                        <p style={{ textAlign: 'center', color: '#888', marginBottom: '30px', fontSize: '14px' }}>
                            {esRegistro ? 'Complete sus datos para registrarse' : 'Introduzca sus credenciales'}
                        </p>

                        <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {esRegistro && (
                                <div><label style={{ fontWeight: '600', fontSize: '12px', color: '#4a4a4a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre Completo</label><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ width: '100%', padding: '12px 0', border: 'none', borderBottom: '1px solid #dcdcdc', outline: 'none', fontSize: '15px', backgroundColor: 'transparent', transition: 'border-color 0.3s' }} onFocus={(e) => e.target.style.borderBottomColor = '#1a1a1a'} onBlur={(e) => e.target.style.borderBottomColor = '#dcdcdc'}/></div>
                            )}
                            <div><label style={{ fontWeight: '600', fontSize: '12px', color: '#4a4a4a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Correo Electrónico</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px 0', border: 'none', borderBottom: '1px solid #dcdcdc', outline: 'none', fontSize: '15px', backgroundColor: 'transparent', transition: 'border-color 0.3s' }} onFocus={(e) => e.target.style.borderBottomColor = '#1a1a1a'} onBlur={(e) => e.target.style.borderBottomColor = '#dcdcdc'} /></div>
                            <div><label style={{ fontWeight: '600', fontSize: '12px', color: '#4a4a4a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contraseña</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 0', border: 'none', borderBottom: '1px solid #dcdcdc', outline: 'none', fontSize: '15px', backgroundColor: 'transparent', transition: 'border-color 0.3s' }} onFocus={(e) => e.target.style.borderBottomColor = '#1a1a1a'} onBlur={(e) => e.target.style.borderBottomColor = '#dcdcdc'} /></div>
                            
                            <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#1a1a1a', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px', transition: 'background 0.3s' }} onMouseOver={(e) => e.target.style.backgroundColor = '#333'} onMouseOut={(e) => e.target.style.backgroundColor = '#1a1a1a'}>
                                {esRegistro ? 'Crear Cuenta' : 'Entrar'}
                            </button>
                        </form>
                        
                        <div style={{ textAlign: 'center', marginTop: '25px' }}>
                            <button onClick={() => setEsRegistro(!esRegistro)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', transition: 'color 0.3s' }} onMouseOver={(e) => e.target.style.color = '#1a1a1a'} onMouseOut={(e) => e.target.style.color = '#666'}>
                                {esRegistro ? 'Ya tengo cuenta. Iniciar sesión' : '¿No tiene cuenta? Solicitar acceso'}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}