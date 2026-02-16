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
                    let oldPrice = 0;

                    if (product.prices) {
                        if (product.prices.price) {
                            price = typeof product.prices.price === 'number'
                                ? product.prices.price
                                : parseInt(product.prices.price.replace(/[^\d]/g, ""));
                        }
                        if (product.prices.oldPrice) {
                            oldPrice = typeof product.prices.oldPrice === 'number'
                                ? product.prices.oldPrice
                                : parseInt(product.prices.oldPrice.replace(/[^\d]/g, ""));
                        }
                    }

                    return {
                        sku: product.sku || sku,
                        displayName: product.name,
                        image: product.image,
                        url: product.url || "",
                        prices: {
                            price: price,
                            oldPrice: oldPrice || Math.round(price * 1.2) // Fallback 20% markup
                        }
                    };
                }
            } catch (e) {
                console.error("Error parsing products JSON:", e);
            }
        }

        // Fallback: try to match from metadata if it's a product page directly
        const metaName = html.match(/<meta property="og:title" content="([^"]+)"/);
        const metaImage = html.match(/<meta property="og:image" content="([^"]+)"/);
        const metaUrl = html.match(/<meta property="og:url" content="([^"]+)"/);

        if (metaName && metaImage) {
            return {
                sku: sku,
                displayName: metaName[1].split("|")[0].trim(),
                image: metaImage[1].trim(),
                url: metaUrl ? metaUrl[1].replace("https://www.jumia.com.ng", "") : "",
                prices: {
                    price: 0,
                    oldPrice: 0
                }
            };
        }

        return null;
    } catch (error) {
        console.error("Error fetching Jumia product:", error);
        return null;
    }
}
