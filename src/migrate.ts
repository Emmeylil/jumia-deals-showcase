import { db } from "./lib/firebase";
import { collection, doc, setDoc, getDocs } from "@firebase/firestore";
import { products } from "./data/products";

async function migrateProducts() {
    const productsCol = collection(db, "products");
    const snapshot = await getDocs(productsCol);

    if (snapshot.empty) {
        console.log("Migrating products to Firestore...");
        for (const product of products) {
            const enrichedProduct = {
                ...product,
                displayName: product.name,
                sku: `SKU-${product.id}`, // Placeholder SKU for static data
                url: "",
                prices: {
                    price: product.price,
                    oldPrice: product.oldPrice
                }
            };
            await setDoc(doc(db, "products", product.id.toString()), enrichedProduct);
        }
        console.log("Migration complete!");
    } else {
        console.log("Products already exist in Firestore.");
    }
}

migrateProducts().catch(console.error);
