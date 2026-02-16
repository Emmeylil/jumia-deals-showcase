import { db } from "./src/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "@firebase/firestore";

async function cleanupData() {
    const snapshot = await getDocs(collection(db, "products"));
    for (const productDoc of snapshot.docs) {
        const data = productDoc.data();
        let updated = false;
        let newImage = data.image;

        if (newImage && newImage.includes("/src/assets/products/")) {
            newImage = newImage.replace("/src/assets/products/", "/products/");
            updated = true;
        }

        if (updated) {
            console.log(`Updating ${productDoc.id}: ${data.image} -> ${newImage}`);
            await updateDoc(doc(db, "products", productDoc.id), {
                image: newImage
            });
        }
    }
}

cleanupData().catch(console.error);
