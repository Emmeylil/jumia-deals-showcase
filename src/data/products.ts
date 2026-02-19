import microwaveImg from "@/assets/products/microwave.png";
import gasCookerImg from "@/assets/products/gas-cooker.png";
import standingFanImg from "@/assets/products/standing-fan.png";
import splitAcImg from "@/assets/products/split-ac.png";
import rechargeableFanImg from "@/assets/products/rechargeable-fan.png";
import inverterAcImg from "@/assets/products/inverter-ac.png";
import tableFanImg from "@/assets/products/table-fan.png";
import humidifierImg from "@/assets/products/humidifier.png";
import chestFreezerImg from "@/assets/products/chest-freezer.png";
import doubleDoorFridgeImg from "@/assets/products/double-door-fridge.png";
import chestFreezerLargeImg from "@/assets/products/chest-freezer-large.png";
import splitAcLargeImg from "@/assets/products/split-ac-large.png";
const placeholderImg = "/placeholder.svg";

export interface Product {
  id: number;
  sku?: string;
  name: string;
  displayName?: string;
  image: string;
  url?: string;
  price: number;
  oldPrice: number;
  brand?: string;
  category?: string;
  prices?: {
    price: number;
    oldPrice: number;
  };
  discountPercentage?: number;
  lastSyncedPrice?: number;
  lastSyncedOldPrice?: number;
}

export const products: Product[] = [
  {
    id: 1,
    name: "Hisense 20L Microwave 1-Year Warranty",
    image: microwaveImg,
    price: 75900,
    oldPrice: 82070,
  },
  {
    id: 2,
    name: "Boscon Auto Ignition Table Top Gas Cooker",
    image: gasCookerImg,
    price: 15900,
    oldPrice: 17655,
  },
  {
    id: 3,
    name: "Tinmo 18\" Rechargeable Standing Fan",
    image: rechargeableFanImg,
    price: 53000,
    oldPrice: 59000,
  },
  {
    id: 4,
    name: "Binatone 1.5 Litres Blender with Grinder",
    image: tableFanImg, // Placeholder for blender if not specifically available
    price: 28560,
    oldPrice: 35305,
  },
  {
    id: 5,
    name: "Syinix 2.2L Electric Kettle",
    image: placeholderImg, // Need to make sure placeholder is available
    price: 6100,
    oldPrice: 6816,
  },
  {
    id: 6,
    name: "Zyre 1200W Dry Iron + 1 Year Warranty",
    image: placeholderImg,
    price: 7850,
    oldPrice: 8703,
  },
  {
    id: 7,
    name: "Bushburgh Intelligent Infrared Electric Stove",
    image: placeholderImg,
    price: 32990,
    oldPrice: 36650,
  },
  {
    id: 8,
    name: "Century Electric Oven Toaster/Baker",
    image: chestFreezerImg,
    price: 38100,
    oldPrice: 47999,
  },
  {
    id: 9,
    name: "Gold Crown Toaster with 1-Year Warranty",
    image: placeholderImg,
    price: 13000,
    oldPrice: 15000,
  },
  {
    id: 10,
    name: "Silvercrest 2L Industrial 8500W Motor Blender",
    image: doubleDoorFridgeImg, // Using a different image for featured
    price: 24900,
    oldPrice: 27200,
  },
  {
    id: 11,
    name: "Humidifier 260mL Mist Humidifier",
    image: humidifierImg,
    price: 4900,
    oldPrice: 5560,
  },
];

export function getDiscountPercentage(product: Product): number {
  if (product.discountPercentage != null) return product.discountPercentage;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

export function formatPrice(amount: number): string {
  return "₦ " + amount.toLocaleString("en-NG");
}
