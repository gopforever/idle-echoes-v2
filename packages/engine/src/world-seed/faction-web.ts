import type { Faction, FactionAlignment } from "./types.js";
import { pick, randInt, type Rng } from "./rng.js";

// ─── Faction generation ───────────────────────────────────────────────────────

const FACTION_TITLES: Record<FactionAlignment, string[]> = {
  good:    ["Brotherhood", "Order", "Covenant", "Alliance", "Fellowship"],
  evil:    ["Dominion", "Cabal", "Black Hand", "Shadow Council", "Legion"],
  neutral: ["Guild", "Collective", "Exchange", "Conclave", "Circle"],
  chaotic: ["Horde", "Warband", "Marauders", "Reavers", "Chaos Host"],
};

const FACTION_ADJECTIVES: Record<FactionAlignment, string[]> = {
  good:    ["Radiant", "Silver", "Holy", "Verdant", "Golden"],
  evil:    ["Obsidian", "Crimson", "Dark", "Void", "Iron"],
  neutral: ["Grey", "Amber", "Ashen", "Copper", "Steel"],
  chaotic: ["Scarlet", "Blood", "Savage", "War", "Bone"],
};

const ALIGNMENTS: FactionAlignment[] = ["good", "evil", "neutral", "chaotic"];

export function generateFactionWeb(rng: Rng, zoneIds: string[]): { factions: Faction[] } {
  const count = randInt(4, 6, rng);
  const factions: Faction[] = [];

  for (let i = 0; i < count; i++) {
    const alignment = pick(ALIGNMENTS, rng);
    const adjective = pick(FACTION_ADJECTIVES[alignment], rng);
    const title = pick(FACTION_TITLES[alignment], rng);
    const homeZoneId = zoneIds[i % zoneIds.length] ?? "zone_0";

    factions.push({
      id: `faction_${i}`,
      name: `The ${adjective} ${title}`,
      alignment,
      homeZoneId,
      relationships: {}, // filled below
      tradeBonus: alignment === "good" ? 10 : alignment === "neutral" ? 5 : 0,
      description: `A ${alignment}-aligned faction based in ${homeZoneId}.`,
    });
  }

  // Set relationships
  for (const f of factions) {
    for (const other of factions) {
      if (f.id === other.id) continue;
      if (f.alignment === other.alignment) {
        f.relationships[other.id] = "allied";
      } else if (
        (f.alignment === "good" && other.alignment === "evil") ||
        (f.alignment === "evil" && other.alignment === "good")
      ) {
        f.relationships[other.id] = "hostile";
      } else {
        f.relationships[other.id] = "neutral";
      }
    }
  }

  return { factions };
}
