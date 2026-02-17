import { db } from "./src/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "@firebase/firestore";

async function deleteAllProducts() {
    console.log("Starting deletion of all products...");
    try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);

        if (snapshot.empty) {
            console.log("No products found to delete.");
            return;
        }

        console.log(`Found ${snapshot.size} products. Deleting...`);

        // Create an array of delete promises to run them concurrently (or in batches if needed, but simple loop is fine for small datasets)
        const deletePromises = snapshot.docs.map(async (productDoc) => {
            await deleteDoc(doc(db, "products", productDoc.id));
            console.log(`Deleted product: ${productDoc.id}`);
        });

        await Promise.all(deletePromises);
        console.log("All products deleted successfully.");

    } catch (error) {
        console.error("Error deleting products:", error);
    }
}

// Execute the function
deleteAllProducts();
