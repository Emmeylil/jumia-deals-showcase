import { initializeApp } from "@firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "@firebase/firestore";
import { getAuth } from "@firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAK57O6YKG17sXSw0GovdLFN-B_FLrn19M",
  authDomain: "jumia-e-catalog.firebaseapp.com",
  projectId: "jumia-e-catalog",
  storageBucket: "jumia-e-catalog.firebasestorage.app",
  messagingSenderId: "776751698383",
  appId: "1:776751698383:web:e18138daae9c4564a402ba"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code === 'unimplemented') {
      console.warn("The current browser does not support all of the features required to enable persistence.");
    }
  });
}
