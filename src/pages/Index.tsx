import React, { useRef, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import ProductCard from "@/components/ProductCard";
import FeaturedProductCard from "@/components/FeaturedProductCard";
import BannerCard from "@/components/BannerCard";
import { useProducts } from "@/hooks/useProducts";
import { onSnapshot, doc, updateDoc, collection, query, orderBy, limit, setDoc, serverTimestamp } from "firebase/firestore";
import { db, isConfigured } from "@/lib/firebase";
import { expandQuery, getSemanticScore, normalizeText, autoCategorizeProduct } from "@/lib/search-utils";
import { PRODUCT_CATEGORIES, CATEGORY_BRAND_MAP, type ProductCategory } from "@/lib/constants";
import { AlertCircle, Loader2, Share2, Download, Search, X, History, Flame, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const Page = React.forwardRef<HTMLDivElement, PageProps>(({ children, className, style, id }, ref) => {
  return (
    <div
      className={`bg-white shadow-md overflow-hidden flex flex-col border border-gray-200 ${className}`}
      ref={ref}
      style={style}
      id={id}
    >
      {children}
    </div>
  );
});

Page.displayName = "Page";

const DEFAULT_SETTINGS = {
  innerPages: {
    backgroundImage: "",
    leftPageBackgroundColor: "",
    rightPageBackgroundColor: "",
  },
  frontPage: { backgroundImage: "", backgroundColor: "" },
  backPage: { backgroundImage: "", backgroundColor: "" }
};

const Index = () => {
  const { products, loading } = useProducts();
  const bookRef = useRef<any>(null);

  // Catalog Settings state
  const [catalogSettings, setCatalogSettings] = React.useState<any>(null);
  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [isDesktop, setIsDesktop] = React.useState(window.innerWidth >= 768);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [recentSearches, setRecentSearches] = React.useState<string[]>(() => {
    const saved = localStorage.getItem("recent_searches");
    return saved ? JSON.parse(saved) : [];
  });
  const [highlightedProductId, setHighlightedProductId] = React.useState<number | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [captureProgress, setCaptureProgress] = React.useState({ current: 0, total: 0 });
  const [searchParams, setSearchParams] = useSearchParams();
  const [popularKeywords, setPopularKeywords] = React.useState<{ keyword: string, count: number }[]>([]);
  const [popularCategories, setPopularCategories] = React.useState<{ category: string, count: number }[]>([]);

  // Suggestion Form State
  const [suggestionForm, setSuggestionForm] = React.useState({ name: "", brand: "", description: "" });
  const [suggestionSuccess, setSuggestionSuccess] = React.useState(false);
  const [suggestionSubmitting, setSuggestionSubmitting] = React.useState(false);

  // Initial page from URL
  const initialPage = React.useMemo(() => {
    const p = searchParams.get('page');
    if (!p) return 0;
    const parsed = parseInt(p);
    return isNaN(parsed) ? 0 : Math.max(0, parsed - 1);
  }, []); // Only once on mount

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-amber-100 text-center animate-in fade-in zoom-in duration-500">
          <div className="bg-amber-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">Connection Pending</h1>
          <p className="text-gray-500 text-sm mb-6 font-medium leading-relaxed">
            The catalog is waiting for its configuration. If you are the administrator, please ensure environment variables are set.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-[10px] font-mono text-gray-400 break-all mb-6">
            Status: Awaiting Firebase API Key
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-jumia-purple text-white rounded-xl py-6 font-bold shadow-lg shadow-jumia-purple/20 transition-all active:scale-95"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="relative mb-6">
          <div className="w-20 h-20 border-4 border-gray-100 rounded-full" />
          <div className="w-20 h-20 border-4 border-jumia-purple rounded-full border-t-transparent animate-spin absolute inset-0" />
          <img src="https://ng.jumia.is/cms/jumia_logo_small.png" alt="Jumia" className="w-10 h-10 absolute inset-0 m-auto animate-pulse" />
        </div>
        <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest animate-pulse">Loading Catalog</h2>
        <p className="text-xs text-gray-400 font-bold mt-2 uppercase tracking-wide">Fetching the latest deals...</p>
      </div>
    );
  }

  // Filter out products without valid images or names (out-of-stock products or sync errors)
  const displayProducts = React.useMemo(() => {
    const filtered = products.filter(p => {
      // 1. Basic check for existence
      if (!p.image || !p.name) return false;

      // 2. Filter by name/displayName patterns
      const fullName = (p.displayName || p.name).toLowerCase();
      const invalidNames = ["not found", "error:", "unnamed product", "no product"];
      if (invalidNames.some(invalid => fullName.includes(invalid))) return false;

      // 3. Filter by image patterns
      const img = p.image.trim().toLowerCase();
      const invalidImages = [
        'placeholder.svg',
        '/placeholder.svg',
        'jumia-logo.png', // The fallback logo used in Admin.tsx
        'no-product'
      ];

      if (img === '' || invalidImages.some(invalid => img.includes(invalid))) return false;

      return true;
    });

    // Prefer the category order from the Google Sheet (column A), fall back to PRODUCT_CATEGORIES
    const categoryOrder: string[] =
      (catalogSettings?.sheetCategoryOrder as string[] | undefined)?.length
        ? (catalogSettings.sheetCategoryOrder as string[])
        : (PRODUCT_CATEGORIES as unknown as string[]);

    return filtered.sort((a, b) => {
      const catA = a.category || "";
      const catB = b.category || "";
      if (catA === catB) return (a.brand || "").localeCompare(b.brand || "");
      const indexA = categoryOrder.indexOf(catA);
      const indexB = categoryOrder.indexOf(catB);
      if (indexA === -1 && indexB === -1) return catA.localeCompare(catB);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [products, catalogSettings?.sheetCategoryOrder]);

  // Chunk products into groups (10 if banner exists, 12 if not)
  const productChunks = React.useMemo(() => {
    const chunks = [];
    let i = 0;
    let spreadIndex = 0;

    // Determine how many spreads to create: 
    // They must cover all products AND all defined banners
    const bannerKeys = Object.keys(catalogSettings?.banners || {});
    const maxBannerSpreadIdx = bannerKeys
      .filter(key => key.startsWith('spread-'))
      .map(key => parseInt(key.split('-')[1]))
      .reduce((max, val) => Math.max(max, val), -1);

    const hasLogosOnPage1 = (catalogSettings?.brandLogos?.length ?? 0) > 0;

    while (i < displayProducts.length || spreadIndex <= maxBannerSpreadIdx) {
      const spreadId = `spread-${spreadIndex}`;
      const hasBanner = !!catalogSettings?.banners?.[spreadId]?.image;

      let size;
      if (spreadIndex === 0 && hasLogosOnPage1) {
        // Spread 0 Left is Logos, so only Right page is available for products
        size = hasBanner ? 4 : 6;
      } else {
        size = hasBanner ? 10 : 12;
      }

      chunks.push(displayProducts.slice(i, i + size));
      i += size;
      spreadIndex++;
    }
    return chunks;
  }, [displayProducts, catalogSettings?.banners, catalogSettings?.brandLogos]);

  // Helper to determine target page for a product based on dynamic chunks
  const getTargetPage = (productId: number) => {
    const hasLogosOnPage1 = (catalogSettings?.brandLogos?.length ?? 0) > 0;

    for (let chunkIdx = 0; chunkIdx < productChunks.length; chunkIdx++) {
      const chunk = productChunks[chunkIdx];
      const prodInChunkIdx = chunk.findIndex(p => p.id === productId);

      if (prodInChunkIdx !== -1) {
        if (chunkIdx === 0 && hasLogosOnPage1) {
          // Spread 0: Left is Logos (Page 1), Right is products (Page 2)
          return 2;
        }

        // General case for spreads
        const spreadStartPage = 1 + (chunkIdx * 2);
        const onLeftPage = prodInChunkIdx < (chunkIdx === 0 && hasLogosOnPage1 ? 0 : 6);
        return spreadStartPage + (onLeftPage ? 0 : 1);
      }
    }
    return 0;
  };

  // Returns the first book page index that contains a product of the given category
  const getCategoryPage = (category: string) => {
    const firstProduct = displayProducts.find(p => p.category === category);
    if (!firstProduct) return 0;
    return getTargetPage(firstProduct.id);
  };

  // Ordered list of categories that actually have products in the current catalog
  // Respects the Google Sheet column-A order when available
  const categoryNav = React.useMemo(() => {
    const present = new Set(displayProducts.map(p => p.category).filter(Boolean));
    const preferredOrder: string[] =
      (catalogSettings?.sheetCategoryOrder as string[] | undefined)?.length
        ? (catalogSettings.sheetCategoryOrder as string[])
        : (PRODUCT_CATEGORIES as unknown as string[]);
    return preferredOrder.filter(c => present.has(c));
  }, [displayProducts, catalogSettings?.sheetCategoryOrder]);

  // Which category is actually dominant on the current spread
  const activeCategoryOnPage = React.useMemo(() => {
    // currentPage 0 = cover, 1+ = inner spreads; spreadIndex = Math.floor((currentPage - 1) / 2)
    if (currentPage === 0) return null;
    const spreadIndex = Math.floor((currentPage - 1) / 2);
    const chunk = productChunks[spreadIndex];
    if (!chunk || chunk.length === 0) return null;
    // Tally categories on this spread and return the most common one
    const tally: Record<string, number> = {};
    for (const p of chunk) {
      if (p.category) tally[p.category] = (tally[p.category] ?? 0) + 1;
    }
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [currentPage, productChunks]);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    // Subscribe to settings
    const unsubscribe = onSnapshot(doc(db, "settings", "catalog"), (snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Deep merge for safe access
        setCatalogSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          innerPages: { ...DEFAULT_SETTINGS.innerPages, ...data.innerPages },
          frontPage: { ...DEFAULT_SETTINGS.frontPage, ...data.frontPage },
          backPage: { ...DEFAULT_SETTINGS.backPage, ...data.backPage },
        });
      }
      setSettingsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Tracking
  useEffect(() => {
    // Unique session ID for presence tracking
    let sessionId = sessionStorage.getItem("jumia_presence_id");
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem("jumia_presence_id", sessionId);
    }

    // Initial updates
    incrementView();
    incrementReader();
    updatePresence(sessionId);

    // Track time on book
    const startTime = Date.now();

    // Heartbeat for presence & potentially time tracking
    const interval = setInterval(() => {
      updatePresence(sessionId!);
    }, 60000);

    return () => {
      clearInterval(interval);
      const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
      updateTimeOnBook(totalSeconds);
    };
  }, []);



  const handleShare = () => {
    incrementShare();
    const shareUrl = window.location.href;
    const pageText = currentPage === 0 ? "the cover" : `Page ${currentPage + 1}`;
    if (navigator.share) {
      navigator.share({
        title: 'Jumia Deals Catalog',
        text: `Check out these hot deals on ${pageText} of the Jumia Catalog!`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      // Fallback
      navigator.clipboard.writeText(shareUrl);
      alert("Link to " + pageText + " copied to clipboard!");
    }
  };

  const handleDownload = async () => {
    if (isCapturing) return;

    incrementDownload();
    setIsCapturing(true);

    const book = bookRef.current?.pageFlip();
    if (!book) {
      setIsCapturing(false);
      return;
    }

    try {
      const totalPagesToCapture = totalPages;
      setCaptureProgress({ current: 0, total: totalPagesToCapture });

      // Create PDF: p = portrait, pt = points, a4 = format
      // Custom format based on page dimensions (isDesktop ? 380x480 : 320x420)
      const pdfWidth = isDesktop ? 380 : 320;
      const pdfHeight = isDesktop ? 480 : 420;
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });

      const options = {
        scale: 3, // High quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: pdfWidth,
        windowHeight: pdfHeight,
        onclone: (doc) => {
          // Force rendering of certain elements if needed
          const captureEl = doc.getElementById('pdf-capture-container');
          if (captureEl) {
            captureEl.style.opacity = '1';
            captureEl.style.visibility = 'visible';
            captureEl.style.left = '0';
          }
        }
      };

      for (let i = 0; i < totalPagesToCapture; i++) {
        setCaptureProgress({ current: i + 1, total: totalPagesToCapture });

        // Target the hidden capture elements instead of the flipbook ones
        const element = document.getElementById(`pdf-page-${i}`);
        if (!element) {
          console.warn(`Hidden page element pdf-page-${i} not found`);
          continue;
        }

        const canvas = await html2canvas(element, options);
        // Using PNG for better quality on text/lines
        const imgData = canvas.toDataURL('image/png');

        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight], 'p');
        }

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`jumia-deals-catalog-${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
      console.error("Download failed:", error);
      alert("Download failed. Please try again.");
    } finally {
      setIsCapturing(false);
      setCaptureProgress({ current: 0, total: 0 });
    }
  };




  const handleAutoSync = async (settings: any) => {
    if (!settings?.autoSyncInterval) return;

    // Check if interval passed
    const lastSync = settings.lastSyncTimestamp || 0;
    const intervalMs = settings.autoSyncInterval * 3600 * 1000;

    if (Date.now() - lastSync < intervalMs) return;

    console.log("Auto-syncing catalog from sheet...");
    try {
      const sheetUrl = import.meta.env.VITE_SHEET_URL;
      if (!sheetUrl) return;
      const response = await fetch(sheetUrl);
      const csvText = await response.text();

      const lines = csvText.split('\n');
      if (lines.length === 0) return;

      const parseCsvLine = (line: string) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = "";
          } else current += char;
        }
        result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        return result;
      };

      const headerRow = parseCsvLine(lines[0]);
      const colMap: Record<string, number> = {};
      headerRow.forEach((col, idx) => {
        const norm = col.toLowerCase().replace(/[^a-z]/g, '');
        if (norm === 'category') colMap.category = idx;
        else if (norm === 'sku') colMap.sku = idx;
        else if (norm === 'productname' || norm === 'name') colMap.name = idx;
        else if (norm === 'brandname' || norm === 'brand') colMap.brand = idx;
        else if (norm === 'oldprice') colMap.oldPrice = idx;
        else if (norm === 'newprice' || norm === 'price') colMap.price = idx;
      });

      const mapping = {
        category: colMap.category ?? 0,
        sku: colMap.sku ?? 1,
        name: colMap.name ?? 2,
        brand: colMap.brand ?? 3,
        oldPrice: colMap.oldPrice ?? 4,
        price: colMap.price ?? 5
      };

      const rows = lines.slice(1).map(parseCsvLine).filter(row => row.length > 2 && row[mapping.sku]);
      if (rows.length === 0) return;

      const cleanPrice = (val: string) => {
        if (!val) return 0;
        const digits = val.replace(/[^\d.]/g, '');
        if (!digits) return 0;
        const numeric = parseFloat(digits);
        return isNaN(numeric) ? 0 : Math.round(numeric);
      };

      for (const row of rows) {
        const sku = row[mapping.sku];
        const category = row[mapping.category] || "";
        const name = row[mapping.name] || "Unnamed Product";
        const brand = row[mapping.brand] || "";
        const sheetOldPrice = cleanPrice(row[mapping.oldPrice]);
        const sheetPrice = cleanPrice(row[mapping.price]);

        // Prepend brand to name if it's not already there for display purposes
        const brandSafe = brand.trim();
        const nameSafe = name.trim();
        const displayName = (brandSafe && !nameSafe.toLowerCase().startsWith(brandSafe.toLowerCase()))
          ? `${brandSafe} ${nameSafe}`
          : nameSafe;

        const existingProduct = products.find(p => p.sku === sku);

        if (existingProduct) {
          const priceChangedInSheet = sheetPrice !== (existingProduct.lastSyncedPrice ?? -1);
          const oldPriceChangedInSheet = sheetOldPrice !== (existingProduct.lastSyncedOldPrice ?? -1);

          if (priceChangedInSheet || oldPriceChangedInSheet || typeof existingProduct.lastSyncedPrice === 'undefined') {
            const updateData: any = {
              displayName,
              brand: brandSafe,
              category,
              lastSyncedPrice: sheetPrice,
              lastSyncedOldPrice: sheetOldPrice
            };

            if (priceChangedInSheet || typeof existingProduct.lastSyncedPrice === 'undefined') {
              updateData.price = sheetPrice;
            }
            if (oldPriceChangedInSheet || typeof existingProduct.lastSyncedOldPrice === 'undefined') {
              updateData.oldPrice = sheetOldPrice;
            }

            updateData.prices = {
              price: updateData.price ?? existingProduct.price,
              oldPrice: updateData.oldPrice ?? existingProduct.oldPrice
            };

            await updateDoc(doc(db, "products", existingProduct.id.toString()), updateData);
          }
        }
      }

      // Collect the ordered list of unique categories as they appear in the sheet (top→bottom)
      const sheetCategoryOrder: string[] = [];
      const seenCats = new Set<string>();
      for (const row of rows) {
        const cat = (row[mapping.category] || "").trim();
        if (cat && !seenCats.has(cat)) {
          sheetCategoryOrder.push(cat);
          seenCats.add(cat);
        }
      }

      await updateDoc(doc(db, "settings", "catalog"), {
        lastSyncTimestamp: Date.now(),
        ...(sheetCategoryOrder.length > 0 ? { sheetCategoryOrder } : {})
      });
    } catch (error) {
      console.error("Auto-sync failed:", error);
    }
  };

  React.useEffect(() => {
    if (!loading && !settingsLoading && catalogSettings) {
      handleAutoSync(catalogSettings);
    }
  }, [loading, settingsLoading]);

  // Bootstrap: if sheetCategoryOrder is missing (first run / old data), fetch it now
  React.useEffect(() => {
    if (settingsLoading || catalogSettings?.sheetCategoryOrder?.length) return;
    const sheetUrl = import.meta.env.VITE_SHEET_URL;
    if (!sheetUrl) return;

    (async () => {
      try {
        const response = await fetch(sheetUrl);
        const csvText = await response.text();
        const lines = csvText.split('\n');
        if (lines.length < 2) return;

        const parseCsvLine = (line: string) => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
              result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
              current = "";
            } else current += char;
          }
          result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          return result;
        };

        const headerRow = parseCsvLine(lines[0]);
        const categoryColIdx = headerRow.findIndex(h =>
          h.toLowerCase().replace(/[^a-z]/g, '') === 'category'
        );
        if (categoryColIdx === -1) return;

        const order: string[] = [];
        const seen = new Set<string>();
        for (const line of lines.slice(1)) {
          const row = parseCsvLine(line);
          const cat = (row[categoryColIdx] || "").trim();
          if (cat && !seen.has(cat)) { order.push(cat); seen.add(cat); }
        }
        if (order.length > 0) {
          await updateDoc(doc(db, "settings", "catalog"), { sheetCategoryOrder: order });
        }
      } catch (e) {
        console.error("Category order bootstrap failed:", e);
      }
    })();
  }, [settingsLoading, catalogSettings?.sheetCategoryOrder]);


  // Calculate total pages for centering logic
  React.useEffect(() => {
    // 1 (Front) + inner spreads + 1 (Back)
    // Pages: 0 (Front), 1-N (Inner), N+1 (Back)
    const count = 1 + (productChunks.length * 2) + 1;
    setTotalPages(count);
  }, [productChunks.length]);

  // Fetch Popular Suggestions
  useEffect(() => {
    const keywordsQuery = query(collection(db, "search_keywords"), orderBy("count", "desc"), limit(8));
    const categoriesQuery = query(collection(db, "search_categories"), orderBy("count", "desc"), limit(8));

    const unsubKeywords = onSnapshot(keywordsQuery, (snap) => {
      setPopularKeywords(snap.docs.map(doc => doc.data() as any));
    });

    const unsubCategories = onSnapshot(categoriesQuery, (snap) => {
      setPopularCategories(snap.docs.map(doc => doc.data() as any));
    });

    return () => {
      unsubKeywords();
      unsubCategories();
    };
  }, []);

  const performSearch = () => {
    if (searchQuery.trim().length <= 1) return;

    // Save to recent searches
    const cleanQuery = searchQuery.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== cleanQuery);
      const updated = [cleanQuery, ...filtered].slice(0, 5);
      localStorage.setItem("recent_searches", JSON.stringify(updated));
      return updated;
    });

    logSearchKeyword(cleanQuery);

    const filtered = displayProducts
      .map(p => ({
        product: p,
        score: getSemanticScore(p, searchQuery)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (filtered.length > 0) {
      const { product } = filtered[0];
      const targetPage = getTargetPage(product.id);
      const book = bookRef.current?.pageFlip();

      if (book) {
        const currentPageIndex = book.getCurrentPageIndex();
        const isVisible = isDesktop
          ? (currentPageIndex === targetPage || (currentPageIndex % 2 !== 0 && currentPageIndex + 1 === targetPage))
          : currentPageIndex === targetPage;

        if (!isVisible) {
          book.flip(targetPage);
        }
      }

      setHighlightedProductId(product.id);
      setSearchQuery("");
      setIsSearchFocused(false);
      setTimeout(() => setHighlightedProductId(null), 5000);
    }
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] font-outfit overflow-hidden flex flex-col items-center justify-between py-2 md:py-4 px-2 md:px-4 relative bg-gradient-to-br from-jumia-purple to-jumia-teal fixed inset-0">

      {/* Control Bar */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={handleShare} className="bg-white p-2 rounded-full shadow hover:bg-gray-50 text-gray-700" title="Share">
          <Share2 size={20} />
        </button>
        <button
          onClick={handleDownload}
          className="bg-white p-2 rounded-full shadow hover:bg-gray-50 text-gray-700 disabled:opacity-50"
          title="Download/Print"
          disabled={isCapturing}
        >
          {isCapturing ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
        </button>
      </div>

      {isCapturing && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300 max-w-xs w-full">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-jumia-purple" />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-jumia-purple">
                {Math.round((captureProgress.current / captureProgress.total) * 100)}%
              </div>
            </div>
            <div className="text-center">
              <p className="font-black text-gray-900 uppercase tracking-widest mb-1">
                Generating PDF
              </p>
              <p className="text-sm font-bold text-gray-500">
                Processing page {captureProgress.current} of {captureProgress.total}
              </p>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-jumia-purple transition-all duration-300 ease-out"
                style={{ width: `${(captureProgress.current / captureProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 font-medium italic">
              Please don't close this tab...
            </p>
          </div>
        </div>
      )}


      {/* Background with blur effect */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{ backgroundImage: `url(${catalogBg})` }}
      />

      {/* Search Backdrop (closes results when clicking away) */}
      {isSearchFocused && (
        <div
          className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]"
          onClick={() => setIsSearchFocused(false)}
        />
      )}

      {/* Search Bar */}
      <div className="w-full max-w-md mb-2 md:mb-3 relative z-50 px-4 md:px-0 shrink-0">
        <div className="relative group">
          <button
            onClick={performSearch}
            className="absolute inset-y-0 left-3 flex items-center z-10 text-gray-400 group-focus-within:text-jumia-purple transition-all hover:scale-110 active:scale-95"
            title="Search"
          >
            <Search size={18} />
          </button>
          <Input
            type="text"
            placeholder="Search products, brands, or deals..."
            className="pl-10 pr-10 py-7 bg-white/95 backdrop-blur-md border-2 border-white/50 shadow-2xl rounded-2xl focus:ring-4 focus:ring-jumia-purple/20 focus:border-jumia-purple transition-all text-gray-900 placeholder:text-gray-400 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch();
              }
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 px-1 hover:scale-110 transition-transform"
            >
              <X size={20} />
            </button>
          )}
        </div>
        {/* Search Suggestion UI (Recent & Popular) */}
        {isSearchFocused && searchQuery.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <History size={16} className="text-gray-400" />
                    Recently searched
                  </h3>
                  <button
                    onClick={() => {
                      setRecentSearches([]);
                      localStorage.removeItem("recent_searches");
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((s, i) => {
                    const mathingProduct = displayProducts.find(p =>
                      p.name.toLowerCase().includes(s.toLowerCase()) ||
                      p.displayName?.toLowerCase().includes(s.toLowerCase())
                    );

                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setSearchQuery(s);
                          setTimeout(performSearch, 10);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 hover:bg-jumia-purple/10 active:scale-95 transition-all rounded-full text-xs font-medium text-gray-700 border border-transparent hover:border-jumia-purple/20"
                      >
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                          {mathingProduct?.image ? (
                            <img src={mathingProduct.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Search size={10} className="text-gray-400" />
                          )}
                        </div>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Flame size={16} className="text-orange-500" />
                  Popular right now
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Dynamic Popular Categories */}
                {popularCategories.length > 0 ? (
                  popularCategories.map((item, i) => {
                    const cat = item.category;
                    const sampleProduct = displayProducts.find(p => p.category === cat);
                    const emojis: Record<string, string> = {
                      "Appliances": "🍳",
                      "Phones & Tablets": "📱",
                      "Health & Beauty": "💄",
                      "Home & Office": "🏡",
                      "Electronics": "📺",
                      "Fashion": "👔",
                      "Supermarket": "🛒",
                      "Computing": "💻",
                      "Gaming": "🎮"
                    };

                    return (
                      <button
                        key={`cat-${i}`}
                        onClick={() => {
                          setSearchQuery(cat);
                          setTimeout(performSearch, 10);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-jumia-purple/10 active:scale-95 transition-all rounded-full text-xs font-bold text-gray-700 border border-gray-100 hover:border-jumia-purple/20 shadow-sm"
                      >
                        {sampleProduct ? (
                          <img src={sampleProduct.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px]">
                            {emojis[cat] || "📂"}
                          </div>
                        )}
                        {emojis[cat]} {cat.toLowerCase()}
                      </button>
                    );
                  })
                ) : (
                  // Fallback to initial predefined categories if no analytics yet
                  PRODUCT_CATEGORIES.slice(0, 6).map((cat, i) => (
                    <button
                      key={`fallback-cat-${i}`}
                      onClick={() => { setSearchQuery(cat); setTimeout(performSearch, 10); }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-jumia-purple/10 rounded-full text-xs font-bold text-gray-700 border border-gray-100"
                    >
                      {cat.toLowerCase()}
                    </button>
                  ))
                )}

                {/* Dynamic Popular Keywords */}
                {popularKeywords.map((item, i) => {
                  const kw = item.keyword;
                  const matchingProduct = displayProducts.find(p =>
                    p.name.toLowerCase().includes(kw.toLowerCase()) ||
                    p.displayName?.toLowerCase().includes(kw.toLowerCase())
                  );

                  return (
                    <button
                      key={`kw-${i}`}
                      onClick={() => {
                        setSearchQuery(kw);
                        setTimeout(performSearch, 10);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 hover:bg-jumia-purple/10 active:scale-95 transition-all rounded-full text-xs font-medium text-gray-700 border border-gray-100 shadow-sm"
                    >
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gray-100">
                        {matchingProduct?.image ? (
                          <img src={matchingProduct.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Search size={10} className="text-gray-400" />
                        )}
                      </div>
                      {kw}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Search Results Dropdown */}
        {isSearchFocused && searchQuery.length > 1 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 max-h-96 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {(() => {
              const filtered = displayProducts
                .map(p => ({
                  product: p,
                  score: getSemanticScore(p, searchQuery)
                }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(item => item.product);

              if (filtered.length === 0) {
                return (
                  <div className="p-8 text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="text-gray-400 italic font-medium">No results found in this catalogue for "{searchQuery}"</div>
                    <div className="h-px w-full bg-gray-100" />
                    <p className="text-[11px] text-gray-500 leading-relaxed max-w-[280px]">
                      Check <span className="font-bold text-jumia-purple">Jumia Mall</span> and explore more options!
                      <br />
                      <span className="text-[9px] opacity-60 font-medium">
                        (Note: The exclusive offers in this catalogue may not cover the products found on the main site)
                      </span>
                    </p>
                    <button
                      onClick={() => {
                        const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(searchQuery)}`;
                        window.open(url, '_blank');
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 bg-jumia-purple text-white text-xs font-bold rounded-xl hover:bg-jumia-purple/90 active:scale-95 transition-all shadow-lg hover:shadow-jumia-purple/20"
                    >
                      {/* Shop Icon removed temporarily */}
                      Shop on Jumia Mall
                    </button>
                  </div>
                );
              }

              return filtered.map((product) => {
                const targetPage = getTargetPage(product.id);

                return (
                  <button
                    key={product.id}
                    className="w-full p-3 flex items-center gap-4 hover:bg-jumia-purple/5 border-b border-gray-100 last:border-none transition-colors group"
                    onClick={() => {
                      const book = bookRef.current?.pageFlip();
                      if (book) {
                        const currentPageIndex = book.getCurrentPageIndex();
                        const isVisible = isDesktop
                          ? (currentPageIndex === targetPage || (currentPageIndex % 2 !== 0 && currentPageIndex + 1 === targetPage))
                          : currentPageIndex === targetPage;

                        if (!isVisible) {
                          book.flip(targetPage);
                        }
                      }
                      setHighlightedProductId(product.id);
                      setSearchQuery("");
                      setIsSearchFocused(false);

                      // Log the search-to-product mapping
                      logSearchToProduct(searchQuery, product.id, product.category);
                      if (product.category) logCategorySearch(product.category);

                      setTimeout(() => setHighlightedProductId(null), 5000);
                    }}
                  >
                    <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 p-1">
                      <img src={product.image} alt="" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <h4 className="font-bold text-gray-900 truncate text-sm leading-tight">{product.name}</h4>
                      <p className="text-xs text-gray-500 font-semibold">{product.brand} {product.category ? `• ${product.category}` : ''} • Page {targetPage}</p>
                    </div>
                    <div className="text-jumia-purple font-black text-sm whitespace-nowrap">
                      ₦{product.price.toLocaleString()}
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        )}

        {/* Auto-complete Suggestions (when typing but not specifically searching yet) */}
        {isSearchFocused && searchQuery.length > 0 && searchQuery.length <= 1 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 z-50 overflow-hidden divide-y divide-gray-50">
            <div className="p-2 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">Popular Categories</div>
            {PRODUCT_CATEGORIES.slice(0, 5).map(cat => (
              <button
                key={cat}
                className="w-full text-left p-3 px-4 hover:bg-jumia-purple/5 transition-colors flex items-center gap-3 text-sm font-bold text-gray-700"
                onClick={() => {
                  setSearchQuery(cat);
                  // Trigger search immediately
                  setTimeout(performSearch, 10);
                }}
              >
                <Search size={14} className="text-gray-400" />
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Navigation Strip */}
      {categoryNav.length > 0 && (
        <div className="w-full max-w-md px-4 md:px-0 shrink-0 -mt-1 mb-1 z-40 relative">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
            {categoryNav.map((cat) => {
              const emojis: Record<string, string> = {
                "Appliances": "🍳",
                "Phones & Tablets": "📱",
                "Health & Beauty": "💄",
                "Home & Office": "🏡",
                "Electronics": "📺",
                "Fashion": "👔",
                "Supermarket": "🛒",
                "Computing": "💻",
                "Gaming": "🎮"
              };
              const targetPage = getCategoryPage(cat);
              const isActive = activeCategoryOnPage === cat;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    const book = bookRef.current?.pageFlip();
                    if (book) book.flip(targetPage);
                  }}
                  className={`snap-start flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 whitespace-nowrap border ${isActive
                    ? "bg-jumia-purple text-white border-jumia-purple shadow-md shadow-jumia-purple/30"
                    : "bg-white/90 text-gray-700 border-white/50 hover:bg-white hover:border-jumia-purple/30 hover:text-jumia-purple shadow-sm"
                    }`}
                >
                  <span>{emojis[cat as keyof typeof emojis] ?? "📂"}</span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="relative z-10 w-full max-w-6xl flex-1 min-h-0 flex justify-center items-center transition-all duration-700 ease-in-out"
        style={{
          transform: isDesktop
            ? (currentPage === 0
              ? 'translateX(-25%)'
              : currentPage === totalPages - 1
                ? 'translateX(25%)'
                : 'translateX(0)')
            : 'none'
        }}
      >
        {/* @ts-expect-error react-pageflip types are sometimes tricky with newer react */}
        <HTMLFlipBook
          key={isDesktop ? 'desktop' : 'mobile'}
          width={isDesktop ? 380 : 320}
          height={isDesktop ? 480 : 420}
          size="stretch"
          minWidth={isDesktop ? 280 : 250}
          maxWidth={700}
          minHeight={350}
          maxHeight={600}
          maxShadowOpacity={0.5}
          className="jumia-book shadow-2xl mx-auto"
          ref={bookRef}
          showCover={true}
          mobileScrollSupport={true}
          usePortrait={!isDesktop}
          flippingTime={1000}
          startPage={initialPage > 0 ? initialPage : 0}
          drawShadow={true}
          useMouseEvents={true}
          onFlip={(e) => {
            const newPage = e.data;
            setCurrentPage(newPage);
            // Update URL silently
            setSearchParams({ page: (newPage + 1).toString() }, { replace: true });
          }}
        >
          {/* COVER PAGE */}
          <Page className="bg-white text-gray-900 border-none" id="page-0">
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2 md:gap-6 p-4 md:p-12 text-center bg-white relative overflow-hidden bg-cover bg-center"
              style={{
                ...(catalogSettings?.frontPage?.backgroundImage ? { backgroundImage: `url(${catalogSettings.frontPage.backgroundImage})` } : {}),
                ...(catalogSettings?.frontPage?.backgroundColor ? { backgroundColor: catalogSettings.frontPage.backgroundColor } : {})
              }}
            >
              {/* Decorative Circle */}
              <div
                className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-[#FF9900]/10 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: `${catalogSettings?.frontPage?.primaryColor || '#FF9900'}1A` }}
              />
              <div
                className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-[#009FE3]/10 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: `${catalogSettings?.frontPage?.secondaryColor || '#009FE3'}1A` }}
              />

              <div className="mb-2 md:mb-8 z-10">
                <img
                  src="https://ng.jumia.is/cms/jumia_logo_small.png"
                  alt="Jumia Logo"
                  className="h-10 md:h-16 w-auto object-contain"
                />
              </div>

              <div className="relative z-10">
                <h1 className="text-4xl md:text-7xl font-black tracking-tighter uppercase italic drop-shadow-sm leading-tight text-gray-900">
                  {catalogSettings?.frontPage?.title || "HOTTEST"} <br />
                  <span
                    className="drop-shadow-sm"
                    style={{ color: catalogSettings?.frontPage?.primaryColor || '#FF9900' }}
                  >
                    {catalogSettings?.frontPage?.subtitle || "DEALS!"}
                  </span>
                </h1>
                <div
                  className="absolute -bottom-4 right-0 text-white text-[10px] md:text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 rotate-[-5deg] shadow-md rounded-sm"
                  style={{ backgroundColor: catalogSettings?.frontPage?.secondaryColor || '#009FE3' }}
                >
                  LIMITED TIME
                </div>
              </div>

              <p className="text-sm md:text-xl font-bold tracking-widest uppercase mt-3 md:mt-8 opacity-70 text-gray-600 z-10">
                {catalogSettings?.frontPage?.tagline || "Digital Catalog 2026"}
              </p>

              <div className="mt-4 md:mt-12 px-6 md:px-8 py-2 md:py-3 border-2 border-gray-200 rounded-full text-xs md:text-sm font-bold text-gray-900 bg-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-bounce z-10">
                {catalogSettings?.frontPage?.footerText || "CLICK TO OPEN"}
              </div>
            </div>
          </Page>

          {/* DYNAMIC PAGES */}
          {productChunks.flatMap((chunk, index) => {
            const pageNum = index * 2 + 1;
            const hasLogosOnPage1 = index === 0 && (catalogSettings?.brandLogos?.length ?? 0) > 0;
            const spreadId = `spread-${index}`;
            const banner = catalogSettings?.banners?.[spreadId];
            const hasBanner = !!banner?.image;

            let leftPageProducts: any[] = [];
            let rightPageProducts: any[] = [];

            if (hasLogosOnPage1) {
              leftPageProducts = [];
              rightPageProducts = hasBanner ? chunk.slice(0, 4) : chunk.slice(0, 6);
            } else {
              leftPageProducts = chunk.slice(0, 6);
              rightPageProducts = hasBanner ? chunk.slice(6, 10) : chunk.slice(6, 12);
            }

            const allPageProducts = [...leftPageProducts, ...rightPageProducts];
            const categories = allPageProducts.map(p => p.category).filter(Boolean);
            const predominantCategory = categories.length > 0
              ? categories.reduce((acc, curr) => (categories.filter(v => v === curr).length > categories.filter(v => v === acc).length ? curr : acc))
              : "Best Deals";

            const categoryBrands = (predominantCategory && predominantCategory !== "Best Deals")
              ? (CATEGORY_BRAND_MAP[predominantCategory as ProductCategory] || [])
              : [];

            const relevantBrandLogos = (catalogSettings?.brandLogos as any[] || []).filter(b =>
              categoryBrands.some(cb => b.name.toLowerCase().includes(cb.toLowerCase()))
            ).slice(0, 4);

            return [
              /* LEFT PAGE */
              <Page
                key={`page-${pageNum}`}
                id={`page-${pageNum}`}
                className="bg-[#E6F7FF] bg-cover bg-center"
                style={{
                  ...(catalogSettings?.innerPages?.backgroundImage ? { backgroundImage: `url(${catalogSettings.innerPages.backgroundImage})` } : {}),
                  ...(catalogSettings?.innerPages?.leftPageBackgroundColor ? { backgroundColor: catalogSettings.innerPages.leftPageBackgroundColor } : {})
                }}
              >
                {/* DEDICATED BRAND LOGOS PAGE — now on Page 1 (index 0) */}
                {hasLogosOnPage1 ? (
                  <div className="w-full h-full flex flex-row">
                    {/* Brand Logos Content */}
                    <div className="flex-1 p-2 md:p-3 flex flex-col min-h-0 overflow-hidden">
                      {/* Header */}
                      <div className="text-center mb-1.5 flex-shrink-0">
                        <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Our</p>
                        <h2 className="text-sm md:text-base font-black text-gray-800 uppercase tracking-wide leading-tight">Brand Partners</h2>
                        <div className="h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent mt-1" />
                      </div>
                      {/* Logo Grid */}
                      <div className="flex-1 grid grid-cols-3 gap-1.5 md:gap-2 content-center">
                        {(catalogSettings.brandLogos as any[]).map((b: any, i: number) =>
                          b.linkUrl ? (
                            <a
                              key={i}
                              href={b.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={b.name}
                              className="bg-white rounded-lg p-1.5 md:p-2 flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 transition-all border border-gray-100 aspect-[2/1]"
                            >
                              {b.logoUrl
                                ? <img src={b.logoUrl} alt={b.name} className="max-h-full max-w-full object-contain" />
                                : <span className="text-[7px] md:text-[9px] font-black text-gray-700 text-center leading-tight">{b.name}</span>
                              }
                            </a>
                          ) : (
                            <div
                              key={i}
                              title={b.name}
                              className="bg-white rounded-lg p-1.5 md:p-2 flex items-center justify-center shadow-sm border border-gray-100 aspect-[2/1]"
                            >
                              {b.logoUrl
                                ? <img src={b.logoUrl} alt={b.name} className="max-h-full max-w-full object-contain" />
                                : <span className="text-[7px] md:text-[9px] font-black text-gray-700 text-center leading-tight">{b.name}</span>
                              }
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    {/* Left Sidebar Header */}
                    <div className="w-10 md:w-14 bg-[#E6E0F8] border-l border-white flex flex-col items-center py-3 md:py-6 relative shadow-inner z-10">
                      <div className="flex-1 flex items-center justify-center">
                        <h2 className="text-xl md:text-3xl font-black text-[#1F1F1F] tracking-wide rotate-90 whitespace-nowrap uppercase opacity-80">
                          Partners
                        </h2>
                      </div>
                      <div className="bg-purple-200 p-1 md:p-1.5 rounded-full mt-3 md:mt-6">
                        <svg className="w-4 h-4 md:w-6 md:h-6 text-purple-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* NORMAL LEFT PAGE */
                  <div className="w-full h-full flex flex-row">
                    <div className="w-10 md:w-14 bg-[#009FE3] flex flex-col items-center py-3 md:py-6 relative shadow-lg z-10">
                      <div className="bg-black/20 p-1 md:p-1.5 rounded-full mb-3 md:mb-6">
                        <svg className="w-4 h-4 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" /></svg>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <h2 className="text-xl md:text-3xl font-black text-white tracking-wide -rotate-90 whitespace-nowrap uppercase drop-shadow-md">
                          Best Deals
                        </h2>
                      </div>
                    </div>
                    <div className="flex-1 p-1.5 md:p-2 grid grid-cols-2 grid-rows-3 gap-1.5 md:gap-2 content-start">
                      {leftPageProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          highlighted={product.id === highlightedProductId}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Page Number */}
                <div className="absolute bottom-2 left-4 text-[9px] font-bold text-gray-400">
                  {pageNum}
                </div>
              </Page>,

              /* RIGHT PAGE */
              <Page
                key={`page-${pageNum + 1}`}
                id={`page-${pageNum + 1}`}
                className="bg-[#E2E0F5] bg-cover bg-center"
                style={{
                  ...(catalogSettings?.innerPages?.backgroundImage ? { backgroundImage: `url(${catalogSettings.innerPages.backgroundImage})` } : {}),
                  ...(catalogSettings?.innerPages?.rightPageBackgroundColor ? { backgroundColor: catalogSettings.innerPages.rightPageBackgroundColor } : {})
                }}
              >
                {/* NORMAL PRODUCT PAGE */}
                <div className="w-full h-full flex flex-row">
                  <div className="flex-1 p-1.5 md:p-2 flex flex-col gap-1 md:gap-1.5 min-h-0 overflow-hidden">
                    <div className={`grid grid-cols-2 gap-1.5 md:gap-2 min-h-0 ${hasBanner ? "grid-rows-2 flex-1" : "grid-rows-3 flex-1"}`}>
                      {rightPageProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          highlighted={product.id === highlightedProductId}
                        />
                      ))}
                    </div>
                    {hasBanner && (
                      <div className="h-[100px] md:h-[120px] flex-shrink-0">
                        <BannerCard image={banner.image} url={banner.url} />
                      </div>
                    )}
                  </div>
                  <div className="w-10 md:w-14 bg-[#E6E0F8] border-l border-white flex flex-col items-center py-3 md:py-6 relative shadow-inner z-10">
                    <div className="flex-1 flex items-center justify-center">
                      <h2 className="text-xl md:text-3xl font-black text-[#1F1F1F] tracking-wide rotate-90 whitespace-nowrap uppercase opacity-80">
                        Top Picks
                      </h2>
                    </div>
                    <div className="bg-purple-200 p-1 md:p-1.5 rounded-full mt-3 md:mt-6">
                      <svg className="w-4 h-4 md:w-6 md:h-6 text-purple-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                {/* Page Number & Relevant Brands */}
                <div className="absolute bottom-3 left-6 right-6 flex justify-between items-center">
                  <div className="flex gap-2">
                    {relevantBrandLogos.map((b, i) => (
                      <div key={i} className="h-4 md:h-6 bg-white/50 rounded-md p-1 shadow-sm">
                        <img src={b.logoUrl} alt={b.name} className="h-full object-contain" />
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Page {String(pageNum + 1).padStart(2, '0')}
                  </div>
                </div>
              </Page>
            ];
          })}

          {/* BACK COVER */}
          <Page className="bg-[#f5f5f5] text-gray-800" id={`page-${1 + productChunks.length * 2}`}>
            <div
              className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 text-center border-l border-gray-200 bg-cover bg-center overflow-y-auto"
              style={{
                ...(catalogSettings?.backPage?.backgroundImage ? { backgroundImage: `url(${catalogSettings.backPage.backgroundImage})` } : {}),
                ...(catalogSettings?.backPage?.backgroundColor ? { backgroundColor: catalogSettings.backPage.backgroundColor } : {})
              }}
            >
              {!suggestionSuccess ? (
                <div className="w-full max-w-sm bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-jumia-purple/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    {/* Icon removed temporarily */}
                  </div>
                  <h2 className="text-lg font-black text-gray-900 mb-1">Missing something?</h2>
                  <p className="text-[11px] text-gray-500 mb-6 font-medium">Suggest a product you'd like to see on Jumia!</p>

                  <div className="space-y-3 text-left">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 mb-1 block">Product Name</label>
                      <input
                        className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-jumia-purple/20 focus:border-jumia-purple transition-all outline-none"
                        placeholder="e.g. Baby Diapers"
                        value={suggestionForm.name}
                        onChange={(e) => setSuggestionForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 mb-1 block">Preferred Brand</label>
                      <input
                        className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-jumia-purple/20 focus:border-jumia-purple transition-all outline-none"
                        placeholder="e.g. Pampers"
                        value={suggestionForm.brand}
                        onChange={(e) => setSuggestionForm(prev => ({ ...prev, brand: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 mb-1 block">Description</label>
                      <textarea
                        className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-jumia-purple/20 focus:border-jumia-purple transition-all outline-none resize-none"
                        placeholder="Any specific features..."
                        rows={2}
                        value={suggestionForm.description}
                        onChange={(e) => setSuggestionForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>

                  <button
                    disabled={suggestionSubmitting || !suggestionForm.name}
                    onClick={async () => {
                      setSuggestionSubmitting(true);
                      try {
                        await setDoc(doc(collection(db, "product_suggestions")), {
                          ...suggestionForm,
                          timestamp: serverTimestamp()
                        });
                        setSuggestionSuccess(true);
                        setTimeout(() => {
                          setSuggestionSuccess(false);
                          setSuggestionForm({ name: "", brand: "", description: "" });
                        }, 3000);
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setSuggestionSubmitting(false);
                      }
                    }}
                    className="w-full mt-6 py-3 bg-jumia-purple text-white rounded-xl text-xs font-bold shadow-lg shadow-jumia-purple/20 hover:bg-jumia-purple/90 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2"
                  >
                    {suggestionSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Submit Suggestion"}
                  </button>
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in duration-300">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-gray-900">Thank You!</h3>
                  <p className="text-sm text-gray-500 font-medium">We've received your suggestion.</p>
                </div>
              )}

              <div className="mt-8 flex flex-col items-center">
                <div className="w-20 h-20 bg-white p-2 shadow-lg rounded-xl mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(catalogSettings?.backPage?.qrCodeUrl || "https://jumia.com.ng")}`}
                    alt="QR Code"
                    className="w-full h-full opacity-90"
                  />
                </div>
                <div className="flex items-center gap-2 opacity-30 text-[10px] font-black uppercase tracking-[0.2em]">
                  <span>{catalogSettings?.backPage?.footerText?.split('©')[0]?.trim() || "JUMIA"}</span>
                  <span>&copy; {new Date().getFullYear()}</span>
                </div>
              </div>
            </div>
          </Page>
        </HTMLFlipBook>
      </div>

      {/* BOTTOM NAVIGATION CONTROLS */}
      <div className="flex items-center gap-8 z-50 shrink-0 pb-1 md:pb-0 mt-2">
        <button
          onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
          className={`p-3 rounded-full transition-colors group ${isDesktop ? 'hover:bg-gray-100 bg-white shadow-md' : 'bg-transparent text-white'}`}
        >
          <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
        </button>

        <div className="bg-white/90 backdrop-blur-md px-6 py-2.5 rounded-full shadow-xl flex items-center gap-3 border border-white/20">
          <span className="text-sm font-black text-jumia-purple">
            {currentPage + 1} <span className="opacity-30 mx-1">/</span> {totalPages}
          </span>
        </div>

        <button
          onClick={() => bookRef.current?.pageFlip()?.flipNext()}
          className={`p-3 rounded-full transition-colors group ${isDesktop ? 'hover:bg-gray-100 bg-white shadow-md' : 'bg-transparent text-white'}`}
        >
          <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* HIDDEN CAPTURE AREA FOR PDF GENERATION */}
      <div
        id="pdf-capture-container"
        className="fixed top-[-9999px] left-[-9999px] z-[-5000] pointer-events-none"
        style={{
          width: isDesktop ? 380 : 320,
          height: isDesktop ? 480 : 420,
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {/* COVER PAGE */}
        <div
          id="pdf-page-0"
          className="bg-white text-gray-900 border-none relative overflow-hidden bg-cover bg-center"
          style={{
            width: isDesktop ? 380 : 320,
            height: isDesktop ? 480 : 420,
            ...(catalogSettings?.frontPage?.backgroundImage ? { backgroundImage: `url(${catalogSettings.frontPage.backgroundImage})` } : {}),
            ...(catalogSettings?.frontPage?.backgroundColor ? { backgroundColor: catalogSettings.frontPage.backgroundColor } : {})
          }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center p-8 md:p-12 text-center bg-white relative overflow-hidden">
            <div className="mb-8 z-10">
              <img src="https://ng.jumia.is/cms/jumia_logo_small.png" alt="Jumia" className="h-10 md:h-16 w-auto object-contain" />
            </div>



            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-tight text-gray-900">
                {catalogSettings?.frontPage?.title || "HOTTEST"} <br />
                <span style={{ color: catalogSettings?.frontPage?.primaryColor || '#FF9900' }}>
                  {catalogSettings?.frontPage?.subtitle || "DEALS!"}
                </span>
              </h1>
            </div>

            <p className="text-sm md:text-lg font-bold tracking-widest uppercase mt-8 opacity-70 text-gray-600 z-10">
              {catalogSettings?.frontPage?.tagline || "Digital Catalog 2026"}
            </p>
          </div>
        </div>

        {/* DYNAMIC PAGES */}
        {productChunks.flatMap((chunk, index) => {
          const pageNum = index * 2 + 1;
          const hasLogosOnPage1 = index === 0 && (catalogSettings?.brandLogos?.length ?? 0) > 0;
          const spreadId = `spread-${index}`;
          const banner = catalogSettings?.banners?.[spreadId];
          const hasBanner = !!banner?.image;

          let leftPageProducts: any[] = [];
          let rightPageProducts: any[] = [];

          if (hasLogosOnPage1) {
            rightPageProducts = hasBanner ? chunk.slice(0, 4) : chunk.slice(0, 6);
          } else {
            leftPageProducts = chunk.slice(0, 6);
            rightPageProducts = hasBanner ? chunk.slice(6, 10) : chunk.slice(6, 12);
          }

          // Determine page category (majority category in chunks)
          const allPageProducts = [...leftPageProducts, ...rightPageProducts];
          const categories = allPageProducts.map(p => p.category).filter(Boolean);
          const predominantCategory = categories.length > 0
            ? categories.reduce((acc, curr) => (categories.filter(v => v === curr).length > categories.filter(v => v === acc).length ? curr : acc))
            : "Best Deals";

          // Relevant brands for this category from our map
          const categoryBrands = predominantCategory && predominantCategory !== "Best Deals"
            ? CATEGORY_BRAND_MAP[predominantCategory as ProductCategory] || []
            : [];

          // Filter catalogSettings.brandLogos to only show those in categoryBrands
          const relevantBrandLogos = (catalogSettings?.brandLogos as any[] || []).filter(b =>
            categoryBrands.some(cb => b.name.toLowerCase().includes(cb.toLowerCase()))
          ).slice(0, 4);

          return [
            /* LEFT PAGE CAPTURE */
            <div
              key={`pdf-page-${pageNum}`}
              id={`pdf-page-${pageNum}`}
              className="bg-[#E6F7FF] bg-cover bg-center relative"
              style={{
                width: isDesktop ? 380 : 320, height: isDesktop ? 480 : 420,
                ...(catalogSettings?.innerPages?.backgroundImage ? { backgroundImage: `url(${catalogSettings.innerPages.backgroundImage})` } : {}),
                ...(catalogSettings?.innerPages?.leftPageBackgroundColor ? { backgroundColor: catalogSettings.innerPages.leftPageBackgroundColor } : {})
              }}
            >
              <div className="w-full h-full flex flex-row overflow-hidden">
                {hasLogosOnPage1 ? (
                  <div className="flex-1 p-3 flex flex-col min-h-0 overflow-hidden">
                    <div className="text-center mb-2">
                      <h2 className="text-sm font-black text-gray-800 uppercase tracking-wide">Brand Partners</h2>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2 content-center">
                      {(catalogSettings.brandLogos as any[]).map((b: any, i: number) => (
                        <div key={i} className="bg-white rounded-lg p-2 flex items-center justify-center border border-gray-100 aspect-[2/1]">
                          {b.logoUrl ? <img src={b.logoUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] font-black text-gray-700">{b.name}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-2 grid grid-cols-2 grid-rows-3 gap-2 content-start overflow-hidden">
                    {leftPageProducts.map(p => <ProductCard key={p.id} product={p} lazy={false} />)}
                  </div>

                )}
                {/* Simulated Sidebar */}
                <div className="w-10 bg-[#009FE3] flex items-center justify-center">
                  <h2 className="text-sm font-black text-white tracking-wide -rotate-90 whitespace-nowrap uppercase">
                    Best Deals
                  </h2>
                </div>
              </div>
              <div className="absolute bottom-2 left-4 text-[9px] font-bold text-gray-400">{pageNum}</div>
            </div>,

            /* RIGHT PAGE CAPTURE */
            <div
              key={`pdf-page-${pageNum + 1}`}
              id={`pdf-page-${pageNum + 1}`}
              className="bg-[#E2E0F5] bg-cover bg-center relative"
              style={{
                width: isDesktop ? 380 : 320, height: isDesktop ? 480 : 420,
                ...(catalogSettings?.innerPages?.backgroundImage ? { backgroundImage: `url(${catalogSettings.innerPages.backgroundImage})` } : {}),
                ...(catalogSettings?.innerPages?.rightPageBackgroundColor ? { backgroundColor: catalogSettings.innerPages.rightPageBackgroundColor } : {})
              }}
            >
              <div className="w-full h-full flex flex-row overflow-hidden">
                <div className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-hidden">
                  <div className={`grid grid-cols-2 gap-2 min-h-0 ${hasBanner ? "grid-rows-2 flex-1" : "grid-rows-3 flex-1"}`}>
                    {rightPageProducts.map(p => <ProductCard key={p.id} product={p} lazy={false} />)}
                  </div>
                  {hasBanner && <div className="h-24"><img src={banner.image} alt="" className="w-full h-full object-cover rounded-xl" /></div>}


                </div>
                {/* Simulated Sidebar */}
                <div className="w-10 bg-[#E6E0F8] border-l border-white flex items-center justify-center">
                  <h2 className="text-sm font-black text-[#1F1F1F] tracking-wide rotate-90 whitespace-nowrap uppercase opacity-80">
                    Top Picks
                  </h2>
                </div>
              </div>
              <div className="absolute bottom-3 left-6 right-6 flex justify-between items-center">
                <div className="flex gap-2">
                  {relevantBrandLogos.map((b, i) => (
                    <div key={i} className="h-4 md:h-6 bg-white/50 rounded-md p-1 shadow-sm">
                      <img src={b.logoUrl} alt={b.name} className="h-full object-contain" />
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-bold text-gray-400">Page {String(pageNum + 1).padStart(2, '0')}</div>
              </div>
            </div>
          ];
        })}

        {/* BACK COVER CAPTURE */}
        <div
          id={`pdf-page-${1 + productChunks.length * 2}`}
          className="bg-[#f5f5f5] text-gray-800 bg-cover bg-center relative flex flex-col items-center justify-center p-12 text-center"
          style={{
            width: isDesktop ? 380 : 320, height: isDesktop ? 480 : 420,
            ...(catalogSettings?.backPage?.backgroundImage ? { backgroundImage: `url(${catalogSettings.backPage.backgroundImage})` } : {}),
            ...(catalogSettings?.backPage?.backgroundColor ? { backgroundColor: catalogSettings.backPage.backgroundColor } : {})
          }}
        >
          <div className="bg-jumia-purple/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {/* Icon removed temporarily */}
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Have a Suggestion?</h2>
          <p className="text-[10px] text-gray-500 mb-6 font-medium max-w-[200px] mx-auto">Suggest a product you'd like to see on Jumia!</p>

          <div className="w-20 h-20 bg-white p-2 shadow-lg rounded-xl mb-4 mx-auto">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(catalogSettings?.backPage?.qrCodeUrl || "https://jumia.com.ng")}`}
              alt="QR"
              className="w-full h-full"
            />
          </div>
          <div className="flex items-center gap-2 opacity-30 text-[10px] font-black uppercase tracking-[0.2em] mt-4">
            <span>{catalogSettings?.backPage?.footerText?.split('©')[0]?.trim() || "JUMIA"}</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

    </div >
  );
};


export default Index;
