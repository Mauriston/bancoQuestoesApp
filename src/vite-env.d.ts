/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_FIRESTORE_DATABASE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injetado em build pelo vite.config.ts (também publicado em /version.json).
declare const __BUILD_ID__: string;
