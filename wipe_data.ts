import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// Parse .env file manually since import.meta.env isn't available in raw Node
const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let val = match[2] || '';
        val = val.replace(/^['"](.*)['"]$/, '$1').trim();
        env[match[1]] = val;
    }
});

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function wipeData() {
    console.log("Starting deletion of corrupted products...");
    try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);
        console.log(`Found ${snapshot.size} products.`);

        let count = 0;
        for (const productDoc of snapshot.docs) {
            // Delete product
            await deleteDoc(doc(db, "products", productDoc.id));
            count++;
        }
        console.log(`Deleted ${count} products.`);

        console.log("Resetting sheetCategoryOrder in settings/catalog...");
        await updateDoc(doc(db, "settings", "catalog"), {
            sheetCategoryOrder: []
        });
        console.log("Settings reset successfully.");
    } catch (error) {
        console.error("Error wiping data:", error);
    }
}

wipeData();
