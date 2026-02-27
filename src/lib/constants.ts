
export const PRODUCT_CATEGORIES = [
    "Appliances",
    "Phones & Tablets",
    "Health & Beauty",
    "Home & Office",
    "Electronics",
    "Fashion",
    "Supermarket",
    "Computing",
    "Gaming"
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const CATEGORY_BRAND_MAP: Record<ProductCategory, string[]> = {
    "Appliances": ["LG", "Samsung", "Hisense", "Boscon", "Binatone", "Syinix", "Scanning", "Century", "Silvercrest"],
    "Phones & Tablets": ["Apple", "Samsung", "Tecno", "Infinix", "Xiaomi", "Nokia", "Itel"],
    "Health & Beauty": ["Nivea", "Dove", "L'Oreal", "Maybelline", "Oral-B"],
    "Home & Office": ["Swiss Polo", "Mini Focus", "Curren", "Generic"],
    "Electronics": ["Samsung", "Sony", "LG", "Hisense", "Skyworth", "Panasonic"],
    "Fashion": ["Adidas", "Nike", "Puma", "Defacto", "Gen-Z"],
    "Supermarket": ["Milo", "Nestle", "Kellogg's", "Indomie", "Coke"],
    "Computing": ["HP", "Dell", "Lenovo", "Asus", "Apple", "Acer"],
    "Gaming": ["Sony", "Microsoft", "Nintendo", "EA Sports", "Logitech"]
};
