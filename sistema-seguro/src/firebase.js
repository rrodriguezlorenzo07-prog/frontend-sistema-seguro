import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
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
// Caché persistente en IndexedDB para trabajar en obra sin cobertura.
// Sustituye a enableIndexedDbPersistence, deprecado; el gestor multipestaña
// evita además el error failed-precondition al abrir la app en varias pestañas.
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

// 👇 ESTO PERMITE AL ADMIN CREAR CUENTAS DE TRABAJADORES CON CONTRASEÑA 👇
const appSecundaria = initializeApp(firebaseConfig, "AppSecundaria");
export const authSecundario = getAuth(appSecundaria);
