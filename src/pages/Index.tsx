import React, { useRef } from "react";
import HTMLFlipBook from "react-pageflip";
import ProductCard from "@/components/ProductCard";
import FeaturedProductCard from "@/components/FeaturedProductCard";
import { useProducts } from "@/hooks/useProducts";
import { Loader2 } from "lucide-react";
import catalogBg from "@/assets/catalog-bg.jpg";

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Split products for the two different sections based on the image layout
  // Page 1 (Left): Small Appliances (First 6 items)
  const leftPageProducts = products.slice(0, 6);

  // Page 2 (Right): Remaining items + Featured
  // The right page has a 2x3 grid structure (6 slots).

  const rightPageRegularProducts = products.slice(6, 10);
  const featuredProduct = products.find(p => p.id === 10) || products[9];

  return (
    <div className="min-h-screen bg-gray-100 font-gotham overflow-hidden flex items-center justify-center p-4">

      {/* Background with blur effect */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{ backgroundImage: `url(${catalogBg})` }}
      />

      <div className="relative z-10 w-full max-w-6xl flex justify-center transform scale-95 md:scale-100 transition-transform duration-500">
        {/* @ts-expect-error react-pageflip types are sometimes tricky with newer react */}
        <HTMLFlipBook
          width={550}
          height={733}
          size="stretch"
          minWidth={315}
          maxWidth={1000}
          minHeight={420}
          maxHeight={1350}
          maxShadowOpacity={0.5}
          className="jumia-book shadow-2xl"
          ref={bookRef}
          showCover={true}
          mobileScrollSupport={true}
          startPage={0}
        >
          {/* COVER PAGE */}
          <Page className="bg-[#009FE3] text-white">
            <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-12 text-center bg-gradient-to-br from-[#009FE3] to-[#007bb0]">
              <div className="flex items-center gap-2 mb-8">
                <h1 className="text-4xl font-black tracking-tight uppercase">JUMIA</h1>
                <div className="bg-jumia-yellow w-4 h-4 rounded-full animate-pulse" />
              </div>

              <div className="relative">
                <h1 className="text-7xl font-black tracking-tighter uppercase italic drop-shadow-lg leading-tight">
                  HOTTEST <br />
                  <span className="text-[#FFDA00]">DEALS!</span>
                </h1>
                <div className="absolute -bottom-4 right-0 bg-white text-[#009FE3] text-xs font-bold px-2 py-1 rotate-[-5deg] shadow-sm">
                  LIMITED TIME
                </div>
              </div>

              <p className="text-xl font-bold tracking-widest uppercase mt-8 opacity-90">Digital Catalog 2026</p>

              <div className="mt-12 px-8 py-3 border-2 border-white/50 rounded-full text-sm font-bold bg-white/10 backdrop-blur-sm animate-pulse cursor-pointer hover:bg-white hover:text-[#009FE3] transition-colors">
                CLICK TO OPEN
              </div>
            </div>
          </Page>

          {/* LEFT PAGE: Small Appliances Start */}
          <Page className="bg-[#E6F7FF]">
            <div className="w-full h-full flex flex-row">
              {/* Left Sidebar Header */}
              <div className="w-14 bg-[#009FE3] flex flex-col items-center py-6 relative shadow-lg z-10">
                <div className="bg-black/20 p-1.5 rounded-full mb-6">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" /></svg>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <h2 className="text-3xl font-black text-white tracking-wide -rotate-90 whitespace-nowrap uppercase drop-shadow-md">
                    Small Appliances
                  </h2>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 p-3 grid grid-cols-2 grid-rows-3 gap-3 content-start">
                {leftPageProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>

            {/* Page Number */}
            <div className="absolute bottom-3 left-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Page 01
            </div>
          </Page>

          {/* RIGHT PAGE: Small Appliances End + Featured */}
          <Page className="bg-[#E2E0F5]"> {/* Slight background change to indicate section shift */}
            <div className="w-full h-full flex flex-row">
              {/* Content Area */}
              <div className="flex-1 p-3 grid grid-cols-2 grid-rows-3 gap-3 content-start">
                {/* Regular Products */}
                {rightPageRegularProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}

                {/* Featured Product Card - Spanning or taking up last slot visually */}
                <div className="col-span-2 row-span-1 mt-auto">
                  {featuredProduct && <FeaturedProductCard product={featuredProduct} />}
                </div>
              </div>

              {/* Right Sidebar Header (Large Appliances Teaser) */}
              <div className="w-14 bg-[#E6E0F8] border-l border-white flex flex-col items-center py-6 relative shadow-inner z-10">
                <div className="flex-1 flex items-center justify-center">
                  <h2 className="text-3xl font-black text-[#1F1F1F] tracking-wide rotate-90 whitespace-nowrap uppercase opacity-80">
                    Large Appliances
                  </h2>
                </div>
                <div className="bg-purple-200 p-1.5 rounded-full mt-6">
                  <svg className="w-6 h-6 text-purple-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Page Number */}
            <div className="absolute bottom-3 right-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Page 02
            </div>
          </Page>

          {/* BACK COVER */}
          <Page className="bg-[#f5f5f5] text-gray-800">
            <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center border-l border-gray-200">
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
