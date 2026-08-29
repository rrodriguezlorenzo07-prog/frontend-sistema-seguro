import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCW1nxHPHriIFbQauj6JunxdEalBvTFct8",
  authDomain: "sistema-seguro-dcecb.firebaseapp.com",
  projectId: "sistema-seguro-dcecb",
  storageBucket: "sistema-seguro-dcecb.firebasestorage.app",
  messagingSenderId: "53597863618",
  appId: "1:53597863618:web:6460e8982d16fb03f3455b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// 👇 ESTO PERMITE AL ADMIN CREAR CUENTAS DE TRABAJADORES CON CONTRASEÑA 👇
const appSecundaria = initializeApp(firebaseConfig, "AppSecundaria");
export const authSecundario = getAuth(appSecundaria);

// 👇 MODO OFFLINE PARA ZONAS SIN COBERTURA 👇
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.log("Múltiples pestañas abiertas, offline desactivado.");
    } else if (err.code == 'unimplemented') {
        console.log("Navegador sin soporte offline.");
    }
});