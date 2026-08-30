import { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Menu, X, ArrowRight, ShieldCheck, ArrowLeft, LogOut, FileText, Building2 } from 'lucide-react';

import PanelOficina from './components/PanelOficina';
import ParteTrabajo from './components/ParteTrabajo';
import LandingPage from './components/LandingPage';
import { color, texto, peso, interletra, espacio, radio, sombra } from './estilos/tokens';
import Boton from './ui/Boton';
import Tarjeta from './ui/Tarjeta';
import Campo from './ui/Campo';
import Etiqueta from './ui/Etiqueta';

export default function App() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const [sesionIniciada, setSesionIniciada] = useState(false);
    const [vistaActiva, setVistaActiva] = useState('home'); 
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
            if (usuario) {
                let esAdminDB = false;
                let nombreDB = usuario.email;

                try {
                    // 1. Buscamos al trabajador en la base de datos por su email
                    const q = query(collection(db, 'trabajadores'), where("email", "==", usuario.email.toLowerCase().trim()));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const datosTrabajador = querySnapshot.docs[0].data();
                        nombreDB = datosTrabajador.nombre;
                        
                        // Si en la base de datos es admin, le damos paso
                        if (datosTrabajador.rol === 'admin') {
                            esAdminDB = true;
                        }
                    } else {
                        // Respaldo por si todavía usas la antigua colección 'usuarios'
                        const docRef = await getDoc(doc(db, 'usuarios', usuario.uid));
                        if (docRef.exists()) { nombreDB = docRef.data().nombre; } 
                    }

                    setNombreUsuario(nombreDB);
                    setEsAdmin(esAdminDB);
                } catch (error) { 
                    console.error("Error al verificar rol: ", error); 
                }
                
                setSesionIniciada(true); 
                setUsuarioLogueado(usuario);
                setVistaActiva(esAdminDB ? 'oficina' : 'redactar');
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
            setErrorLogin('Correo o contraseña incorrectos.');
        }
    };

    const recuperarContrasena = async (e) => {
        e.preventDefault();
        if (!email) { setErrorLogin("Escribe tu correo primero."); return; }
        try { await sendPasswordResetEmail(auth, email); setErrorLogin("Correo de recuperación enviado."); } 
        catch (error) { setErrorLogin("Error al enviar el correo."); }
    };

    const cerrarSesion = async () => {
        await signOut(auth);
        setEmail(''); setPassword(''); setVistaActiva('home'); setMostrarLogin(false);
        setMenuMovilAbierto(false);
    };

    if (!sesionIniciada) {
        if (!mostrarLogin) { return <LandingPage onEntrar={() => setMostrarLogin(true)} />; }

        return (
            <div style={{ minHeight: '100vh', backgroundColor: color.fondo, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: espacio.lg }}>
                <Boton variante="fantasma" onClick={() => setMostrarLogin(false)} style={{ position: 'absolute', top: espacio.lg, left: espacio.lg }}>
                    <ArrowLeft size={15}/> Volver al inicio
                </Boton>

                <Tarjeta relleno="amplio" style={{ width: '100%', maxWidth: '420px', boxShadow: sombra.media }}>
                    <h2 style={{ margin: `0 0 ${espacio.xl} 0`, fontSize: texto.titulo, fontWeight: peso.maximo, letterSpacing: interletra.titulo, textAlign: 'center', color: color.petroleo }}>
                        Acceso al portal
                    </h2>

                    {errorLogin && (
                        <div style={{ padding: espacio.sm, marginBottom: espacio.lg, border: `1px solid ${color.error}`, backgroundColor: color.errorSuave, color: color.error, fontSize: texto.base, borderRadius: radio.sutil, lineHeight: 1.45 }}>
                            {errorLogin}
                        </div>
                    )}

                    <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: espacio.md }}>
                        <Campo etiqueta="Correo electrónico" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} tamano="amplio" required />
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <Etiqueta>Contraseña</Etiqueta>
                                <button type="button" onClick={recuperarContrasena} style={{ background: 'none', border: 'none', color: color.vidrio, fontSize: texto.menor, cursor: 'pointer', padding: 0 }}>¿Olvidada?</button>
                            </div>
                            <Campo type="password" value={password} onChange={(e)=>setPassword(e.target.value)} tamano="amplio" required />
                        </div>
                        <Boton type="submit" tamano="amplio" ancho style={{ marginTop: espacio.xs }}>
                            Entrar al sistema
                        </Boton>
                    </form>
                </Tarjeta>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: color.fondo, minHeight: '100vh', color: color.texto }}>

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: esMovil ? espacio.md : `${espacio.md} ${espacio.xl}`, backgroundColor: color.superficie, borderBottom: `1px solid ${color.linea}`, position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ fontWeight: peso.maximo, fontSize: texto.mayor, letterSpacing: interletra.titulo, color: color.petroleo }}>GESTIÓN<span style={{ color: color.vidrio }}>PRO</span></div>

                {esMovil && (
                    <button onClick={() => setMenuMovilAbierto(!menuMovilAbierto)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.petroleo, padding: espacio.xxs, lineHeight: 0 }}>{menuMovilAbierto ? <X size={24} /> : <Menu size={24} />}</button>
                )}

                {!esMovil && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: espacio.lg }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: color.texto, fontWeight: peso.fuerte, fontSize: texto.base }}>{nombreUsuario}</div>
                            <div style={{ color: color.vidrio, fontSize: texto.micro, letterSpacing: interletra.etiqueta, textTransform: 'uppercase', fontWeight: peso.maximo }}>{esAdmin ? 'Administrador' : 'Operario'}</div>
                        </div>
                        <Boton variante="secundario" onClick={cerrarSesion}><LogOut size={14} /> Salir</Boton>
                    </div>
                )}
            </header>

            {esMovil && menuMovilAbierto && (
                <div style={{ position: 'absolute', top: '65px', left: 0, width: '100%', backgroundColor: color.superficie, borderBottom: `1px solid ${color.linea}`, boxShadow: sombra.media, zIndex: 40, padding: espacio.md, display: 'flex', flexDirection: 'column', gap: espacio.xs }}>
                    <Boton variante="secundario" tamano="amplio" ancho onClick={() => {setVistaActiva('redactar'); setMenuMovilAbierto(false);}}><FileText size={16} /> Redactar parte</Boton>
                    {esAdmin && ( <Boton tamano="amplio" ancho onClick={() => {setVistaActiva('oficina'); setMenuMovilAbierto(false);}}><Building2 size={16} /> Panel de oficina</Boton> )}
                    <Boton variante="fantasma" tamano="amplio" ancho onClick={cerrarSesion} style={{ marginTop: espacio.xs }}><LogOut size={16} /> Cerrar sesión</Boton>
                </div>
            )}

            {/* Sin relleno en móvil: la vista de operario ya trae el suyo y en una
                pantalla de teléfono cada píxel de margen se nota. */}
            <main style={{ padding: esMovil ? '0px' : espacio.xl }}>
                {vistaActiva === 'redactar' && <ParteTrabajo usuario={usuarioLogueado} esAdmin={esAdmin} volverOficina={() => setVistaActiva('oficina')} />}
                {vistaActiva === 'oficina' && esAdmin && <Tarjeta relleno="ninguno" style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', overflow: 'hidden' }}><PanelOficina cambiarVista={() => setVistaActiva('redactar')} /></Tarjeta>}
            </main>
        </div>
    );
}