export interface JumiaProduct {
    sku: string;
    displayName: string;
    brand?: string;
    image: string;
    url: string;
    prices: {
        price: number;
        oldPrice: number;
    };
}

const JUMIA_SKU_FUNC_URL = 'https://fetchjumiasku-776751698383.europe-west2.run.app';

export async function fetchJumiaProductBySku(sku: string): Promise<JumiaProduct | null> {
    try {
        const response = await fetch(JUMIA_SKU_FUNC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku }),
        });

        if (!response.ok) {
            throw new Error(`Jumia fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
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
