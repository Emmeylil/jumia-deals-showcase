// Test script to fetch Jumia product and see raw data
const sku = 'MA699HA82GXITNAFAMZ'; // Replace with your SKU

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
};

const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(sku)}`;
console.log('Fetching:', url);

fetch(url, { headers })
    .then(res => res.text())
    .then(html => {
        // Try to find products JSON
        const patterns = [
            /"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"head"/,
            /"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"filters"/,
            /"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"[a-zA-Z]/,
            /"products"\s*:\s*(\[[\s\S]*?\])\s*\}/,
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    let jsonStr = match[1];
                    let depth = 0;
                    let endIdx = 0;
                    for (let i = 0; i < jsonStr.length; i++) {
                        if (jsonStr[i] === '[') depth++;
                        else if (jsonStr[i] === ']') {
                            depth--;
                            if (depth === 0) { endIdx = i + 1; break; }
                        }
                    }
                    if (endIdx > 0) jsonStr = jsonStr.substring(0, endIdx);

                    const products = JSON.parse(jsonStr);
                    console.log('\n=== FOUND PRODUCTS ===');
                    console.log('Total products:', products.length);

                    if (products.length > 0) {
                        const product = products[0];
                        console.log('\n=== FIRST PRODUCT DATA ===');
                        console.log('SKU:', product.sku);
                        console.log('name:', product.name);
                        console.log('displayName:', product.displayName);
                        console.log('brand:', product.brand);
                        console.log('All keys:', Object.keys(product));
                        console.log('\n=== FULL PRODUCT OBJECT ===');
                        console.log(JSON.stringify(product, null, 2));
                    }
                    return;
                } catch (e) {
                    console.error('Parse error:', e);
                }
            }
        }
        console.log('No products found in page');
    })
    .catch(err => console.error('Fetch error:', err));
