import { type Product, formatPrice } from "@/data/products";
import { incrementClick, incrementProductClick } from "@/lib/stats";
import { addUTMParameters } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
  highlighted?: boolean;
}

const ProductCard = ({ product, compact, highlighted }: ProductCardProps) => {
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const handleClick = () => {
    incrementClick();
    incrementProductClick(product.id);
  };

  const content = (
    <div className={`relative bg-white rounded-[1.5rem] shadow-sm flex flex-col items-center p-2.5 h-full overflow-hidden transition-all hover:shadow-md cursor-pointer group ${highlighted ? 'border-2 border-jumia-purple ring-4 ring-jumia-purple/20 animate-beat' : ''}`}>
      {/* Discount Badge */}
      {discount > 0 && (
        <div className="absolute top-2 right-2 z-10 bg-[#FF9900] text-white text-[9px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
          -{discount}%
        </div>
      )}

      {/* Product Image */}
      <div className="flex-1 w-full flex items-center justify-center py-0 mt-1 min-h-0 max-h-[52%]">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Product Name */}
      <div className="w-full text-center px-1 mb-1 shrink-0">
        <h3 className="text-[11px] md:text-xs font-bold text-gray-900 leading-tight line-clamp-2 min-h-[2.8em] flex items-center justify-center">
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
