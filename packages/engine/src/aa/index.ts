// ─── Alternate Advancement (AA) System ───────────────────────────────────────
// AA points are earned through kills. Spend them on passive or active talent nodes.

export type Archetype = "Fighter" | "Scout" | "Mage" | "Priest";

export type PassiveEffectType =
  "damage_mult" | "crit_chance" | "avoidance" | "mitigation" | "max_hp_pct" |
  "hp_regen" | "power_regen" | "gold_mult" | "xp_mult" | "drop_rate" |
  "str_bonus" | "agi_bonus" | "sta_bonus" | "int_bonus" | "wis_bonus" |
  "finishing_blow" | "flurry" | "leech" | "reflect_damage" | "dot_proc" | "reactive_heal";

export interface PassiveEffect {
  type: PassiveEffectType;
  valuePerRank: number;
  dotPctPerTick?: number;
  dotDuration?: number;
}

export type ActiveEffectType =
  "heal" | "burst_damage" | "manaburn" | "lifeburn" | "escape" | "purify" |
  "damage_buff" | "power_restore" | "invulnerable";

export interface ActiveEffect {
  type: ActiveEffectType;
  healPct?: number;
  burstMult?: number;
  burnPct?: number;
  buffMult?: number;
  durationTicks?: number;
  powerPct?: number;
  cooldownMs: number;
}

export interface AANodeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  tier: 1 | 2 | 3 | 4;
  archetype?: Archetype[];
  classes?: string[];
  maxRank: number;
  costPerRank: number[];
  bonusDescription: string;
  passive?: PassiveEffect;
  active?: ActiveEffect;
}

export interface AABonuses {
  damageMult: number;
  critChanceBonus: number;
  avoidanceBonus: number;
  mitigationBonus: number;
  maxHpBonus: number;
  hpRegenPerTick: number;
  powerRegenPerTick: number;
  goldMult: number;
  xpMult: number;
  dropRateBonus: number;
  strBonus: number;
  agiBonus: number;
  staBonus: number;
  intBonus: number;
  wisBonus: number;
  finishingBlowChance: number;
  flurryChance: number;
  leechPct: number;
  reflectPct: number;
  dotProcChance: number;
  reactiveHealChance: number;
  hasteMult: number; // kept for backward compat, always 1.0 now
  echoBonus: number; // kept for compat
}

/** Points earned per N total kills */
export const AA_KILLS_PER_POINT = 10;

