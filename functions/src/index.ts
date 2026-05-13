import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * 1. GET ANALYTICS
 * Aggregates dashboard data.
 */
export const getAnalytics = onRequest({ cors: true }, async (req: any, res: any) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let dailyQuery: admin.firestore.Query = db.collection("daily_stats").orderBy("date", "asc");

    if (startDate) dailyQuery = dailyQuery.where("date", ">=", startDate);
    if (endDate) dailyQuery = dailyQuery.where("date", "<=", endDate);

    const dailySnapshot = await dailyQuery.get();
    const dailyData = dailySnapshot.docs.map((doc: any) => ({ _id: doc.id, ...doc.data() }));

    const generalStatsDoc = await db.collection("stats").doc("general").get();
    const generalStats = generalStatsDoc.exists ? generalStatsDoc.data() || {} : {};

    const rangeTotals = dailyData.reduce((acc: any, current: any) => ({
      activeUsers: acc.activeUsers + (current.activeUsers || 0),
      totalClicks: acc.totalClicks + (current.totalClicks || 0),
      totalViews: acc.totalViews + (current.totalViews || 0),
      totalShares: acc.totalShares + (current.totalShares || 0),
      totalDownloads: acc.totalDownloads + (current.totalDownloads || 0),
    }), { activeUsers: 0, totalClicks: 0, totalViews: 0, totalShares: 0, totalDownloads: 0 });

    const isFiltered = !!(startDate || endDate);

    res.status(200).json({
      success: true,
      summary: {
        totalViews: isFiltered ? rangeTotals.totalViews : (generalStats.views || 0),
        totalClicks: isFiltered ? rangeTotals.totalClicks : (generalStats.clicks || 0),
        totalReaders: isFiltered ? rangeTotals.activeUsers : (generalStats.readers || 0),
        totalShares: isFiltered ? rangeTotals.totalShares : (generalStats.shares || 0),
        totalDownloads: isFiltered ? rangeTotals.totalDownloads : (generalStats.downloads || 0),
        rangeActiveUsers: rangeTotals.activeUsers,
        rangeTotalClicks: rangeTotals.totalClicks,
        avgInteractionRate: rangeTotals.activeUsers > 0 
          ? (rangeTotals.totalClicks / rangeTotals.activeUsers) * 100 
          : 0
      },
      dailyData
    });
    return;
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 2. FETCH JUMIA SKU
 * Scrapes Jumia for product details.
 */
export const fetchJumiaSku = onRequest({ cors: true }, async (req: any, res: any) => {
  try {
    const { sku } = req.body;
    if (!sku) {
      res.status(400).json({ success: false, error: 'SKU is required' });
      return;
    }

    const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(sku)}`;
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      res.status(502).json({ success: false, error: `Jumia error: ${response.status}` });
      return;
    }

    const html = await response.text();
    
    // Robust extraction: find the products array using bracket balancing
    const startMarker = '"products":[';
    const startIdx = html.indexOf(startMarker);
    
    if (startIdx !== -1) {
      try {
        const arrayStart = html.indexOf('[', startIdx); // Find the first [ after "products"
        if (arrayStart === -1) throw new Error('Array start not found');
        
        let depth = 0;
        let endIdx = -1;
        
        for (let i = arrayStart; i < html.length; i++) {
          if (html[i] === '[') depth++;
          else if (html[i] === ']') {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }

        if (endIdx !== -1) {
          const jsonStr = html.substring(arrayStart, endIdx);
          const products = JSON.parse(jsonStr);
          
          if (products && products.length > 0) {
            const requestedSku = sku.toLowerCase().trim();
            const product = products.find((p: any) => 
              p.sku?.toLowerCase().trim() === requestedSku || 
              p.sku?.toLowerCase().trim().includes(requestedSku)
            ) || products[0];
            
            // Only use this if it's actually the SKU we want, or if we're just doing a general search
            if (product.sku?.toLowerCase().trim().includes(requestedSku) || products.length > 1) {
              const price = typeof product.prices?.price === 'number' ? product.prices.price : 0;
              res.json({
                success: true,
                data: {
                  sku: product.sku || sku,
                  displayName: product.displayName || product.name || '',
                  brand: product.brand || '',
                  image: product.image || '',
                  url: product.url || '',
                  prices: { 
                    price, 
                    oldPrice: product.prices?.oldPrice || Math.round(price * 1.2) 
                  }
                }
              });
              return;
            }
          }
        }
      } catch (e: any) {
        console.error('Extraction error:', e.message);
      }
    }

    // Fallback: Try JSON-LD (common on detail pages if redirected)
    try {
      const ldMarker = 'application/ld+json';
      const ldIndex = html.indexOf(ldMarker);
      if (ldIndex !== -1) {
        const startIdx = html.indexOf('{', ldIndex);
        let depth = 0;
        let endIdx = -1;
        for (let i = startIdx; i < html.length; i++) {
          if (html[i] === '{') depth++;
          else if (html[i] === '}') {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        
        if (endIdx !== -1) {
          const ldData = JSON.parse(html.substring(startIdx, endIdx));
          const requestedSku = sku.toLowerCase().trim();
          const product = ldData["@graph"]?.find((item: any) => 
            item["@type"] === "Product" && 
            (item.sku?.toLowerCase().trim().includes(requestedSku) || requestedSku.includes(item.sku?.toLowerCase().trim() || ''))
          ) || (ldData["@type"] === "Product" ? ldData : null);
          
          if (product) {
            const price = parseFloat(product.offers?.price || "0");
            const image = Array.isArray(product.image?.contentUrl) ? product.image.contentUrl[0] : (product.image?.contentUrl || product.image || '');
            
            res.json({
              success: true,
              data: {
                sku: product.sku || sku,
                displayName: product.name || '',
                brand: product.brand?.name || product.brand || '',
                image: image,
                url: product.url || '',
                prices: { 
                  price, 
                  oldPrice: Math.round(price * 1.2) 
                }
              }
            });
            return;
          }
        }
      }
    } catch (e: any) {
      console.error('LD-JSON extraction error:', e.message);
    }
    
    res.status(404).json({ success: false, error: 'Product not found in Jumia data' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. IMAGE PROXY
 * Proxies images to base64.
 */
export const imageProxy = onRequest({ cors: true }, async (req: any, res: any) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4. SYNC CATALOG
 * Syncs Google Sheet data to Firestore.
 */
export const syncCatalog = onRequest({ cors: true, timeoutSeconds: 300 }, async (req: any, res: any) => {
  try {
    const SHEET_URL = "https://docs.google.com/spreadsheets/d/12Wug9aedeK8vKebFVyXq8-QLCf7ciAXG47BzqYAuu_c/export?format=csv";
    const csvRes = await fetch(SHEET_URL);
    const csvText = await csvRes.text();
    const rows = csvText.split('\n').slice(1).map(line => line.split(',')); // Simplistic parser

    let updated = 0;
    const productsSnap = await db.collection("products").get();
    const existingProducts = productsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() as any }));

    for (const row of rows) {
      if (row.length < 5) continue;
      const sku = row[1]?.trim();
      const price = parseInt(row[5]?.replace(/[^\d]/g, '')) || 0;
      const existing = existingProducts.find((p: any) => p.sku === sku);

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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
