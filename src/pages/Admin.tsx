import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { Product, formatPrice } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import CatalogHeader from "@/components/CatalogHeader";
import { fetchJumiaProductBySku } from "@/lib/jumia";
import { Plus, Search, Loader2, Trash2 } from "lucide-react";

const Admin = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingSku, setFetchingSku] = useState(false);

    // Form State
    const [sku, setSku] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [oldPrice, setOldPrice] = useState("");
    const [previewProduct, setPreviewProduct] = useState<{ name: string, image: string } | null>(null);

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

    const handleFetchSku = async () => {
        if (!sku) return toast.error("Please enter a SKU");
        setFetchingSku(true);
        setPreviewProduct(null);

        try {
            const data = await fetchJumiaProductBySku(sku);
            if (data) {
                setPreviewProduct({ name: data.name, image: data.image });
                setOldPrice(data.price > 0 ? data.price.toString() : "");
                toast.success("Product found on Jumia!");
            } else {
                toast.error("Could not find product with this SKU on Jumia. You can still enter details manually.");
                setPreviewProduct({ name: "", image: "" }); // Allow manual entry if not found
            }
        } catch (error) {
            toast.error("Error fetching SKU");
        } finally {
            setFetchingSku(false);
        }
    };

    const handleAddProduct = async () => {
        if (!previewProduct || !newPrice) return toast.error("Missing product details or price");

        try {
            // Find next ID
            const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

            const productData: Product = {
                id: nextId,
                name: previewProduct.name,
                image: previewProduct.image,
                price: parseInt(newPrice),
                oldPrice: parseInt(oldPrice) || parseInt(newPrice) * 1.2, // Default 20% more if old price missing
            };

            await setDoc(doc(db, "products", nextId.toString()), productData);
            toast.success("Product added successfully!");

            // Reset Form
            setSku("");
            setNewPrice("");
            setOldPrice("");
            setPreviewProduct(null);
        } catch (error) {
            toast.error("Failed to add product");
        }
    };

    const handleUpdatePrice = async (id: number, price: number) => {
        try {
            const productRef = doc(db, "products", id.toString());
            await updateDoc(productRef, { price });
            toast.success("Price updated");
        } catch (error) {
            toast.error("Update failed");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-background pb-20">
            <CatalogHeader />
            <div className="max-w-4xl mx-auto px-4 py-8">

                {/* Add Product Section */}
                <section className="mb-12 p-6 border rounded-xl bg-white shadow-sm">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Plus className="text-primary" /> Add New Product
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Jumia SKU</label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="e.g. MA711HA1L7XGZNAFAMZ"
                                        value={sku}
                                        onChange={(e) => setSku(e.target.value)}
                                    />
                                    <Button onClick={handleFetchSku} disabled={fetchingSku} variant="secondary">
                                        {fetchingSku ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                                    </Button>
                                </div>
                            </div>

                            {previewProduct && (
                                <>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Product Name</label>
                                        <Input
                                            value={previewProduct.name}
                                            onChange={(e) => setPreviewProduct({ ...previewProduct, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Your Price (₦)</label>
                                            <Input
                                                type="number"
                                                value={newPrice}
                                                onChange={(e) => setNewPrice(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-1 block">Old Price (₦)</label>
                                            <Input
                                                type="number"
                                                value={oldPrice}
                                                onChange={(e) => setOldPrice(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleAddProduct} className="w-full">Add to Catalog</Button>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 bg-gray-50 min-h-[200px]">
                            {previewProduct?.image ? (
                                <img src={previewProduct.image} alt="Preview" className="max-h-48 object-contain mb-2" />
                            ) : (
                                <p className="text-muted-foreground text-sm">Image Preview</p>
                            )}
                            {previewProduct && (
                                <Input
                                    className="mt-2 text-xs"
                                    placeholder="Image URL"
                                    value={previewProduct.image}
                                    onChange={(e) => setPreviewProduct({ ...previewProduct, image: e.target.value })}
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* List Section */}
                <h2 className="text-2xl font-bold mb-6">Manage Products</h2>
                <div className="space-y-4">
                    {products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                            <div className="flex items-center gap-4">
                                <img src={product.image} alt={product.name} className="w-16 h-16 object-contain" />
                                <div>
                                    <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                                    <p className="text-xs text-muted-foreground">ID: {product.id}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right mr-2">
                                    <p className="text-xs text-muted-foreground line-through">{formatPrice(product.oldPrice)}</p>
                                    <p className="font-bold text-primary text-sm">{formatPrice(product.price)}</p>
                                </div>
                                <Input
                                    type="number"
                                    defaultValue={product.price}
                                    className="w-24 h-9 text-sm"
                                    onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (val !== product.price) handleUpdatePrice(product.id, val);
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Admin;
