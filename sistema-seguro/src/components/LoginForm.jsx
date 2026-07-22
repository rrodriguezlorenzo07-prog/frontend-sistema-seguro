import { useState, useEffect } from 'react';
import { auth } from '../firebase'; 
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    sendPasswordResetEmail,      // NUEVO: Para recuperar contraseña
    sendEmailVerification        // NUEVO: Para verificar el correo
} from "firebase/auth";

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [esRegistro, setEsRegistro] = useState(false);
    const [sesionIniciada, setSesionIniciada] = useState(false);
    
    // NUEVO: Estado para controlar si el usuario ha verificado su email
    const [emailNoVerificado, setEmailNoVerificado] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (usuario) => {
            if (usuario) {
                // Comprobamos si el correo está verificado
                if (usuario.emailVerified) {
                    setSesionIniciada(true);
                    setEmailNoVerificado(false);
                } else {
                    // Si no está verificado, lo echamos pero le avisamos
                    setSesionIniciada(false);
                    setEmailNoVerificado(true);
                    signOut(auth); 
                }
            } else {
                setSesionIniciada(false);
                setEmailNoVerificado(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const manejarEnvio = async (evento) => {
        evento.preventDefault();
        
        try {
            if (esRegistro) {
                // 1. Registra al usuario
                const credenciales = await createUserWithEmailAndPassword(auth, email, password);
                
                // 2. NUEVO: Le manda el correo de verificación inmediatamente
                await sendEmailVerification(credenciales.user);
                
                alert("¡Cuenta creada! Te hemos enviado un correo de verificación. Revisa tu bandeja de entrada o la carpeta de SPAM antes de iniciar sesión.");
                
                // Lo mandamos a la pantalla de login y vaciamos el formulario
                setEsRegistro(false);
                setPassword(''); 
                signOut(auth); // Cerramos sesión para obligarle a verificar primero

            } else {
                // Intenta iniciar sesión
                const credenciales = await signInWithEmailAndPassword(auth, email, password);
                
                // Si el correo no está verificado, le mandamos una alerta.
                // (El useEffect de arriba también se encarga de echarlo por seguridad).
                if (!credenciales.user.emailVerified) {
                   alert("Debes verificar tu correo electrónico antes de entrar. Revisa tu bandeja de entrada.");
                }
            }
        } catch (error) {
            console.error("Error de Firebase:", error.code);
            if (error.code === 'auth/invalid-credential') {
                alert("Correo o contraseña incorrectos.");
            } else if (error.code === 'auth/email-already-in-use') {
                alert("Este correo ya está registrado.");
            } else if (error.code === 'auth/weak-password') {
                alert("La contraseña debe tener al menos 6 caracteres.");
            } else {
                alert("Hubo un error: " + error.message);
            }
        }
    };

    // NUEVO: Función para recuperar la contraseña
    const recuperarContrasena = async () => {
        if (!email) {
            alert("Por favor, escribe tu correo electrónico en la casilla de arriba primero.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Te hemos enviado un correo con instrucciones para cambiar tu contraseña. Revisa tu bandeja de entrada.");
        } catch (error) {
            if (error.code === 'auth/invalid-email') {
               alert("El formato del correo no es válido.");
            } else {
               alert("Error al enviar el correo. ¿Estás seguro de que existe esta cuenta?");
            }
        }
    };

    const cerrarSesion = async () => {
        await signOut(auth);
        setEmail('');
        setPassword('');
    };

    const pedirDatosSecretos = () => {
        alert("¡Conexión perfecta! Aquí programaremos los Partes de Trabajo de la empresa.");
    };

    // --- RENDERIZADO CONDICIONAL ---

    if (sesionIniciada) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#1f2937', borderRadius: '10px' }}>
                <h2 style={{ color: '#10b981' }}>¡Acceso Concedido!</h2>
                <p style={{ marginTop: '10px', marginBottom: '20px' }}>Estás dentro del área segura de la empresa.</p>
                
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button 
                        onClick={pedirDatosSecretos}
                        style={{ backgroundColor: '#8b5cf6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Ver Partes de Trabajo
                    </button>

                    <button 
                        onClick={cerrarSesion}
                        style={{ backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ marginBottom: '20px' }}>
                {esRegistro ? 'Crear Nueva Cuenta' : 'Iniciar Sesión'}
            </h2>

            {/* Aviso visual si intenta entrar sin verificar */}
            {emailNoVerificado && !esRegistro && (
                <div style={{ backgroundColor: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: '5px', marginBottom: '15px', maxWidth: '300px', textAlign: 'center' }}>
                    ⚠️ Tu correo no está verificado. Por favor, revisa tu email y haz clic en el enlace que te mandamos.
                </div>
            )}
            
            <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
                <input 
                    type="email" 
                    placeholder="Ingresa tu correo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ padding: '10px', borderRadius: '5px', border: 'none', color: 'black' }}
                    required
                />
                
                <input 
                    type="password" 
                    placeholder="Tu contraseña secreta"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ padding: '10px', borderRadius: '5px', border: 'none', color: 'black' }}
                    required
                />

                <button type="submit" style={{ backgroundColor: '#3b82f6', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {esRegistro ? 'Registrarse' : 'Entrar'}
                </button>
            </form>

            {/* NUEVO: Botón de recuperar contraseña (solo aparece en Login) */}
            {!esRegistro && (
                <button 
                    onClick={recuperarContrasena}
                    style={{ marginTop: '15px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' }}
                >
                    ¿Olvidaste tu contraseña?
                </button>
            )}

            <button 
                onClick={() => setEsRegistro(!esRegistro)}
                style={{ marginTop: '20px', background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', textDecoration: 'underline' }}
            >
                {esRegistro ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
        </div>
    );
}