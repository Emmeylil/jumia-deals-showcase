import { db } from "./src/lib/firebase";
import { collection, getDocs } from "@firebase/firestore";

async function checkIds() {
    const snapshot = await getDocs(collection(db, "products"));
    snapshot.forEach(doc => {
        if (isNaN(parseInt(doc.id))) {
            console.log(`WARNING: Non-numeric Doc ID found: ${doc.id}`);
        } else {
            console.log(`Numeric Doc ID: ${doc.id}`);
        }
    });
}

checkIds().catch(console.error);
