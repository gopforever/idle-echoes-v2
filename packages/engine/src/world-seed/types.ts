// ─── World Seed Types ─────────────────────────────────────────────────────────

export type Biome =
  | "grasslands"
  | "forest"
  | "frozen"
  | "volcanic"
  | "arcane"
  | "corrupted"
  | "desert"
  | "swamp"
  | "undead"
  | "celestial";

export type FactionAlignment = "good" | "evil" | "neutral" | "chaotic";

export type HistoryEventType =
  | "fallen_empire"
  | "dragon_war"
  | "plague"
  | "divine_blessing"
  | "arcane_cataclysm"
  | "great_migration"
  | "ancient_awakening"
  | "war_of_factions";

export interface Zone {
  id: string;           // "zone_0", "zone_1", etc.
  name: string;         // generated from biome + history
  biome: Biome;
  levelRange: [number, number];
  connections: string[]; // zone ids this connects to
  factionId: string | null;
  description: string;
  bossName: string;
  bossLevel: number;
  lootQuality: number;  // 10-100, scales with level range
}

export interface ZoneGraph {
  zones: Zone[];
  startingZoneId: string;
}

export interface Faction {
  id: string;
  name: string;
  alignment: FactionAlignment;
  homeZoneId: string;
  relationships: Record<string, "allied" | "neutral" | "hostile">;
  tradeBonus: number;   // % bonus to merchant prices when friendly
  description: string;
}

export interface FactionWeb {
  factions: Faction[];
}

export interface HistoryEvent {
  type: HistoryEventType;
  era: number;          // which era this happened in (1 = oldest)
  affectedZoneIds: string[];
  description: string;
  legacyEffect: string; // what residue this left (e.g. "undead roam these lands")
}

export interface WorldHistory {
  events: HistoryEvent[];
  worldName: string;
  age: string;          // "young" | "ancient" | "primordial"
}

export interface GeneratedWorld {
  seed: number;
  zoneGraph: ZoneGraph;
  factionWeb: FactionWeb;
  history: WorldHistory;
}
