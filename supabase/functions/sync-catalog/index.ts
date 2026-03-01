// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SHEET_URL = "https://docs.google.com/spreadsheets/d/12Wug9aedeK8vKebFVyXq8-QLCf7ciAXG47BzqYAuu_c/export?format=csv";
const FIREBASE_PROJECT_ID = "jumia-e-catalog";
const FIREBASE_API_KEY = "AIzaSyAK57O6YKG17sXSw0GovdLFN-B_FLrn19M";

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ---- Firestore REST helpers ----

async function firestoreGet(path: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`);
  if (!res.ok) return null;
  return res.json();
}

async function firestoreList(collection: string) {
  const url = `${FIRESTORE_BASE}/${collection}?key=${FIREBASE_API_KEY}&pageSize=1000`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents ?? [];
}

async function firestorePatch(path: string, fields: Record<string, any>, updateMask: string[]) {
  const mask = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
  const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}&${mask}`;
  const body = { fields: toFirestoreFields(fields) };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// Convert plain JS object → Firestore field value map
function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) { out[k] = { nullValue: null }; continue; }
    if (typeof v === "boolean") { out[k] = { booleanValue: v }; continue; }
    if (typeof v === "number") { out[k] = { integerValue: String(Math.round(v)) }; continue; }
    if (typeof v === "string") { out[k] = { stringValue: v }; continue; }
    if (typeof v === "object" && !Array.isArray(v)) {
      out[k] = { mapValue: { fields: toFirestoreFields(v) } }; continue;
    }
  }
  return out;
}

// Extract plain JS value from Firestore field value
function fromFirestoreValue(v: any): any {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) {
    const fields = v.mapValue.fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, fv]) => [k, fromFirestoreValue(fv)]));
  }
  return null;
}

function fromFirestoreDoc(doc: any) {
  const fields = doc.fields ?? {};
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    data[k] = fromFirestoreValue(v as any);
  }
  // Extract doc id from name path
  const nameParts = (doc.name as string).split("/");
  data._id = nameParts[nameParts.length - 1];
  return data;
}

// ---- CSV helpers ----

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      current = "";
    } else { current += char; }
  }
  result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  return result;
}

const cleanPrice = (val: string) => {
  if (!val) return 0;
  const digits = val.replace(/[^\d.]/g, '');
  if (!digits) return 0;
  const n = parseFloat(digits);
  return isNaN(n) ? 0 : Math.round(n);
};

// ---- Main handler ----

serve(async (_req: Request) => {
  try {
    console.log("Starting catalog sync via REST...");

    // Fetch Google Sheet CSV
    const csvRes = await fetch(SHEET_URL);
    const csvText = await csvRes.text();
    const lines = csvText.split('\n');

    // Parse header
    const headerRow = parseCsvLine(lines[0]);
    const colMap: Record<string, number> = {};
    headerRow.forEach((col, idx) => {
      const norm = col.toLowerCase().replace(/[^a-z]/g, '');
      if (norm === 'category') colMap.category = idx;
      else if (norm === 'sku') colMap.sku = idx;
      else if (norm === 'productname' || norm === 'name') colMap.name = idx;
      else if (norm === 'brandname' || norm === 'brand') colMap.brand = idx;
      else if (norm === 'oldprice') colMap.oldPrice = idx;
      else if (norm === 'newprice' || norm === 'price') colMap.price = idx;
    });

    const mapping = {
      category: colMap.category ?? 0,
      sku: colMap.sku ?? 1,
      name: colMap.name ?? 2,
      brand: colMap.brand ?? 3,
      oldPrice: colMap.oldPrice ?? 4,
      price: colMap.price ?? 5,
    };

    // Fetch existing products
    const docs = await firestoreList("products");
    const currentProducts = docs.map(fromFirestoreDoc);

    // Process rows
    const rows = lines.slice(1).map(parseCsvLine).filter(row => row.length > 2 && row[mapping.sku]);
    let updated = 0;

    for (const row of rows) {
      const sku = row[mapping.sku];
      const brandSafe = (row[mapping.brand] || "").trim();
      const nameSafe = (row[mapping.name] || "Unnamed Product").trim();
      const sheetOldPrice = cleanPrice(row[mapping.oldPrice]);
      const sheetPrice = cleanPrice(row[mapping.price]);

      const existing = currentProducts.find(p => p.sku === sku);
      if (!existing) continue;

      const priceChanged = sheetPrice !== (existing.lastSyncedPrice ?? -1);
      const oldPriceChanged = sheetOldPrice !== (existing.lastSyncedOldPrice ?? -1);
      const brandChanged = brandSafe !== (existing.brand ?? "");

      if (priceChanged || oldPriceChanged || brandChanged || typeof existing.lastSyncedPrice === 'undefined') {
        const nameToUse = existing.name || nameSafe;
        const displayName = (brandSafe && !nameToUse.toLowerCase().startsWith(brandSafe.toLowerCase()))
          ? `${brandSafe} ${nameToUse}`
          : nameToUse;

        const updateData: Record<string, any> = {
          brand: brandSafe,
          displayName,
          lastSyncedPrice: sheetPrice,
          lastSyncedOldPrice: sheetOldPrice,
          prices: {
            price: priceChanged ? sheetPrice : (existing.price ?? sheetPrice),
            oldPrice: oldPriceChanged ? sheetOldPrice : (existing.oldPrice ?? sheetOldPrice),
          },
        };

        if (priceChanged) updateData.price = sheetPrice;
        if (oldPriceChanged) updateData.oldPrice = sheetOldPrice;

        const docPath = `products/${existing._id}`;
        const fields = Object.keys(updateData);
        await firestorePatch(docPath, updateData, fields);
        updated++;
      }
    }

    // Update lastSyncTimestamp on settings/catalog
    await firestorePatch("settings/catalog", { lastSyncTimestamp: Date.now() }, ["lastSyncTimestamp"]);

    return new Response(
      JSON.stringify({ success: true, processed: rows.length, updated }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
