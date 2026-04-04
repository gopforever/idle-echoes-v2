// ─── Alternate Advancement (AA) System ───────────────────────────────────────
// AA points are earned through kills. Spend them on passive talent nodes.

export interface AANodeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxRank: number;
  bonusPerRank: string;
  category: "offense" | "defense" | "utility";
}

export const AA_NODES: AANodeDef[] = [
  // Offense
  { id: "berserker",       name: "Berserker",       description: "+5% melee damage per rank",       icon: "⚔️", maxRank: 5, bonusPerRank: "+5% dmg",      category: "offense"  },
  { id: "critical_eye",    name: "Critical Eye",    description: "+2% critical hit chance per rank", icon: "🎯", maxRank: 5, bonusPerRank: "+2% crit",     category: "offense"  },
  { id: "swift_strikes",   name: "Swift Strikes",   description: "+5% attack haste per rank",        icon: "⚡", maxRank: 3, bonusPerRank: "+5% haste",    category: "offense"  },
  // Defense
  { id: "iron_skin",       name: "Iron Skin",       description: "+2% mitigation per rank",          icon: "🛡️", maxRank: 5, bonusPerRank: "+2% mit",      category: "defense"  },
  { id: "battle_hardened", name: "Battle Hardened", description: "+5% maximum HP per rank",          icon: "💪", maxRank: 5, bonusPerRank: "+5% max HP",   category: "defense"  },
  { id: "survivors_will",  name: "Survivor's Will", description: "-10% XP loss on death per rank",  icon: "🔄", maxRank: 3, bonusPerRank: "-10% penalty", category: "defense"  },
  // Utility
  { id: "fortune",         name: "Fortune",         description: "+5% gold income per rank",         icon: "💰", maxRank: 5, bonusPerRank: "+5% gold",     category: "utility"  },
  { id: "loot_sense",      name: "Loot Sense",      description: "+5% item drop chance per rank",    icon: "🎲", maxRank: 3, bonusPerRank: "+5% drop",     category: "utility"  },
  { id: "echo_resonance",  name: "Echo Resonance",  description: "+10% echo bonus per rank",         icon: "✨", maxRank: 5, bonusPerRank: "+10% echo",    category: "utility"  },
];

/** Points earned per N total kills */
export const AA_KILLS_PER_POINT = 10;

export function getAABonuses(aaNodes: Record<string, number>) {
  const r = (id: string) => aaNodes[id] ?? 0;
  return {
    damageMult:          1 + r("berserker")       * 0.05,
    critChanceBonus:         r("critical_eye")    * 0.02,
    hasteMult:           1 + r("swift_strikes")   * 0.05,
    mitigationBonus:         r("iron_skin")        * 0.02,
    maxHpBonus:              r("battle_hardened") * 0.05,
    deathPenaltyMult:    1 - r("survivors_will")  * 0.10,
    goldMult:            1 + r("fortune")         * 0.05,
    dropRateBonus:           r("loot_sense")      * 0.05,
    echoBonus:               r("echo_resonance")  * 0.10,
  };
}
