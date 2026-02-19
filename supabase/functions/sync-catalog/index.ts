import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"

// Configuration
const SHEET_URL = "https://docs.google.com/spreadsheets/d/12Wug9aedeK8vKebFVyXq8-QLCf7ciAXG47BzqYAuu_c/export?format=csv";
const FIREBASE_CONFIG = {
    // Replace with your Firebase credentials
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
};

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

serve(async (req) => {
    try {
        console.log("Starting catalog sync from Google Sheet...");

        // 1. Fetch CSV
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();

        const rows = csvText.split('\n').map(row => {
            const result = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    result.push(current.trim().replace(/^"|"$/g, ''));
                    current = "";
                } else current += char;
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        }).filter(row => row.length >= 6 && row[1] !== 'SKU');

        if (rows.length === 0) {
            return new Response(JSON.stringify({ message: "No rows found" }), { status: 200 });
        }

        // 2. Get current products
        const productsSnapshot = await getDocs(collection(db, "products"));
        const currentProducts = productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Process Rows (Smart Merge Logic)
        for (const row of rows) {
            const [category, sku, name, brand, oldPriceStr, newPriceStr] = row;
            const sheetOldPrice = parseInt(oldPriceStr.replace(/[^0-9]/g, '')) || 0;
            const sheetPrice = parseInt(newPriceStr.replace(/[^0-9]/g, '')) || 0;

            const existingProduct = currentProducts.find((p: any) => p.sku === sku);

            if (existingProduct) {
                const priceChangedInSheet = sheetPrice !== (existingProduct.lastSyncedPrice || 0);
                const oldPriceChangedInSheet = sheetOldPrice !== (existingProduct.lastSyncedOldPrice || 0);

                if (priceChangedInSheet || oldPriceChangedInSheet || !existingProduct.lastSyncedPrice) {
                    const updateData: any = {
                        category,
                        brand,
                        lastSyncedPrice: sheetPrice,
                        lastSyncedOldPrice: sheetOldPrice
                    };

                    if (priceChangedInSheet || !existingProduct.lastSyncedPrice) {
                        updateData.price = sheetPrice;
                        updateData.prices = {
                            price: sheetPrice,
                            oldPrice: oldPriceChangedInSheet || !existingProduct.lastSyncedOldPrice ? sheetOldPrice : (existingProduct.prices?.oldPrice || sheetOldPrice)
                        };
                    }

                    if (oldPriceChangedInSheet || !existingProduct.lastSyncedOldPrice) {
                        updateData.oldPrice = sheetOldPrice;
                    }

                    await updateDoc(doc(db, "products", existingProduct.id.toString()), updateData);
                }
            } else {
                // Handle new products if needed (would require Jumia fetch)
                console.log(`New SKU discovered: ${sku}. Use Admin panel to fetch Jumia data for new items first.`);
            }
        }

        // 4. Update Last Sync
        await updateDoc(doc(db, "settings", "catalog"), { lastSyncTimestamp: Date.now() });

        return new Response(JSON.stringify({ success: true, processed: rows.length }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
})
