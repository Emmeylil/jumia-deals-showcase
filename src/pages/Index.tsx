import CatalogHeader from "@/components/CatalogHeader";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";
import catalogBg from "@/assets/catalog-bg.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <CatalogHeader />

      {/* Background with catalog template */}
      <div
        className="w-full min-h-screen"
        style={{
          backgroundImage: `url(${catalogBg})`,
          backgroundSize: "cover",
          backgroundPosition: "top center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
