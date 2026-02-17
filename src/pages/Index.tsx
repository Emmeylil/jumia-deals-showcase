import React, { useRef, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import ProductCard from "@/components/ProductCard";
import FeaturedProductCard from "@/components/FeaturedProductCard";
import { useProducts } from "@/hooks/useProducts";
import { Loader2, Share2, Download } from "lucide-react";
import catalogBg from "@/assets/catalog-bg.jpg";
import { incrementView, incrementReader, updateTimeOnBook, incrementShare, incrementDownload } from "@/lib/stats";

interface PageProps {
  children: React.ReactNode;
  className?: string;
}

const Page = React.forwardRef<HTMLDivElement, PageProps>(({ children, className }, ref) => {
  return (
    <div className={`bg-white shadow-md overflow-hidden flex flex-col border border-gray-200 ${className}`} ref={ref}>
      {children}
    </div>
  );
});

Page.displayName = "Page";

const Index = () => {
  const { products, loading } = useProducts();
  const bookRef = useRef<any>(null);

  // Catalog Settings state
  const [catalogSettings, setCatalogSettings] = React.useState<any>(null);

  React.useEffect(() => {
    // Subscribe to settings
    const { onSnapshot, doc } = require("firebase/firestore");
    const { db } = require("@/lib/firebase");

    const unsubscribe = onSnapshot(doc(db, "settings", "catalog"), (doc: any) => {
      if (doc.exists()) {
        setCatalogSettings(doc.data());
      }
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

  const handleDownload = () => {
    incrementDownload();
    window.print(); // Simple "download" as PDF via print
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Chunk products into groups of 10 (6 for left page, 4 for right page)
  const productChunks = [];
  for (let i = 0; i < products.length; i += 10) {
    productChunks.push(products.slice(i, i + 10));
  }

  return (
    <div className="min-h-screen bg-gray-100 font-gotham overflow-hidden flex flex-col items-center justify-center p-4 relative">

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

      <div className="relative z-10 w-full max-w-6xl flex justify-center transform scale-95 md:scale-100 transition-transform duration-500">
        {/* @ts-expect-error react-pageflip types are sometimes tricky with newer react */}
        <HTMLFlipBook
          width={400}
          height={520}
          size="stretch"
          minWidth={300}
          maxWidth={800}
          minHeight={400}
          maxHeight={1000}
          maxShadowOpacity={0.5}
          className="jumia-book shadow-2xl"
          ref={bookRef}
          showCover={true}
          mobileScrollSupport={true}
          startPage={0}
        >
          {/* COVER PAGE */}
          <Page className="bg-white text-gray-900 border-none">
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-6 p-12 text-center bg-white relative overflow-hidden bg-cover bg-center"
              style={catalogSettings?.frontPage?.backgroundImage ? { backgroundImage: `url(${catalogSettings.frontPage.backgroundImage})` } : {}}
            >
              {/* Decorative Circle */}
              <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-[#FF9900]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-[#009FE3]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="mb-8 z-10">
                <img
                  src="https://ng.jumia.is/cms/jumia_logo_small.png"
                  alt="Jumia Logo"
                  className="h-16 w-auto object-contain"
                />
              </div>

              <div className="relative z-10">
                <h1 className="text-7xl font-black tracking-tighter uppercase italic drop-shadow-sm leading-tight text-gray-900">
                  HOTTEST <br />
                  <span className="text-[#FF9900] drop-shadow-sm">DEALS!</span>
                </h1>
                <div className="absolute -bottom-4 right-0 bg-[#009FE3] text-white text-xs font-bold px-3 py-1 rotate-[-5deg] shadow-md rounded-sm">
                  LIMITED TIME
                </div>
              </div>

              <p className="text-xl font-bold tracking-widest uppercase mt-8 opacity-70 text-gray-600 z-10">
                Digital Catalog 2026
              </p>

              <div className="mt-12 px-8 py-3 border-2 border-gray-200 rounded-full text-sm font-bold text-gray-900 bg-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-bounce z-10">
                CLICK TO OPEN
              </div>
            </div>
          </Page>

          {/* DYNAMIC PAGES */}
          {productChunks.flatMap((chunk, index) => {
            const pageNum = index * 2 + 1;
            const leftPageProducts = chunk.slice(0, 6);
            const rightPageRegularProducts = chunk.slice(6, 9);
            const featuredProduct = chunk[9] || (rightPageRegularProducts.length === 3 ? null : chunk[chunk.length - 1]);

            return [
              /* LEFT PAGE */
              <Page key={`page-${pageNum}`} className="bg-[#E6F7FF]">
                <div className="w-full h-full flex flex-row">
                  {/* Left Sidebar Header */}
                  <div className="w-14 bg-[#009FE3] flex flex-col items-center py-6 relative shadow-lg z-10">
                    <div className="bg-black/20 p-1.5 rounded-full mb-6">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" /></svg>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <h2 className="text-3xl font-black text-white tracking-wide -rotate-90 whitespace-nowrap uppercase drop-shadow-md">
                        Best Deals
                      </h2>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 p-2 grid grid-cols-2 grid-rows-3 gap-2 content-start">
                    {leftPageProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>

                {/* Page Number */}
                <div className="absolute bottom-2 left-4 text-[9px] font-bold text-gray-400">
                  {pageNum}
                </div>
              </Page>,

              /* RIGHT PAGE */
              <Page key={`page-${pageNum + 1}`} className="bg-[#E2E0F5]">
                <div className="w-full h-full flex flex-row">
                  {/* Content Area */}
                  <div className="flex-1 p-2 grid grid-cols-2 grid-rows-3 gap-2 content-start">
                    {/* Regular Products (up to 3) */}
                    {rightPageRegularProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}

                    {/* Featured Product Card - Spanning or taking up last slot visually */}
                    <div className="col-span-2 row-span-1 mt-auto">
                      {chunk.length > 9 && <FeaturedProductCard product={chunk[9]} />}
                    </div>
                  </div>

                  {/* Right Sidebar Header */}
                  <div className="w-14 bg-[#E6E0F8] border-l border-white flex flex-col items-center py-6 relative shadow-inner z-10">
                    <div className="flex-1 flex items-center justify-center">
                      <h2 className="text-3xl font-black text-[#1F1F1F] tracking-wide rotate-90 whitespace-nowrap uppercase opacity-80">
                        Top Picks
                      </h2>
                    </div>
                    <div className="bg-purple-200 p-1.5 rounded-full mt-6">
                      <svg className="w-6 h-6 text-purple-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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
          <Page className="bg-[#f5f5f5] text-gray-800">
            <div
              className="w-full h-full flex flex-col items-center justify-center p-12 text-center border-l border-gray-200 bg-cover bg-center"
              style={catalogSettings?.backPage?.backgroundImage ? { backgroundImage: `url(${catalogSettings.backPage.backgroundImage})` } : {}}
            >
              <h2 className="text-3xl font-black mb-4">Don't Miss Out!</h2>
              <p className="mb-8 text-gray-600">Visit Jumia.com.ng for even more amazing deals on all your favorite brands.</p>
              <div className="w-40 h-40 bg-white p-4 shadow-xl rounded-2xl mb-6 transform hover:scale-105 transition-transform duration-300">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://jumia.com.ng" alt="QR Code" className="w-full h-full opacity-90" />
              </div>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-12">Scan to shop now</p>

              <div className="flex items-center gap-2 opacity-50">
                <span className="font-bold">JUMIA</span>
                <span>&copy; 2026</span>
              </div>
            </div>
          </Page>
        </HTMLFlipBook>
      </div>

      {/* Navigation Controls */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-full shadow-2xl border border-gray-200 z-50">
        <button
          onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
          className="p-3 hover:bg-gray-100 rounded-full transition-colors group"
        >
          <svg className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
        </button>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <button
          onClick={() => bookRef.current?.pageFlip()?.flipNext()}
          className="p-3 hover:bg-gray-100 rounded-full transition-colors group"
        >
          <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};

export default Index;
