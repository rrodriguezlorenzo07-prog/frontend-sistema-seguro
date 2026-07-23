// 1. Importamos las herramientas de Firebase
import { getFirestore } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // <- Esta es la pieza clave para el Login

// 2. TUS LLAVES (Copia las tuyas de la web de Firebase y pégalas aquí dentro)
const firebaseConfig = {
  apiKey: "AIzaSyCW1nxHPHriIFbQauj6JunxdEalBvTFct8",
  authDomain: "sistema-seguro-dcecb.firebaseapp.com",
  projectId: "sistema-seguro-dcecb",
  storageBucket: "sistema-seguro-dcecb.firebasestorage.app",
  messagingSenderId: "53597863618",
  appId: "1:53597863618:web:6460e8982d16fb03f3455b"
  
};

// 3. Encendemos Firebase y preparamos la Autenticación
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);