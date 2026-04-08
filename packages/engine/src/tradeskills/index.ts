// ─── Material definitions ─────────────────────────────────────────────────────
export type MaterialId =
  // Mining
  | "copper_ore" | "silver_ore" | "gold_ore" | "mythril_ore" | "adamantine_ore"
  // Foraging
  | "fiber" | "hardwood" | "silkweed" | "rare_root" | "ancient_bark"
  // Fishing
  | "common_fish" | "silver_fin" | "deepwater_crab" | "ancient_fossil" | "shimmer_eel"
  // Processed (from crafting)
  | "copper_ingot" | "silver_ingot" | "gold_ingot" | "mythril_bar" | "leather_strip"
  | "healing_draught" | "mana_draught" | "swift_elixir";

export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: string;
  tier: 1 | 2 | 3 | 4 | 5;
  source: "mining" | "foraging" | "fishing" | "crafting";
  stackSize: number;
}

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  // Mining
  copper_ore:      { id: "copper_ore",      name: "Copper Ore",       icon: "🪨", tier: 1, source: "mining",   stackSize: 200 },
  silver_ore:      { id: "silver_ore",      name: "Silver Ore",       icon: "🪨", tier: 2, source: "mining",   stackSize: 200 },
  gold_ore:        { id: "gold_ore",        name: "Gold Ore",         icon: "🪨", tier: 3, source: "mining",   stackSize: 200 },
  mythril_ore:     { id: "mythril_ore",     name: "Mythril Ore",      icon: "💎", tier: 4, source: "mining",   stackSize: 100 },
  adamantine_ore:  { id: "adamantine_ore",  name: "Adamantine Ore",   icon: "💎", tier: 5, source: "mining",   stackSize: 100 },
  // Foraging
  fiber:           { id: "fiber",           name: "Plant Fiber",      icon: "🌿", tier: 1, source: "foraging", stackSize: 200 },
  hardwood:        { id: "hardwood",        name: "Hardwood",         icon: "🪵", tier: 2, source: "foraging", stackSize: 200 },
  silkweed:        { id: "silkweed",        name: "Silkweed",         icon: "🌾", tier: 3, source: "foraging", stackSize: 200 },
  rare_root:       { id: "rare_root",       name: "Rare Root",        icon: "🌱", tier: 4, source: "foraging", stackSize: 100 },
  ancient_bark:    { id: "ancient_bark",    name: "Ancient Bark",     icon: "🪵", tier: 5, source: "foraging", stackSize: 100 },
  // Fishing
  common_fish:     { id: "common_fish",     name: "Common Fish",      icon: "🐟", tier: 1, source: "fishing",  stackSize: 200 },
  silver_fin:      { id: "silver_fin",      name: "Silver Fin",       icon: "🐟", tier: 2, source: "fishing",  stackSize: 200 },
  deepwater_crab:  { id: "deepwater_crab",  name: "Deepwater Crab",   icon: "🦀", tier: 3, source: "fishing",  stackSize: 200 },
  ancient_fossil:  { id: "ancient_fossil",  name: "Ancient Fossil",   icon: "🦴", tier: 4, source: "fishing",  stackSize: 100 },
  shimmer_eel:     { id: "shimmer_eel",     name: "Shimmer Eel",      icon: "🐍", tier: 5, source: "fishing",  stackSize: 100 },
  // Processed
  copper_ingot:    { id: "copper_ingot",    name: "Copper Ingot",     icon: "🔶", tier: 1, source: "crafting", stackSize: 100 },
  silver_ingot:    { id: "silver_ingot",    name: "Silver Ingot",     icon: "⬜", tier: 2, source: "crafting", stackSize: 100 },
  gold_ingot:      { id: "gold_ingot",      name: "Gold Ingot",       icon: "🟡", tier: 3, source: "crafting", stackSize: 100 },
  mythril_bar:     { id: "mythril_bar",     name: "Mythril Bar",      icon: "💠", tier: 4, source: "crafting", stackSize: 50  },
  leather_strip:   { id: "leather_strip",   name: "Leather Strip",    icon: "🟫", tier: 1, source: "crafting", stackSize: 100 },
  healing_draught: { id: "healing_draught", name: "Healing Draught",  icon: "🧪", tier: 1, source: "crafting", stackSize: 50  },
  mana_draught:    { id: "mana_draught",    name: "Mana Draught",     icon: "🔮", tier: 2, source: "crafting", stackSize: 50  },
  swift_elixir:    { id: "swift_elixir",    name: "Swift Elixir",     icon: "⚗️", tier: 3, source: "crafting", stackSize: 50  },
};

