// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const FIREBASE_PROJECT_ID = "jumia-e-catalog";
const FIREBASE_API_KEY = "AIzaSyAK57O6YKG17sXSw0GovdLFN-B_FLrn19M";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Extract plain JS value from Firestore field value
function fromFirestoreValue(v: any): any {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
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
  const nameParts = (doc.name as string).split("/");
  data._id = nameParts[nameParts.length - 1];
  return data;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate'); // YYYY-MM-DD
    const endDate = searchParams.get('endDate');     // YYYY-MM-DD

    console.log(`Fetching analytics from ${startDate} to ${endDate}`);

    // Query Firestore daily_stats
    // We use a structured query to filter by date
    const queryUrl = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`;
    
    const structuredQuery = {
      structuredQuery: {
        from: [{ collectionId: "daily_stats" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              ...(startDate ? [{
                fieldFilter: {
                  field: { fieldPath: "date" },
                  op: "GREATER_THAN_OR_EQUAL",
                  value: { stringValue: startDate }
                }
              }] : []),
              ...(endDate ? [{
                fieldFilter: {
                  field: { fieldPath: "date" },
                  op: "LESS_THAN_OR_EQUAL",
                  value: { stringValue: endDate }
                }
              }] : [])
            ]
          }
        },
        orderBy: [{
          field: { fieldPath: "date" },
          direction: "ASCENDING"
        }]
      }
    };

    const res = await fetch(queryUrl, {
      method: "POST",
      body: JSON.stringify(structuredQuery)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Firestore query failed: ${err}`);
    }

    const results = await res.json();
    const dailyData = (results || [])
      .filter(entry => entry.document)
      .map(entry => fromFirestoreDoc(entry.document));

    // Also fetch overall stats for totals
    const statsRes = await fetch(`${FIRESTORE_BASE}/stats/general?key=${FIREBASE_API_KEY}`);
    const statsDoc = await statsRes.json();
    const generalStats = fromFirestoreDoc(statsDoc);

    // Calculate totals for the range
    const rangeTotals = dailyData.reduce((acc, current) => ({
      activeUsers: acc.activeUsers + (current.activeUsers || 0),
      totalClicks: acc.totalClicks + (current.totalClicks || 0),
    }), { activeUsers: 0, totalClicks: 0 });

    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
