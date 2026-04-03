import { useState, useEffect, useRef, useMemo } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Product, formatPrice } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import CatalogHeader from "@/components/CatalogHeader";
import { fetchJumiaProductBySku } from "@/lib/jumia";
import { Plus, Search, Loader2, Trash2, Save, Edit2, BarChart3, MousePointer2, Users, Clock, Share2, Download, Trophy, RefreshCw, LogOut } from "lucide-react";
import { getStats, type StatsData, listenToActiveReaders, getDailyStats, fetchBackendAnalytics, type AnalyticsResponse } from "@/lib/stats";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/constants";
import { autoCategorizeProduct } from "@/lib/search-utils";
import { FeatureRequest, Announcement, RequestStatus, RequestTopic } from "@/types/feedback";
import { addUTMParameters } from "@/lib/utils";

import BannerCard from "@/components/BannerCard";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";

interface FetchedProduct {
  name: string;
  displayName: string;
  brand?: string;
  image: string;
  url: string;
  sku: string;
  price: number;
  oldPrice: number;
  selected: boolean;
}

interface Banner {
  image: string;
  url?: string;
}

interface CatalogSettings {
  frontPage: {
    title: string;
    subtitle: string;
    tagline: string;
    footerText: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundImage?: string;
    backgroundColor?: string;
  };
  backPage: {
    title: string;
    subtitle?: string; // Add if needed by UI
    description: string;
    qrCodeUrl: string;
    callToAction: string;
    footerText: string;
    backgroundImage?: string;
    backgroundColor?: string;
  };
  innerPages: {
    backgroundImage?: string;
    leftPageBackgroundColor?: string;
    rightPageBackgroundColor?: string;
  };
  banners?: Record<string, Banner>;
  brandLogos?: Array<{ name: string; logoUrl: string; linkUrl: string; page: 1 | 2 }>;
  pinnedProductId?: number | null;
  lastSyncTimestamp?: number;
  autoSyncInterval?: number; // in hours
};

const DEFAULT_SETTINGS: CatalogSettings = {
  frontPage: {
    title: "HOTTEST",
    subtitle: "DEALS!",
    tagline: "Digital Catalog 2026",
    footerText: "CLICK TO OPEN",
    primaryColor: "#FF9900",
    secondaryColor: "#009FE3",
    backgroundImage: "",
    backgroundColor: "#ffffff",
  },
  backPage: {
    title: "Don't Miss Out!",
    description: "Visit Jumia.com.ng for even more amazing deals on all your favorite brands.",
    qrCodeUrl: "https://jumia.com.ng",
    callToAction: "Scan to shop now",
    footerText: "JUMIA © 2026",
    backgroundImage: "",
    backgroundColor: "#f5f5f5",
  },
  innerPages: {
    backgroundImage: "",
    leftPageBackgroundColor: "",
    rightPageBackgroundColor: "",
  },
  banners: {},
  brandLogos: [],
  lastSyncTimestamp: 0,
  autoSyncInterval: 6, // default 6 hours
};

