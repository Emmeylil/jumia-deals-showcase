import { type Product, formatPrice } from "@/data/products";

interface FeaturedProductCardProps {
    product: Product;
}

const FeaturedProductCard = ({ product }: FeaturedProductCardProps) => {
    return (
        <div className="relative bg-[#FFDA00] rounded-xl shadow-sm border border-yellow-400 flex flex-col p-4 h-full min-h-[200px] overflow-hidden transition-all hover:shadow-md cursor-pointer group">
            {/* Product Image */}
            <div className="flex-1 flex items-center justify-center pt-2 pb-4">
                <img
                    src={product.image}
                    alt={product.name}
                    className="max-h-32 w-auto object-contain group-hover:scale-110 transition-transform duration-300"
                />
            </div>

            {/* Featured Price Pill */}
            <div className="flex justify-center mb-4">
                <div className="bg-white text-gray-900 px-4 py-1.5 rounded-full inline-flex flex-col items-center shadow-md">
                    <span className="text-xl md:text-2xl font-black leading-none">
                        {formatPrice(product.price)}
                    </span>
                    <span className="text-[10px] md:text-xs text-gray-400 line-through font-bold mt-1">
                        {formatPrice(product.oldPrice)}
                    </span>
                </div>
            </div>

            {/* Product Info */}
            <div className="text-center">
                <h3 className="text-lg md:text-xl font-black text-gray-900 uppercase tracking-tight leading-none mb-1">
                    {product.name.split(' ')[0]} {/* Simplified brand name for focus */}
                </h3>
                <p className="text-[10px] md:text-xs font-bold text-gray-800 uppercase tracking-tight leading-tight uppercase opacity-80">
                    {product.name}
                </p>
            </div>
        </div>
    );
};

export default FeaturedProductCard;
