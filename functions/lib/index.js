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
exports.syncCatalog = exports.imageProxy = exports.fetchJumiaSku = exports.getAnalytics = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
/**
 * 1. GET ANALYTICS
 * Aggregates dashboard data.
 */
exports.getAnalytics = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        let dailyQuery = db.collection("daily_stats").orderBy("date", "asc");
        if (startDate)
            dailyQuery = dailyQuery.where("date", ">=", startDate);
        if (endDate)
            dailyQuery = dailyQuery.where("date", "<=", endDate);
        const dailySnapshot = await dailyQuery.get();
        const dailyData = dailySnapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        const generalStatsDoc = await db.collection("stats").doc("general").get();
        const generalStats = generalStatsDoc.exists ? generalStatsDoc.data() || {} : {};
        const rangeTotals = dailyData.reduce((acc, current) => ({
            activeUsers: acc.activeUsers + (current.activeUsers || 0),
            totalClicks: acc.totalClicks + (current.totalClicks || 0),
        }), { activeUsers: 0, totalClicks: 0 });
        res.status(200).json({
            success: true,
            summary: {
                totalViews: generalStats.views || 0,
                totalClicks: generalStats.clicks || 0,
                totalReaders: generalStats.readers || 0,
                totalShares: generalStats.shares || 0,
                totalDownloads: generalStats.downloads || 0,
                rangeActiveUsers: rangeTotals.activeUsers,
                rangeTotalClicks: rangeTotals.totalClicks,
                avgInteractionRate: rangeTotals.activeUsers > 0
                    ? (rangeTotals.totalClicks / rangeTotals.activeUsers) * 100
                    : 0
            },
            dailyData
        });
        return;
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * 2. FETCH JUMIA SKU
 * Scrapes Jumia for product details.
 */
exports.fetchJumiaSku = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        const { sku } = req.body;
        if (!sku) {
            res.status(400).json({ success: false, error: 'SKU is required' });
            return;
        }
        const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(sku)}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) {
            res.status(502).json({ success: false, error: `Jumia error: ${response.status}` });
            return;
        }
        const html = await response.text();
        const patterns = [/"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"head"/, /"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"filters"/];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    const products = JSON.parse(match[1]);
                    if (products && products.length > 0) {
                        const product = products.find((p) => p.sku === sku) || products[0];
                        const price = typeof product.prices?.price === 'number' ? product.prices.price : 0;
                        res.json({
                            success: true,
                            data: {
                                sku: product.sku || sku,
                                displayName: product.displayName || product.name || '',
                                brand: product.brand || '',
                                image: product.image || '',
                                url: product.url || '',
                                prices: { price, oldPrice: product.prices?.oldPrice || Math.round(price * 1.2) }
                            }
                        });
                        return;
                    }
                }
                catch (e) {
                    continue;
                }
            }
        }
        res.status(404).json({ success: false, error: 'Product not found' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * 3. IMAGE PROXY
 * Proxies images to base64.
 */
exports.imageProxy = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) {
            res.status(400).json({ error: "Invalid URL" });
            return;
        }
        const response = await fetch(imageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("Content-Type") || "image/jpeg";
        const base64 = Buffer.from(buffer).toString('base64');
        res.json({ dataUrl: `data:${contentType};base64,${base64}` });
        return;
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * 4. SYNC CATALOG
 * Syncs Google Sheet data to Firestore.
 */
exports.syncCatalog = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 300 }, async (req, res) => {
    try {
        const SHEET_URL = "https://docs.google.com/spreadsheets/d/12Wug9aedeK8vKebFVyXq8-QLCf7ciAXG47BzqYAuu_c/export?format=csv";
        const csvRes = await fetch(SHEET_URL);
        const csvText = await csvRes.text();
        const rows = csvText.split('\n').slice(1).map(line => line.split(',')); // Simplistic parser
        let updated = 0;
        const productsSnap = await db.collection("products").get();
        const existingProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const row of rows) {
            if (row.length < 5)
                continue;
            const sku = row[1]?.trim();
            const price = parseInt(row[5]?.replace(/[^\d]/g, '')) || 0;
            const existing = existingProducts.find(p => p.sku === sku);
            if (existing) {
                await db.collection("products").doc(existing.id).update({
                    lastSyncedPrice: price,
                    "prices.price": price
                });
                updated++;
            }
        }
        await db.collection("settings").doc("catalog").set({ lastSyncTimestamp: Date.now() }, { merge: true });
        res.json({ success: true, updated });
        return;
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=index.js.map