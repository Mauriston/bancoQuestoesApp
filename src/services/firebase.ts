import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfigJson from "../../firebase-applet-config.json";

export const firebaseConfig = {
  projectId: firebaseConfigJson.projectId,
  appId: firebaseConfigJson.appId,
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId
};

export const firestoreDatabaseId = firebaseConfigJson.firestoreDatabaseId || "ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6";

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth Service for AuthContext and auth flows
export const auth = getAuth(app);

// Explicitly initialize Firestore with the designated databaseId
export const db = getFirestore(app, firestoreDatabaseId);

// Initialize Storage Service
export const storage = getStorage(app);

export default app;