// ─── Tradeskill types ─────────────────────────────────────────────────────────
export type TradeskillId = "mining" | "foraging" | "fishing" | "blacksmithing" | "tailoring" | "alchemy";
export type GatheringSkillId = "mining" | "foraging" | "fishing";
export type CraftingSkillId = "blacksmithing" | "tailoring" | "alchemy";

export interface TradeskillEntry {
  level: number;
  xp: number;
  xpToNext: number;
}

export type Tradeskills = Record<TradeskillId, TradeskillEntry>;

export function initTradeskills(): Tradeskills {
  const init = (level = 1) => ({ level, xp: 0, xpToNext: tradeskillXpToLevel(2) });
  return {
    mining:        init(),
    foraging:      init(),
    fishing:       init(),
    blacksmithing: init(),
    tailoring:     init(),
    alchemy:       init(),
  };
}

export function tradeskillXpToLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

export function awardTradeskillXp(entry: TradeskillEntry, xpGain: number): TradeskillEntry {
  let { level, xp, xpToNext } = entry;
  xp += xpGain;
  while (xp >= xpToNext && level < 100) {
    xp -= xpToNext;
    level++;
    xpToNext = tradeskillXpToLevel(level + 1);
  }
  return { level, xp, xpToNext };
}

// ─── Gathering yield table ────────────────────────────────────────────────────
// Which materials can be gathered by each skill, and at what minimum skill level
export interface GatherYield {
  materialId: MaterialId;
  minLevel: number;
  weight: number; // relative probability
}

export const GATHERING_YIELDS: Record<GatheringSkillId, GatherYield[]> = {
  mining: [
    { materialId: "copper_ore",     minLevel: 1,  weight: 60 },
    { materialId: "silver_ore",     minLevel: 15, weight: 30 },
    { materialId: "gold_ore",       minLevel: 35, weight: 15 },
    { materialId: "mythril_ore",    minLevel: 55, weight: 8  },
    { materialId: "adamantine_ore", minLevel: 80, weight: 3  },
  ],
  foraging: [
    { materialId: "fiber",        minLevel: 1,  weight: 60 },
    { materialId: "hardwood",     minLevel: 15, weight: 30 },
    { materialId: "silkweed",     minLevel: 35, weight: 15 },
    { materialId: "rare_root",    minLevel: 55, weight: 8  },
    { materialId: "ancient_bark", minLevel: 80, weight: 3  },
  ],
  fishing: [
    { materialId: "common_fish",    minLevel: 1,  weight: 60 },
    { materialId: "silver_fin",     minLevel: 15, weight: 30 },
    { materialId: "deepwater_crab", minLevel: 35, weight: 15 },
    { materialId: "ancient_fossil", minLevel: 55, weight: 8  },
    { materialId: "shimmer_eel",    minLevel: 80, weight: 3  },
  ],
};

// Biome affinities — which gathering skills get a bonus yield in each biome
export const BIOME_GATHERING_BONUS: Record<string, GatheringSkillId[]> = {
  grasslands: ["foraging"],
  forest:     ["foraging", "fishing"],
  frozen:     ["mining", "fishing"],
  volcanic:   ["mining"],
  arcane:     ["mining", "foraging"],
  corrupted:  ["mining"],
  desert:     ["mining", "foraging"],
  swamp:      ["fishing", "foraging"],
  undead:     ["mining"],
  celestial:  ["mining", "foraging", "fishing"],
};

