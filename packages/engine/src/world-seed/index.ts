import { mulberry32 } from "./rng.js";
import { generateZoneGraph } from "./zone-graph.js";
import { generateFactionWeb } from "./faction-web.js";
import { generateWorldHistory } from "./history.js";
import type { GeneratedWorld } from "./types.js";

export * from "./types.js";
export * from "./rng.js";

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate a complete world from a 32-bit seed.
 * Deterministic: same seed → same world, every time.
 */
export function generateWorld(seed: number): GeneratedWorld {
  const rng = mulberry32(seed);

  // Generate factions first (zones reference them)
  // We need zone ids for factions, so we do a two-pass:
  // Pass 1: generate placeholder zone ids
  const placeholderZoneIds = Array.from({ length: 10 }, (_, i) => `zone_${i}`);
  const factionWeb = generateFactionWeb(rng, placeholderZoneIds);

  // Pass 2: generate zone graph with real faction references
  const zoneGraph = generateZoneGraph(rng, factionWeb.factions);

  // Generate world history using real zone ids
  const realZoneIds = zoneGraph.zones.map(z => z.id);
  const history = generateWorldHistory(rng, realZoneIds);

  return { seed, zoneGraph, factionWeb, history };
}

/**
 * Generate a random seed for a new world.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

/**
 * Derive a stable world name from the world's history.
 */
export function getWorldDisplayName(world: GeneratedWorld): string {
  return world.history.worldName;
}
