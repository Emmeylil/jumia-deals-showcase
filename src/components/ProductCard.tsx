import { type Product, formatPrice } from "@/data/products";
import { incrementClick, incrementProductClick } from "@/lib/stats";
import { addUTMParameters } from "@/lib/utils";
import React from "react";
import { Heart } from "lucide-react";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
  highlighted?: boolean;
  lazy?: boolean;
}

const ProductCard = ({ product, compact, highlighted, lazy = true }: ProductCardProps) => {

  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const [isWishlisted, setIsWishlisted] = React.useState(() => {
    const saved = localStorage.getItem("jumia_wishlist");
    if (!saved) return false;
    const list = JSON.parse(saved);
    return list.includes(product.id);
  });

  const handleClick = (e: React.MouseEvent) => {
    // If clicking the heart, don't trigger the main card click
    if ((e.target as HTMLElement).closest('.wishlist-btn')) return;

    incrementClick();
    incrementProductClick(product.id);
  };

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newStatus = !isWishlisted;
    setIsWishlisted(newStatus);

    const saved = localStorage.getItem("jumia_wishlist");
    const list = saved ? JSON.parse(saved) : [];

    const updatedList = newStatus
      ? [...list, product.id]
      : list.filter((id: any) => id !== product.id);

    localStorage.setItem("jumia_wishlist", JSON.stringify(updatedList));

    // If adding to wishlist, also take user to the product page on the main site to "sync"
    if (newStatus && product.url) {
      window.open(addUTMParameters(product.url), '_blank');
    }
  };

  const content = (
    <div className={`relative bg-white rounded-[1.5rem] shadow-sm flex flex-col items-center p-2.5 h-full overflow-hidden transition-all hover:shadow-md cursor-pointer group ${highlighted ? 'border-2 border-jumia-purple ring-4 ring-jumia-purple/20 animate-beat' : ''}`}>
      {/* Discount Badge */}
      {discount > 0 && (
        <div className="absolute top-2 right-2 z-10 bg-[#FF9900] text-white text-[9px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
          -{discount}%
        </div>
      )}

      {/* Wishlist Button */}
      <button
        onClick={toggleWishlist}
        className={`wishlist-btn absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center rounded-full transition-all shadow-sm ${isWishlisted ? 'bg-jumia-purple text-white' : 'bg-white/80 text-gray-400 hover:text-jumia-purple'}`}
      >
        <Heart size={14} fill={isWishlisted ? "currentColor" : "none"} />
      </button>

      {/* Product Image */}
      <div className="flex-1 w-full flex items-center justify-center py-0 mt-1 min-h-0 max-h-[52%]">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading={lazy ? "lazy" : "eager"}
        />


      </div>

      {/* Product Name */}
      <div className="w-full text-center px-1 mb-1 shrink-0 flex items-center justify-center min-h-[2.5rem]">
        <h3 className="text-[11px] md:text-xs font-bold text-gray-900 leading-tight line-clamp-2">
          {(() => {
            const fullName = product.displayName || product.name;
            const words = fullName.split(' ');
            const brand = words[0];
            const rest = words.slice(1).join(' ');
            return (
              <span>
                <span className="font-black">{brand}</span>
                {rest && <span> {rest}</span>}
              </span>
            );
          })()}
        </h3>
      </div>

      {/* Price Pill */}
      <div className="w-full flex flex-col items-center justify-end mt-0.5 gap-0.5 shrink-0">
        <div className="bg-[#FF9900] text-black w-full max-w-[90%] py-1 rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-[12px] md:text-sm font-black tracking-tight">
            {formatPrice(product.price)}
          </span>
        </div>

        {product.oldPrice && (
          <span className="text-[9px] text-gray-400 line-through font-bold">
            {formatPrice(product.oldPrice)}
          </span>
        )}
      </div>
    </div>
  );

  if (product.url) {
    return (
      <a href={addUTMParameters(product.url)} target="_blank" rel="noopener noreferrer" className="block h-full" onClick={handleClick}>
        {content}
      </a>
    );
  }

  return content;
};

export default ProductCard;
