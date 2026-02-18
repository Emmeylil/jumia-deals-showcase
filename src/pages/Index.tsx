import React, { useRef, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import html2canvas from 'html2canvas';
import ProductCard from "@/components/ProductCard";
import FeaturedProductCard from "@/components/FeaturedProductCard";
import BannerCard from "@/components/BannerCard";
import { useProducts } from "@/hooks/useProducts";
import { Loader2, Share2, Download, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import catalogBg from "@/assets/catalog-bg.jpg";
import { incrementView, incrementReader, updateTimeOnBook, incrementShare, incrementDownload } from "@/lib/stats";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const [highlightedProductId, setHighlightedProductId] = React.useState<number | null>(null);

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
    // Track view and reader on mount
    incrementView();
    incrementReader();

    // Track time on book
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      // Update every 10 seconds to avoid spamming writes, or just on unmount
    }, 10000);

    return () => {
      clearInterval(interval);
      const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
      updateTimeOnBook(totalSeconds);
    };
  }, []);

  const handleShare = () => {
    incrementShare();
    if (navigator.share) {
      navigator.share({
        title: 'Jumia Deals Catalog',
        text: 'Check out the hottest deals on Jumia!',
        url: window.location.href,
      }).catch(console.error);
    } else {
      // Fallback
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  const handleDownload = async () => {
    incrementDownload();
    // window.print(); // Removed print logic

    const book = bookRef.current?.pageFlip();
    if (!book) return;

    const currentIndex = book.getCurrentPageIndex();
    const isMobile = window.innerWidth < 768; // Adjust breakpoint as needed

    // Determine which page(s) to capture
    // Cover page is index 0.
    // In landscape mode (desktop), pages are usually displayed in pairs (spread), except maybe cover.
    // However, react-pageflip logic can be tricky.
    // Let's assume:
    // Index 0: Cover
    // Index 1, 2: Spread 1
    // Index 3, 4: Spread 2
    // ...

    // We try to capture the visible element(s).
    // The library doesn't easily expose "visible" DOM elements directly in a simple way without querying.
    // But we assigned IDs!

    // Logic:
    // If index 0 => capture #page-0
    // If index > 0 and isMobile => capture #page-{index}
    // If index > 0 and !isMobile => capture #page-{index} AND #page-{index+1} (if exists) combined? 
    // Actually, `getCurrentPageIndex()` usually returns the index of the left page in a spread (or the single page).

    // Let's try to capture the specific page IDs.

    let captureIds: string[] = [];

    if (currentIndex === 0) {
      captureIds.push("page-0");
    } else {
      if (isMobile) {
        captureIds.push(`page-${currentIndex}`);
      } else {
        // Desktop spread
        // React-pageflip usually treats index 0 as cover (single).
        // Index 1 is left, Index 2 is right.
        // If current index is odd (1, 3, 5...), it's likely the left page of a spread.
        // If it's even (and not 0), it might be right page (but usually it reports left).

        // We will simplify: try to capture the page at currentIndex. 
        // If it's odd, also try currentIndex + 1.

        captureIds.push(`page-${currentIndex}`);
        if (currentIndex % 2 !== 0) { // If odd, assumes left page of spread
          captureIds.push(`page-${currentIndex + 1}`);
        }
      }
    }

    // Filter out IDs that don't exist
    const elements = captureIds.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    if (elements.length === 0) {
      console.error("No pages found to capture");
      return;
    }

    try {
      let canvas;

      if (elements.length === 1) {
        canvas = await html2canvas(elements[0], { scale: 2, useCORS: true });
      } else {
        // Merge two canvases or capture a container?
        // Capturing a container is better if they are side-by-side in DOM.
        // But they are likely inside the flipbook structure with transforms.
        // Better to capture individually and merge in a new canvas.

        const canvas1 = await html2canvas(elements[0], { scale: 2, useCORS: true });
        const canvas2 = await html2canvas(elements[1], { scale: 2, useCORS: true });

        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = canvas1.width + canvas2.width;
        mergedCanvas.height = Math.max(canvas1.height, canvas2.height);
        const ctx = mergedCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas1, 0, 0);
          ctx.drawImage(canvas2, canvas1.width, 0);
        }
        canvas = mergedCanvas;
      }

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `jumia-catalog-page-${currentIndex}.png`;
      link.click();

    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // Chunk products into groups of 10 (6 for left page, 4 for right page)
  const productChunks = [];
  for (let i = 0; i < products.length; i += 10) {
    productChunks.push(products.slice(i, i + 10));
  }

  // Calculate total pages for centering logic
  React.useEffect(() => {
    // 1 (Front) + inner spreads + 1 (Back)
    // Pages: 0 (Front), 1-N (Inner), N+1 (Back)
    const count = 1 + (productChunks.length * 2) + 1;
    setTotalPages(count);
  }, [productChunks.length]);

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] font-gotham overflow-hidden flex flex-col items-center justify-between py-2 md:py-4 px-2 md:px-4 relative bg-gradient-to-br from-jumia-purple to-jumia-teal fixed inset-0">

      {/* Control Bar */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={handleShare} className="bg-white p-2 rounded-full shadow hover:bg-gray-50 text-gray-700" title="Share">
          <Share2 size={20} />
        </button>
        <button onClick={handleDownload} className="bg-white p-2 rounded-full shadow hover:bg-gray-50 text-gray-700" title="Download/Print">
          <Download size={20} />
        </button>
      </div>

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
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-jumia-purple transition-colors">
            <Search size={18} />
          </div>
          <Input
            type="text"
            placeholder="Search products, brands, or deals..."
            className="pl-10 pr-10 py-7 bg-white/95 backdrop-blur-md border-2 border-white/50 shadow-2xl rounded-2xl focus:ring-4 focus:ring-jumia-purple/20 focus:border-jumia-purple transition-all text-gray-900 placeholder:text-gray-400 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.length > 1) {
                const filtered = products.filter(p =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.category?.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filtered.length > 0) {
                  const product = filtered[0];
                  const productIndex = products.findIndex(p => p.id === product.id);
                  const chunkIndex = Math.floor(productIndex / 10);
                  const indexInChunk = productIndex % 10;
                  const onLeftPage = indexInChunk < 6;
                  const targetPage = 1 + (chunkIndex * 2) + (onLeftPage ? 0 : 1);

                  bookRef.current?.pageFlip()?.flip(targetPage);
                  setHighlightedProductId(product.id);
                  setSearchQuery("");
                  setIsSearchFocused(false);
                  setTimeout(() => setHighlightedProductId(null), 5000);
                }
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

        {/* Search Results Dropdown */}
        {isSearchFocused && searchQuery.length > 1 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 max-h-96 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {(() => {
              const filtered = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category?.toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (filtered.length === 0) {
                return <div className="p-8 text-center text-gray-400 italic font-medium">No results found for "{searchQuery}"</div>;
              }

              return filtered.map((product) => {
                const productIndex = products.findIndex(p => p.id === product.id);
                const chunkIndex = Math.floor(productIndex / 10);
                const indexInChunk = productIndex % 10;
                const onLeftPage = indexInChunk < 6;
                const targetPage = 1 + (chunkIndex * 2) + (onLeftPage ? 0 : 1);

                return (
                  <button
                    key={product.id}
                    className="w-full p-3 flex items-center gap-4 hover:bg-jumia-purple/5 border-b border-gray-100 last:border-none transition-colors group"
                    onClick={() => {
                      bookRef.current?.pageFlip()?.flip(targetPage);
                      setHighlightedProductId(product.id);
                      setSearchQuery("");
                      setIsSearchFocused(false);
                      setTimeout(() => setHighlightedProductId(null), 5000);
                    }}
                  >
                    <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 p-1">
                      <img src={product.image} alt="" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <h4 className="font-bold text-gray-900 truncate text-sm leading-tight">{product.name}</h4>
                      <p className="text-xs text-gray-500 font-semibold">{product.brand} • Page {targetPage + 1}</p>
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
      </div>

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
          startPage={0}
          drawShadow={true}
          useMouseEvents={true}
          onFlip={(e) => setCurrentPage(e.data)}
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
            const leftPageProducts = chunk.slice(0, 6);
            const rightPageRegularProducts = chunk.slice(6, 10);

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
                <div className="w-full h-full flex flex-row">
                  {/* Left Sidebar Header */}
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

                  {/* Content Area */}
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
                <div className="w-full h-full flex flex-row">
                  {/* Content Area */}
                  <div className="flex-1 p-1.5 md:p-2 grid grid-cols-2 grid-rows-3 gap-1.5 md:gap-2 content-start">
                    {/* Regular Products (up to 3) */}
                    {rightPageRegularProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        highlighted={product.id === highlightedProductId}
                      />
                    ))}

                    {/* Featured Slot - Banner Placement */}
                    <div className="col-span-2 row-span-1 mt-auto">
                      {(() => {
                        const spreadId = `spread-${index}`;
                        const banner = catalogSettings?.banners?.[spreadId];

                        // Always render BannerCard. It will handle its own placeholder state.
                        return <BannerCard image={banner?.image} url={banner?.url} />;
                      })()}
                    </div>
                  </div>

                  {/* Right Sidebar Header */}
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

                {/* Page Number */}
                <div className="absolute bottom-3 right-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Page {String(pageNum + 1).padStart(2, '0')}
                </div>
              </Page>
            ];
          })}

          {/* BACK COVER */}
          <Page className="bg-[#f5f5f5] text-gray-800" id={`page-${1 + productChunks.length * 2}`}>
            <div
              className="w-full h-full flex flex-col items-center justify-center p-4 md:p-12 text-center border-l border-gray-200 bg-cover bg-center"
              style={{
                ...(catalogSettings?.backPage?.backgroundImage ? { backgroundImage: `url(${catalogSettings.backPage.backgroundImage})` } : {}),
                ...(catalogSettings?.backPage?.backgroundColor ? { backgroundColor: catalogSettings.backPage.backgroundColor } : {})
              }}
            >
              <h2 className="text-xl md:text-3xl font-black mb-2 md:mb-4">{catalogSettings?.backPage?.title || "Don't Miss Out!"}</h2>
              <p className="mb-4 md:mb-8 text-gray-600 text-sm md:text-base">{catalogSettings?.backPage?.description || "Visit Jumia.com.ng for even more amazing deals on all your favorite brands."}</p>
              <div className="w-28 h-28 md:w-40 md:h-40 bg-white p-3 md:p-4 shadow-xl rounded-2xl mb-4 md:mb-6 transform hover:scale-105 transition-transform duration-300">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(catalogSettings?.backPage?.qrCodeUrl || "https://jumia.com.ng")}`}
                  alt="QR Code"
                  className="w-full h-full opacity-90"
                />
              </div>
              <p className="text-[10px] md:text-xs font-bold text-blue-500 uppercase tracking-widest mb-6 md:mb-12">{catalogSettings?.backPage?.callToAction || "Scan to shop now"}</p>

              <div className="flex items-center gap-2 opacity-50 text-sm">
                <span className="font-bold">{catalogSettings?.backPage?.footerText?.split('©')[0]?.trim() || "JUMIA"}</span>
                <span>&copy; {new Date().getFullYear()}</span>
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
    </div>
  );
};

export default Index;
