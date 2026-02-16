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

export interface Product {
  id: number;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  discountPercentage?: number;
}

export const products: Product[] = [
  {
    id: 1,
    name: "Maxi 20 Litres Manual Microwave Oven",
    image: microwaveImg,
    price: 55370,
    oldPrice: 65340,
  },
  {
    id: 2,
    name: "Skyrun 4 Burners (4+0) Gas Cooker",
    image: gasCookerImg,
    price: 147999,
    oldPrice: 201163,
  },
  {
    id: 3,
    name: "HANSEN 18 inches Industrial Standing Fan",
    image: standingFanImg,
    price: 16999,
    oldPrice: 20060,
  },
  {
    id: 4,
    name: "Nexus 1HP Split Air Conditioner",
    image: splitAcImg,
    price: 269999,
    oldPrice: 374099,
  },
  {
    id: 5,
    name: "Rechargeable Standing Fan (168F) + Solar Panel",
    image: rechargeableFanImg,
    price: 37999,
    oldPrice: 66500,
  },
  {
    id: 6,
    name: "Royal 1.5 HP INVERTER Air Conditioner",
    image: inverterAcImg,
    price: 341250,
    oldPrice: 394385,
  },
  {
    id: 7,
    name: "Nexus 1.5HP Split Air Conditioner",
    image: splitAcLargeImg,
    price: 299600,
    oldPrice: 391128,
  },
  {
    id: 8,
    name: "Lontor 12 Inch Rechargeable Table Fan",
    image: tableFanImg,
    price: 39000,
    oldPrice: 66500,
  },
  {
    id: 9,
    name: "260ml Mist Humidifier Diffuser",
    image: humidifierImg,
    price: 3020,
    oldPrice: 7435,
  },
  {
    id: 10,
    name: "Skyrun 200l Chest Freezer",
    image: chestFreezerImg,
    price: 279999,
    oldPrice: 386291,
  },
  {
    id: 11,
    name: "Aeon 70L Double Door Fridge",
    image: doubleDoorFridgeImg,
    price: 149999,
    oldPrice: 193499,
  },
  {
    id: 12,
    name: "Aeon 90 Litres Chest Freezer",
    image: chestFreezerLargeImg,
    price: 257999,
    oldPrice: 379999,
  },
];

export function getDiscountPercentage(product: Product): number {
  if (product.discountPercentage != null) return product.discountPercentage;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

export function formatPrice(amount: number): string {
  return "₦ " + amount.toLocaleString("en-NG");
}
