import type { HistoryEvent, HistoryEventType, WorldHistory } from "./types.js";
import { pick, pickN, randInt, type Rng } from "./rng.js";

// ─── History generation ───────────────────────────────────────────────────────

const EVENT_DESCRIPTIONS: Record<HistoryEventType, string[]> = {
  fallen_empire: [
    "A great empire once ruled these lands, its ruins still dotting the landscape.",
    "The remnants of a collapsed civilization haunt this region.",
  ],
  dragon_war: [
    "Dragons once fought a terrible war here, leaving scars still visible today.",
    "The bones of ancient dragons litter the valleys below.",
  ],
  plague: [
    "A devastating plague swept through, leaving undead in its wake.",
    "Dark magic from an ancient plague still lingers in the soil.",
  ],
  divine_blessing: [
    "The gods themselves blessed this land, granting unusual resilience to its inhabitants.",
    "A divine covenant was forged here long ago.",
  ],
  arcane_cataclysm: [
    "An arcane experiment gone wrong reshaped this region permanently.",
    "The ley lines were shattered here, warping reality in subtle ways.",
  ],
  great_migration: [
    "A great exodus passed through, leaving behind settlements and abandoned treasures.",
    "Multiple races fled through here, each leaving their mark.",
  ],
  ancient_awakening: [
    "Something ancient stirs beneath the surface.",
    "An elder being awakened here centuries ago, and its influence remains.",
  ],
  war_of_factions: [
    "Bitter faction wars were fought on these grounds, leaving rival strongholds.",
    "The scars of factional conflict run deep in this land.",
  ],
};

const EVENT_LEGACIES: Record<HistoryEventType, string[]> = {
  fallen_empire:    ["Construct guardians patrol ancient ruins", "Treasure caches hidden by empire loyalists"],
  dragon_war:       ["Dragon bones yield rare crafting materials", "Draconic cultists seek to resurrect their masters"],
  plague:           ["Undead spawn at elevated rates", "Plague-touched enemies have poison resistance"],
  divine_blessing:  ["Healing effects are 20% stronger", "Divine items drop more frequently"],
  arcane_cataclysm: ["Spell damage is amplified", "Arcane anomalies grant bonus XP when defeated"],
  great_migration:  ["Rare vendor stock from distant lands", "Hidden caches appear in certain zones"],
  ancient_awakening:["Elite enemies appear without warning", "Lore fragments grant bonus AA XP"],
  war_of_factions:  ["Faction reputation gains are doubled", "Rival faction ambushes occur randomly"],
};

const WORLD_NAMES = [
  "Norrath", "Azeroth", "Velious", "Kunark", "Luclin",
  "Antonica", "Faydwer", "D'Lere", "Myrist", "Tenebrous",
  "Sunderstone", "Ashenveil", "Duskholm", "Embercrest", "Voidmarch",
];

const EVENT_TYPES: HistoryEventType[] = [
  "fallen_empire", "dragon_war", "plague", "divine_blessing",
  "arcane_cataclysm", "great_migration", "ancient_awakening", "war_of_factions",
];

export function generateWorldHistory(rng: Rng, zoneIds: string[]): WorldHistory {
  const worldName = pick(WORLD_NAMES, rng);
  const age = pick(["young", "ancient", "primordial"] as const, rng);
  const eventCount = randInt(2, 4, rng);
  const chosenTypes = pickN(EVENT_TYPES, eventCount, rng);

  const events: HistoryEvent[] = chosenTypes.map((type, i) => {
    const affectedCount = randInt(1, Math.min(3, zoneIds.length), rng);
    const affectedZoneIds = pickN(zoneIds, affectedCount, rng);
    return {
      type,
      era: i + 1,
      affectedZoneIds,
      description: pick(EVENT_DESCRIPTIONS[type], rng),
      legacyEffect: pick(EVENT_LEGACIES[type], rng),
    };
  });

  return { events, worldName, age };
}
