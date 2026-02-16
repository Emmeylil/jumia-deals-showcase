import { supabase } from "@/integrations/supabase/client";

export interface JumiaProduct {
    sku: string;
    displayName: string;
    image: string;
    url: string;
    prices: {
        price: number;
        oldPrice: number;
    };
}

export async function fetchJumiaProductBySku(sku: string): Promise<JumiaProduct | null> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-jumia-sku', {
            body: { sku },
        });

        if (error) {
            console.error("Edge function error:", error);
            return null;
        }

        if (data?.success && data?.data) {
            return data.data as JumiaProduct;
        }

        console.error("Product not found:", data?.error);
        return null;
    } catch (error) {
        console.error("Error fetching Jumia product:", error);
        return null;
    }
}
