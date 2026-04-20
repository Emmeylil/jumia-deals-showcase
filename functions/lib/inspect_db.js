"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
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
    }
    else {
        dailySnap.forEach(doc => {
            console.log(`[${doc.id}] : ${JSON.stringify(doc.data())}`);
        });
    }
    // 3. Check stats/general
    console.log("\n--- General Stats ---");
    const generalSnap = await db.collection("stats").doc("general").get();
    if (generalSnap.exists) {
        console.log(JSON.stringify(generalSnap.data(), null, 2));
    }
    else {
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
//# sourceMappingURL=inspect_db.js.map