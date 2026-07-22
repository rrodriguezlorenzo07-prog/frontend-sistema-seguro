import { useState, useEffect } from 'react';

export default function LoginForm() {
    // 1. Estados de memoria
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [esRegistro, setEsRegistro] = useState(false);
    
    // NUEVO: Estado para saber si estamos dentro o fuera
    const [sesionIniciada, setSesionIniciada] = useState(false);

    // NUEVO: useEffect se ejecuta una vez al abrir la página. 
    // Comprueba si ya teníamos una pulsera guardada de ayer.
    useEffect(() => {
        const tokenGuardado = localStorage.getItem('token_seguro');
        if (tokenGuardado) {
            setSesionIniciada(true); // Si hay token, entramos directos
        }
    }, []);

    const manejarEnvio = async (evento) => {
        evento.preventDefault();
        
        const endpoint = esRegistro ? '/api/registro' : '/api/login';
        const url = `http://localhost:3000${endpoint}`;

        try {
            const peticion = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const respuesta = await peticion.json();
            
            if (respuesta.exito) {
                // Si es un LOGIN exitoso, guardamos el token
                if (!esRegistro && respuesta.token) {
                    localStorage.setItem('token_seguro', respuesta.token);
                    setSesionIniciada(true); // Cambiamos la pantalla
                } else {
                    alert(`¡Registro Exitoso! Ahora inicia sesión.`);
                    setEsRegistro(false); // Lo mandamos a la pantalla de login
                }
            } else {
                alert(`Error: ${respuesta.mensaje}`);
            }

        } catch (error) {
            console.error("Fallo de red crítico:", error);
            alert("No se pudo conectar con el servidor.");
        }
    };

    // Función para destruir el token y salir
    const cerrarSesion = () => {
        localStorage.removeItem('token_seguro');
        setSesionIniciada(false);
        setEmail('');
        setPassword('');
    };

    // --- RENDERIZADO CONDICIONAL ---

    // SI ESTAMOS DENTRO: Mostramos el Panel de Control
    // SI ESTAMOS DENTRO: Mostramos el Panel de Control
    if (sesionIniciada) {
        
        // Función que viaja a la ruta protegida con el Token en la mano
        const pedirDatosSecretos = async () => {
            const tokenGuardado = localStorage.getItem('token_seguro');
            
            try {
                const peticion = await fetch('http://localhost:3000/api/boveda', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${tokenGuardado}` // <--- Enseñamos la pulsera al guardia
                    }
                });
                
                const respuesta = await peticion.json();
                alert(respuesta.mensaje);
                
            } catch (error) {
                alert("Error de conexión con la bóveda");
            }
        };

        return (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#1f2937', borderRadius: '10px' }}>
                <h2 style={{ color: '#10b981' }}>¡Acceso Concedido!</h2>
                <p style={{ marginTop: '10px', marginBottom: '20px' }}>Estás dentro del área segura.</p>
                
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button 
                        onClick={pedirDatosSecretos}
                        style={{ backgroundColor: '#8b5cf6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Ver Datos Secretos
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

    // SI ESTAMOS FUERA: Mostramos el Formulario (Código anterior)
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