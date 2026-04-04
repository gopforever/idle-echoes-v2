export type ItemRarity = "common" | "uncommon" | "rare" | "legendary" | "fabled" | "mythical";
export type ItemSlot =
  | "primary" | "secondary"
  | "head" | "chest" | "shoulder" | "back" | "wrist" | "hands" | "waist" | "legs" | "feet"
  | "neck" | "earLeft" | "earRight" | "ringLeft" | "ringRight" | "charm";
export type ItemType = "weapon" | "armor" | "accessory" | "consumable" | "material";

export interface ItemStats {
  strength?: number;
  agility?: number;
  stamina?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  health?: number;
  power?: number;
  attackRating?: number;
  defenseRating?: number;
  mitigation?: number;
  avoidance?: number;
  haste?: number;
  critChance?: number;
  critBonus?: number;
  weaponDamageMin?: number;
  weaponDamageMax?: number;
  weaponDelay?: number;
}

export interface GeneratedItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  slot: ItemSlot;
  rarity: ItemRarity;
  level: number;
  stats: ItemStats;
  sellPrice: number;
  buyPrice: number;
  procedural: true;
  zoneId: string;
  noSell: boolean; // fabled+ cannot be sold
}
