import { type Product, getDiscountPercentage, formatPrice } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const discount = getDiscountPercentage(product);

  return (
    <div className="relative rounded-2xl bg-card shadow-card hover:shadow-card-hover hover:scale-[1.03] transition-all duration-300 cursor-pointer overflow-hidden group">
      {/* Discount Badge */}
      <div className="absolute top-3 right-3 z-10 discount-badge w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm">
        -{discount}%
      </div>

      {/* Product Image */}
      <div className="p-4 pb-2 flex items-center justify-center h-44 overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Product Info */}
      <div className="px-4 pb-4 pt-2">
        <h3 className="text-sm font-bold text-card-foreground leading-tight line-clamp-2 min-h-[2.5rem]">
          {product.displayName || product.name}
        </h3>
        <p className="mt-2 text-lg font-extrabold text-jumia-orange">
          {formatPrice(product.price)}
        </p>
        <p className="text-sm text-muted-foreground line-through">
          {formatPrice(product.oldPrice)}
        </p>
      </div>
    </div>
  );
};

export default ProductCard;