// ─── Gather tick ──────────────────────────────────────────────────────────────
export interface GatherResult {
  skillId: GatheringSkillId;
  materialId: MaterialId;
  quantity: number;
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
}

export function doGatherTick(
  skillId: GatheringSkillId,
  entry: TradeskillEntry,
  biome: string,
  rng: () => number,
): GatherResult | null {
  const yields = GATHERING_YIELDS[skillId].filter(y => y.minLevel <= entry.level);
  if (yields.length === 0) return null;

  // Weighted random pick
  const totalWeight = yields.reduce((sum, y) => sum + y.weight, 0);
  let roll = rng() * totalWeight;
  let picked = yields[yields.length - 1]!;
  for (const y of yields) {
    roll -= y.weight;
    if (roll <= 0) { picked = y; break; }
  }

  // Biome bonus: 2 items instead of 1
  const biomeBonus = (BIOME_GATHERING_BONUS[biome] ?? []).includes(skillId);
  const quantity = biomeBonus ? (rng() < 0.3 ? 2 : 1) : 1;

  // XP: 5 + skill level * 0.5, rounded
  const xpGained = Math.round(5 + entry.level * 0.5);
  const updated = awardTradeskillXp(entry, xpGained);

  return {
    skillId,
    materialId: picked.materialId,
    quantity,
    xpGained,
    leveledUp: updated.level > entry.level,
    newLevel: updated.level,
  };
}

// ─── Recipe definitions ───────────────────────────────────────────────────────
export type RecipeOutput =
  | { type: "material"; materialId: MaterialId; quantity: number }
  | { type: "item"; slot: string; minLevel: number; rarity: "common" | "uncommon" | "rare" };

export interface Recipe {
  id: string;
  name: string;
  skill: CraftingSkillId;
  requiredLevel: number;
  inputs: { materialId: MaterialId; quantity: number }[];
  output: RecipeOutput;
  xpReward: number;
}

