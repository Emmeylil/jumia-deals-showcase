export interface JumiaProduct {
    name: string;
    image: string;
    price: number;
}

export async function fetchJumiaProductBySku(sku: string): Promise<JumiaProduct | null> {
    try {
        // We use a CORS proxy to fetch Jumia data from the client side
        // Using allorigins.win or similar
        const url = `https://www.jumia.com.ng/catalog/?q=${sku}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Failed to fetch from Jumia");

        const data = await response.json();
        const html = data.contents;

        // Look for the JSON data within script tags, similar to the user's script
        // We search for the products array which Jumia embeds in their initial state scripts
        const productsMatch = html.match(/"products":\s*(\[[\s\S]*?\])\s*,\s*"head"/);

        if (productsMatch) {
            try {
                const products = JSON.parse(productsMatch[1]);
                if (products && products.length > 0) {
                    const product = products[0];

                    // Jumia price is usually a string with currency or an object
                    let price = 0;
                    if (product.prices && product.prices.price) {
                        if (typeof product.prices.price === 'number') {
                            price = product.prices.price;
                        } else if (typeof product.prices.price === 'string') {
                            price = parseInt(product.prices.price.replace(/[^\d]/g, ""));
                        }
                    }

                    return {
                        name: product.name,
                        image: product.image,
                        price: price
                    };
                }
            } catch (e) {
                console.error("Error parsing products JSON:", e);
            }
        }

        // Fallback: try to match from metadata if it's a product page directly
        const metaName = html.match(/<meta property="og:title" content="([^"]+)"/);
        const metaImage = html.match(/<meta property="og:image" content="([^"]+)"/);

        if (metaName && metaImage) {
            return {
                name: metaName[1].split("|")[0].trim(),
                image: metaImage[1].trim(),
                price: 0 // Price might be harder to get from meta
            };
        }

        return null;
    } catch (error) {
        console.error("Error fetching Jumia product:", error);
        return null;
    }
}
