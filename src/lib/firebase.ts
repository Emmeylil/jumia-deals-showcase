import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_SHEET_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY'
];

const missingVars = requiredEnvVars.filter(key => !import.meta.env[key]);

// Export configuration status for UI feedback
export const isConfigured = missingVars.length === 0;

if (!isConfigured) {
  console.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
}

let dbInstance: any;
let authInstance: any;
let storageInstance: any;

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    authInstance = getAuth(app);
    storageInstance = getStorage(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export const db = dbInstance;
export const auth = authInstance;
export const storage = storageInstance;
