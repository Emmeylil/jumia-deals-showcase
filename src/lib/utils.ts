import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function addUTMParameters(url: string | undefined): string {
  if (!url) return "#";
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set("utm_source", "eCat");
    urlObj.searchParams.set("utm_medium", "tw26");
    urlObj.searchParams.set("utm_campaign", "techweek");
    return urlObj.toString();
  } catch (e) {
    // If it's not a valid full URL, fallback to simple appending
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}utm_source=eCat&utm_medium=tw26&utm_campaign=techweek`;
  }
}
