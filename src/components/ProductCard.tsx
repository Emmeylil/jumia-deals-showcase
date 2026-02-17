import { type Product, getDiscountPercentage, formatPrice } from "@/data/products";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

const ProductCard = ({ product, compact }: ProductCardProps) => {
  const discount = getDiscountPercentage(product);

  return (
    <div className="relative rounded-2xl bg-card shadow-card hover:shadow-card-hover hover:scale-[1.03] transition-all duration-300 cursor-pointer overflow-hidden group">
      {/* Discount Badge */}
      <div className={`absolute top-2 right-2 z-10 discount-badge ${compact ? 'w-8 h-8 text-[10px]' : 'w-12 h-12 text-sm'} rounded-full flex items-center justify-center font-bold`}>
        -{discount}%
      </div>

      {/* Product Image */}
      <div className={`${compact ? 'p-2 pb-1 h-20' : 'p-4 pb-2 h-44'} flex items-center justify-center overflow-hidden`}>
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Product Info */}
      <div className={compact ? 'px-2 pb-2 pt-1' : 'px-4 pb-4 pt-2'}>
        <h3 className={`${compact ? 'text-[10px] min-h-0' : 'text-sm min-h-[2.5rem]'} font-bold text-card-foreground leading-tight line-clamp-2`}>
          {product.displayName || product.name}
        </h3>
        <p className={`${compact ? 'mt-0.5 text-xs' : 'mt-2 text-lg'} font-extrabold text-jumia-orange`}>
          {formatPrice(product.price)}
        </p>
        <p className={`${compact ? 'text-[10px]' : 'text-sm'} text-muted-foreground line-through`}>
          {formatPrice(product.oldPrice)}
        </p>
      </div>
    </div>
  );
};

export default ProductCard;
