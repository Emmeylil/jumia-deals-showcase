import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Product, formatPrice } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import CatalogHeader from "@/components/CatalogHeader";

const Admin = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
            const docs = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: parseInt(doc.id),
            })) as Product[];
            setProducts(docs.sort((a, b) => a.id - b.id));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleUpdatePrice = async (id: number, newPrice: number) => {
        try {
            const productRef = doc(db, "products", id.toString());
            await updateDoc(productRef, { price: newPrice });
            toast.success("Price updated successfully");
        } catch (error) {
            console.error("Error updating price:", error);
            toast.error("Failed to update price");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading products...</div>;

    return (
        <div className="min-h-screen bg-background pb-20">
            <CatalogHeader />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8 text-primary">Admin Dashboard - Update Prices</h1>
                <div className="space-y-4">
                    {products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                            <div className="flex items-center gap-4">
                                <img src={product.image} alt={product.name} className="w-16 h-16 object-contain" />
                                <div>
                                    <h3 className="font-semibold">{product.name}</h3>
                                    <p className="text-sm text-muted-foreground">ID: {product.id}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right mr-4">
                                    <p className="text-sm text-muted-foreground line-through">{formatPrice(product.oldPrice)}</p>
                                    <p className="font-bold text-primary">{formatPrice(product.price)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        defaultValue={product.price}
                                        className="w-32"
                                        onBlur={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val !== product.price) handleUpdatePrice(product.id, val);
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">Press tab to save</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Admin;
