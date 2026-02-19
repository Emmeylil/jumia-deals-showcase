import { useState, useEffect, useRef } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "@firebase/storage";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, orderBy, limit, getDocs } from "@firebase/firestore";
import { Product, formatPrice } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import CatalogHeader from "@/components/CatalogHeader";
import { fetchJumiaProductBySku } from "@/lib/jumia";
import { Plus, Search, Loader2, Trash2, Save, Edit2, BarChart3, MousePointer2, Users, Clock, Share2, Download, Trophy, RefreshCw, LogOut } from "lucide-react";
import { getStats, type StatsData } from "@/lib/stats";
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
  lastSyncTimestamp: 0,
  autoSyncInterval: 6, // default 6 hours
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

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [productClicks, setProductClicks] = useState<Array<{ id: string, clicks: number, product?: Product }>>([]);

  // Catalog Settings state
  const [catalogSettings, setCatalogSettings] = useState<CatalogSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(catalogSettings);
  const [activeTab, setActiveTab] = useState<"products" | "settings">("products");
  const [uploading, setUploading] = useState(false);

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
      await setDoc(doc(db, "settings", "catalog"), newSettings);
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
    };

    fetchStatsData();

    // Fetch settings
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "catalog");
        const docSnap = await getDocs(query(collection(db, "settings"))); // Temporary check
        // Actually direct getDoc is better for single document
        // But let's stick to the pattern used or just getDoc
      } catch (e) {
        console.error("Error fetching settings:", e);
      }
    };

    // Using onSnapshot for real-time updates on settings too?
    const settingsUnsub = onSnapshot(doc(db, "settings", "catalog"), (snapshot: any) => {
      if (snapshot.exists()) {
        // Merge with defaults to ensure new fields (like backgroundImage) exist
        setCatalogSettings({ ...DEFAULT_SETTINGS, ...snapshot.data() } as CatalogSettings);
      } else {
        // Initialize if not exists
        setDoc(snapshot.ref, DEFAULT_SETTINGS);
      }
    });

    // Fetch products
    const q = query(collection(db, "products"), orderBy("id"), limit(100));
    const unsubscribe = onSnapshot(q,
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
    return () => unsubscribe();
  }, []);

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
      const response = await fetch("https://docs.google.com/spreadsheets/d/12Wug9aedeK8vKebFVyXq8-QLCf7ciAXG47BzqYAuu_c/export?format=csv");
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
        const category = row[mapping.category] || "";
        const name = row[mapping.name] || "Unnamed Product";
        const brand = row[mapping.brand] || "";
        const sheetOldPrice = cleanPrice(row[mapping.oldPrice]);
        const sheetPrice = cleanPrice(row[mapping.price]);

        // Prepend brand to name if it's not already there for display purposes
        const brandSafe = brand.trim();
        const nameSafe = name.trim();
        const displayName = (brandSafe && !nameSafe.toLowerCase().startsWith(brandSafe.toLowerCase()))
          ? `${brandSafe} ${nameSafe}`
          : nameSafe;

        const existingProduct = currentProducts.find(p => p.sku === sku);

        if (existingProduct) {
          const priceChangedInSheet = sheetPrice !== (existingProduct.lastSyncedPrice ?? -1);
          const oldPriceChangedInSheet = sheetOldPrice !== (existingProduct.lastSyncedOldPrice ?? -1);

          const updateData: any = {
            category,
            brand: brandSafe,
            displayName,
            lastSyncedPrice: sheetPrice,
            lastSyncedOldPrice: sheetOldPrice
          };

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
        } else {
          const jumiaData = await fetchJumiaProductBySku(sku);
          const productData: Product = {
            id: nextId,
            sku,
            name: nameSafe,
            brand: brandSafe,
            category,
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

  const handleUpdateProduct = async (id: number, name: string, price: number, oldPrice: number) => {
    try {
      const productRef = doc(db, "products", id.toString());
      await updateDoc(productRef, {
        name,
        displayName: name,
        price,
        oldPrice,
        prices: { price, oldPrice },
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
        <div className="flex gap-4 mb-8 border-b">
          <button
            className={`pb-2 px-4 font-medium transition-colors border-b-2 ${activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('products')}
          >
            Manage Products
          </button>
          <button
            className={`pb-2 px-4 font-medium transition-colors border-b-2 ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('settings')}
          >
            Catalog Settings
          </button>
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

            {/* Banner Management */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">Banner Management</h2>
                <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold border border-orange-100">
                  Max 200KB limit
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Configure promotional banners for each spread (pair of pages). These banners replace the featured product slot.
              </p>

              <div className="space-y-6">
                {[...Array(Math.max(1, Math.ceil(products.length / 10)))].map((_, i) => {
                  const spreadId = `spread-${i}`;
                  const banner = catalogSettings.banners?.[spreadId];
                  return (
                    <div key={spreadId} className="p-4 border border-gray-100 rounded-lg bg-gray-50/50">
                      <h3 className="font-semibold text-sm mb-3">Spread {i + 1} (Right Page Bottom Slot)</h3>
                      <div className="grid gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="text-xs font-medium mb-1 block">Banner Image (File)</label>
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
                          <div className="flex-1">
                            <label className="text-xs font-medium mb-1 block">Image URL (Alternative)</label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="https://..."
                                value={banner?.image || ""}
                                onChange={(e) => {
                                  const newBanners = {
                                    ...(catalogSettings.banners || {}),
                                    [spreadId]: {
                                      ...(banner || { image: "" }),
                                      image: e.target.value
                                    }
                                  };
                                  setCatalogSettings({ ...catalogSettings, banners: newBanners });
                                }}
                                className="text-xs"
                              />
                              {banner?.image && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => {
                                    const newBanners = { ...catalogSettings.banners };
                                    delete newBanners[spreadId];
                                    setCatalogSettings({ ...catalogSettings, banners: newBanners });
                                  }}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                          {banner?.image && (
                            <div className="relative group shrink-0">
                              <img src={banner.image} alt="Preview" className="h-12 w-20 object-cover rounded border bg-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Click-through URL (Optional)</label>
                          <Input
                            placeholder="https://jumia.com.ng/..."
                            value={banner?.url || ""}
                            onChange={(e) => {
                              const newBanners = {
                                ...(catalogSettings.banners || {}),
                                [spreadId]: {
                                  ...(banner || { image: "" }),
                                  url: e.target.value
                                }
                              };
                              setCatalogSettings({ ...catalogSettings, banners: newBanners });
                            }}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Automation Settings</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Google Sheet Sync Interval (Hours)</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={catalogSettings.autoSyncInterval || 6}
                    onChange={(e) => setCatalogSettings({ ...catalogSettings, autoSyncInterval: parseInt(e.target.value) })}
                  >
                    <option value={1}>Every Hour</option>
                    <option value={4}>Every 4 Hours</option>
                    <option value={12}>Every 12 Hours</option>
                    <option value={24}>Every 24 Hours</option>
                    <option value={0}>Disabled</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-2 font-semibold uppercase tracking-wider">
                    Site will automatically sync from sheet when an admin or visitor opens the catalog if the interval has passed.
                  </p>
                </div>
              </div>
            </section>

            <Button
              onClick={async () => {
                try {
                  await setDoc(doc(db, "settings", "catalog"), catalogSettings);
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
        ) : (
          <>

            {/* Statistics Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="text-primary" /> Statistics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                  <Users className="text-blue-500" size={24} />
                  <span className="text-3xl font-bold text-gray-900">{stats?.views || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Views</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                  <MousePointer2 className="text-orange-500" size={24} />
                  <span className="text-3xl font-bold text-gray-900">{stats?.clicks || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Product Clicks</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                  <Users className="text-green-500" size={24} />
                  <span className="text-3xl font-bold text-gray-900">{stats?.readers || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Unique Readers</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                  <Clock className="text-purple-500" size={24} />
                  <span className="text-xl font-bold text-gray-900">{formatTime(stats?.timeOnBook || 0)}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Time on Book</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                  <Share2 className="text-pink-500" size={24} />
                  <span className="text-3xl font-bold text-gray-900">{stats?.shares || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Shares</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
                  <Download className="text-teal-500" size={24} />
                  <span className="text-3xl font-bold text-gray-900">{stats?.downloads || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Downloads</span>
                </div>
              </div>

              {/* Product Leaderboard */}
              {productClicks.length > 0 && (
                <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={20} /> Most Popular Products
                  </h3>
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
            </section>

            {/* Bulk SKU Search */}
            <section className="mb-12 p-6 border rounded-xl bg-white shadow-sm">
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
            </section>

            {/* Manage Products */}
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
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm line-clamp-1">{product.displayName || product.name}</h3>
                      <div className="flex gap-2 text-[10px] text-muted-foreground uppercase tracking-tight">
                        <span>ID: {product.id}</span>
                        {product.sku && <span>• SKU: {product.sku}</span>}
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
                        <Button
                          size="icon"
                          variant="ghost"
                          className="mt-3 self-end"
                          onClick={() => handleUpdateProduct(product.id, editName, parseInt(editPrice) || 0, parseInt(editOldPrice) || 0)}
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
          </>
        )}
      </div>
    </div>
  );
};

export default Admin;
