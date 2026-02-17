import { type Product, formatPrice } from "@/data/products";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

const ProductCard = ({ product, compact }: ProductCardProps) => {
  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-gray-100 flex p-3 h-28 md:h-32 overflow-hidden transition-all hover:shadow-md cursor-pointer group">
      {/* Product Info (Left) */}
      <div className="flex-1 flex flex-col justify-between pr-2 z-10">
        <div>
          <h3 className="text-[10px] md:text-xs font-bold text-gray-800 leading-tight line-clamp-2">
            {product.displayName || product.name}
          </h3>
        </div>

        <div className="mt-1">
          <div className="bg-[#009FE3] text-white px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 shadow-sm">
            <span className="text-[10px] md:text-xs font-bold leading-none">
              {formatPrice(product.price)}
            </span>
          </div>
          <div className="mt-0.5 pl-1">
            <span className="text-[8px] md:text-[10px] text-gray-400 line-through font-medium">
              {formatPrice(product.oldPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Product Image (Right) */}
      <div className="w-20 md:w-24 flex items-center justify-center shrink-0">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-300"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default ProductCard;
