import React, { useState, useEffect, useRef } from "react";
import HTMLFlipBook from "react-pageflip";
import CatalogHeader from "@/components/CatalogHeader";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/data/products";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "@firebase/firestore";
import catalogBg from "@/assets/catalog-bg.jpg";

interface PageProps {
  children: React.ReactNode;
  className?: string;
}

const Page = React.forwardRef<HTMLDivElement, PageProps>(({ children, className }, ref) => {
  return (
    <div className={`bg-white shadow-2xl p-8 overflow-hidden flex flex-col items-center justify-center border ${className}`} ref={ref}>
      {children}
    </div>
  );
});

Page.displayName = "Page";

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const bookRef = useRef<any>(null);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("id"), limit(50));
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: parseInt(doc.id),
        })) as Product[];
        setProducts(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Split products into pairs for book pages (2 products per spread)
  const productPairs = [];
  for (let i = 0; i < products.length; i += 2) {
    productPairs.push(products.slice(i, i + 2));
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <CatalogHeader />

      <div
        className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center p-4 md:p-12"
        style={{
          backgroundImage: `url(${catalogBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed"
        }}
      >
        {!loading && (
          <div className="relative">
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
              {/* Cover Page */}
              <Page className="bg-primary text-white !p-0">
                <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-12 text-center bg-gradient-to-br from-primary to-primary/80">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/e/e0/Jumia_Group_Logo.png" alt="Jumia" className="w-48 brightness-0 invert opacity-90" />
                  <div className="h-1 w-24 bg-white/30 rounded-full" />
                  <h1 className="text-5xl font-black tracking-tighter uppercase italic drop-shadow-lg">
                    HOTTEST <br />
                    <span className="text-secondary text-5xl">DEALS!</span>
                  </h1>
                  <p className="text-xl font-medium opacity-90 tracking-widest uppercase">Digital Catalog 2026</p>
                  <div className="mt-8 px-6 py-2 border-2 border-white/50 rounded-full text-sm font-bold animate-pulse">
                    OPEN TO EXPLORE
                  </div>
                </div>
              </Page>

              {/* Product Pages */}
              {products.map((product) => (
                <Page key={product.id} className="bg-white">
                  <div className="w-full h-full flex flex-col justify-between py-4">
                    <div className="flex-1 flex items-center justify-center">
                      <ProductCard product={product} />
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-medium tracking-widest uppercase">
                      <span>Jumia Deals 2026</span>
                      <span>ID: {product.id.toString().padStart(3, '0')}</span>
                    </div>
                  </div>
                </Page>
              ))}

              {/* Back Cover */}
              <Page className="bg-[#f5f5f5] text-gray-800">
                <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center">
                  <h2 className="text-3xl font-black mb-4">Don't Miss Out!</h2>
                  <p className="mb-8">Visit Jumia.com.ng for even more amazing deals on all your favorite brands.</p>
                  <div className="w-32 h-32 bg-white p-4 shadow-inner rounded-xl mb-6">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://jumia.com.ng" alt="QR Code" className="w-full h-full opacity-80" />
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scan to shop now</p>
                </div>
              </Page>
            </HTMLFlipBook>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/95 backdrop-blur-sm p-3 rounded-full shadow-2xl border border-gray-200 z-50">
        <button
          onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
          className="p-3 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
        </button>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <button
          onClick={() => bookRef.current?.pageFlip()?.flipNext()}
          className="p-3 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};

export default Index;
