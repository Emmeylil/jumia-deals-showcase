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

    const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(sku)}`;
    console.log('Fetching Jumia URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.error('Jumia fetch failed:', response.status);
      return new Response(
        JSON.stringify({ success: false, error: `Jumia returned status ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Extract products JSON from the page - Jumia embeds product data in their initial state
    const productsMatch = html.match(/"products":\s*(\[[\s\S]*?\])\s*,\s*"head"/);

    if (productsMatch) {
      try {
        const products = JSON.parse(productsMatch[1]);
        if (products && products.length > 0) {
          const product = products[0];

          let price = 0;
          let oldPrice = 0;

          if (product.prices) {
            if (product.prices.price) {
              price = typeof product.prices.price === 'number'
                ? product.prices.price
                : parseInt(String(product.prices.price).replace(/[^\d]/g, ''));
            }
            if (product.prices.oldPrice) {
              oldPrice = typeof product.prices.oldPrice === 'number'
                ? product.prices.oldPrice
                : parseInt(String(product.prices.oldPrice).replace(/[^\d]/g, ''));
            }
          }

          const result = {
            sku: product.sku || sku,
            displayName: product.name || product.displayName || '',
            image: product.image || '',
            url: product.url || '',
            prices: {
              price,
              oldPrice: oldPrice || Math.round(price * 1.2),
            },
          };

          console.log('Product found:', result.displayName);
          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('Error parsing products JSON:', e);
      }
    }

    // Fallback: try meta tags
    const metaName = html.match(/<meta property="og:title" content="([^"]+)"/);
    const metaImage = html.match(/<meta property="og:image" content="([^"]+)"/);
    const metaUrl = html.match(/<meta property="og:url" content="([^"]+)"/);

    if (metaName && metaImage) {
      const result = {
        sku,
        displayName: metaName[1].split('|')[0].trim(),
        image: metaImage[1].trim(),
        url: metaUrl ? metaUrl[1].replace('https://www.jumia.com.ng', '') : '',
        prices: { price: 0, oldPrice: 0 },
      };

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Product not found' }),
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
