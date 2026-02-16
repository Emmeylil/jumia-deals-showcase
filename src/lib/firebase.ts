import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCYHvsRT2seLKiJ2Puvxve3RC32cMTbQjA",
  authDomain: "digital-cataloge-81b8f.firebaseapp.com",
  projectId: "digital-cataloge-81b8f",
  storageBucket: "digital-cataloge-81b8f.firebasestorage.app",
  messagingSenderId: "117571270900",
  appId: "1:117571270900:web:32422a8b2f05af326986a1"
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