const InteractionRateGraph = ({ data }: { data: any[] }) => {
  const chartData = useMemo(() => {
    return data.map(day => ({
      ...day,
      interactionRate: day.activeUsers > 0 ? (day.totalClicks / day.activeUsers) * 100 : 0
    }));
  }, [data]);

  if (!chartData || chartData.length === 0) return (
    <div className="h-[200px] flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
      <p className="text-sm text-gray-400 font-medium italic">Collect more data to see interaction trends...</p>
    </div>
  );

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="1 1" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }}
            tickFormatter={(str) => {
              const d = new Date(str);
              return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
            }}
            minTickGap={20}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }}
            tickFormatter={(val) => `${Math.round(val)}%`}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Interaction Rate"]}
            labelFormatter={(label) => new Date(label).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
          />
          <Line
            type="monotone"
            dataKey="interactionRate"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            name="Interaction Rate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const Admin = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingSku, setFetchingSku] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  // Bulk SKU state
  const [skuInput, setSkuInput] = useState("");
  const [fetchedProducts, setFetchedProducts] = useState<FetchedProduct[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  // Editing state for existing products
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editOldPrice, setEditOldPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [activeReaders, setActiveReaders] = useState(0);
  const [productClicks, setProductClicks] = useState<Array<{ id: string, clicks: number, product?: Product }>>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // New Analytics State
  const [analyticsRange, setAnalyticsRange] = useState<"7D" | "30D" | "All Time" | "CUSTOM">("7D");
  const [backendAnalytics, setBackendAnalytics] = useState<AnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });


  // Catalog Settings state
  const [catalogSettings, setCatalogSettings] = useState<CatalogSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(catalogSettings);
  const [activeTab, setActiveTab] = useState<"products" | "settings" | "banners" | "brandlogos" | "analytics" | "ideas" | "roadmap" | "announcements">("products");
  const [uploading, setUploading] = useState(false);

  // Ideas & Roadmap State
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  // Dynamic Categories
  const availableCategories = useMemo(() => {
    const categories = (products || [])
      .filter(p => p.category)
      .map(p => p.category);
    // Merge with predefined categories to ensure they are always options
    const allUnique = Array.from(new Set([...categories, ...PRODUCT_CATEGORIES]));
    return allUnique.sort();
  }, [products]);

  // Keep ref in sync with state for async access
  useEffect(() => {
    settingsRef.current = catalogSettings;
  }, [catalogSettings]);

  const handleImageUpload = async (file: File, type: 'front' | 'back' | 'inner' | 'banner', spreadId?: string) => {
    if (!file) return;

    // Size validation: 200kb = 200 * 1024 bytes
    if (file.size > 200 * 1024) {
      toast.error("Image exceeds 200kb limit. Please compress it.");
      return;
    }

    try {
      setUploading(true);
      const storageRef = ref(storage, `settings/${type}-page-bg-${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      // Use the ref to get the absolute latest state, ensuring no overwrites of concurrent edits
      const currentSettings = settingsRef.current;

      let newSettings: CatalogSettings;
      if (type === 'front') {
        newSettings = {
          ...currentSettings,
          frontPage: {
            ...currentSettings.frontPage,
            backgroundImage: url
          }
        };
      } else if (type === 'back') {
        newSettings = {
          ...currentSettings,
          backPage: {
            ...currentSettings.backPage,
            backgroundImage: url
          }
        };
      } else if (type === 'inner') {
        newSettings = {
          ...currentSettings,
          innerPages: {
            ...currentSettings.innerPages,
            backgroundImage: url
          }
        };
      } else if (type === 'banner' && spreadId) {
        newSettings = {
          ...currentSettings,
          banners: {
            ...(currentSettings.banners || {}),
            [spreadId]: {
              ...(currentSettings.banners?.[spreadId] || {}),
              image: url
            }
          }
        };
      } else {
        return; // Should not happen
      }

      setCatalogSettings(newSettings);
      await setDoc(doc(db, "settings", "catalog"), newSettings, { merge: true });
      toast.success(`${type === 'banner' ? 'Banner' : type === 'front' ? 'Front' : type === 'back' ? 'Back' : 'Inner'} uploaded and saved!`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    // Fetch stats
    const fetchStatsData = async () => {
      const data = await getStats();
      setStats(data);

      // Fetch product leaderboard
      const clicksRef = collection(db, "product_clicks");
      const q = query(clicksRef, orderBy("clicks", "desc"), limit(5));
      const snapshot = await getDocs(q);
      const clicksData = snapshot.docs.map(doc => ({
        id: doc.id,
        clicks: doc.data().clicks
      }));
      setProductClicks(clicksData);

      // Fetch daily active user stats
      const dailyData = await getDailyStats(14); // Last 14 days
      setDailyStats(dailyData);
    };

    fetchStatsData();

    // Fetch settings
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "catalog");
        const docSnap = await getDocs(query(collection(db, "settings"))); // Temporary check
      } catch (e) {
        console.error("Error fetching settings:", e);
      }
    };

    // Using onSnapshot for real-time updates on settings
    const settingsUnsub = onSnapshot(doc(db, "settings", "catalog"), (snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCatalogSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          frontPage: { ...DEFAULT_SETTINGS.frontPage, ...(data.frontPage || {}) },
          backPage: { ...DEFAULT_SETTINGS.backPage, ...(data.backPage || {}) },
          innerPages: { ...DEFAULT_SETTINGS.innerPages, ...(data.innerPages || {}) },
          banners: data.banners !== undefined ? data.banners : DEFAULT_SETTINGS.banners,
          brandLogos: data.brandLogos !== undefined ? data.brandLogos : DEFAULT_SETTINGS.brandLogos,
        } as CatalogSettings);
      } else {
        setDoc(snapshot.ref, DEFAULT_SETTINGS);
      }
    });

    // Fetch products
    const productQuery = query(collection(db, "products"), orderBy("id"), limit(100));
    const productsUnsub = onSnapshot(productQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: parseInt(doc.id),
        })) as Product[];
        setProducts(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        toast.error("Failed to load products. Check your connection.");
        setLoading(false);
      }
    );

    // Listen to active readers in real-time
    const presenceUnsub = listenToActiveReaders((count) => {
      setActiveReaders(count);
    });

    // Listen to feature requests (Ideas)
    setIdeasLoading(true);
    const requestsQuery = query(collection(db, "feature_requests"), orderBy("createdAt", "desc"));
    const requestsUnsub = onSnapshot(requestsQuery, (snapshot) => {
      setFeatureRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeatureRequest)));
      setIdeasLoading(false);
    });

    // Listen to announcements
    setAnnouncementsLoading(true);
    const announcementsQuery = query(collection(db, "announcements"), orderBy("date", "desc"));
    const announcementsUnsub = onSnapshot(announcementsQuery, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
      setAnnouncementsLoading(false);
    });

    return () => {
      settingsUnsub();
      productsUnsub();
      presenceUnsub();
      requestsUnsub();
      announcementsUnsub();
    };
  }, []);

  // Fetch Backend Analytics Effect
  useEffect(() => {
    if (activeTab !== 'analytics') return;

    const loadAnalytics = async () => {
      setIsLoadingAnalytics(true);
      let start: string | undefined;
      let end: string | undefined;

      const now = new Date();
      if (analyticsRange === "7D") {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
      } else if (analyticsRange === "30D") {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
      } else if (analyticsRange === "CUSTOM") {
        start = customRange.start;
        end = customRange.end;
      }
      // "All Time" leaves start/end undefined

      const data = await fetchBackendAnalytics(start, end);
      if (data) {
        setBackendAnalytics(data);
      }
      setIsLoadingAnalytics(false);
    };

    loadAnalytics();
  }, [activeTab, analyticsRange, customRange]);

  // Auto-sync trigger
  useEffect(() => {
    if (loading || !catalogSettings?.autoSyncInterval) return;

    const lastSync = catalogSettings.lastSyncTimestamp || 0;
    const intervalMs = catalogSettings.autoSyncInterval * 3600 * 1000;

    if (Date.now() - lastSync >= intervalMs) {
      console.log("Auto-syncing from Admin...");
      handleSyncFromSheet(true);
    }
  }, [loading, catalogSettings?.autoSyncInterval, catalogSettings?.lastSyncTimestamp]);


  const handleBulkFetch = async () => {
    const skus = skuInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (skus.length === 0) return toast.error("Enter at least one SKU");
    setFetchingSku(true);
    setFetchedProducts([]);

    const results: FetchedProduct[] = [];

    for (const sku of skus) {
      try {
        const data = await fetchJumiaProductBySku(sku);
        if (data) {
          results.push({
            name: data.displayName || "",
            displayName: data.displayName || "",
            brand: data.brand,
            image: data.image || "",
            url: data.url || "",
            sku: data.sku || sku,
            price: data.prices?.price || 0,
            oldPrice: data.prices?.oldPrice || 0,
            selected: true,
          });
        } else {
          results.push({
            name: `Not found: ${sku}`,
            displayName: "",
            image: "",
            url: "",
            sku,
            price: 0,
            oldPrice: 0,
            selected: false,
          });
        }
      } catch {
        results.push({
          name: `Error: ${sku}`,
          displayName: "",
          image: "",
          url: "",
          sku,
          price: 0,
          oldPrice: 0,
          selected: false,
        });
      }
    }

    setFetchedProducts(results);
    setFetchingSku(false);
    toast.success(`Fetched ${results.filter((r) => r.displayName).length} of ${skus.length} products`);
  };

  const toggleFetchedProduct = (idx: number) => {
    setFetchedProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p))
    );
  };

  const updateFetchedProduct = (idx: number, field: keyof FetchedProduct, value: any) => {
    setFetchedProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const handleAddSelected = async () => {
    const toAdd = fetchedProducts.filter((p) => p.selected && p.displayName);
    if (toAdd.length === 0) return toast.error("No valid products selected");

    try {
      let nextId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;

      for (const item of toAdd) {
        const productData: Product = {
          id: nextId,
          sku: item.sku,
          name: item.displayName,
          displayName: item.displayName,
          image: item.image,
          url: item.url.startsWith("http") ? item.url : `https://www.jumia.com.ng${item.url.startsWith("/") ? "" : "/"}${item.url}`,
          price: item.price,
          oldPrice: item.oldPrice || Math.round(item.price * 1.2),
          prices: {
            price: item.price,
            oldPrice: item.oldPrice || Math.round(item.price * 1.2),
          },
          searchTags: "",
        };
        await setDoc(doc(db, "products", nextId.toString()), productData);
        nextId++;
      }

      toast.success(`Added ${toAdd.length} product(s) to catalog!`);
      setFetchedProducts([]);
      setSkuInput("");
    } catch (error) {
      toast.error("Failed to add products");
    }
  };

  const handleSyncFromSheet = async (isAuto = false) => {
    if (!isAuto && !confirm("This will fetch products from the Google Sheet and attempt to update the catalog. Manual edits will be preserved unless the sheet value has changed. Continue?")) return;

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0 });

    try {
      const sheetUrl = import.meta.env.VITE_SHEET_URL;
      if (!sheetUrl) throw new Error("Sheet URL not configured");
      const response = await fetch(sheetUrl);
      const csvText = await response.text();

      const lines = csvText.split('\n');
      if (lines.length === 0) throw new Error("Empty spreadsheet");

      // Robust CSV parser
      const parseCsvLine = (line: string) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = "";
          } else current += char;
        }
        result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        return result;
      };

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

      // Default mapping if headers missing
      const mapping = {
        category: colMap.category ?? 0,
        sku: colMap.sku ?? 1,
        name: colMap.name ?? 2,
        brand: colMap.brand ?? 3,
        oldPrice: colMap.oldPrice ?? 4,
        price: colMap.price ?? 5
      };

      const rows = lines.slice(1).map(parseCsvLine).filter(row => row.length > 2 && row[mapping.sku]);

      if (rows.length === 0) {
        if (!isAuto) toast.error("No valid product rows found");
        setIsSyncing(false);
        return;
      }

      setSyncProgress({ current: 0, total: rows.length });
      const currentProducts = [...products];
      let nextId = currentProducts.length > 0 ? Math.max(...currentProducts.map(p => p.id)) + 1 : 1;

      // Price cleaner: handles "65,340", "₦55,000.00", etc.
      const cleanPrice = (val: string) => {
        if (!val) return 0;
        const digits = val.replace(/[^\d.]/g, '');
        if (!digits) return 0;
        const numeric = parseFloat(digits);
        return isNaN(numeric) ? 0 : Math.round(numeric);
      };

      for (const row of rows) {
        const sku = row[mapping.sku];
        const sheetCategory = row[mapping.category] || "";
        const nameFromSheet = row[mapping.name] || "Unnamed Product";
        const brandFromSheet = (row[mapping.brand] || "").trim();
        const sheetOldPrice = cleanPrice(row[mapping.oldPrice]);
        const sheetPrice = cleanPrice(row[mapping.price]);

        // Intelligent Categorization: Trust the sheet if provided natively!
        // If Sheet Column A has text, we use it exactly as provided.
        // If Sheet Column A is empty, we fall back to auto-categorization.
        const categoryToUse = sheetCategory.trim() !== ""
          ? sheetCategory.trim()
          : autoCategorizeProduct(nameFromSheet);

        const existingProduct = currentProducts.find(p => p.sku === sku);

        if (existingProduct) {
          const priceChangedInSheet = sheetPrice !== (existingProduct.lastSyncedPrice ?? -1);
          const oldPriceChangedInSheet = sheetOldPrice !== (existingProduct.lastSyncedOldPrice ?? -1);
          const brandChangedInSheet = brandFromSheet !== (existingProduct.brand ?? "");
          const categoryChangedInSheet = categoryToUse !== (existingProduct.category ?? "");

          // Update if Price, Brand, OR Category changed in the sheet
          if (priceChangedInSheet || oldPriceChangedInSheet || brandChangedInSheet || categoryChangedInSheet || typeof existingProduct.lastSyncedPrice === 'undefined') {
            const updateData: any = {
              brand: brandFromSheet,
              category: categoryToUse, // ALWAYS use the fresh category logic
              lastSyncedPrice: sheetPrice,
              lastSyncedOldPrice: sheetOldPrice
            };

            // Prepend brand to EXISTING name (not sheet name) if it's not already there
            const nameToUse = existingProduct.name || nameFromSheet;
            const displayName = (brandFromSheet && !nameToUse.toLowerCase().startsWith(brandFromSheet.toLowerCase()))
              ? `${brandFromSheet} ${nameToUse}`
              : nameToUse;

            updateData.displayName = displayName;

            if (priceChangedInSheet || typeof existingProduct.lastSyncedPrice === 'undefined') {
              updateData.price = sheetPrice;
            }
            if (oldPriceChangedInSheet || typeof existingProduct.lastSyncedOldPrice === 'undefined') {
              updateData.oldPrice = sheetOldPrice;
            }

            updateData.prices = {
              price: updateData.price ?? existingProduct.price,
              oldPrice: updateData.oldPrice ?? existingProduct.oldPrice
            };

            await updateDoc(doc(db, "products", existingProduct.id.toString()), updateData);
          }
        } else {
          // New product: Fetch details from Jumia, but use Sheet for Price and Brand
          const jumiaData = await fetchJumiaProductBySku(sku);

          const nameToUse = jumiaData?.displayName || nameFromSheet;
          const displayName = (brandFromSheet && !nameToUse.toLowerCase().startsWith(brandFromSheet.toLowerCase()))
            ? `${brandFromSheet} ${nameToUse}`
            : nameToUse;

          const productData: Product = {
            id: nextId,
            sku,
            name: nameToUse,
            brand: brandFromSheet,
            category: categoryToUse, // Use mapped or auto-categorized value
            displayName,
            image: jumiaData?.image || "https://premium.jumia.com.ng/assets/images/jumia-logo.png",
            url: jumiaData?.url ? (jumiaData.url.startsWith("http") ? jumiaData.url : `https://www.jumia.com.ng${jumiaData.url.startsWith("/") ? "" : "/"}${jumiaData.url}`) : `https://www.jumia.com.ng/catalog/?q=${sku}`,
            price: sheetPrice,
            oldPrice: sheetOldPrice || Math.round(sheetPrice * 1.2),
            prices: { price: sheetPrice, oldPrice: sheetOldPrice || Math.round(sheetPrice * 1.2) },
            lastSyncedPrice: sheetPrice,
            lastSyncedOldPrice: sheetOldPrice
          };
          await setDoc(doc(db, "products", nextId.toString()), productData);
          nextId++;
        }
        setSyncProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      const now = Date.now();
      await updateDoc(doc(db, "settings", "catalog"), { lastSyncTimestamp: now });
      setCatalogSettings(prev => ({ ...prev, lastSyncTimestamp: now }));

      if (!isAuto) toast.success(`Synced ${rows.length} products! Prices mapping verified.`);
    } catch (error) {
      console.error("Sync error:", error);
      if (!isAuto) toast.error("Failed to sync from Google Sheet");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateProduct = async (id: number, name: string, price: number, oldPrice: number, category?: string) => {
    try {
      const productRef = doc(db, "products", id.toString());
      await updateDoc(productRef, {
        name,
        displayName: name,
        price,
        oldPrice,
        prices: { price, oldPrice },
        category: category || ""
      });
      toast.success("Product updated");
      setEditingId(null);
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id.toString()));
      toast.success("Product deleted");
    } catch (error) {
      toast.error("Delete failed");
    }
  };


  const handleDeleteAll = async () => {
    if (!confirm("ARE YOU SURE? This will delete ALL products from the catalog. This action cannot be undone.")) return;

    setLoading(true);
    try {
      const q = query(collection(db, "products"));
      const snapshot = await getDocs(q); // Need to import getDocs

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      toast.success("All products deleted");
    } catch (error) {
      console.error("Delete all error:", error);
      toast.error("Failed to delete products");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadClicksList = async () => {
    try {
      toast.info("Preparing download...");
      const clicksRef = collection(db, "product_clicks");
      // Fetch all clicks, not just the top 5
      const snapshot = await getDocs(clicksRef);
      const allClicksData = snapshot.docs.map(doc => ({
        id: doc.id,
        clicks: doc.data().clicks
      }));

      if (allClicksData.length === 0) {
        toast.error("No click data available to download");
        return;
      }

      // Sort by clicks descending
      allClicksData.sort((a, b) => b.clicks - a.clicks);

      // Prepare CSV content
      const headers = ["Product Name", "Product Link", "Clicks", "Total engagement %"];
      const totalClicks = stats?.clicks || 1;

      const csvRows = allClicksData.map(item => {
        const product = products.find(p => p.id.toString() === item.id);
        const name = product?.displayName || product?.name || `Product #${item.id}`;
        const url = product?.url || "N/A";
        const engagement = ((item.clicks / totalClicks) * 100).toFixed(1) + "%";
        
        // Escape quotes and wrap in quotes for CSV safety
        const cleanName = `"${name.replace(/"/g, '""')}"`;
        const cleanUrl = `"${url.replace(/"/g, '""')}"`;
        
        return [cleanName, cleanUrl, item.clicks, engagement].join(",");
      });

      const csvContent = [headers.join(","), ...csvRows].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `popular_products_clicks_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download started!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to generate download");
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Loading...</div>;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <CatalogHeader />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-black tracking-tight text-gray-900">
            Catalog <span className="text-primary">Admin</span>
          </h1>
          <Button onClick={handleLogout} variant="ghost" className="rounded-xl font-bold text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut className="mr-2" size={18} /> Logout
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-8 border-b overflow-x-auto">
          <button
            className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('products')}
          >
            Manage Products
          </button>
          <button
            className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'banners' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('banners')}
          >
            🖼️ Banners & Ads
            <span className="text-[9px] bg-orange-100 text-orange-700 font-black uppercase rounded px-1.5 py-0.5 tracking-wider">Backend Only</span>
          </button>
          <button
            className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'brandlogos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('brandlogos')}
          >
            🏷️ Brand Logos
            <span className="text-[9px] bg-blue-100 text-blue-700 font-black uppercase rounded px-1.5 py-0.5 tracking-wider">Pages 1 & 2</span>
          </button>
          <button
            className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'analytics' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>
          <button
            className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('settings')}
          >
            Catalog Settings
          </button>
          <div className="flex-1" />
          <div className="flex gap-1 overflow-x-auto">
            <button
              className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'ideas' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('ideas')}
            >
              💡 Ideas
              <span className="text-[9px] bg-amber-100 text-amber-700 font-black uppercase rounded px-1.5 py-0.5 tracking-wider">{featureRequests.length}</span>
            </button>
            <button
              className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'roadmap' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('roadmap')}
            >
              🗺️ Roadmap
            </button>
            <button
              className={`pb-2 px-4 font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'announcements' ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('announcements')}
            >
              📢 Announcements
            </button>
          </div>
          <div className="flex-1" />
          {catalogSettings.lastSyncTimestamp > 0 && (
            <div className="hidden md:flex flex-col items-end justify-center px-4 mb-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Last Sync</span>
              <span className="text-xs font-black text-gray-500">{new Date(catalogSettings.lastSyncTimestamp).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>

        {activeTab === 'settings' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Front Page Settings */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Front Page Settings</h2>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Main Title</label>
                    <Input
                      value={catalogSettings.frontPage.title}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, title: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Highlight Text (Subtitle)</label>
                    <Input
                      value={catalogSettings.frontPage.subtitle}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, subtitle: e.target.value } })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Footer Text</label>
                  <Input
                    value={catalogSettings.frontPage.footerText}
                    onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, footerText: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tagline</label>
                  <Input
                    value={catalogSettings.frontPage.tagline}
                    onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, tagline: e.target.value } })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium block">Background Image (File)</label>
                    <span className="text-[10px] text-muted-foreground font-semibold">Max 200KB • Recommended: 800x1040px</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'front');
                        }}
                        disabled={uploading}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Background Image URL (Alternative)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={catalogSettings.frontPage.backgroundImage || ""}
                      onChange={(e) => setCatalogSettings({
                        ...catalogSettings,
                        frontPage: { ...catalogSettings.frontPage, backgroundImage: e.target.value }
                      })}
                      className="text-xs"
                    />
                    {catalogSettings.frontPage.backgroundImage && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 text-destructive flex-shrink-0"
                        onClick={() => setCatalogSettings({
                          ...catalogSettings,
                          frontPage: { ...catalogSettings.frontPage, backgroundImage: "" }
                        })}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                    {catalogSettings.frontPage.backgroundImage && (
                      <img src={catalogSettings.frontPage.backgroundImage} alt="Preview" className="h-10 w-10 object-cover rounded flex-shrink-0 border" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Background Color</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={catalogSettings.frontPage.backgroundColor || "#ffffff"}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, backgroundColor: e.target.value } })}
                      className="w-12 p-1 h-10"
                    />
                    <Input
                      value={catalogSettings.frontPage.backgroundColor || "#ffffff"}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, backgroundColor: e.target.value } })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Primary Color</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={catalogSettings.frontPage.primaryColor}
                        onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, primaryColor: e.target.value } })}
                        className="w-12 p-1 h-10"
                      />
                      <Input
                        value={catalogSettings.frontPage.primaryColor}
                        onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, primaryColor: e.target.value } })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Secondary Color</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={catalogSettings.frontPage.secondaryColor}
                        onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, secondaryColor: e.target.value } })}
                        className="w-12 p-1 h-10"
                      />
                      <Input
                        value={catalogSettings.frontPage.secondaryColor}
                        onChange={(e) => setCatalogSettings({ ...catalogSettings, frontPage: { ...catalogSettings.frontPage, secondaryColor: e.target.value } })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-bold text-lg mb-4">Inner Pages Settings</h3>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Background Image (Applied to all inner pages)</label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'inner');
                        }}
                        disabled={uploading}
                      />
                      {catalogSettings.innerPages?.backgroundImage && (
                        <img src={catalogSettings.innerPages.backgroundImage} alt="Preview" className="h-10 w-10 object-cover rounded" />
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Left Page Background</label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={catalogSettings.innerPages?.leftPageBackgroundColor || "#E6F7FF"}
                          onChange={(e) => setCatalogSettings({ ...catalogSettings, innerPages: { ...catalogSettings.innerPages, leftPageBackgroundColor: e.target.value } })}
                          className="w-12 p-1 h-10"
                        />
                        <Input
                          value={catalogSettings.innerPages?.leftPageBackgroundColor || ""}
                          onChange={(e) => setCatalogSettings({ ...catalogSettings, innerPages: { ...catalogSettings.innerPages, leftPageBackgroundColor: e.target.value } })}
                          placeholder="Default Blue"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Right Page Background</label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={catalogSettings.innerPages?.rightPageBackgroundColor || "#E2E0F5"}
                          onChange={(e) => setCatalogSettings({ ...catalogSettings, innerPages: { ...catalogSettings.innerPages, rightPageBackgroundColor: e.target.value } })}
                          className="w-12 p-1 h-10"
                        />
                        <Input
                          value={catalogSettings.innerPages?.rightPageBackgroundColor || ""}
                          onChange={(e) => setCatalogSettings({ ...catalogSettings, innerPages: { ...catalogSettings.innerPages, rightPageBackgroundColor: e.target.value } })}
                          placeholder="Default Purple"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>


              </div>
            </section>

            {/* Banner settings moved to dedicated Banners & Ads tab */}
            <section className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center gap-3">
              <span className="text-2xl">🖼️</span>
              <div>
                <p className="font-bold text-orange-800 text-sm">Banner & Ad Management has moved!</p>
                <p className="text-orange-700 text-xs mt-0.5">Use the <strong>Banners & Ads</strong> tab above. Banners are never synced from Google Sheet — they are always backend-only.</p>
              </div>
              <button
                className="ml-auto text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-700 transition whitespace-nowrap"
                onClick={() => setActiveTab('banners')}
              >Go to Banners →</button>
            </section>

            {/* Back Page Settings */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Back Page Settings</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Headline</label>
                  <Input
                    value={catalogSettings.backPage.title}
                    onChange={(e) => setCatalogSettings({ ...catalogSettings, backPage: { ...catalogSettings.backPage, title: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <Textarea
                    value={catalogSettings.backPage.description}
                    onChange={(e) => setCatalogSettings({ ...catalogSettings, backPage: { ...catalogSettings.backPage, description: e.target.value } })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium block">Background Image (File)</label>
                    <span className="text-[10px] text-muted-foreground font-semibold">Max 200KB • Recommended: 800x1040px</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'back');
                        }}
                        disabled={uploading}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Background Image URL (Alternative)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={catalogSettings.backPage.backgroundImage || ""}
                      onChange={(e) => setCatalogSettings({
                        ...catalogSettings,
                        backPage: { ...catalogSettings.backPage, backgroundImage: e.target.value }
                      })}
                      className="text-xs"
                    />
                    {catalogSettings.backPage.backgroundImage && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 text-destructive flex-shrink-0"
                        onClick={() => setCatalogSettings({
                          ...catalogSettings,
                          backPage: { ...catalogSettings.backPage, backgroundImage: "" }
                        })}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                    {catalogSettings.backPage.backgroundImage && (
                      <img src={catalogSettings.backPage.backgroundImage} alt="Preview" className="h-10 w-10 object-cover rounded flex-shrink-0 border" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Background Color</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={catalogSettings.backPage.backgroundColor || "#f5f5f5"}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, backPage: { ...catalogSettings.backPage, backgroundColor: e.target.value } })}
                      className="w-12 p-1 h-10"
                    />
                    <Input
                      value={catalogSettings.backPage.backgroundColor || "#f5f5f5"}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, backPage: { ...catalogSettings.backPage, backgroundColor: e.target.value } })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">QR Code URL (Link destination)</label>
                  <Input
                    value={catalogSettings.backPage.qrCodeUrl}
                    onChange={(e) => setCatalogSettings({ ...catalogSettings, backPage: { ...catalogSettings.backPage, qrCodeUrl: e.target.value } })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Call To Action</label>
                    <Input
                      value={catalogSettings.backPage.callToAction}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, backPage: { ...catalogSettings.backPage, callToAction: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Footer Text</label>
                    <Input
                      value={catalogSettings.backPage.footerText}
                      onChange={(e) => setCatalogSettings({ ...catalogSettings, backPage: { ...catalogSettings.backPage, footerText: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            </section>



            <Button
              onClick={async () => {
                try {
                  await setDoc(doc(db, "settings", "catalog"), catalogSettings, { merge: true });
                  toast.success("Settings saved successfully!");
                } catch (error) {
                  console.error("Error saving settings:", error);
                  toast.error("Failed to save settings");
                }
              }}
              className="w-full"
            >
              <Save className="mr-2" size={18} /> Save Changes
            </Button>
          </div>
        ) : activeTab === 'banners' ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Backend Only Notice */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-5 flex items-start gap-4 shadow-lg">
              <span className="text-3xl shrink-0">🔒</span>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide">Backend Only — Not Synced from Google Sheet</h2>
                <p className="text-sm text-orange-100 mt-1">Banners and ads you configure here are saved directly to your Firebase backend. They will <strong>never</strong> be overwritten or removed by any Google Sheet sync. Update them whenever you like — they stay until <em>you</em> remove them.</p>
              </div>
            </div>

            {/* Banner Slots */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">Ad Banners</h2>
                <span className="text-xs text-gray-400 font-semibold">Max 200KB per image</span>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Each spread (pair of pages) has a banner slot at the bottom of the right page. Upload an image and optionally link it to a product or promotion.
              </p>
              <div className="space-y-4">
                {(() => {
                  const bannerKeys = Object.keys(catalogSettings?.banners || {});
                  const maxBannerIdx = bannerKeys
                    .filter(key => key.startsWith('spread-'))
                    .map(key => parseInt(key.split('-')[1]))
                    .reduce((max, val) => Math.max(max, val), -1);
                  const slotsCount = Math.max(10, Math.ceil(products.length / 10), maxBannerIdx + 1);

                  return [...Array(slotsCount)].map((_, i) => {
                    const spreadId = `spread-${i}`;
                    const banner = catalogSettings.banners?.[spreadId];
                    const hasImage = !!banner?.image;
                    return (
                      <div key={spreadId} className={`p-4 border rounded-xl transition-all ${hasImage ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${hasImage ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <h3 className="font-bold text-sm">Spread {i + 1} – Right Page Ad Slot</h3>
                          {hasImage && <span className="ml-auto text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-black uppercase tracking-wider">Active</span>}
                          {!hasImage && <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider">Empty</span>}
                        </div>
                        <div className="grid gap-3">
                          <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex-1 min-w-[180px]">
                              <label className="text-xs font-semibold mb-1 block text-gray-600">Upload Image</label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'banner', spreadId);
                                }}
                                disabled={uploading}
                                className="text-xs"
                              />
                            </div>
                            <div className="flex-1 min-w-[180px]">
                              <label className="text-xs font-semibold mb-1 block text-gray-600">Or paste image URL</label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="https://..."
                                  value={banner?.image || ""}
                                  onChange={(e) => {
                                    const newBanners = {
                                      ...(catalogSettings.banners || {}),
                                      [spreadId]: { ...(banner || { image: "" }), image: e.target.value }
                                    };
                                    setCatalogSettings({ ...catalogSettings, banners: newBanners });
                                  }}
                                  className="text-xs"
                                />
                                {hasImage && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 text-destructive shrink-0"
                                    title="Remove banner"
                                    onClick={() => {
                                      const newBanners = { ...(catalogSettings.banners || {}) };
                                      delete newBanners[spreadId];
                                      setCatalogSettings({ ...catalogSettings, banners: newBanners });
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {hasImage && (
                              <div className="shrink-0">
                                <img src={banner!.image} alt="Preview" className="h-14 w-24 object-contain rounded-lg border bg-white shadow-sm" />
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold mb-1 block text-gray-600">Click-through URL (Optional)</label>
                            <Input
                              placeholder="https://jumia.com.ng/..."
                              value={banner?.url || ""}
                              onChange={(e) => {
                                const newBanners = {
                                  ...(catalogSettings.banners || {}),
                                  [spreadId]: { ...(banner || { image: "" }), url: e.target.value }
                                };
                                setCatalogSettings({ ...catalogSettings, banners: newBanners });
                              }}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>

            {/* Save Button */}
            <Button
              onClick={async () => {
                try {
                  // Only save the banners field — never touches products or sync timestamps
                  await setDoc(doc(db, "settings", "catalog"), catalogSettings, { merge: true });
                  toast.success("Banners saved to Firebase! These will not be affected by any Google Sheet sync.");
                } catch (error) {
                  console.error("Error saving banners:", error);
                  toast.error("Failed to save banners");
                }
              }}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              <Save className="mr-2" size={18} /> Save Banners to Backend
            </Button>
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg mb-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0">📊</span>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wide">Live Analytics Dashboard</h2>
                  <p className="text-sm text-purple-100 mt-1">Detailed tracking of engagement, clicks, and visitor behavior.</p>
                </div>
              </div>
              
              {/* Date Filters UI from Image */}
              <div className="bg-white/10 p-1.5 rounded-2xl backdrop-blur-sm flex items-center gap-1 self-start md:self-center border border-white/10">
                {(["7D", "30D", "All Time", "CUSTOM"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setAnalyticsRange(range)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      analyticsRange === range 
                        ? "bg-white text-purple-700 shadow-lg scale-105" 
                        : "text-white/80 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {analyticsRange === "CUSTOM" && (
              <div className="bg-white p-4 rounded-2xl border border-purple-100 flex flex-wrap gap-4 items-end animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Start Date</label>
                  <Input 
                    type="date" 
                    value={customRange.start} 
                    onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">End Date</label>
                  <Input 
                    type="date" 
                    value={customRange.end} 
                    onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setAnalyticsRange("7D")}
                  className="rounded-xl h-10 w-10 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            )}

            {isLoadingAnalytics ? (
              <div className="bg-white p-20 rounded-3xl border border-gray-100 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-purple-600" size={40} />
                <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Crunching data...</p>
              </div>
            ) : backendAnalytics ? (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">Active Users</span>
                    <span className="text-3xl font-black text-gray-900 line-clamp-1">{backendAnalytics.summary.rangeActiveUsers.toLocaleString()}</span>
                    <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      In Selected Range
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">Total Clicks</span>
                    <span className="text-3xl font-black text-gray-900">{backendAnalytics.summary.rangeTotalClicks.toLocaleString()}</span>
                    <div className="text-[10px] text-purple-600 font-bold uppercase mt-1">Interactions</div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">Engagement</span>
                    <span className="text-3xl font-black text-gray-900">{backendAnalytics.summary.avgInteractionRate.toFixed(1)}%</span>
                    <div className="text-[10px] text-orange-600 font-bold uppercase mt-1">Interaction Rate</div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">Total Views</span>
                    <span className="text-3xl font-black text-gray-900">{backendAnalytics.summary.totalViews.toLocaleString()}</span>
                    <div className="text-[10px] text-blue-600 font-bold uppercase mt-1">Lifetime Value</div>
                  </div>
                </div>

                {/* Trend Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center justify-between">
                      Traffic Overview
                      <Users size={14} className="text-purple-500" />
                    </h3>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={backendAnalytics.dailyData}>
                          <defs>
                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9333ea" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                            tickFormatter={(str) => {
                              const d = new Date(str);
                              return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
                            }}
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="activeUsers" 
                            stroke="#9333ea" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorUsers)" 
                            name="Active Users"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center justify-between">
                      Click Activity
                      <MousePointer2 size={14} className="text-orange-500" />
                    </h3>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={backendAnalytics.dailyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                            tickFormatter={(str) => {
                              const d = new Date(str);
                              return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
                            }}
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="totalClicks" 
                            stroke="#f97316" 
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            name="Total Clicks"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Engagement Section */}
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BarChart3 size={120} />
                  </div>
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2 uppercase">Engagement Highlights</h3>
                      <p className="text-gray-500 font-medium italic">Showing the most active products and user behaviors for the selected period.</p>
                    </div>
                    <div className="flex gap-4">
                       <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 text-center min-w-[140px]">
                          <span className="block text-3xl font-black text-purple-700">{backendAnalytics.summary.totalReaders.toLocaleString()}</span>
                          <span className="text-[10px] font-black uppercase text-purple-400">Total Readers</span>
                       </div>
                       <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 text-center min-w-[140px]">
                          <span className="block text-3xl font-black text-orange-700">{backendAnalytics.summary.totalShares.toLocaleString()}</span>
                          <span className="text-[10px] font-black uppercase text-orange-400">Total Shares</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-20 rounded-3xl border border-gray-100 text-center">
                 <p className="font-bold text-gray-400">No data found for this range.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'ideas' ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl p-5 flex items-start gap-4 shadow-lg">
              <span className="text-3xl shrink-0">💡</span>
              <div>
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-lg font-black uppercase tracking-wide">Feature Requests</h2>
                  <Button 
                    onClick={() => {
                      const title = prompt("Enter feature title:");
                      const description = prompt("Enter description:");
                      if (title) {
                        const newReq: any = {
                          title,
                          description: description || "",
                          status: 'under-consideration',
                          topic: 'new-feature',
                          upvotes: 0,
                          author: "Admin",
                          createdAt: new Date(),
                          commentCount: 0,
                          labels: []
                        };
                        setDoc(doc(collection(db, "feature_requests")), newReq);
                        toast.success("Feature request added!");
                      }
                    }}
                    className="bg-white text-amber-600 hover:bg-amber-50 rounded-xl font-bold border-none h-9"
                  >
                    + Submit Idea
                  </Button>
                </div>
                <p className="text-sm text-amber-100 mt-1">Manage product requests and feature ideas from the community.</p>
              </div>
            </div>

            {ideasLoading ? (
              <div className="p-8 text-center text-gray-400">
                <Loader2 className="animate-spin inline-block mb-2" />
                <p>Loading ideas...</p>
              </div>
            ) : featureRequests.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center gap-3">
                <span className="text-4xl opacity-20">📂</span>
                <p className="font-bold text-gray-400">No ideas yet!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {featureRequests.map((req) => (
                  <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 group hover:border-amber-200 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center justify-center min-w-[50px] border border-gray-100">
                          <span className="text-lg font-black text-gray-900">{req.upvotes || 0}</span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase">Upvotes</span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-black text-gray-900 uppercase tracking-tight leading-none mb-1">{req.title}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2 italic">"{req.description || "No description provided"}"</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              req.status === 'shipped' ? 'bg-green-100 text-green-700' :
                              req.status === 'in-development' ? 'bg-blue-100 text-blue-700' :
                              req.status === 'planned' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {req.status.replace('-', ' ')}
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">
                              #{req.topic}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select 
                          value={req.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value as RequestStatus;
                            await updateDoc(doc(db, "feature_requests", req.id), { status: newStatus });
                            if (newStatus === 'shipped') {
                              if (confirm("Create an announcement for this shipped feature?")) {
                                const newAnn: any = {
                                  title: `Shipped: ${req.title}`,
                                  content: `We've successfully implemented: ${req.description}`,
                                  date: new Date(),
                                  type: 'shipped',
                                  requestId: req.id
                                };
                                await setDoc(doc(collection(db, "announcements")), newAnn);
                                toast.success("Feature marked as shipped and announcement created!");
                                setActiveTab('announcements');
                              }
                            }
                          }}
                          className="text-[10px] font-bold border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="under-consideration">Under Consideration</option>
                          <option value="planned">Planned</option>
                          <option value="in-development">In Development</option>
                          <option value="shipped">Shipped</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl h-8 w-8"
                          onClick={async () => {
                            if (confirm("Delete this request?")) {
                              await deleteDoc(doc(db, "feature_requests", req.id));
                              toast.success("Request deleted");
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'roadmap' ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-2xl p-5 flex items-start gap-4 shadow-lg mb-8">
              <span className="text-3xl shrink-0">🗺️</span>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide">Product Roadmap</h2>
                <p className="text-sm text-green-100 mt-1">Visualize what's coming next and track the progress of ongoing developments.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start overflow-x-auto pb-4">
              {[
                { id: 'under-consideration', label: 'Under Consideration', color: 'gray' },
                { id: 'planned', label: 'Planned', color: 'purple' },
                { id: 'in-development', label: 'In Development', color: 'blue' },
                { id: 'shipped', label: 'Shipped', color: 'green' }
              ].map((column) => (
                <div key={column.id} className="flex flex-col gap-3 min-w-[250px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full bg-${column.color}-500`} />
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500">
                      {column.label} ({featureRequests.filter(r => r.status === column.id).length})
                    </h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {featureRequests.filter(r => r.status === column.id).map(req => (
                      <div key={req.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex items-start justify-between mb-2">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-tighter bg-gray-100 text-gray-500`}>
                            {req.upvotes || 0}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold">#{req.topic}</span>
                        </div>
                        <h4 className="font-bold text-xs text-gray-900 group-hover:text-primary transition-colors leading-tight mb-1">{req.title}</h4>
                        <p className="text-[10px] text-gray-500 line-clamp-2 italic leading-relaxed">"{req.description}"</p>
                      </div>
                    ))}
                    {featureRequests.filter(r => r.status === column.id).length === 0 && (
                      <div className="py-8 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-300 uppercase italic">Slot Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'announcements' ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-2xl p-5 flex items-start gap-4 shadow-lg mb-8">
              <span className="text-3xl shrink-0">📢</span>
              <div>
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-lg font-black uppercase tracking-wide">Announcements</h2>
                  <Button 
                    onClick={() => {
                      const title = prompt("Announcement Title:");
                      const content = prompt("Content:");
                      if (title) {
                        const newAnn: any = {
                          title,
                          content: content || "",
                          date: new Date(),
                          type: 'announcement',
                        };
                        setDoc(doc(collection(db, "announcements")), newAnn);
                        toast.success("Announcement posted!");
                      }
                    }}
                    className="bg-white text-rose-600 hover:bg-rose-50 rounded-xl font-bold border-none h-9"
                  >
                    + New Post
                  </Button>
                </div>
                <p className="text-sm text-rose-100 mt-1">Keep your audience informed about new features, updates, and major milestones.</p>
              </div>
            </div>

            {announcementsLoading ? (
              <div className="p-8 text-center text-gray-400">
                <Loader2 className="animate-spin inline-block mb-2" />
                <p>Loading announcements...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center gap-3">
                <span className="text-4xl opacity-20">📭</span>
                <p className="font-bold text-gray-400">No announcements yet!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-12 max-w-2xl mx-auto pt-4">
                {announcements.map((ann) => (
                  <div key={ann.id} className="relative pl-12 border-l-2 border-gray-100 pb-12 last:pb-0">
                    <div className="absolute left-[-11px] top-0 w-5 h-5 rounded-full bg-white border-4 border-rose-500 shadow-sm" />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <span>{ann.date?.toDate ? ann.date.toDate().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}</span>
                        <span className={`px-2 py-0.5 rounded-full ${ann.type === 'shipped' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                          {ann.type}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">{ann.title}</h3>
                      <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 overflow-hidden group hover:border-rose-200 transition-all">
                        <p className="text-gray-600 leading-relaxed font-medium whitespace-pre-wrap">{ann.content}</p>
                        {ann.image && (
                          <div className="mt-6 rounded-2xl overflow-hidden shadow-2xl border border-gray-50">
                            <img src={ann.image} alt="" className="w-full h-auto object-cover" />
                          </div>
                        )}
                        <div className="mt-8 flex items-center justify-between border-t pt-4 border-gray-50">
                          <span className="text-[10px] font-bold text-gray-300 uppercase">Shared from Jumia Catalog Admin</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl"
                            onClick={async () => {
                              if (confirm("Delete this announcement?")) {
                                await deleteDoc(doc(db, "announcements", ann.id));
                                toast.success("Announcement deleted");
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'brandlogos' ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-5 flex items-start gap-4 shadow-lg">
              <span className="text-3xl shrink-0">🏷️</span>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide">Brand Partner Logos</h2>
                <p className="text-sm text-blue-100 mt-1">Page 2 is dedicated to your brand partners. Add each brand logo URL and an optional click-through link. All logos appear in a clean grid on page 2 of the catalog. Logos with no image URL show as a text badge.</p>
              </div>
            </div>

            {/* Brand Logos List */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Logo Entries</h2>
                <Button
                  size="sm"
                  onClick={() => {
                    const newLogo = { name: '', logoUrl: '', linkUrl: '', page: 1 as 1 | 2 };
                    setCatalogSettings(prev => ({ ...prev, brandLogos: [...(prev.brandLogos || []), newLogo] }));
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  <Plus size={15} className="mr-1" /> Add Brand
                </Button>
              </div>

              {(!catalogSettings.brandLogos || catalogSettings.brandLogos.length === 0) && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-3">🏷️</p>
                  <p className="font-semibold">No brand logos yet.</p>
                  <p className="text-sm">Click "Add Brand" to get started.</p>
                </div>
              )}

              <div className="space-y-3">
                {(catalogSettings.brandLogos || []).map((brand, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 grid gap-3">
                    <div className="flex items-center gap-2">
                      {/* Logo preview */}
                      <div className="w-14 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {brand.logoUrl
                          ? <img src={brand.logoUrl} alt={brand.name} className="max-w-full max-h-full object-contain p-1" />
                          : <span className="text-[9px] text-gray-400 font-semibold text-center leading-tight px-1">{brand.name || 'Logo'}</span>
                        }
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">Brand Name</label>
                          <Input
                            value={brand.name}
                            placeholder="e.g. Samsung"
                            className="text-xs h-9"
                            onChange={(e) => {
                              const updated = [...(catalogSettings.brandLogos || [])];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              setCatalogSettings(prev => ({ ...prev, brandLogos: updated }));
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">Show on Page</label>
                          <select
                            value={brand.page}
                            className="w-full h-9 border border-gray-200 rounded-md text-xs px-2 bg-white"
                            onChange={(e) => {
                              const updated = [...(catalogSettings.brandLogos || [])];
                              updated[idx] = { ...updated[idx], page: parseInt(e.target.value) as 1 | 2 };
                              setCatalogSettings(prev => ({ ...prev, brandLogos: updated }));
                            }}
                          >
                            <option value={1}>Page 1 (Left)</option>
                            <option value={2}>Page 2 (Right)</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        title="Delete"
                        onClick={() => {
                          const updated = (catalogSettings.brandLogos || []).filter((_, i) => i !== idx);
                          setCatalogSettings(prev => ({ ...prev, brandLogos: updated }));
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Logo Image URL</label>
                      <Input
                        value={brand.logoUrl}
                        placeholder="https://example.com/logo.png"
                        className="text-xs h-9"
                        onChange={(e) => {
                          const updated = [...(catalogSettings.brandLogos || [])];
                          updated[idx] = { ...updated[idx], logoUrl: e.target.value };
                          setCatalogSettings(prev => ({ ...prev, brandLogos: updated }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Destination Link (Optional)</label>
                      <Input
                        value={brand.linkUrl}
                        placeholder="https://jumia.com.ng/brand-page/"
                        className="text-xs h-9"
                        onChange={(e) => {
                          const updated = [...(catalogSettings.brandLogos || [])];
                          updated[idx] = { ...updated[idx], linkUrl: e.target.value };
                          setCatalogSettings(prev => ({ ...prev, brandLogos: updated }));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Save */}
            <Button
              onClick={async () => {
                try {
                  await setDoc(doc(db, "settings", "catalog"), catalogSettings, { merge: true });
                  toast.success("Brand logos saved!");
                } catch (error) {
                  toast.error("Failed to save brand logos");
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2" size={18} /> Save Brand Logos
            </Button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Statistics Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="text-primary" /> Statistics
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-100 animate-pulse">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Live Now</span>
                    </div>
                    <Users className="text-green-600" size={24} />
                    <span className="text-3xl font-black text-gray-900">{activeReaders}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Readers</span>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                    <Users className="text-green-500" size={24} />
                    <span className="text-3xl font-bold text-gray-900">{stats?.readers || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Unique Readers</span>
                  </div>
                  <div className="col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <BarChart3 size={14} className="text-orange-500" /> Interaction Rate
                      </h3>
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 uppercase">Trend Analysis</span>
                    </div>
                    <InteractionRateGraph data={dailyStats} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                    <BarChart3 className="text-blue-500" size={24} />
                    <span className="text-3xl font-bold text-gray-900">{stats?.views || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Views</span>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                    <MousePointer2 className="text-orange-500" size={24} />
                    <span className="text-3xl font-bold text-gray-900">{stats?.clicks || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Product Clicks</span>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                    <Clock className="text-purple-500" size={24} />
                    <span className="text-xl font-bold text-gray-900">
                      {(() => {
                        const total = stats?.timeOnBook || 0;
                        const readers = stats?.readers || 1;
                        const avgSec = Math.round(total / readers);
                        const m = Math.floor(avgSec / 60);
                        const s = avgSec % 60;
                        return m > 0 ? `${m}m ${s}s` : `${s}s`;
                      })()}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Avg. Time on Book</span>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                    <Share2 className="text-pink-500" size={24} />
                    <span className="text-3xl font-bold text-gray-900">{stats?.shares || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Shares</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Product Management Section */}
            <section className="mt-12 pt-12 border-t">
              {/* Product Leaderboard */}
              {productClicks.length > 0 && (
                <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Trophy className="text-yellow-500" size={20} /> Most Popular Products
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDownloadClicksList}
                      className="rounded-xl border-dashed border-gray-300 hover:border-primary hover:text-primary transition-all bg-white"
                    >
                      <Download size={14} className="mr-2" /> Download List
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {productClicks.map((item, index) => {
                      const product = products.find(p => p.id.toString() === item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                          <div className="w-6 h-6 rounded-full bg-jumia-purple/10 text-jumia-purple flex items-center justify-center text-xs font-black">
                            {index + 1}
                          </div>
                          {product?.image && (
                            <img src={product.image} alt="" className="w-8 h-8 object-contain" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-gray-900">
                              {product?.displayName || product?.name || `Product #${item.id}`}
                            </p>
                            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                              {item.clicks} Total Clicks
                            </p>
                          </div>
                          <div className="text-xs font-bold text-jumia-purple bg-jumia-purple/5 px-2 py-1 rounded">
                            {Math.round((item.clicks / (stats?.clicks || 1)) * 100)}% of engagement
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Most Popular Product Picker */}
              <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <Trophy className="text-yellow-500" size={20} /> Pick Most Popular Product
                </h3>
                <p className="text-xs text-gray-500 mb-4">Select the product to highlight as the #1 most popular. This overrides the automatic click-based ranking shown to visitors.</p>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Featured Product</label>
                    <select
                      className="w-full h-10 border border-gray-200 rounded-md text-sm px-3 bg-white"
                      value={catalogSettings.pinnedProductId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                        setCatalogSettings(prev => ({ ...prev, pinnedProductId: val }));
                      }}
                    >
                      <option value="">— Auto (highest clicks) —</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          #{p.id} · {p.displayName || p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, "settings", "catalog"), catalogSettings, { merge: true });
                        toast.success("Featured product saved!");
                      } catch { toast.error("Failed to save"); }
                    }}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white h-10 px-5"
                  >
                    <Save size={15} className="mr-1" /> Save
                  </Button>
                  {catalogSettings.pinnedProductId && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const updated = { ...catalogSettings, pinnedProductId: null };
                        setCatalogSettings(updated);
                        await setDoc(doc(db, "settings", "catalog"), updated, { merge: true });
                        toast.success("Cleared — auto mode active");
                      }}
                      className="h-10 text-red-500 border-red-200"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {catalogSettings.pinnedProductId && (() => {
                  const p = products.find(p => p.id === catalogSettings.pinnedProductId);
                  return p ? (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                      {p.image && <img src={p.image} alt="" className="w-10 h-10 object-contain" />}
                      <div>
                        <p className="text-sm font-bold text-gray-900">{p.displayName || p.name}</p>
                        <p className="text-xs text-yellow-700 font-semibold">✓ Pinned as Most Popular</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Automation Settings */}
              <div className="mb-8 p-6 border rounded-xl bg-white shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">⚙️ Automation Settings</h2>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Google Sheet Auto-Sync Interval</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={catalogSettings.autoSyncInterval ?? 6}
                      onChange={async (e) => {
                        const updated = { ...catalogSettings, autoSyncInterval: parseInt(e.target.value) };
                        setCatalogSettings(updated);
                        try {
                          await setDoc(doc(db, "settings", "catalog"), updated, { merge: true });
                          toast.success("Sync interval saved!");
                        } catch { toast.error("Failed to save interval"); }
                      }}
                    >
                      <option value={1}>Every Hour</option>
                      <option value={4}>Every 4 Hours</option>
                      <option value={6}>Every 6 Hours (default)</option>
                      <option value={12}>Every 12 Hours</option>
                      <option value={24}>Every 24 Hours</option>
                      <option value={0}>Disabled</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-2 font-semibold uppercase tracking-wider">
                      The catalog auto-syncs prices from Google Sheet each time an admin or visitor opens it, if the interval has passed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bulk SKU Search */}
              <div className="mb-12 p-6 border rounded-xl bg-white shadow-sm">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Plus className="text-primary" /> Add Products by SKU
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Jumia SKU(s) — one per line or comma-separated
                    </label>
                    <Textarea
                      placeholder={`e.g.\nMA699HA82GXITNAFAMZ\nMA711HA1L7XGZNAFAMZ\nSK123ABC, SK456DEF`}
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleBulkFetch} disabled={fetchingSku} className="w-full">
                    {fetchingSku ? (
                      <><Loader2 className="animate-spin mr-2" size={18} /> Fetching...</>
                    ) : (
                      <><Search size={18} className="mr-2" /> Fetch Products</>
                    )}
                  </Button>
                </div>

                {/* Fetched Results */}
                {fetchedProducts.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="font-semibold text-lg">Results ({fetchedProducts.length})</h3>
                    {fetchedProducts.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 border rounded-lg ${item.selected && item.displayName ? "bg-green-50 border-green-200" : "bg-gray-50"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.selected}
                          disabled={!item.displayName}
                          onChange={() => toggleFetchedProduct(idx)}
                          className="mt-2"
                        />
                        {item.image && (
                          <img src={item.image} alt="" className="w-16 h-16 object-contain flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 space-y-2">
                          {item.brand && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-semibold">Brand:</span> {item.brand}
                            </div>
                          )}
                          <Input
                            value={item.displayName || item.name}
                            onChange={(e) => updateFetchedProduct(idx, "displayName", e.target.value)}
                            className="text-sm font-medium"
                            placeholder="Product name"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Price (₦)</label>
                              <Input
                                type="number"
                                value={item.price || ""}
                                onChange={(e) => updateFetchedProduct(idx, "price", parseInt(e.target.value) || 0)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Old Price (₦)</label>
                              <Input
                                type="number"
                                value={item.oldPrice || ""}
                                onChange={(e) => updateFetchedProduct(idx, "oldPrice", parseInt(e.target.value) || 0)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">SKU: {item.sku}</p>
                        </div>
                      </div>
                    ))}
                    <Button onClick={handleAddSelected} className="w-full mt-4">
                      Add {fetchedProducts.filter((p) => p.selected && p.displayName).length} Selected to Catalog
                    </Button>
                  </div>
                )}
              </div>

              {/* Manage Products Area */}
              <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h2 className="text-2xl font-bold">Manage Products</h2>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncFromSheet()}
                      disabled={isSyncing}
                      className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    >
                      {isSyncing ? (
                        <><Loader2 size={16} className="mr-2 animate-spin" /> Syncing ({syncProgress.current}/{syncProgress.total})...</>
                      ) : (
                        <><RefreshCw size={16} className="mr-2" /> Sync from Google Sheet</>
                      )}
                    </Button>
                    {products.length > 0 && (
                      <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={isSyncing}>
                        <Trash2 size={16} className="mr-2" /> Delete All
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm gap-3">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <img src={product.image} alt={product.name} className="w-16 h-16 object-contain flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm line-clamp-2">{product.displayName || product.name}</h3>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-tight mt-1">
                            <span>ID: {product.id}</span>
                            {product.sku && <span>• SKU: {product.sku}</span>}
                            <select
                              value={product.category || ""}
                              onChange={async (e) => {
                                const newCat = e.target.value;
                                try {
                                  await updateDoc(doc(db, "products", product.id.toString()), { category: newCat });
                                  toast.success(`Updated to ${newCat || 'Uncategorized'}`);
                                } catch (err) {
                                  toast.error("Failed to update category");
                                }
                              }}
                              className="ml-2 h-6 border border-gray-200 bg-gray-50 rounded text-[10px] px-1 py-0 focus:ring-1 focus:border-jumia-purple focus:ring-jumia-purple outline-none cursor-pointer hover:bg-white transition-colors"
                            >
                              <option value="">Uncategorized</option>
                              {PRODUCT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {editingId === product.id ? (
                        <div className="flex flex-col gap-2 flex-shrink-0 w-full max-w-sm">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Name</label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Price</label>
                              <Input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-24 h-8 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Old Price</label>
                              <Input
                                type="number"
                                value={editOldPrice}
                                onChange={(e) => setEditOldPrice(e.target.value)}
                                className="w-24 h-8 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground">Category</label>
                              <select
                                className="w-full h-8 border rounded-md text-xs px-2 bg-white"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                              >
                                <option value="">Select Category</option>
                                {PRODUCT_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="mt-3 self-end"
                              onClick={() => handleUpdateProduct(product.id, editName, parseInt(editPrice) || 0, parseInt(editOldPrice) || 0, editCategory)}
                            >
                              <Save size={16} />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground line-through">{formatPrice(product.oldPrice)}</p>
                            <p className="font-bold text-primary text-sm">{formatPrice(product.price)}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(product.id);
                              setEditName(product.displayName || product.name);
                              setEditPrice(product.price.toString());
                              setEditOldPrice(product.oldPrice.toString());
                              setEditCategory(product.category || "");
                            }}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(product.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
