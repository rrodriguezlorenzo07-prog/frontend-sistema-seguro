const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 
const { Pool } = require('pg'); 

// Borra la configuración vieja (la que tenía localhost y tu clave de pgAdmin)
// Y pon esta nueva configuración para la nube:

const db = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_OSb18YnDlBVp@ep-noisy-voice-zadofynu-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false // Obligatorio para conexiones seguras en la nube
    }
});

const FIRMA_SECRETA = 'mi_super_secreto_de_ingenieria_2026';

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------
// EL GUARDIA DE SEGURIDAD (MIDDLEWARE)
// ---------------------------------------------------
const verificarToken = (req, res, next) => {
    // 1. Buscamos el token en las cabeceras de la petición
    const cabeceraAuth = req.headers['authorization'];
    
    if (!cabeceraAuth) {
        return res.status(403).json({ exito: false, mensaje: "¡Alto! Necesitas una pulsera VIP para entrar aquí." });
    }

    try {
        // El formato suele ser "Bearer <token>", así que extraemos solo el token
        const token = cabeceraAuth.split(' ')[1];
        
        // 2. Verificamos si la firma matemática es válida y no ha caducado
        const datosDecodificados = jwt.verify(token, FIRMA_SECRETA);
        
        // 3. Si es válido, guardamos los datos del usuario y le dejamos pasar
        req.usuario = datosDecodificados;
        next(); 
    } catch (error) {
        return res.status(401).json({ exito: false, mensaje: "Token inválido, falso o caducado." });
    }
};

// --- RUTA 1: REGISTRO ---
app.post('/api/registro', async (req, res) => {
    const { email, password } = req.body;
    try {
        const passwordEncriptada = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO usuarios (email, password_hash) VALUES ($1, $2) RETURNING id, email';
        await db.query(query, [email, passwordEncriptada]);
        res.json({ exito: true, mensaje: "Usuario registrado correctamente" });
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ exito: false, mensaje: "Email ya registrado" });
        res.status(500).json({ exito: false, mensaje: "Error del servidor" });
    }
});

// --- RUTA 2: INICIO DE SESIÓN ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const query = 'SELECT * FROM usuarios WHERE email = $1';
        const resultado = await db.query(query, [email]);

        if (resultado.rows.length === 0) return res.status(401).json({ exito: false, mensaje: "Credenciales incorrectas" });

        const usuario = resultado.rows[0];
        const esValida = await bcrypt.compare(password, usuario.password_hash);

        if (esValida) {
            const token = jwt.sign({ id: usuario.id, email: usuario.email }, FIRMA_SECRETA, { expiresIn: '1h' });
            res.json({ exito: true, mensaje: "¡Bienvenido!", token });
        } else {
            res.status(401).json({ exito: false, mensaje: "Credenciales incorrectas" });
        }
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: "Error del servidor" });
    }
});

// ---------------------------------------------------
// RUTA 3: LA BOVEDA SECRETA (Protegida por el guardia)
// Fíjate que hemos puesto "verificarToken" en medio
// ---------------------------------------------------
app.get('/api/boveda', verificarToken, (req, res) => {
    // Si el código llega hasta aquí, es que el guardia le dejó pasar
    res.json({ 
        exito: true, 
        mensaje: `¡Hola ${req.usuario.email}! Aquí tienes los códigos de lanzamiento ultrasecretos: 994-Alpha-X.` 
    });
});

// Render nos asignará un puerto automáticamente en la variable de entorno process.env.PORT
// Si estamos en local, usará el 3000.
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
    console.log(`[+] Servidor backend operando en el puerto ${PUERTO}`);
});