import * as admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "jumia-e-catalog"
    });
}

const db = admin.firestore();

async function inspectCollections() {
    console.log("--- Firebase Database Inspection ---");
    
    // 1. Check all root collections
    const collections = await db.listCollections();
    console.log(`Root Collections: ${collections.map(c => c.id).join(", ")}`);

    // 2. Sample daily_stats
    console.log("\n--- Daily Stats Sample ---");
    const dailySnap = await db.collection("daily_stats").orderBy("date", "desc").limit(10).get();
    if (dailySnap.empty) {
        console.log("No daily_stats documents found.");
    } else {
        dailySnap.forEach(doc => {
            console.log(`[${doc.id}] : ${JSON.stringify(doc.data())}`);
        });
    }

    // 3. Check stats/general
    console.log("\n--- General Stats ---");
    const generalSnap = await db.collection("stats").doc("general").get();
    if (generalSnap.exists) {
        console.log(JSON.stringify(generalSnap.data(), null, 2));
    } else {
        console.log("stats/general not found.");
    }

    // 4. Check for any "analytics" or "views" collections
    const otherPossibleCollections = ["analytics", "views", "sessions", "activity"];
    for (const name of otherPossibleCollections) {
        const snap = await db.collection(name).limit(1).get();
        if (!snap.empty) {
            console.log(`\n--- Found collection: ${name} ---`);
            snap.forEach(doc => console.log(`[${doc.id}] : ${JSON.stringify(doc.data())}`));
        }
    }
}

inspectCollections()
    .then(() => console.log("\nInspection Complete."))
    .catch(err => console.error("Inspection Error:", err));
