import { app, auth, db, storage, firebaseConfig, firestoreDatabaseId } from "../services/firebase";

export { app, auth, db, storage, firebaseConfig };
export const FIRESTORE_DATABASE_ID = firestoreDatabaseId;

export default app;
