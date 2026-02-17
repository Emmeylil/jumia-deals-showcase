const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sku } = await req.json();

    if (!sku) {
      return new Response(
        JSON.stringify({ success: false, error: 'SKU is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };

    // Try the catalog search page
    const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(sku)}`;
    console.log('Fetching Jumia URL:', url);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error('Jumia fetch failed:', response.status);
      return new Response(
        JSON.stringify({ success: false, error: `Jumia returned status ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Try multiple regex patterns to find product data in the page
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
          // Clean up the JSON - sometimes there's trailing content
          let jsonStr = match[1];
          // Ensure valid JSON array by finding the matching closing bracket
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
          console.log(`Found ${products.length} products with pattern`);

          if (products && products.length > 0) {
            // Try to find exact SKU match first
            let product = products.find((p: any) => p.sku === sku);
            if (!product) product = products[0];

            let price = 0;
            let oldPrice = 0;

            if (product.prices) {
              price = typeof product.prices.price === 'number'
                ? product.prices.price
                : parseInt(String(product.prices.price).replace(/[^\d]/g, ''));
              if (product.prices.oldPrice) {
                oldPrice = typeof product.prices.oldPrice === 'number'
                  ? product.prices.oldPrice
                  : parseInt(String(product.prices.oldPrice).replace(/[^\d]/g, ''));
              }
            }

            // Extract brand and construct full name with brand
            const brand = product.brand || '';
            const productName = product.name || product.displayName || '';
            const fullName = brand && !productName.toLowerCase().startsWith(brand.toLowerCase())
              ? `${brand} ${productName}`
              : productName;

            const result = {
              sku: product.sku || sku,
              displayName: fullName,
              image: product.image || '',
              url: product.url || '',
              prices: {
                price,
                oldPrice: oldPrice || Math.round(price * 1.2),
              },
            };

            console.log('Product found:', result.displayName, 'Image:', result.image);
            return new Response(
              JSON.stringify({ success: true, data: result }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          console.error('Error parsing products JSON with pattern:', e);
          continue;
        }
      }
    }

    // Fallback: try to extract from individual product card HTML
    // Look for product article/card elements
    const productCardMatch = html.match(/<article[^>]*class="[^"]*prd[^"]*"[^>]*>[\s\S]*?<\/article>/);
    if (productCardMatch) {
      const card = productCardMatch[0];
      const nameMatch = card.match(/data-name="([^"]+)"/i) || card.match(/class="[^"]*name[^"]*"[^>]*>([^<]+)</i);
      const imgMatch = card.match(/data-src="([^"]+)"/i) || card.match(/src="(https:\/\/[^"]*jumia[^"]*\.(?:jpg|png|webp)[^"]*)"/i);
      const priceMatch = card.match(/data-price="([^"]+)"/i);
      const oldPriceMatch = card.match(/data-old-price="([^"]+)"/i);
      const urlMatch = card.match(/href="(\/[^"]+\.html)"/i);
      const skuMatch = card.match(/data-sku="([^"]+)"/i);

      if (nameMatch || imgMatch) {
        let url = urlMatch ? urlMatch[1] : '';
        if (url && !url.startsWith('http')) {
          url = `https://www.jumia.com.ng${url.startsWith('/') ? '' : '/'}${url}`;
        }

        // Try to extract brand
        const brandMatch = card.match(/data-brand=\"([^\"]+)\"/i) || card.match(/class=\"[^\"]*brand[^\"]*\"[^>]*>([^<]+)</i);
        const brand = brandMatch ? brandMatch[1].trim() : '';
        const productName = nameMatch ? (nameMatch[1] || '').trim() : '';
        const fullName = brand && !productName.toLowerCase().startsWith(brand.toLowerCase())
          ? `${brand} ${productName}`
          : productName;

        const result = {
          sku: skuMatch ? skuMatch[1] : sku,
          displayName: fullName,
          image: imgMatch ? imgMatch[1] : '',
          url: url,
          prices: {
            price: priceMatch ? parseInt(priceMatch[1]) : 0,
            oldPrice: oldPriceMatch ? parseInt(oldPriceMatch[1]) : 0,
          },
        };

        console.log('Product found via card HTML:', result.displayName);
        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Last fallback: look for __NEXT_DATA__ or window.__STORE__ patterns
    const storeMatch = html.match(/window\.__(?:NEXT_DATA__|STORE__|INITIAL_STATE__|DATA__)__?\s*=\s*({[\s\S]*?});?\s*<\/script>/);
    if (storeMatch) {
      try {
        const storeData = JSON.parse(storeMatch[1]);
        console.log('Found store data, keys:', Object.keys(storeData));
        // Try to navigate to products in the store data
        const findProducts = (obj: any, depth = 0): any[] | null => {
          if (depth > 5) return null;
          if (Array.isArray(obj) && obj.length > 0 && obj[0]?.sku) return obj;
          if (typeof obj === 'object' && obj !== null) {
            for (const key of Object.keys(obj)) {
              if (key === 'products' || key === 'items' || key === 'results') {
                const found = findProducts(obj[key], depth + 1);
                if (found) return found;
              }
            }
            for (const key of Object.keys(obj)) {
              const found = findProducts(obj[key], depth + 1);
              if (found) return found;
            }
          }
          return null;
        };

        const products = findProducts(storeData);
        if (products && products.length > 0) {
          const product = products.find((p: any) => p.sku === sku) || products[0];

          // Extract brand and construct full name
          const brand = product.brand || '';
          const productName = product.name || product.displayName || '';
          const fullName = brand && !productName.toLowerCase().startsWith(brand.toLowerCase())
            ? `${brand} ${productName}`
            : productName;

          const result = {
            sku: product.sku || sku,
            displayName: fullName,
            image: product.image || '',
            url: product.url || '',
            prices: {
              price: product.prices?.price || 0,
              oldPrice: product.prices?.oldPrice || 0,
            },
          };
          console.log('Product found via store data:', result.displayName);
          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('Error parsing store data:', e);
      }
    }

    // Log a snippet of the HTML for debugging
    console.log('HTML snippet (first 2000 chars):', html.substring(0, 2000));
    console.log('No product data found in page');

    return new Response(
      JSON.stringify({ success: false, error: 'Product not found - could not extract data from page' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