export const AA_NODES: AANodeDef[] = [
  // ─── TIER 1: General (all classes, no filter) ────────────────────────────────
  {
    id: "gen_strength", name: "Innate Strength", icon: "💪",
    description: "+2 STR per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2 STR per rank",
    passive: { type: "str_bonus", valuePerRank: 2 },
  },
  {
    id: "gen_stamina", name: "Innate Stamina", icon: "❤️",
    description: "+2 STA per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2 STA per rank",
    passive: { type: "sta_bonus", valuePerRank: 2 },
  },
  {
    id: "gen_agility", name: "Innate Agility", icon: "🦊",
    description: "+2 AGI per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2 AGI per rank",
    passive: { type: "agi_bonus", valuePerRank: 2 },
  },
  {
    id: "gen_intelligence", name: "Innate Intelligence", icon: "🧠",
    description: "+2 INT per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2 INT per rank",
    passive: { type: "int_bonus", valuePerRank: 2 },
  },
  {
    id: "gen_wisdom", name: "Innate Wisdom", icon: "🌿",
    description: "+2 WIS per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2 WIS per rank",
    passive: { type: "wis_bonus", valuePerRank: 2 },
  },
  {
    id: "gen_fire_resist", name: "Fire Resistance", icon: "🔥",
    description: "+2% fire resist per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2% fire resist per rank",
    passive: { type: "mitigation", valuePerRank: 0.002 },
  },
  {
    id: "gen_cold_resist", name: "Cold Resistance", icon: "❄️",
    description: "+2% cold resist per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2% cold resist per rank",
    passive: { type: "mitigation", valuePerRank: 0.002 },
  },
  {
    id: "gen_magic_resist", name: "Magic Resistance", icon: "✨",
    description: "+2% magic resist per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2% magic resist per rank",
    passive: { type: "mitigation", valuePerRank: 0.002 },
  },
  {
    id: "gen_poison_resist", name: "Poison Resistance", icon: "☠️",
    description: "+2% poison resist per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+2% poison resist per rank",
    passive: { type: "mitigation", valuePerRank: 0.002 },
  },
  {
    id: "gen_regen", name: "Innate Regeneration", icon: "🌱",
    description: "+1 HP regen per tick per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+1 HP regen per tick per rank",
    passive: { type: "hp_regen", valuePerRank: 1 },
  },
  {
    id: "gen_first_aid", name: "First Aid", icon: "🩹",
    description: "+10% meditation heal per rank", tier: 1, maxRank: 3, costPerRank: [1,1,1],
    bonusDescription: "+10% meditation heal per rank",
    passive: { type: "reactive_heal", valuePerRank: 0.03 },
  },
  {
    id: "gen_gold_sense", name: "Gold Sense", icon: "💰",
    description: "+5% gold drops per rank", tier: 1, maxRank: 5, costPerRank: [1,1,1,1,1],
    bonusDescription: "+5% gold drops per rank",
    passive: { type: "gold_mult", valuePerRank: 0.05 },
  },
  {
    id: "gen_loot_sense", name: "Loot Sense", icon: "🗡️",
    description: "+3% item drop rate per rank", tier: 1, maxRank: 3, costPerRank: [1,1,1],
    bonusDescription: "+3% item drop rate per rank",
    passive: { type: "drop_rate", valuePerRank: 0.03 },
  },

  // ─── TIER 2: General / Backward-Compat nodes ─────────────────────────────────
  {
    id: "fortune", name: "Fortune", icon: "🍀",
    description: "+8% gold & +3% drop rate per rank", tier: 2, maxRank: 5, costPerRank: [1,1,2,2,3],
    bonusDescription: "+8% gold per rank",
    passive: { type: "gold_mult", valuePerRank: 0.08 },
  },
  {
    id: "loot_sense", name: "Loot Sense", icon: "🔍",
    description: "+5% drop rate per rank", tier: 2, maxRank: 5, costPerRank: [1,1,2,2,3],
    bonusDescription: "+5% drop rate per rank",
    passive: { type: "drop_rate", valuePerRank: 0.05 },
  },
  {
    id: "echo_resonance", name: "Echo Resonance", icon: "🌀",
    description: "+2% echo/ascension bonus per rank", tier: 2, maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+2% echo bonus per rank",
    passive: { type: "xp_mult", valuePerRank: 0.04 },
  },

  // ─── TIER 2: Archetype nodes ─────────────────────────────────────────────────
  {
    id: "arch_combat_agility", name: "Combat Agility", icon: "🌪️",
    description: "+2/5/10% avoidance", tier: 2, maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+3.3% avoidance per rank",
    passive: { type: "avoidance", valuePerRank: 0.033 },
  },
  {
    id: "arch_combat_stability", name: "Combat Stability", icon: "🏰",
    description: "+2/5/10% mitigation", tier: 2, maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+3.3% mitigation per rank",
    passive: { type: "mitigation", valuePerRank: 0.033 },
  },
  {
    id: "arch_natural_durability", name: "Natural Durability", icon: "🛡️",
    description: "+2/5/10% max HP", tier: 2, maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+3.3% max HP per rank",
    passive: { type: "max_hp_pct", valuePerRank: 0.033 },
  },
  {
    id: "arch_combat_fury", name: "Combat Fury", icon: "⚔️",
    description: "+2/4/7% crit chance", tier: 2, archetype: ["Fighter","Scout"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+2.3% crit chance per rank",
    passive: { type: "crit_chance", valuePerRank: 0.023 },
  },
  {
    id: "arch_natural_healing", name: "Natural Healing", icon: "💚",
    description: "+1/2/3 HP regen/tick", tier: 2, archetype: ["Fighter","Scout"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+1 HP regen per rank",
    passive: { type: "hp_regen", valuePerRank: 1 },
  },
  {
    id: "arch_finishing_blow", name: "Finishing Blow", icon: "⚡",
    description: "10/20/35% chance to execute enemy below 10% HP", tier: 2, archetype: ["Fighter","Scout"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+11.7% finishing blow chance per rank",
    passive: { type: "finishing_blow", valuePerRank: 0.117 },
  },
  {
    id: "arch_channeling_focus", name: "Channeling Focus", icon: "📿",
    description: "-5/10/15% stun chance", tier: 2, archetype: ["Mage","Priest"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+5% avoidance per rank",
    passive: { type: "avoidance", valuePerRank: 0.05 },
  },
  {
    id: "arch_mental_clarity", name: "Mental Clarity", icon: "🔮",
    description: "+1/2/3 Power regen/tick", tier: 2, archetype: ["Mage","Priest"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+1 Power regen per rank",
    passive: { type: "power_regen", valuePerRank: 1 },
  },
  {
    id: "arch_spell_fury", name: "Spell Casting Fury", icon: "⚡",
    description: "+2/4/7% spell crit", tier: 2, archetype: ["Mage","Priest"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+2.3% spell crit per rank",
    passive: { type: "crit_chance", valuePerRank: 0.023 },
  },
  {
    id: "arch_healing_adept", name: "Healing Adept", icon: "❤️‍🩹",
    description: "+5/10/20% heal effectiveness", tier: 2, archetype: ["Priest"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+6.7% heal effectiveness per rank",
    passive: { type: "reactive_heal", valuePerRank: 0.067 },
  },
  {
    id: "arch_healing_gift", name: "Healing Gift", icon: "🎁",
    description: "+3/6/10% critical heal chance", tier: 2, archetype: ["Priest"], maxRank: 3, costPerRank: [2,4,6],
    bonusDescription: "+2 HP regen per rank",
    passive: { type: "hp_regen", valuePerRank: 2 },
  },

  // ─── TIER 2: Old backward-compat nodes ───────────────────────────────────────
  {
    id: "berserker", name: "Berserker Rage", icon: "😡",
    description: "+5% damage per rank", tier: 2, archetype: ["Fighter","Scout"], maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+5% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.05 },
  },
  {
    id: "critical_eye", name: "Critical Eye", icon: "👁️",
    description: "+2% crit chance per rank", tier: 2, maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+2% crit chance per rank",
    passive: { type: "crit_chance", valuePerRank: 0.02 },
  },
  {
    id: "swift_strikes", name: "Swift Strikes", icon: "⚡",
    description: "+4% flurry chance per rank", tier: 2, archetype: ["Fighter","Scout"], maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+4% flurry per rank",
    passive: { type: "flurry", valuePerRank: 0.04 },
  },
  {
    id: "iron_skin", name: "Iron Skin", icon: "🪨",
    description: "+3% mitigation per rank", tier: 2, maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+3% mitigation per rank",
    passive: { type: "mitigation", valuePerRank: 0.03 },
  },
  {
    id: "battle_hardened", name: "Battle-Hardened", icon: "💎",
    description: "+4% max HP per rank", tier: 2, archetype: ["Fighter"], maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+4% max HP per rank",
    passive: { type: "max_hp_pct", valuePerRank: 0.04 },
  },
  {
    id: "survivors_will", name: "Survivor's Will", icon: "🔥",
    description: "+2 HP regen/tick per rank", tier: 2, maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+2 HP regen per rank",
    passive: { type: "hp_regen", valuePerRank: 2 },
  },

  // ─── TIER 3: Fighter classes ──────────────────────────────────────────────────
  {
    id: "cls_guardian_fortify", name: "Fortify", icon: "🏯",
    description: "+5/10/20% mitigation when below 40% HP", tier: 3, classes: ["Guardian"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% mitigation per rank",
    passive: { type: "mitigation", valuePerRank: 0.067 },
  },
  {
    id: "cls_guardian_rampage", name: "Rampage", icon: "💥",
    description: "Strike all nearby enemies this tick", tier: 3, classes: ["Guardian"], maxRank: 1, costPerRank: [5],
    bonusDescription: "AoE burst damage",
    active: { type: "burst_damage", burstMult: 0.5, cooldownMs: 30000 },
  },
  {
    id: "cls_guardian_warcry", name: "Warcry", icon: "📣",
    description: "10/20/30% damage reduction buff for 3 ticks", tier: 3, classes: ["Guardian"], maxRank: 1, costPerRank: [5],
    bonusDescription: "Invulnerability for 1 tick",
    active: { type: "invulnerable", durationTicks: 1, cooldownMs: 45000 },
  },
  {
    id: "cls_berserker_frenzy", name: "Blood Frenzy", icon: "🩸",
    description: "+10/20/35% damage when below 50% HP", tier: 3, classes: ["Berserker"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+11.7% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.117 },
  },
  {
    id: "cls_berserker_savage", name: "Savage Strike", icon: "⚔️",
    description: "Guaranteed crit, triple damage hit", tier: 3, classes: ["Berserker"], maxRank: 1, costPerRank: [9],
    bonusDescription: "3× damage burst",
    active: { type: "burst_damage", burstMult: 3.0, cooldownMs: 60000 },
  },
  {
    id: "cls_berserker_flurry", name: "Flurry", icon: "🌀",
    description: "+10/20/35% flurry chance", tier: 3, classes: ["Berserker"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+11.7% flurry per rank",
    passive: { type: "flurry", valuePerRank: 0.117 },
  },
  {
    id: "cls_monk_purify", name: "Purify Body", icon: "🧘",
    description: "Remove all negative effects", tier: 3, classes: ["Monk"], maxRank: 1, costPerRank: [9],
    bonusDescription: "Cleanse all debuffs",
    active: { type: "purify", cooldownMs: 90000 },
  },
  {
    id: "cls_monk_return_kick", name: "Return Kick", icon: "🦵",
    description: "+10/25/40% riposte/counter chance", tier: 3, classes: ["Monk"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+13.3% counter per rank",
    passive: { type: "flurry", valuePerRank: 0.133 },
  },
  {
    id: "cls_monk_inner_fire", name: "Inner Fire", icon: "🔥",
    description: "+10/20/30% damage for 3 ticks", tier: 3, classes: ["Monk"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "Damage buff for 3 ticks",
    active: { type: "damage_buff", buffMult: 1.3, durationTicks: 3, cooldownMs: 45000 },
  },
  {
    id: "cls_bruiser_slam", name: "Power Slam", icon: "💪",
    description: "+5/10/20% stun proc chance", tier: 3, classes: ["Bruiser"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% stun proc per rank",
    passive: { type: "dot_proc", valuePerRank: 0.067, dotPctPerTick: 0.0, dotDuration: 1 },
  },
  {
    id: "cls_bruiser_iron_fist", name: "Iron Fist", icon: "✊",
    description: "+10/20/35% unarmed/melee damage", tier: 3, classes: ["Bruiser"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+11.7% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.117 },
  },
  {
    id: "cls_bruiser_bull_rush", name: "Bull Rush", icon: "🐂",
    description: "Massive burst strike: 2.5× damage", tier: 3, classes: ["Bruiser"], maxRank: 1, costPerRank: [9],
    bonusDescription: "2.5× burst damage",
    active: { type: "burst_damage", burstMult: 2.5, cooldownMs: 45000 },
  },
  {
    id: "cls_shadowknight_fearless", name: "Fearless", icon: "💀",
    description: "Immune to stun effects", tier: 3, classes: ["Shadowknight"], maxRank: 1, costPerRank: [6],
    bonusDescription: "+15% avoidance",
    passive: { type: "avoidance", valuePerRank: 0.15 },
  },
  {
    id: "cls_shadowknight_leech", name: "Leech Touch", icon: "🧛",
    description: "+10/20/30% life steal on hit", tier: 3, classes: ["Shadowknight"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+10% life steal per rank",
    passive: { type: "leech", valuePerRank: 0.1 },
  },
  {
    id: "cls_shadowknight_unholy", name: "Unholy Strike", icon: "⚫",
    description: "+5/10/20% damage, reflected as HP", tier: 3, classes: ["Shadowknight"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "2× burst damage",
    active: { type: "burst_damage", burstMult: 2.0, cooldownMs: 40000 },
  },
  {
    id: "cls_paladin_lay_hands", name: "Lay on Hands", icon: "✋",
    description: "Restore 75% max HP", tier: 3, classes: ["Paladin"], maxRank: 1, costPerRank: [5],
    bonusDescription: "Restore 75% HP",
    active: { type: "heal", healPct: 0.75, cooldownMs: 120000 },
  },
  {
    id: "cls_paladin_slay_undead", name: "Slay Undead", icon: "☀️",
    description: "+30/60/100% damage vs undead/construct", tier: 3, classes: ["Paladin"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+33.3% vs undead per rank",
    passive: { type: "damage_mult", valuePerRank: 0.333 },
  },
  {
    id: "cls_paladin_divine_aura", name: "Divine Aura", icon: "🌟",
    description: "Invulnerable for 2 ticks", tier: 3, classes: ["Paladin"], maxRank: 1, costPerRank: [9],
    bonusDescription: "Invulnerable for 2 ticks",
    active: { type: "invulnerable", durationTicks: 2, cooldownMs: 180000 },
  },

  // ─── TIER 3: Scout classes ────────────────────────────────────────────────────
  {
    id: "cls_assassin_escape", name: "Escape", icon: "🌫️",
    description: "Break combat instantly", tier: 3, classes: ["Assassin","Brigand"], maxRank: 1, costPerRank: [9],
    bonusDescription: "Escape combat instantly",
    active: { type: "escape", cooldownMs: 120000 },
  },
  {
    id: "cls_assassin_lethal", name: "Lethal Strike", icon: "🗡️",
    description: "+15/30/50% damage", tier: 3, classes: ["Assassin"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+16.7% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.167 },
  },
  {
    id: "cls_assassin_shadow", name: "Shadow Step", icon: "👤",
    description: "+10/20/35% avoidance for 3 ticks (passive proc)", tier: 3, classes: ["Assassin"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+11.7% avoidance per rank",
    passive: { type: "avoidance", valuePerRank: 0.117 },
  },
  {
    id: "cls_ranger_archery", name: "Archery Mastery", icon: "🏹",
    description: "+30/60/100% ranged crit damage", tier: 3, classes: ["Ranger"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+10% crit chance per rank",
    passive: { type: "crit_chance", valuePerRank: 0.10 },
  },
  {
    id: "cls_ranger_endless", name: "Endless Quiver", icon: "♾️",
    description: "+5/10/20% attack rate (flurry)", tier: 3, classes: ["Ranger"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% flurry per rank",
    passive: { type: "flurry", valuePerRank: 0.067 },
  },
  {
    id: "cls_ranger_stride", name: "Nature Stride", icon: "🌲",
    description: "Burst 2× damage attack", tier: 3, classes: ["Ranger"], maxRank: 1, costPerRank: [9],
    bonusDescription: "2× burst damage",
    active: { type: "burst_damage", burstMult: 2.0, cooldownMs: 30000 },
  },
  {
    id: "cls_brigand_steal", name: "Steal", icon: "💸",
    description: "+15/30/60% gold from kills", tier: 3, classes: ["Brigand"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+20% gold per rank",
    passive: { type: "gold_mult", valuePerRank: 0.2 },
  },
  {
    id: "cls_brigand_ambush", name: "Ambush", icon: "🎯",
    description: "Triple damage burst strike", tier: 3, classes: ["Brigand"], maxRank: 1, costPerRank: [6],
    bonusDescription: "3× burst damage",
    active: { type: "burst_damage", burstMult: 3.0, cooldownMs: 60000 },
  },
  {
    id: "cls_brigand_tricks", name: "Dirty Tricks", icon: "🃏",
    description: "+5/10/20% chance to proc DoT on hit", tier: 3, classes: ["Brigand"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% DoT proc per rank",
    passive: { type: "dot_proc", valuePerRank: 0.067, dotPctPerTick: 0.02, dotDuration: 3 },
  },
  {
    id: "cls_swashbuckler_riposte", name: "Riposte", icon: "⚔️",
    description: "+10/20/35% counter-attack chance", tier: 3, classes: ["Swashbuckler"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+11.7% counter per rank",
    passive: { type: "flurry", valuePerRank: 0.117 },
  },
  {
    id: "cls_swashbuckler_flourish", name: "Flourish", icon: "💃",
    description: "+5/10/20% crit chance for 3 ticks", tier: 3, classes: ["Swashbuckler"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "Damage buff for 3 ticks",
    active: { type: "damage_buff", buffMult: 1.2, durationTicks: 3, cooldownMs: 30000 },
  },
  {
    id: "cls_swashbuckler_luck", name: "Adventurer's Luck", icon: "🎲",
    description: "+15/30/60% gold drops", tier: 3, classes: ["Swashbuckler"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+20% gold per rank",
    passive: { type: "gold_mult", valuePerRank: 0.2 },
  },
  {
    id: "cls_troubador_hymn", name: "Battle Hymn", icon: "🎵",
    description: "+5/10/15% damage mult", tier: 3, classes: ["Troubador"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+5% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.05 },
  },
  {
    id: "cls_troubador_march", name: "War March", icon: "🥁",
    description: "+3/6/10% flurry chance", tier: 3, classes: ["Troubador"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+3.3% flurry per rank",
    passive: { type: "flurry", valuePerRank: 0.033 },
  },
  {
    id: "cls_troubador_encore", name: "Encore", icon: "🎶",
    description: "+10/20/30% XP from kills", tier: 3, classes: ["Troubador"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+10% XP per rank",
    passive: { type: "xp_mult", valuePerRank: 0.10 },
  },
  {
    id: "cls_dirge_deathsong", name: "Deathsong", icon: "💀",
    description: "+5/10/20% DoT proc chance", tier: 3, classes: ["Dirge"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% DoT proc per rank",
    passive: { type: "dot_proc", valuePerRank: 0.067, dotPctPerTick: 0.03, dotDuration: 3 },
  },
  {
    id: "cls_dirge_lament", name: "Lament", icon: "😢",
    description: "+10/20/35% damage below 40% HP", tier: 3, classes: ["Dirge"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+11.7% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.117 },
  },
  {
    id: "cls_dirge_requiem", name: "Requiem", icon: "🎻",
    description: "+10/20/40% crit damage", tier: 3, classes: ["Dirge"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+13.3% crit per rank",
    passive: { type: "crit_chance", valuePerRank: 0.133 },
  },

  // ─── TIER 3: Mage classes ─────────────────────────────────────────────────────
  {
    id: "cls_wizard_manaburn", name: "Manaburn", icon: "🔥",
    description: "Burn all Power as non-resistable damage", tier: 3, classes: ["Wizard"], maxRank: 1, costPerRank: [5],
    bonusDescription: "Convert 80% Power to damage",
    active: { type: "manaburn", burnPct: 0.80, cooldownMs: 120000 },
  },
  {
    id: "cls_wizard_quick_dmg", name: "Quick Damage", icon: "⚡",
    description: "+5/10/20% spell damage", tier: 3, classes: ["Wizard"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% spell damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.067 },
  },
  {
    id: "cls_wizard_strong_root", name: "Arcane Lock", icon: "🔒",
    description: "+5/10/20% stun proc on hit", tier: 3, classes: ["Wizard"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% stun proc per rank",
    passive: { type: "dot_proc", valuePerRank: 0.067, dotPctPerTick: 0.0, dotDuration: 1 },
  },
  {
    id: "cls_warlock_destructive", name: "Destructive Fury", icon: "💥",
    description: "+10/20/40% damage vs enemy below 50% HP", tier: 3, classes: ["Warlock"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+13.3% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.133 },
  },
  {
    id: "cls_warlock_dark_pact", name: "Dark Pact", icon: "🌑",
    description: "Sacrifice 15% HP for 50% damage buff 2 ticks", tier: 3, classes: ["Warlock"], maxRank: 1, costPerRank: [9],
    bonusDescription: "50% damage buff for 2 ticks",
    active: { type: "damage_buff", buffMult: 1.5, durationTicks: 2, cooldownMs: 60000 },
  },
  {
    id: "cls_warlock_pandemic", name: "Pandemic", icon: "☠️",
    description: "+5/10/20% DoT damage", tier: 3, classes: ["Warlock"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% DoT proc per rank",
    passive: { type: "dot_proc", valuePerRank: 0.067, dotPctPerTick: 0.04, dotDuration: 4 },
  },
  {
    id: "cls_conjuror_elemental", name: "Elemental Mastery", icon: "🌊",
    description: "+10/20/30% elemental spell damage", tier: 3, classes: ["Conjuror"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+10% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.10 },
  },
  {
    id: "cls_conjuror_pact", name: "Elemental Pact", icon: "🤝",
    description: "+5/10/20% all damage", tier: 3, classes: ["Conjuror"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% all damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.067 },
  },
  {
    id: "cls_conjuror_reclaim", name: "Reclaim Energy", icon: "⚡",
    description: "Restore 60% Power on demand", tier: 3, classes: ["Conjuror"], maxRank: 1, costPerRank: [9],
    bonusDescription: "Restore 60% Power",
    active: { type: "power_restore", powerPct: 0.60, cooldownMs: 90000 },
  },
  {
    id: "cls_necromancer_lifeburn", name: "Lifeburn", icon: "💀",
    description: "Sacrifice 40% current HP, deal 2× as damage", tier: 3, classes: ["Necromancer"], maxRank: 1, costPerRank: [9],
    bonusDescription: "Convert 40% HP to 2× damage",
    active: { type: "lifeburn", burnPct: 0.40, cooldownMs: 120000 },
  },
  {
    id: "cls_necromancer_fear", name: "Fearstorm", icon: "😱",
    description: "+5/10/20% stun proc chance", tier: 3, classes: ["Necromancer"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% stun proc per rank",
    passive: { type: "dot_proc", valuePerRank: 0.067, dotPctPerTick: 0.0, dotDuration: 2 },
  },
  {
    id: "cls_necromancer_drain", name: "Life Drain", icon: "🩸",
    description: "+10/20/30% life steal", tier: 3, classes: ["Necromancer"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+10% life steal per rank",
    passive: { type: "leech", valuePerRank: 0.10 },
  },
  {
    id: "cls_illusionist_charm", name: "Phantasm", icon: "🌀",
    description: "+5/10/20% chance to skip enemy attack", tier: 3, classes: ["Illusionist"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% avoidance per rank",
    passive: { type: "avoidance", valuePerRank: 0.067 },
  },
  {
    id: "cls_illusionist_gather", name: "Gather Mana", icon: "🔮",
    description: "Restore 20/35/60% Power", tier: 3, classes: ["Illusionist"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "Restore 20% Power",
    active: { type: "power_restore", powerPct: 0.20, cooldownMs: 60000 },
  },
  {
    id: "cls_illusionist_clarity", name: "Illusive Clarity", icon: "💭",
    description: "+5/10/20% Power regen", tier: 3, classes: ["Illusionist"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+2 Power regen per rank",
    passive: { type: "power_regen", valuePerRank: 2 },
  },
  {
    id: "cls_coercer_torment", name: "Mental Torment", icon: "🧠",
    description: "+5/10/20% reflect damage", tier: 3, classes: ["Coercer"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% reflect per rank",
    passive: { type: "reflect_damage", valuePerRank: 0.067 },
  },
  {
    id: "cls_coercer_expertise", name: "Spell Expertise", icon: "📚",
    description: "+5/10/20% spell damage", tier: 3, classes: ["Coercer"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% spell damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.067 },
  },
  {
    id: "cls_coercer_shatter", name: "Mind Shatter", icon: "💥",
    description: "Burst 2× damage hit, ignores mitigation", tier: 3, classes: ["Coercer"], maxRank: 1, costPerRank: [9],
    bonusDescription: "2.5× burst damage",
    active: { type: "burst_damage", burstMult: 2.5, cooldownMs: 50000 },
  },

  // ─── TIER 3: Priest classes ───────────────────────────────────────────────────
  {
    id: "cls_templar_lay_hands", name: "Lay on Hands", icon: "✋",
    description: "Restore 75% max HP", tier: 3, classes: ["Templar","Inquisitor"], maxRank: 1, costPerRank: [5],
    bonusDescription: "Restore 75% HP",
    active: { type: "heal", healPct: 0.75, cooldownMs: 120000 },
  },
  {
    id: "cls_templar_healing_mastery", name: "Healing Mastery", icon: "❤️",
    description: "+10/25/50% meditation regen", tier: 3, classes: ["Templar"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+3 HP regen per rank",
    passive: { type: "hp_regen", valuePerRank: 3 },
  },
  {
    id: "cls_templar_divine_wrath", name: "Divine Wrath", icon: "☀️",
    description: "+5/10/20% damage", tier: 3, classes: ["Templar"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.067 },
  },
  {
    id: "cls_inquisitor_slay", name: "Slay Undead", icon: "☀️",
    description: "+30/60/100% vs undead", tier: 3, classes: ["Inquisitor"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+33.3% vs undead per rank",
    passive: { type: "damage_mult", valuePerRank: 0.333 },
  },
  {
    id: "cls_inquisitor_invigorate", name: "Invigorate", icon: "💉",
    description: "Restore 20/35/60% HP", tier: 3, classes: ["Inquisitor"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "Restore 20% HP",
    active: { type: "heal", healPct: 0.20, cooldownMs: 60000 },
  },
  {
    id: "cls_inquisitor_torture", name: "Torture", icon: "🩸",
    description: "+5/10/20% damage after taking a hit", tier: 3, classes: ["Inquisitor"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.067 },
  },
  {
    id: "cls_mystic_spirit_tap", name: "Spirit Tap", icon: "🌙",
    description: "+3/6/10 Power regen/tick", tier: 3, classes: ["Mystic"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+3 Power regen per rank",
    passive: { type: "power_regen", valuePerRank: 3 },
  },
  {
    id: "cls_mystic_ward", name: "Ancestral Ward", icon: "🛡️",
    description: "Invulnerable for 1 tick", tier: 3, classes: ["Mystic"], maxRank: 1, costPerRank: [9],
    bonusDescription: "Invulnerable for 1 tick",
    active: { type: "invulnerable", durationTicks: 1, cooldownMs: 90000 },
  },
  {
    id: "cls_mystic_totemic", name: "Totemic Ward", icon: "🪬",
    description: "+5/10/20% mitigation", tier: 3, classes: ["Mystic"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% mitigation per rank",
    passive: { type: "mitigation", valuePerRank: 0.067 },
  },
  {
    id: "cls_defiler_cannibalize", name: "Cannibalize", icon: "🧬",
    description: "Convert 15/25/40% HP to Power", tier: 3, classes: ["Defiler"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "Restore 15% Power",
    active: { type: "power_restore", powerPct: 0.15, cooldownMs: 60000 },
  },
  {
    id: "cls_defiler_dark_ward", name: "Dark Ward", icon: "🌑",
    description: "+5/10/20% mitigation", tier: 3, classes: ["Defiler"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% mitigation per rank",
    passive: { type: "mitigation", valuePerRank: 0.067 },
  },
  {
    id: "cls_defiler_affliction", name: "Affliction Mastery", icon: "☠️",
    description: "+10/20/35% DoT damage", tier: 3, classes: ["Defiler"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+11.7% DoT proc per rank",
    passive: { type: "dot_proc", valuePerRank: 0.117, dotPctPerTick: 0.04, dotDuration: 4 },
  },
  {
    id: "cls_warden_nature_heal", name: "Nature Healing", icon: "🌳",
    description: "+10/25/50% meditation regen", tier: 3, classes: ["Warden"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+3 HP regen per rank",
    passive: { type: "hp_regen", valuePerRank: 3 },
  },
  {
    id: "cls_warden_spirit_wood", name: "Spirit of the Wood", icon: "🌲",
    description: "Restore 80% HP", tier: 3, classes: ["Warden"], maxRank: 1, costPerRank: [9],
    bonusDescription: "Restore 80% HP",
    active: { type: "heal", healPct: 0.80, cooldownMs: 150000 },
  },
  {
    id: "cls_warden_thorns", name: "Thorns", icon: "🌵",
    description: "+5/10/20% reflect damage", tier: 3, classes: ["Warden"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6.7% reflect per rank",
    passive: { type: "reflect_damage", valuePerRank: 0.067 },
  },
  {
    id: "cls_fury_storm", name: "Storm of Lightning", icon: "⚡",
    description: "2× burst damage hit", tier: 3, classes: ["Fury"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "2× burst damage",
    active: { type: "burst_damage", burstMult: 2.0, cooldownMs: 30000 },
  },
  {
    id: "cls_fury_bestial", name: "Bestial Fury", icon: "🐺",
    description: "+10/20/40% damage above 80% HP", tier: 3, classes: ["Fury"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+13.3% damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.133 },
  },
  {
    id: "cls_fury_regrowth", name: "Regrowth", icon: "🌺",
    description: "+5/10/20 HP regen/tick", tier: 3, classes: ["Fury"], maxRank: 3, costPerRank: [3,6,9],
    bonusDescription: "+6 HP regen per rank",
    passive: { type: "hp_regen", valuePerRank: 6 },
  },

  // ─── TIER 4: Planar (requires ascensions > 0) ─────────────────────────────────
  {
    id: "plan_adv_strength", name: "Advanced Strength", icon: "💪",
    description: "+2 STR per rank", tier: 4, maxRank: 10, costPerRank: [1,1,1,1,1,2,2,2,3,3],
    bonusDescription: "+2 STR per rank",
    passive: { type: "str_bonus", valuePerRank: 2 },
  },
  {
    id: "plan_adv_stamina", name: "Advanced Stamina", icon: "❤️",
    description: "+2 STA per rank", tier: 4, maxRank: 10, costPerRank: [1,1,1,1,1,2,2,2,3,3],
    bonusDescription: "+2 STA per rank",
    passive: { type: "sta_bonus", valuePerRank: 2 },
  },
  {
    id: "plan_adv_agility", name: "Advanced Agility", icon: "🦊",
    description: "+2 AGI per rank", tier: 4, maxRank: 10, costPerRank: [1,1,1,1,1,2,2,2,3,3],
    bonusDescription: "+2 AGI per rank",
    passive: { type: "agi_bonus", valuePerRank: 2 },
  },
  {
    id: "plan_adv_intelligence", name: "Advanced Intelligence", icon: "🧠",
    description: "+2 INT per rank", tier: 4, maxRank: 10, costPerRank: [1,1,1,1,1,2,2,2,3,3],
    bonusDescription: "+2 INT per rank",
    passive: { type: "int_bonus", valuePerRank: 2 },
  },
  {
    id: "plan_adv_wisdom", name: "Advanced Wisdom", icon: "🌿",
    description: "+2 WIS per rank", tier: 4, maxRank: 10, costPerRank: [1,1,1,1,1,2,2,2,3,3],
    bonusDescription: "+2 WIS per rank",
    passive: { type: "wis_bonus", valuePerRank: 2 },
  },
  {
    id: "plan_planar_power", name: "Planar Power", icon: "🌌",
    description: "+5% all stats cap, +3% all damage per rank", tier: 4, maxRank: 5, costPerRank: [2,2,3,3,4],
    bonusDescription: "+3% all damage per rank",
    passive: { type: "damage_mult", valuePerRank: 0.03 },
  },
  {
    id: "plan_planar_durability", name: "Planar Durability", icon: "🏛️",
    description: "+5/10/15% max HP", tier: 4, archetype: ["Fighter"], maxRank: 3, costPerRank: [3,4,5],
    bonusDescription: "+5% max HP per rank",
    passive: { type: "max_hp_pct", valuePerRank: 0.05 },
  },
  {
    id: "plan_enlightenment", name: "Innate Enlightenment", icon: "🔆",
    description: "+5% XP & Power regen per rank", tier: 4, archetype: ["Mage","Priest"], maxRank: 5, costPerRank: [3,3,4,4,5],
    bonusDescription: "+5% XP per rank",
    passive: { type: "xp_mult", valuePerRank: 0.05 },
  },
];

// ─── Startup validator ────────────────────────────────────────────────────────

(function validateNodes() {
  const ids = new Set<string>();
  for (const n of AA_NODES) {
    if (ids.has(n.id)) throw new Error(`Duplicate AA node id: ${n.id}`);
    ids.add(n.id);
    if (n.costPerRank.length !== n.maxRank)
      throw new Error(`costPerRank length mismatch on ${n.id}: ${n.costPerRank.length} vs ${n.maxRank}`);
  }
})();

// ─── Bonus aggregator ─────────────────────────────────────────────────────────

export function getAABonuses(aaNodes: Record<string, number>): AABonuses {
  const bonuses: AABonuses = {
    damageMult: 1, critChanceBonus: 0, avoidanceBonus: 0, mitigationBonus: 0,
    maxHpBonus: 0, hpRegenPerTick: 0, powerRegenPerTick: 0, goldMult: 1, xpMult: 1,
    dropRateBonus: 0, strBonus: 0, agiBonus: 0, staBonus: 0, intBonus: 0, wisBonus: 0,
    finishingBlowChance: 0, flurryChance: 0, leechPct: 0, reflectPct: 0,
    dotProcChance: 0, reactiveHealChance: 0, hasteMult: 1, echoBonus: 0,
  };
  for (const node of AA_NODES) {
    const rank = aaNodes[node.id] ?? 0;
    if (rank <= 0 || !node.passive) continue;
    const val = node.passive.valuePerRank * rank;
    switch (node.passive.type) {
      case "damage_mult":    bonuses.damageMult       += val; break;
      case "crit_chance":    bonuses.critChanceBonus  += val; break;
      case "avoidance":      bonuses.avoidanceBonus   += val; break;
      case "mitigation":     bonuses.mitigationBonus  += val; break;
      case "max_hp_pct":     bonuses.maxHpBonus       += val; break;
      case "hp_regen":       bonuses.hpRegenPerTick   += val; break;
      case "power_regen":    bonuses.powerRegenPerTick += val; break;
      case "gold_mult":      bonuses.goldMult         += val; break;
      case "xp_mult":        bonuses.xpMult           += val; break;
      case "drop_rate":      bonuses.dropRateBonus    += val; break;
      case "str_bonus":      bonuses.strBonus         += val; break;
      case "agi_bonus":      bonuses.agiBonus         += val; break;
      case "sta_bonus":      bonuses.staBonus         += val; break;
      case "int_bonus":      bonuses.intBonus         += val; break;
      case "wis_bonus":      bonuses.wisBonus         += val; break;
      case "finishing_blow": bonuses.finishingBlowChance += val; break;
      case "flurry":         bonuses.flurryChance     += val; break;
      case "leech":          bonuses.leechPct         += val; break;
      case "reflect_damage": bonuses.reflectPct       += val; break;
      case "dot_proc":       bonuses.dotProcChance    += val; break;
      case "reactive_heal":  bonuses.reactiveHealChance += val; break;
    }
  }
  return bonuses;
}
