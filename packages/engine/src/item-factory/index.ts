import type { ItemRarity, ItemSlot, ItemStats, GeneratedItem } from "./types.js";
import { pick, type Rng } from "../world-seed/rng.js";
import { mulberry32 } from "../world-seed/rng.js";

export * from "./types.js";

// ─── Rarity config ────────────────────────────────────────────────────────────

interface RarityConfig {
  statMult: number;
  sellMult: number;
  minLevel: number; // minimum character level before this rarity can drop
  weight: number;
}

const RARITY_CONFIG: Record<ItemRarity, RarityConfig> = {
  common:    { statMult: 1.0, sellMult: 1,   minLevel: 1,  weight: 60 },
  uncommon:  { statMult: 1.4, sellMult: 3,   minLevel: 1,  weight: 25 },
  rare:      { statMult: 2.0, sellMult: 10,  minLevel: 15, weight: 10 },
  legendary: { statMult: 3.2, sellMult: 40,  minLevel: 25, weight: 4  },
  fabled:    { statMult: 5.0, sellMult: 150, minLevel: 40, weight: 1  },
  mythical:  { statMult: 8.0, sellMult: 500, minLevel: 50, weight: 0  }, // boss/raid only
};

// ─── Slot config ──────────────────────────────────────────────────────────────

const ALL_SLOTS: ItemSlot[] = [
  "primary", "secondary",
  "head", "chest", "shoulder", "back", "wrist", "hands", "waist", "legs", "feet",
  "neck", "earLeft", "earRight", "ringLeft", "ringRight", "charm",
];

const SLOT_STAT_PROFILE: Record<ItemSlot, Array<keyof ItemStats>> = {
  primary:    ["attackRating", "weaponDamageMin", "weaponDamageMax", "strength"],
  secondary:  ["defenseRating", "mitigation", "stamina"],
  head:       ["stamina", "intelligence", "wisdom", "mitigation"],
  chest:      ["stamina", "mitigation", "defenseRating", "health"],
  shoulder:   ["strength", "agility", "mitigation"],
  back:       ["agility", "avoidance", "defenseRating"],
  wrist:      ["intelligence", "wisdom", "attackRating"],
  hands:      ["agility", "attackRating", "haste"],
  waist:      ["stamina", "strength", "defenseRating"],
  legs:       ["stamina", "agility", "mitigation"],
  feet:       ["agility", "avoidance", "haste"],
  neck:       ["wisdom", "charisma", "intelligence"],
  earLeft:    ["intelligence", "critChance", "attackRating"],
  earRight:   ["wisdom", "critBonus", "attackRating"],
  ringLeft:   ["strength", "stamina", "attackRating"],
  ringRight:  ["agility", "stamina", "defenseRating"],
  charm:      ["critChance", "haste", "critBonus"],
};

const SLOT_NOUN: Record<ItemSlot, string> = {
  primary: "Blade", secondary: "Shield",
  head: "Helm", chest: "Breastplate", shoulder: "Pauldrons",
  back: "Cloak", wrist: "Bracers", hands: "Gauntlets",
  waist: "Belt", legs: "Greaves", feet: "Boots",
  neck: "Pendant", earLeft: "Earring", earRight: "Earring",
  ringLeft: "Ring", ringRight: "Ring", charm: "Charm",
};

// ─── Name parts ───────────────────────────────────────────────────────────────

const PREFIXES: Record<ItemRarity, string[]> = {
  common:    ["Worn", "Battered", "Plain", "Simple", "Old"],
  uncommon:  ["Sturdy", "Solid", "Reinforced", "Forged", "Tempered"],
  rare:      ["Runed", "Inscribed", "Tempest", "Warded", "Shadow"],
  legendary: ["Legendary", "Ancient", "Gleaming", "Gilded", "Sundered"],
  fabled:    ["Fabled", "Eternal", "Transcendent", "Worldbreaker", "Undying"],
  mythical:  ["Mythical", "Godforged", "Celestial", "Primordial", "Infinite"],
};

const SUFFIXES: Record<ItemRarity, string[]> = {
  common:    ["", "", ""],
  uncommon:  ["of the Wilds", "of the Adventurer", "of Resilience", ""],
  rare:      ["of Power", "of the Storm", "of the Ages", "of the Void"],
  legendary: ["of the Conqueror", "of Norrath", "of the Ancients", "of Might"],
  fabled:    ["of the Forsaken", "of the Tribunal", "of Destiny", "of the Gods"],
  mythical:  ["of Creation", "of the Infinite", "of the First Age", "of Eternity"],
};

