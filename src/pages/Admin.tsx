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
import { Plus, Search, Loader2, Trash2, Save, Edit2, BarChart3, MousePointer2, Users, Clock, Share2, Download } from "lucide-react";
import { getStats, type StatsData } from "@/lib/stats";

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
    description: string;
    qrCodeUrl: string;
    callToAction: string;
    footerText: string;
    backgroundImage?: string;
    backgroundColor?: string;
  };
  innerPages: {
    backgroundImage?: string;
    backgroundColor?: string;
  };
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
    backgroundColor: "", // Default empty to allow default page colors if not set
  },
};

const Admin = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingSku, setFetchingSku] = useState(false);

  // Bulk SKU state
  const [skuInput, setSkuInput] = useState("");
  const [fetchedProducts, setFetchedProducts] = useState<FetchedProduct[]>([]);

  // Editing state for existing products
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editOldPrice, setEditOldPrice] = useState("");

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);

  // Catalog Settings state
  const [catalogSettings, setCatalogSettings] = useState<CatalogSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(catalogSettings);
  const [activeTab, setActiveTab] = useState<"products" | "settings">("products");
  const [uploading, setUploading] = useState(false);

  // Keep ref in sync with state for async access
  useEffect(() => {
    settingsRef.current = catalogSettings;
  }, [catalogSettings]);

  const handleImageUpload = async (file: File, type: 'front' | 'back' | 'inner') => {
    if (!file) return;

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
      } else {
        newSettings = {
          ...currentSettings,
          innerPages: {
            ...currentSettings.innerPages,
            backgroundImage: url
          }
        };
      }

      setCatalogSettings(newSettings);
      await setDoc(doc(db, "settings", "catalog"), newSettings);
      toast.success(`${type === 'front' ? 'Front' : type === 'back' ? 'Back' : 'Inner'} page background uploaded and saved!`);
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
                  <label className="text-sm font-medium mb-1 block">Background Image</label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'front');
                      }}
                      disabled={uploading}
                    />
                    {catalogSettings.frontPage.backgroundImage && (
                      <img src={catalogSettings.frontPage.backgroundImage} alt="Preview" className="h-10 w-10 object-cover rounded" />
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
                  <div className="mt-4">
                    <label className="text-sm font-medium mb-1 block">Background Color (Overrides default page colors)</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={catalogSettings.innerPages?.backgroundColor || "#ffffff"}
                        onChange={(e) => setCatalogSettings({ ...catalogSettings, innerPages: { ...catalogSettings.innerPages, backgroundColor: e.target.value } })}
                        className="w-12 p-1 h-10"
                      />
                      <Input
                        value={catalogSettings.innerPages?.backgroundColor || "#ffffff"}
                        onChange={(e) => setCatalogSettings({ ...catalogSettings, innerPages: { ...catalogSettings.innerPages, backgroundColor: e.target.value } })}
                        placeholder="#RRGGBB or empty for default"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>


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
                  <label className="text-sm font-medium mb-1 block">Background Image</label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'back');
                      }}
                      disabled={uploading}
                    />
                    {catalogSettings.backPage.backgroundImage && (
                      <img src={catalogSettings.backPage.backgroundImage} alt="Preview" className="h-10 w-10 object-cover rounded" />
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Manage Products</h2>
              {products.length > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDeleteAll}>
                  <Trash2 size={16} className="mr-2" /> Delete All
                </Button>
              )}
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
