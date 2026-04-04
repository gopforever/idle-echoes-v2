// ─── Ghost World ──────────────────────────────────────────────────────────────
// Ghost players simulate a living world economy and generate world events.
// Each ghost has a personality + individual traits for unique behavior.

import { pick, randInt, randFloat, shuffle, type Rng } from "../world-seed/rng.js";

export type GhostPersonality =
  | "Aggressive" | "Cautious" | "Explorer"
  | "Greedy" | "Scholarly" | "Devout" | "Crafter" | "Wanderer";

export interface GhostTraits {
  bossChanceBonus: number;      // +/- on top of personality base
  lootChanceBonus: number;
  craftingAffinity: boolean;    // prefers crafting over combat
  favoriteZoneId: string | null;// always returns here when level allows
  startingLevel: number;        // some ghosts start ahead
  startingGold: number;
  rivalGhostId: string | null;  // generates rivalry events
  hoarder: boolean;             // rarely spends gold
  speedrunner: boolean;         // levels faster, skips side content
}

export interface GhostSeed {
  id: string;
  name: string;
  race: string;
  archetype: string;
  className: string;
  alignment: "Qeynos" | "Freeport" | "Neutral";
  personality: GhostPersonality;
  traits: GhostTraits;
  stats: { strength: number; agility: number; stamina: number; intelligence: number; wisdom: number; charisma: number };
}

// ─── Personality config ───────────────────────────────────────────────────────

interface PersonalityConfig {
  bossChance: number;
  lootChance: number;
  spendChance: number;
  zoneChangeChance: number;
  craftChance: number;
}

export const PERSONALITY_CONFIG: Record<GhostPersonality, PersonalityConfig> = {
  Aggressive: { bossChance: 0.25, lootChance: 0.12, spendChance: 0.10, zoneChangeChance: 0.05, craftChance: 0.02 },
  Cautious:   { bossChance: 0.02, lootChance: 0.08, spendChance: 0.20, zoneChangeChance: 0.03, craftChance: 0.08 },
  Explorer:   { bossChance: 0.06, lootChance: 0.07, spendChance: 0.10, zoneChangeChance: 0.30, craftChance: 0.05 },
  Greedy:     { bossChance: 0.15, lootChance: 0.35, spendChance: 0.03, zoneChangeChance: 0.08, craftChance: 0.04 },
  Scholarly:  { bossChance: 0.04, lootChance: 0.06, spendChance: 0.25, zoneChangeChance: 0.06, craftChance: 0.30 },
  Devout:     { bossChance: 0.10, lootChance: 0.09, spendChance: 0.18, zoneChangeChance: 0.04, craftChance: 0.06 },
  Crafter:    { bossChance: 0.03, lootChance: 0.10, spendChance: 0.15, zoneChangeChance: 0.03, craftChance: 0.50 },
  Wanderer:   { bossChance: 0.08, lootChance: 0.10, spendChance: 0.12, zoneChangeChance: 0.40, craftChance: 0.04 },
};

// ─── Ghost seed generator ─────────────────────────────────────────────────────
// Generates 30 unique ghost players for a world using the world's RNG.
// Each ghost gets individual traits layered on their personality.

const GHOST_NAMES = [
  "Tharindel", "Morigath", "Sylvarra", "Durgrak", "Liria Sunwhisper",
  "Zhangar", "Kelindra", "Brunnhildr", "Naxxaril", "Tumblefoot",
  "Gorrak Stonehide", "Elindra", "Vorrigan", "Ssalika", "Pyrelia",
  "Thonk", "Rivendarax", "Gwendolyn Ashveil", "Krix", "Arzuhl",
  "Caladiel", "Thurak", "Whisperwind", "Daxaran", "Torgrath",
  "Elindor Swiftblade", "Ironfist", "Maeloria", "Razzik", "Sunaria",
];

const RACES = ["Human", "Dark Elf", "Wood Elf", "High Elf", "Gnome", "Dwarf",
               "Halfling", "Barbarian", "Half Elf", "Kerra", "Ratonga", "Fae",
               "Arasai", "Sarnak", "Ogre", "Froglok"];