// ─── Rarity roller ────────────────────────────────────────────────────────────

export function rollRarity(characterLevel: number, rng: Rng, forceBoss = false): ItemRarity {
  const eligible = (Object.entries(RARITY_CONFIG) as [ItemRarity, RarityConfig][])
    .filter(([rarity, cfg]) => {
      if (rarity === "mythical") return forceBoss && characterLevel >= 50;
      if (cfg.minLevel > characterLevel) return false;
      if (rarity === "fabled" && !forceBoss && characterLevel < 40) return false;
      if (rarity === "legendary" && !forceBoss && characterLevel < 20) return false;
      return true;
    });

  const total = eligible.reduce((s, [, cfg]) => s + cfg.weight, 0);
  let roll = rng() * total;
  for (const [rarity, cfg] of eligible) {
    roll -= cfg.weight;
    if (roll <= 0) return rarity;
  }
  return "common";
}

// ─── Stat scaler ─────────────────────────────────────────────────────────────
// Fixed: suffix bonuses now scale with level so low-level gear isn't overpowered.

function scaleStats(slot: ItemSlot, level: number, rarity: ItemRarity, rng: Rng): ItemStats {
  const cfg = RARITY_CONFIG[rarity];
  const mult = cfg.statMult;
  const base = Math.max(1, Math.floor(level * 0.8));

  // Level scalar for absolute bonuses — prevents overpowering at level 1
  const levelScale = Math.sqrt(Math.max(1, level) / 10);

  const stats: ItemStats = {};

  if (slot === "primary") {
    stats.weaponDamageMin = Math.floor((base + level * 1.2) * mult * levelScale);
    stats.weaponDamageMax = Math.floor((base + level * 2.4) * mult * levelScale);
    stats.weaponDelay = rarity === "fabled" || rarity === "mythical" ? 1.6 : 2.0;
    stats.attackRating = Math.floor(base * mult * 0.6 * levelScale);
    if (rng() < 0.4) stats.strength = Math.floor(base * mult * 0.3 * levelScale);
  } else {
    const numStats = rarity === "common" ? 2 : rarity === "uncommon" ? 2 : rarity === "rare" ? 3 : 4;
    const profile = [...SLOT_STAT_PROFILE[slot]].sort(() => rng() - 0.5).slice(0, numStats);

    for (const statKey of profile) {
      if (statKey === "weaponDamageMin" || statKey === "weaponDamageMax" || statKey === "weaponDelay") continue;
      const val = Math.floor(base * mult * (0.5 + rng() * 0.5) * levelScale);
      (stats as Record<string, number>)[statKey] = Math.max(1, val);
    }

    if (slot === "secondary" || slot === "head" || slot === "chest" || slot === "legs") {
      stats.mitigation = Math.max(1, Math.floor(base * mult * 0.6 * levelScale));
    }
  }

  return stats;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateItem(
  zoneId: string,
  characterLevel: number,
  rng: Rng,
  options?: { forceRarity?: ItemRarity; forceSlot?: ItemSlot; isBoss?: boolean },
): GeneratedItem {
  const rarity = options?.forceRarity ?? rollRarity(characterLevel, rng, options?.isBoss);
  const slot = options?.forceSlot ?? pick(ALL_SLOTS, rng);
  const cfg = RARITY_CONFIG[rarity];

  const prefix = pick(PREFIXES[rarity], rng);
  const noun = SLOT_NOUN[slot];
  const suffix = pick(SUFFIXES[rarity], rng);
  const name = suffix ? `${prefix} ${noun} ${suffix}` : `${prefix} ${noun}`;

  const stats = scaleStats(slot, characterLevel, rarity, rng);
  const itemLevel = Math.max(1, characterLevel);
  const sellPrice = Math.max(1, Math.floor(characterLevel * 2 * cfg.sellMult));

  return {
    id: `proc_${zoneId}_${slot}_${rarity}_${Date.now()}_${Math.floor(rng() * 9999)}`,
    name,
    description: `A ${rarity} quality ${noun.toLowerCase()} from ${zoneId}.`,
    type: (slot === "primary" || slot === "secondary") ? "weapon"
        : (slot === "neck" || slot.startsWith("ear") || slot.startsWith("ring") || slot === "charm") ? "accessory"
        : "armor",
    slot,
    rarity,
    level: itemLevel,
    stats,
    sellPrice,
    buyPrice: sellPrice * 3,
    procedural: true,
    zoneId,
    noSell: rarity === "fabled" || rarity === "mythical",
  };
}

/** Roll loot from a killed enemy. Level-gated rarity, no fabled from normal mobs. */
export function rollLoot(
  zoneId: string,
  characterLevel: number,
  isBoss: boolean,
  rng: Rng,
): GeneratedItem[] {
  const results: GeneratedItem[] = [];

  if (isBoss) {
    // Boss always drops — main drop is rare+, scaled by level
    const mainRarity: ItemRarity =
      characterLevel < 15 ? pick(["uncommon", "rare"] as ItemRarity[], rng) :
      characterLevel < 30 ? pick(["rare", "rare", "legendary"] as ItemRarity[], rng) :
      characterLevel < 45 ? pick(["rare", "legendary", "legendary", "fabled"] as ItemRarity[], rng) :
                            pick(["legendary", "legendary", "fabled", "fabled"] as ItemRarity[], rng);

    results.push(generateItem(zoneId, characterLevel, rng, { forceRarity: mainRarity, isBoss: true }));

    // 50% chance for a second uncommon+ drop
    if (rng() < 0.5) {
      results.push(generateItem(zoneId, characterLevel, rng, {
        forceRarity: characterLevel < 20 ? "uncommon" : pick(["uncommon", "rare"] as ItemRarity[], rng),
      }));
    }
  } else {
    // Normal mob: 20% drop chance
    if (rng() < 0.20) {
      results.push(generateItem(zoneId, characterLevel, rng));
    }
  }

  return results;
}

/**
 * Generate the one-of-a-kind world unique item for a zone.
 * Seeded by worldSeed + zoneId — always the same item for that world/zone.
 * Call only after confirming it has not yet been claimed (check world_events).
 */
export function generateWorldUniqueItem(
  worldSeed: number,
  zoneId: string,
  zoneName: string,
  bossName: string,
): GeneratedItem {
  const zoneHash = zoneId.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const rng = mulberry32((worldSeed ^ zoneHash) >>> 0);

  const slot = pick(ALL_SLOTS, rng);
  const noun = SLOT_NOUN[slot];
  const zoneWord = zoneName.split(" ")[0] ?? zoneName;
  const bossPart = bossName.split(",")[0]?.split(" ").slice(-1)[0] ?? "Ancient";
  const uniquePrefixes = ["Primordial", "Eternal", "Forsaken", "First", "Undying", "Mythic"];
  const name = `${pick(uniquePrefixes, rng)} ${noun} of ${zoneWord}`;

  const stats = scaleStats(slot, 55, "mythical", rng);
  // World uniques get an extra 50% on all stats
  for (const key of Object.keys(stats) as (keyof ItemStats)[]) {
    if (key !== "weaponDelay") {
      const v = stats[key];
      if (typeof v === "number") (stats as Record<string, number>)[key] = Math.floor(v * 1.5);
    }
  }

  return {
    id:          `worldunique_${worldSeed}_${zoneId}`,
    name,
    description: `An artifact of incomprehensible power, bound to the essence of ${bossPart}. Only one may ever exist in this world.`,
    type:        (slot === "primary" || slot === "secondary") ? "weapon"
               : (slot === "neck" || slot.startsWith("ear") || slot.startsWith("ring") || slot === "charm") ? "accessory"
               : "armor",
    slot,
    rarity:      "mythical",
    level:       55,
    stats,
    sellPrice:   0,
    buyPrice:    0,
    procedural:  true,
    zoneId,
    noSell:      true,
    worldUnique: true,
  };
}

/** Session-stable merchant stock (seeded by zone + level). */
export function getMerchantStock(zoneId: string, characterLevel: number, count = 4): GeneratedItem[] {
  const seed = zoneId.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), characterLevel);
  const rng = mulberry32(seed >>> 0);
  return Array.from({ length: count }, () =>
    generateItem(zoneId, characterLevel, rng, {
      forceRarity: rollRarity(characterLevel, rng) === "common" ? "uncommon" : undefined,
    })
  );
}
