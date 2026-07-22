import { useState, useEffect } from 'react';
// 1. Importamos las herramientas mágicas de Firebase que creaste antes
import { auth } from '../firebase'; 
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "firebase/auth";

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [esRegistro, setEsRegistro] = useState(false);
    const [sesionIniciada, setSesionIniciada] = useState(false);

    // 2. Firebase vigila automáticamente si ya estábamos dentro (sin usar localStorage)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (usuario) => {
            if (usuario) {
                setSesionIniciada(true);
            } else {
                setSesionIniciada(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // 3. Conexión directa con la base de datos de Firebase
    const manejarEnvio = async (evento) => {
        evento.preventDefault();
        
        try {
            if (esRegistro) {
                // Registrar nuevo usuario en Firebase
                await createUserWithEmailAndPassword(auth, email, password);
                alert("¡Cuenta creada con éxito!");
            } else {
                // Iniciar sesión comprobando en Firebase
                await signInWithEmailAndPassword(auth, email, password);
                // No hace falta cambiar el estado aquí, el useEffect de arriba se da cuenta solo
            }
        } catch (error) {
            console.error("Error de Firebase:", error.code);
            // Mensajes de error amigables
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

    // 4. Cerrar sesión con Firebase
    const cerrarSesion = async () => {
        await signOut(auth);
        setEmail('');
        setPassword('');
    };

    // Botón de prueba para el futuro
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

            <button 
                onClick={() => setEsRegistro(!esRegistro)}
                style={{ marginTop: '20px', background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', textDecoration: 'underline' }}
            >
                {esRegistro ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
        </div>
    );
}