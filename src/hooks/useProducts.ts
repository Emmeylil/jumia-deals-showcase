import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "@firebase/firestore";
import { type Product } from "@/data/products";

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

                setProducts(docs);
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
