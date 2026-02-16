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

        // Simple regex parsing of the HTML to find name and image
        // Note: Jumia's HTML structure might vary, but we look for common patterns

        // Look for the first product in search results
        const nameMatch = html.match(/<h3 class="name">([^<]+)<\/h3>/);
        const imageMatch = html.match(/data-src="([^"]+)" class="img"/);
        const priceMatch = html.match(/<div class="prc">₦ ([0-9,]+)<\/div>/);

        if (nameMatch && imageMatch) {
            return {
                name: nameMatch[1].trim(),
                image: imageMatch[1].trim(),
                price: priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : 0
            };
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
