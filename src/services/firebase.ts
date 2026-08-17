import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import firebaseConfigJson from "../../firebase-applet-config.json";

// As variáveis VITE_FIREBASE_* (ver .env.example) são overrides opcionais:
// permitem apontar o build para outro projeto Firebase (ex.: staging) sem
// editar firebase-applet-config.json. Se não definidas, o config commitado
// no repositório continua sendo usado normalmente.
export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId
};

export const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  firebaseConfigJson.firestoreDatabaseId ||
  "ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6";

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth Service for AuthContext and auth flows
export const auth = getAuth(app);

// Explicitly initialize Firestore with the designated databaseId
export const db = getFirestore(app, firestoreDatabaseId);

// Initialize Storage Service
export const storage = getStorage(app);

// Cloud Functions (ex.: generateExamReportPdf — ver functions/src/index.ts)
export const functions = getFunctions(app);

export default app;
