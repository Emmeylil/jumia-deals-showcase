import { db } from "./src/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

async function countProducts() {
    const snapshot = await getDocs(collection(db, "products"));
    console.log(`Total products in Firestore: ${snapshot.size}`);
}

countProducts().catch(console.error);
