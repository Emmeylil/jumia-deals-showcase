import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { type Product } from "@/data/products";
import { autoCategorizeProduct } from "@/lib/search-utils";
import { CATEGORY_BRAND_MAP } from "@/lib/constants";
function getCategoryFromBrand(brand: string): string | undefined {
  if (!brand) return undefined;
  const lowerBrand = brand.toLowerCase();
  for (const [category, brands] of Object.entries(CATEGORY_BRAND_MAP)) {
    if (brands.some(b => b.toLowerCase() === lowerBrand)) {
      return category as string;
    }
  }
  return undefined;
}


export const useProducts = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const q = query(collection(db, "products"), orderBy("id"));

        // Subscribe to real-time updates
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docs = snapshot.docs.map((doc) => ({
                    ...doc.data(),
                    id: parseInt(doc.id) || doc.data().id, // Ensure ID is handled correctly
                })) as Product[];

                // Ensure each product has a valid category. Do NOT override the sheet category if it exists!
                const enriched = docs.map(p => {
                    const finalCat = p.category || getCategoryFromBrand(p.brand) || autoCategorizeProduct(p.name);
                    return { ...p, category: finalCat };
                });

                setProducts(enriched);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching products:", err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return { products, loading, error };
};
