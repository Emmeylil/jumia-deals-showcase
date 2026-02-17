import { type Product, formatPrice } from "@/data/products";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

const ProductCard = ({ product, compact }: ProductCardProps) => {
  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col p-1.5 h-full overflow-hidden transition-all hover:shadow-md cursor-pointer group">
      {/* Product Name (Top) */}
      <div className="mb-1">
        <h3 className="text-[9px] md:text-[10px] font-bold text-gray-800 leading-tight line-clamp-2 text-center h-[2.5em] flex items-center justify-center">
          {product.displayName || product.name}
        </h3>
      </div>

      {/* Product Image (Center) */}
      <div className="flex-1 flex items-center justify-center py-1">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Price Info (Bottom) */}
      <div className="mt-1 flex items-center justify-center gap-1">
        <div className="bg-[#009FE3] text-white px-2 py-0.5 rounded-full inline-flex items-center shadow-sm">
          <span className="text-[10px] md:text-xs font-bold leading-none">
            {formatPrice(product.price)}
          </span>
        </div>
        {product.oldPrice && (
          <span className="text-[8px] md:text-[10px] text-gray-400 line-through font-medium">
            {formatPrice(product.oldPrice)}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
