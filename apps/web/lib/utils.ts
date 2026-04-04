import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function rarityColor(rarity: string): string {
  const map: Record<string, string> = {
    common:    "text-gray-400",
    uncommon:  "text-green-400",
    rare:      "text-blue-400",
    legendary: "text-amber-400",
    fabled:    "text-orange-400",
    mythical:  "text-purple-400",
  };
  return map[rarity] ?? "text-gray-400";
}

export function rarityBorder(rarity: string): string {
  const map: Record<string, string> = {
    common:    "border-gray-500",
    uncommon:  "border-green-500",
    rare:      "border-blue-500",
    legendary: "border-amber-500",
    fabled:    "border-orange-500",
    mythical:  "border-purple-500",
  };
  return map[rarity] ?? "border-gray-500";
}
