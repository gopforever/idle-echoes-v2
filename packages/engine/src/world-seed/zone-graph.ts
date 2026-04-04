import type { Biome, Zone, ZoneGraph, Faction } from "./types.js";
import { pick, randInt, type Rng } from "./rng.js";

// ─── Name parts by biome ─────────────────────────────────────────────────────

const BIOME_PREFIXES: Record<Biome, string[]> = {
  grasslands:  ["Green", "Golden", "Rolling", "Sunlit", "Amber"],
  forest:      ["Whispering", "Ancient", "Darkwood", "Elder", "Shadow"],
  frozen:      ["Frost", "Glacial", "Bleak", "Shivering", "Permafrost"],
  volcanic:    ["Ashen", "Magma", "Scorched", "Cinder", "Ember"],
  arcane:      ["Runed", "Shifting", "Ethereal", "Crystalline", "Void"],
  corrupted:   ["Blighted", "Twisted", "Forsaken", "Withered", "Cursed"],
  desert:      ["Sun-Baked", "Parched", "Endless", "Burning", "Arid"],
  swamp:       ["Murky", "Fetid", "Bog", "Mire", "Brackish"],
  undead:      ["Ashen", "Rotting", "Hollow", "Desolate", "Grave"],
  celestial:   ["Radiant", "Blessed", "Hallowed", "Gleaming", "Sanctified"],
};

const BIOME_NOUNS: Record<Biome, string[]> = {
  grasslands:  ["Plains", "Fields", "Steppes", "Meadows", "Vales"],
  forest:      ["Woods", "Thicket", "Canopy", "Grove", "Reaches"],
  frozen:      ["Peaks", "Wastes", "Tundra", "Expanse", "Highlands"],
  volcanic:    ["Mountains", "Caldera", "Flats", "Ridges", "Depths"],
  arcane:      ["Sanctum", "Spire", "Nexus", "Rift", "Crucible"],
  corrupted:   ["Wastes", "Mire", "Hollow", "Barrens", "Ruins"],
  desert:      ["Sands", "Dunes", "Flats", "Reaches", "Expanse"],
  swamp:       ["Fens", "Bogs", "Mire", "Marsh", "Bayou"],
  undead:      ["Catacombs", "Ruins", "Crypts", "Gravefields", "Moors"],
  celestial:   ["Heights", "Spires", "Sanctum", "Gardens", "Citadel"],
};

const BIOME_BOSS_TITLES: Record<Biome, string[]> = {
  grasslands:  ["Warlord", "Champion", "Chieftain", "Overlord"],
  forest:      ["Ancient", "Elder", "Warden", "Sovereign"],
  frozen:      ["Frost King", "Glacial Lord", "Ice Sovereign", "Blizzard Tyrant"],
  volcanic:    ["Flame Lord", "Magma Titan", "Infernal Duke", "Cinder King"],
  arcane:      ["Archmage", "Void Weaver", "Rune Lord", "Rift Walker"],
  corrupted:   ["Plague Bringer", "Blight Lord", "Corruption Incarnate", "Withered King"],
  desert:      ["Sand King", "Dune Sovereign", "Sun Herald", "Parched God"],
  swamp:       ["Bog Tyrant", "Swamp Elder", "Mire Sovereign", "Fetid Lord"],
  undead:      ["Death Knight", "Lich Lord", "Undying Sovereign", "Grave Warden"],
  celestial:   ["Seraph", "Divine Arbiter", "Celestial Warden", "Holy Sentinel"],
};

// ─── Biome pools by tier (level range buckets) ───────────────────────────────

const TIER_BIOMES: [number, number, Biome[]][] = [
  [1,  15, ["grasslands", "forest"]],
  [10, 25, ["forest", "swamp", "corrupted"]],
  [20, 35, ["frozen", "desert", "undead"]],
  [30, 45, ["volcanic", "arcane", "corrupted"]],
  [40, 55, ["volcanic", "arcane", "celestial"]],
];

// ─── Zone graph generator ─────────────────────────────────────────────────────

export function generateZoneGraph(rng: Rng, factions: Faction[]): ZoneGraph {
  const zoneCount = randInt(8, 12, rng);
  const zones: Zone[] = [];

  for (let i = 0; i < zoneCount; i++) {
    const tierIdx = Math.floor(i / Math.ceil(zoneCount / TIER_BIOMES.length));
    const tierDef = TIER_BIOMES[Math.min(tierIdx, TIER_BIOMES.length - 1)];
    if (!tierDef) continue;

    const [minLevel, maxLevel, biomes] = tierDef;
    const biome = pick(biomes, rng);
    const prefix = pick(BIOME_PREFIXES[biome], rng);
    const noun = pick(BIOME_NOUNS[biome], rng);
    const name = `${prefix} ${noun}`;

    const levelMin = minLevel + randInt(0, 3, rng);
    const levelMax = maxLevel + randInt(-2, 2, rng);
    const bossTitle = pick(BIOME_BOSS_TITLES[biome], rng);
    const bossName = `${pick(["Lord", "Lady", "Elder", "High", "Ancient", "The"], rng)} ${generateName(rng)}`;

    // Assign faction: 60% chance for a zone to be faction-affiliated
    const factionId = rng() < 0.6 && factions.length > 0
      ? (pick(factions, rng)?.id ?? null)
      : null;

    zones.push({
      id: `zone_${i}`,
      name,
      biome,
      levelRange: [levelMin, Math.max(levelMin + 5, levelMax)],
      connections: [], // filled in below
      factionId,
      description: `A ${biome} region known as ${name}.`,
      bossName: `${bossName}, ${bossTitle}`,
      bossLevel: Math.max(levelMin + 4, levelMax),
      lootQuality: Math.round((levelMin + levelMax) / 2),
    });
  }

  // Wire up connections: each zone connects to 1-3 others
  // Form a linear backbone, then add cross-connections
  for (let i = 0; i < zones.length - 1; i++) {
    zones[i]!.connections.push(`zone_${i + 1}`);
    zones[i + 1]!.connections.push(`zone_${i}`);
  }
  // Extra cross-connections
  const extraEdges = randInt(1, Math.floor(zones.length / 2), rng);
  for (let e = 0; e < extraEdges; e++) {
    const a = randInt(0, zones.length - 1, rng);
    const b = randInt(0, zones.length - 1, rng);
    if (a !== b) {
      const zA = zones[a];
      const zB = zones[b];
      if (zA && zB && !zA.connections.includes(`zone_${b}`)) {
        zA.connections.push(`zone_${b}`);
        zB.connections.push(`zone_${a}`);
      }
    }
  }

  return { zones, startingZoneId: "zone_0" };
}

// ─── Simple name generator ────────────────────────────────────────────────────

const NAME_STARTS = ["Thar", "Vel", "Kaz", "Mor", "Sel", "Drix", "Nar", "Vol", "Ash", "Zyr"];
const NAME_ENDS   = ["oth", "ax", "an", "ara", "iel", "us", "ia", "en", "ar", "ix"];

export function generateName(rng: Rng): string {
  return pick(NAME_STARTS, rng) + pick(NAME_ENDS, rng);
}