const CLASS_BY_ARCHETYPE: Record<string, string[]> = {
  Fighter: ["Guardian", "Berserker", "Monk", "Bruiser", "Shadowknight", "Paladin"],
  Scout:   ["Assassin", "Ranger", "Brigand", "Swashbuckler", "Troubador", "Dirge"],
  Mage:    ["Wizard", "Warlock", "Conjuror", "Necromancer", "Illusionist", "Coercer"],
  Priest:  ["Templar", "Inquisitor", "Mystic", "Defiler", "Warden", "Fury"],
};

const ARCHETYPES = ["Fighter", "Scout", "Mage", "Priest"];

const PERSONALITIES: GhostPersonality[] = [
  "Aggressive", "Aggressive", "Aggressive",
  "Cautious", "Cautious", "Cautious",
  "Explorer", "Explorer", "Explorer", "Explorer",
  "Greedy", "Greedy", "Greedy",
  "Scholarly", "Scholarly",
  "Devout", "Devout", "Devout",
  "Crafter", "Crafter",
  "Wanderer", "Wanderer", "Wanderer",
  // Remaining 7 slots are random
  "Aggressive", "Cautious", "Explorer", "Greedy", "Scholarly", "Devout", "Crafter",
];

export function generateGhostSeeds(_worldSeed: number, zoneIds: string[], rng: Rng): GhostSeed[] {
  const names = shuffle([...GHOST_NAMES], rng);
  const personalities = shuffle([...PERSONALITIES], rng);

  return names.map((name, i) => {
    const archetype = pick(ARCHETYPES, rng);
    const classOptions = CLASS_BY_ARCHETYPE[archetype] ?? ["Warrior"];
    const className = pick(classOptions, rng);
    const personality = personalities[i] ?? pick(Object.keys(PERSONALITY_CONFIG) as GhostPersonality[], rng);
    const alignment = pick(["Qeynos", "Freeport", "Neutral"] as const, rng);

    // Individual traits — unique per ghost
    const traits: GhostTraits = {
      bossChanceBonus: randFloat(-0.05, 0.10, rng),
      lootChanceBonus: randFloat(-0.03, 0.08, rng),
      craftingAffinity: rng() < 0.15,
      favoriteZoneId: rng() < 0.6 ? (pick(zoneIds, rng) ?? null) : null,
      startingLevel: rng() < 0.3 ? randInt(2, 5, rng) : 1,
      startingGold: rng() < 0.4 ? randInt(10, 100, rng) : 0,
      rivalGhostId: null, // wired up after all ghosts generated
      hoarder: personality === "Greedy" ? rng() < 0.7 : rng() < 0.1,
      speedrunner: rng() < 0.1,
    };

    // Base stats skewed by archetype
    const stats = {
      strength:     archetype === "Fighter" ? randInt(40, 60, rng) : randInt(8, 25, rng),
      agility:      archetype === "Scout"   ? randInt(40, 58, rng) : randInt(10, 28, rng),
      stamina:      archetype === "Fighter" ? randInt(38, 55, rng) : randInt(12, 30, rng),
      intelligence: archetype === "Mage"    ? randInt(48, 65, rng) : randInt(8, 22, rng),
      wisdom:       archetype === "Priest"  ? randInt(45, 62, rng) : randInt(10, 25, rng),
      charisma:     randInt(6, 45, rng),
    };

    return {
      id: `ghost_${i}`,
      name,
      race: pick(RACES, rng),
      archetype,
      className,
      alignment,
      personality,
      traits,
      stats,
    };
  });
}

/** Wire up rivalries after all ghosts are generated */
export function assignRivalries(ghosts: GhostSeed[], rng: Rng): GhostSeed[] {
  const rivalCount = Math.floor(ghosts.length * 0.3); // 30% of ghosts have rivals
  const indices = shuffle(ghosts.map((_, i) => i), rng).slice(0, rivalCount * 2);

  for (let i = 0; i < indices.length - 1; i += 2) {
    const a = ghosts[indices[i] as number];
    const b = ghosts[indices[i + 1] as number];
    if (a && b) {
      a.traits.rivalGhostId = b.id;
      b.traits.rivalGhostId = a.id;
    }
  }

  return ghosts;
}
