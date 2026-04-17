import { db } from "./firebase";
import { doc, updateDoc, increment, getDoc, setDoc, collection, onSnapshot, query, where, serverTimestamp, Timestamp, orderBy, limit, getDocs } from "firebase/firestore";


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
    await logDailyActivity('view');
};

export const incrementClick = async () => {
    const statsRef = await ensureStatsDoc();
    await updateDoc(statsRef, { clicks: increment(1) });
    await logDailyActivity('click');
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
    await logDailyActivity('share');
};

export const incrementDownload = async () => {
    const statsRef = await ensureStatsDoc();
    await updateDoc(statsRef, { downloads: increment(1) });
    await logDailyActivity('download');
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
    await logDailyActivity('click');
};

export const updatePresence = async (sessionId: string) => {
    const presenceRef = doc(db, "presence", sessionId);
    await setDoc(presenceRef, {
        lastSeen: serverTimestamp(),
    }, { merge: true });
};

export const listenToActiveReaders = (callback: (count: number) => void) => {
    // Consider active if seen in the last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const q = query(
        collection(db, "presence"),
        where("lastSeen", ">=", Timestamp.fromDate(twoMinutesAgo))
    );

    return onSnapshot(q, (snapshot) => {
        callback(snapshot.size);
    });
};

export const logSearchKeyword = async (keyword: string) => {
    if (!keyword || keyword.trim().length <= 1) return;
    const cleanKeyword = keyword.trim().toLowerCase();
    const keywordRef = doc(db, "search_keywords", cleanKeyword);
    const snapshot = await getDoc(keywordRef);

    if (!snapshot.exists()) {
        await setDoc(keywordRef, {
            keyword: cleanKeyword,
            count: 1,
            lastSearched: serverTimestamp()
        });
    } else {
        await updateDoc(keywordRef, {
            count: increment(1),
            lastSearched: serverTimestamp()
        });
    }
};

export const logCategorySearch = async (category: string) => {
    if (!category) return;
    const categoryRef = doc(db, "search_categories", category);
    const snapshot = await getDoc(categoryRef);

    if (!snapshot.exists()) {
        await setDoc(categoryRef, {
            category,
            count: 1,
            lastSearched: serverTimestamp()
        });
    } else {
        await updateDoc(categoryRef, {
            count: increment(1),
            lastSearched: serverTimestamp()
        });
    }
};

export const logSearchToProduct = async (keyword: string, productId: string | number, category?: string) => {
    if (!keyword) return;
    const cleanKeyword = keyword.trim().toLowerCase();
    const pid = productId.toString();
    const logId = `${cleanKeyword}_${pid}`;
    const logRef = doc(db, "search_analytics", logId);

    await setDoc(logRef, {
        keyword: cleanKeyword,
        productId: pid,
        category: category || "unknown",
        timestamp: serverTimestamp(),
        count: increment(1)
    }, { merge: true });
};

export const logDailyActivity = async (type: 'visit' | 'click' | 'view' | 'share' | 'download' = 'visit') => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const dailyRef = doc(db, "daily_stats", today);

        const snapshot = await getDoc(dailyRef);
        if (!snapshot.exists()) {
            await setDoc(dailyRef, {
                date: today,
                activeUsers: 0,
                totalClicks: 0,
                totalViews: 0,
                totalShares: 0,
                totalDownloads: 0,
                timestamp: serverTimestamp()
            });
        }

        if (type === 'visit') {
            const storageKey = `jumia_daily_active_${today}`;
            if (sessionStorage.getItem(storageKey)) return;
            await updateDoc(dailyRef, { activeUsers: increment(1) });
            sessionStorage.setItem(storageKey, "true");
        } else if (type === 'view') {
            const storageKey = `jumia_daily_view_${today}`;
            if (sessionStorage.getItem(storageKey)) return;
            await updateDoc(dailyRef, { totalViews: increment(1) });
            sessionStorage.setItem(storageKey, "true");
        } else if (type === 'click') {
            await updateDoc(dailyRef, { totalClicks: increment(1) });
        } else if (type === 'share') {
            await updateDoc(dailyRef, { totalShares: increment(1) });
        } else if (type === 'download') {
            await updateDoc(dailyRef, { totalDownloads: increment(1) });
        }
    } catch (error) {
        console.error("Error logging daily activity:", error);
    }
};

export const getDailyStats = async (days: number = 30) => {
    try {
        const dailyCollection = collection(db, "daily_stats");
        const q = query(
            dailyCollection,
            orderBy("date", "desc"),
            limit(days)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => doc.data())
            .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("Error fetching daily stats:", error);
        return [];
    }
};


// Firebase Analytics Function URL - Update this after deployment if necessary
const ANALYTICS_FUNC_URL = 'https://getanalytics-776751698383.europe-west2.run.app';

export interface AnalyticsResponse {
    success: boolean;
    summary: {
        totalViews: number;
        totalClicks: number;
        totalReaders: number;
        totalShares: number;
        totalDownloads: number;
        rangeActiveUsers: number;
        rangeTotalClicks: number;
        avgInteractionRate: number;
    };
    dailyData: any[];
}

export const fetchBackendAnalytics = async (startDate?: string, endDate?: string): Promise<AnalyticsResponse | null> => {
    try {
        const url = new URL(ANALYTICS_FUNC_URL);
        if (startDate) url.searchParams.append('startDate', startDate);
        if (endDate) url.searchParams.append('endDate', endDate);

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Analytics fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data as AnalyticsResponse;
    } catch (error) {
        console.error("Error fetching backend analytics:", error);
        return null;
    }
};
