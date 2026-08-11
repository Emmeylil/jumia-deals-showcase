import { db } from "./src/lib/firebase";
import { doc, updateDoc } from "@firebase/firestore";

async function resetCategories() {
    try {
        console.log("Resetting sheetCategoryOrder in Firebase...");
        await updateDoc(doc(db, "settings", "catalog"), {
            sheetCategoryOrder: []
        });
        console.log("Successfully reset categories.");
    } catch (error) {
        console.error("Error resetting categories:", error);
    }
}

resetCategories();
