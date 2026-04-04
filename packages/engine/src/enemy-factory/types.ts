// ─── Enemy Trait System ───────────────────────────────────────────────────────
// Enemies are generated from combinations of traits, not fixed tables.
// 5 base types × 5 sizes × 6 elements × 4 roles × 5 modifiers = 3,000+ combos.

export type EnemyBaseType = "beast" | "undead" | "elemental" | "construct" | "humanoid";
export type EnemySize = "tiny" | "small" | "medium" | "large" | "colossal";
export type EnemyElement = "fire" | "ice" | "void" | "divine" | "poison" | "physical";
export type EnemyRole = "striker" | "tank" | "caster" | "support";
export type EnemyModifier = "ancient" | "corrupted" | "blessed" | "enraged" | "elite";

export interface EnemyTraits {
  baseType: EnemyBaseType;
  size: EnemySize;
  element: EnemyElement;
  role: EnemyRole;
  modifier: EnemyModifier | null;
}

export interface EnemyAbility {
  id: string;
  name: string;
  triggerType: "every_n_ticks" | "percent_hp" | "on_hit_proc";
  triggerValue: number;         // ticks interval / HP% threshold / proc chance
  effectType: "damage" | "dot" | "stun" | "slow" | "heal" | "shield" | "frenzy";
  effectValue: number;
  duration?: number;            // ticks for ongoing effects
  unavoidable?: boolean;
}

export interface GeneratedEnemy {
  id: string;
  name: string;
  traits: EnemyTraits;
  level: number;
  isBoss: boolean;

  // Stats
  hp: number;
  maxHp: number;
  attackRating: number;
  defenseRating: number;
  mitigation: number;
  avoidance: number;
  dmgMin: number;
  dmgMax: number;

  // Combat behavior
  abilities: EnemyAbility[];
  resistances: Partial<Record<EnemyElement, number>>; // % resist (negative = vulnerable)

  // Boss personality (only for bosses)
  personality?: {
    aggression: number;    // 0-100
    cunning: number;       // 0-100 (learns from player patterns)
    patience: number;      // 0-100
    desperation: number;   // 0-100 (escalates when low HP)
  };

  // Rewards
  xpReward: number;
  goldReward: number;
  lootQuality: number;
}
