import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, orderBy, limit, getDocs } from "@firebase/firestore";
import { Product, formatPrice } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import CatalogHeader from "@/components/CatalogHeader";
import { fetchJumiaProductBySku } from "@/lib/jumia";
import { Plus, Search, Loader2, Trash2, Save, Edit2 } from "lucide-react";

interface FetchedProduct {
  name: string;
  displayName: string;
  image: string;
  url: string;
  sku: string;
  price: number;
  oldPrice: number;
  selected: boolean;
}

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

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <CatalogHeader />
      <div className="max-w-4xl mx-auto px-4 py-8">

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
      </div>
    </div>
  );
};

export default Admin;
