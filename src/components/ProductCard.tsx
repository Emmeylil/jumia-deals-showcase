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
      {/* ... existing content ... */}
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
