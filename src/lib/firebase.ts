import { initializeApp } from "@firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "@firebase/firestore";
import { getAuth } from "@firebase/auth";
import { getStorage } from "@firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAK57O6YKG17sXSw0GovdLFN-B_FLrn19M",
  authDomain: "jumia-e-catalog.firebaseapp.com",
  projectId: "jumia-e-catalog",
  storageBucket: "jumia-e-catalog.firebasestorage.app",
  messagingSenderId: "776751698383",
  appId: "1:776751698383:web:e18138daae9c4564a402ba"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with modern persistent cache settings (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
export const storage = getStorage(app);
