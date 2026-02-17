import { type Product, formatPrice } from "@/data/products";
import { incrementClick } from "@/lib/stats";

interface FeaturedProductCardProps {
    product: Product;
}

const FeaturedProductCard = ({ product }: FeaturedProductCardProps) => {
    const discount = product.oldPrice
        ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
        : 0;

    const handleClick = () => {
        incrementClick();
    };

    const content = (
        <div className="relative bg-[#FFDA00] rounded-[1.5rem] shadow-sm flex flex-col items-center p-3 h-full overflow-hidden transition-all hover:shadow-md cursor-pointer group">
            {/* Discount Badge */}
            {discount > 0 && (
                <div className="absolute top-2 right-2 z-10 bg-white text-[#FF9900] text-[10px] font-black w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
                    -{discount}%
                </div>
            )}

            {/* Product Image */}
            <div className="flex-1 w-full flex items-center justify-center pt-2 pb-2 min-h-0">
                <img
                    src={product.image}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
            </div>

            {/* Product Name */}
            <div className="w-full text-center px-1 mb-2 shrink-0">
                <h3 className="text-xs md:text-sm font-black text-gray-900 leading-tight line-clamp-2 uppercase">
                    {(() => {
                        const fullName = product.displayName || product.name;
                        const words = fullName.split(' ');
                        const brand = words[0];
                        const rest = words.slice(1).join(' ');
                        return (
                            <>
                                <span className="font-black">{brand}</span>
                                {rest && <span> {rest}</span>}
                            </>
                        );
                    })()}
                </h3>
            </div>

            {/* Price Pill */}
            <div className="w-full flex flex-col items-center justify-end mt-auto gap-0.5 shrink-0">
                <div className="bg-white text-black w-full max-w-[90%] py-1.5 rounded-xl flex items-center justify-center shadow-sm border border-orange-100">
                    <span className="text-sm md:text-base font-black tracking-tight">
                        {formatPrice(product.price)}
                    </span>
                </div>
                {product.oldPrice && (
                    <span className="text-[10px] text-gray-600 line-through font-bold">
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

export default FeaturedProductCard;
