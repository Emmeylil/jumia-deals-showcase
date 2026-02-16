import { db } from "./src/lib/firebase";
import { collection, getDocs, query, limit } from "@firebase/firestore";

async function checkData() {
    const q = query(collection(db, "products"), limit(5));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        console.log(`Doc ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
        console.log("---");
    });
}

checkData().catch(console.error);
