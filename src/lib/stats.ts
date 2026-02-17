import { db } from "./firebase";
import { doc, updateDoc, increment, getDoc, setDoc } from "@firebase/firestore";

const STATS_DOC_ID = "general";
const STATS_COLLECTION = "stats";

export interface StatsData {
    views: number;
    clicks: number;
    readers: number;
    timeOnBook: number; // in seconds
    shares: number;
    downloads: number;
}

// Helper to ensure the stats document exists
const ensureStatsDoc = async () => {
    const statsRef = doc(db, STATS_COLLECTION, STATS_DOC_ID);
    const snapshot = await getDoc(statsRef);
    if (!snapshot.exists()) {
        await setDoc(statsRef, {
            views: 0,
            clicks: 0,
            readers: 0,
            timeOnBook: 0,
            shares: 0,
            downloads: 0,
        });
    }
    return statsRef;
};

export const incrementView = async () => {
    const statsRef = await ensureStatsDoc();
    await updateDoc(statsRef, { views: increment(1) });
};

export const incrementClick = async () => {
    const statsRef = await ensureStatsDoc();
    await updateDoc(statsRef, { clicks: increment(1) });
};

export const incrementReader = async () => {
    // Check local storage to avoid double counting same user in a session
    const hasRead = sessionStorage.getItem("jumia_catalog_read");
    if (!hasRead) {
        const statsRef = await ensureStatsDoc();
        await updateDoc(statsRef, { readers: increment(1) });
        sessionStorage.setItem("jumia_catalog_read", "true");
    }
};

export const updateTimeOnBook = async (seconds: number) => {
    if (seconds <= 0) return;
    const statsRef = await ensureStatsDoc();
    await updateDoc(statsRef, { timeOnBook: increment(seconds) });
};

export const incrementShare = async () => {
    const statsRef = await ensureStatsDoc();
    await updateDoc(statsRef, { shares: increment(1) });
};

export const incrementDownload = async () => {
    const statsRef = await ensureStatsDoc();
    await updateDoc(statsRef, { downloads: increment(1) });
};

export const getStats = async (): Promise<StatsData | null> => {
    const statsRef = doc(db, STATS_COLLECTION, STATS_DOC_ID);
    const snapshot = await getDoc(statsRef);
    if (snapshot.exists()) {
        return snapshot.data() as StatsData;
    }
    return null;
};

export const incrementProductClick = async (productId: string | number) => {
    const id = productId.toString();
    const productRef = doc(db, "product_clicks", id);
    const snapshot = await getDoc(productRef);

    if (!snapshot.exists()) {
        await setDoc(productRef, { clicks: 1 });
    } else {
        await updateDoc(productRef, { clicks: increment(1) });
    }
};
