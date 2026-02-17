import { type Product, formatPrice } from "@/data/products";
import { incrementClick } from "@/lib/stats";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

const ProductCard = ({ product, compact }: ProductCardProps) => {
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const handleClick = () => {
    incrementClick();
  };

  const content = (
    <div className="relative bg-white rounded-[1.5rem] shadow-sm flex flex-col items-center p-2 h-full overflow-hidden transition-all hover:shadow-md cursor-pointer group">
      {/* Discount Badge */}
      {discount > 0 && (
        <div className="absolute top-2 right-2 z-10 bg-[#FF9900] text-white text-[9px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
          -{discount}%
        </div>
      )}

      {/* Product Image */}
      <div className="flex-1 w-full flex items-center justify-center py-1 mt-1 min-h-0">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Product Name */}
      <div className="w-full text-center px-1 mb-1 shrink-0">
        <h3 className="text-[9px] md:text-[10px] font-medium text-gray-700 leading-tight line-clamp-2 h-[2.2em]">
          {product.displayName || product.name}
        </h3>
      </div>

      {/* Price Pill */}
      <div className="w-full flex flex-col items-center justify-end mt-auto gap-0.5 shrink-0">
        <div className="bg-[#FF9900] text-black w-full max-w-[80%] py-1 rounded-lg flex items-center justify-center shadow-sm">
          <span className="text-[11px] md:text-xs font-black tracking-tight">
            {formatPrice(product.price)}
          </span>
        </div>

        {product.oldPrice && (
          <span className="text-[8px] text-gray-400 line-through font-medium">
            {formatPrice(product.oldPrice)}
          </span>
        )}
      </div>
    </div>
  );

  if (product.url) {
    return (
      <a href={product.url} target="_blank" rel="noopener noreferrer" className="block h-full" onClick={handleClick}>
        {content}
      </a>
    );
  }

  return content;
};

export default ProductCard;