export const RECIPES: Recipe[] = [
  // ── Blacksmithing ────────────────────────────────────────────────────────
  { id: "smelt_copper",        name: "Smelt Copper",   skill: "blacksmithing", requiredLevel: 1,  inputs: [{ materialId: "copper_ore",    quantity: 3 }], output: { type: "material", materialId: "copper_ingot",   quantity: 1 }, xpReward: 10 },
  { id: "smelt_silver",        name: "Smelt Silver",   skill: "blacksmithing", requiredLevel: 15, inputs: [{ materialId: "silver_ore",    quantity: 3 }], output: { type: "material", materialId: "silver_ingot",   quantity: 1 }, xpReward: 20 },
  { id: "smelt_gold",          name: "Smelt Gold",     skill: "blacksmithing", requiredLevel: 35, inputs: [{ materialId: "gold_ore",      quantity: 3 }], output: { type: "material", materialId: "gold_ingot",     quantity: 1 }, xpReward: 35 },
  { id: "smelt_mythril",       name: "Smelt Mythril",  skill: "blacksmithing", requiredLevel: 55, inputs: [{ materialId: "mythril_ore",   quantity: 4 }], output: { type: "material", materialId: "mythril_bar",    quantity: 1 }, xpReward: 60 },
  { id: "forge_copper_weapon", name: "Copper Weapon",  skill: "blacksmithing", requiredLevel: 5,  inputs: [{ materialId: "copper_ingot",  quantity: 2 }], output: { type: "item", slot: "primary", minLevel: 3,  rarity: "common"   }, xpReward: 25 },
  { id: "forge_silver_weapon", name: "Silver Weapon",  skill: "blacksmithing", requiredLevel: 20, inputs: [{ materialId: "silver_ingot",  quantity: 2 }], output: { type: "item", slot: "primary", minLevel: 15, rarity: "uncommon" }, xpReward: 50 },
  { id: "forge_gold_weapon",   name: "Gold Weapon",    skill: "blacksmithing", requiredLevel: 40, inputs: [{ materialId: "gold_ingot",    quantity: 2 }], output: { type: "item", slot: "primary", minLevel: 30, rarity: "rare"     }, xpReward: 90 },
  { id: "forge_copper_armor",  name: "Copper Armor",   skill: "blacksmithing", requiredLevel: 5,  inputs: [{ materialId: "copper_ingot",  quantity: 3 }], output: { type: "item", slot: "chest",   minLevel: 3,  rarity: "common"   }, xpReward: 25 },
  { id: "forge_silver_armor",  name: "Silver Armor",   skill: "blacksmithing", requiredLevel: 20, inputs: [{ materialId: "silver_ingot",  quantity: 3 }], output: { type: "item", slot: "chest",   minLevel: 15, rarity: "uncommon" }, xpReward: 50 },
  // ── Tailoring ────────────────────────────────────────────────────────────
  { id: "tan_leather",         name: "Tan Leather",    skill: "tailoring", requiredLevel: 1,  inputs: [{ materialId: "fiber",         quantity: 4 }], output: { type: "material", materialId: "leather_strip", quantity: 2 }, xpReward: 10 },
  { id: "craft_tunic",         name: "Cloth Tunic",    skill: "tailoring", requiredLevel: 5,  inputs: [{ materialId: "fiber",         quantity: 5 }], output: { type: "item", slot: "chest",   minLevel: 3,  rarity: "common"   }, xpReward: 25 },
  { id: "craft_silk_robe",     name: "Silk Robe",      skill: "tailoring", requiredLevel: 20, inputs: [{ materialId: "silkweed",      quantity: 4 }], output: { type: "item", slot: "chest",   minLevel: 15, rarity: "uncommon" }, xpReward: 50 },
  { id: "craft_gloves",        name: "Leather Gloves", skill: "tailoring", requiredLevel: 10, inputs: [{ materialId: "leather_strip", quantity: 2 }], output: { type: "item", slot: "hands",   minLevel: 8,  rarity: "common"   }, xpReward: 30 },
  { id: "craft_boots",         name: "Leather Boots",  skill: "tailoring", requiredLevel: 10, inputs: [{ materialId: "leather_strip", quantity: 2 }], output: { type: "item", slot: "feet",    minLevel: 8,  rarity: "common"   }, xpReward: 30 },
  { id: "craft_silk_cap",      name: "Silk Cap",        skill: "tailoring", requiredLevel: 25, inputs: [{ materialId: "silkweed",      quantity: 3 }], output: { type: "item", slot: "head",    minLevel: 18, rarity: "uncommon" }, xpReward: 45 },
  // ── Alchemy ───────────────────────────────────────────────────────────────
  { id: "brew_healing",        name: "Healing Draught", skill: "alchemy", requiredLevel: 1,  inputs: [{ materialId: "common_fish",    quantity: 2 }, { materialId: "fiber",     quantity: 1 }], output: { type: "material", materialId: "healing_draught", quantity: 1 }, xpReward: 15 },
  { id: "brew_mana",           name: "Mana Draught",    skill: "alchemy", requiredLevel: 15, inputs: [{ materialId: "silver_fin",     quantity: 2 }, { materialId: "silkweed",  quantity: 1 }], output: { type: "material", materialId: "mana_draught",    quantity: 1 }, xpReward: 30 },
  { id: "brew_swift",          name: "Swift Elixir",    skill: "alchemy", requiredLevel: 30, inputs: [{ materialId: "deepwater_crab", quantity: 1 }, { materialId: "rare_root", quantity: 2 }], output: { type: "material", materialId: "swift_elixir",    quantity: 1 }, xpReward: 55 },
];
