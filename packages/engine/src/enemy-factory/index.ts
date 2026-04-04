import type {
  EnemyBaseType, EnemySize, EnemyElement, EnemyRole,
  EnemyModifier, EnemyTraits, GeneratedEnemy, EnemyAbility,
} from "./types.js";
import { pick, randInt, type Rng } from "../world-seed/rng.js";
import { xpReward } from "../formulas/index.js";

export * from "./types.js";

// ─── Trait pools ──────────────────────────────────────────────────────────────

const BASE_TYPES: EnemyBaseType[]  = ["beast", "undead", "elemental", "construct", "humanoid"];
const SIZES: EnemySize[]           = ["tiny", "small", "medium", "large", "colossal"];
const ELEMENTS: EnemyElement[]     = ["fire", "ice", "void", "divine", "poison", "physical"];
const ROLES: EnemyRole[]           = ["striker", "tank", "caster", "support"];
const MODIFIERS: EnemyModifier[]   = ["ancient", "corrupted", "blessed", "enraged", "elite"];

// ─── Stat multipliers by trait ────────────────────────────────────────────────

const SIZE_HP_MULT: Record<EnemySize, number> = {
  tiny: 0.5, small: 0.75, medium: 1.0, large: 1.5, colossal: 2.5,
};

const SIZE_DMG_MULT: Record<EnemySize, number> = {
  tiny: 0.6, small: 0.8, medium: 1.0, large: 1.3, colossal: 1.8,
};

const ROLE_STAT_PROFILE: Record<EnemyRole, { hp: number; atk: number; def: number; mit: number }> = {
  striker: { hp: 0.8, atk: 1.4, def: 0.8, mit: 0.7 },
  tank:    { hp: 1.8, atk: 0.7, def: 1.5, mit: 1.4 },
  caster:  { hp: 0.7, atk: 1.2, def: 0.9, mit: 0.6 },
  support: { hp: 1.0, atk: 0.6, def: 1.2, mit: 1.0 },
};

const MODIFIER_MULT: Record<EnemyModifier, number> = {
  ancient: 1.3, corrupted: 1.2, blessed: 1.1, enraged: 1.4, elite: 1.5,
};

// ─── Name generation ──────────────────────────────────────────────────────────

const TYPE_NAMES: Record<EnemyBaseType, string[]> = {
  beast:     ["Wolf", "Stalker", "Lurker", "Ravager", "Prowler", "Fang"],
  undead:    ["Shade", "Revenant", "Wraith", "Specter", "Shambler", "Lich"],
  elemental: ["Wisp", "Core", "Surge", "Flux", "Shard", "Vortex"],
  construct: ["Golem", "Automaton", "Sentinel", "Warden", "Juggernaut", "Colossus"],
  humanoid:  ["Warrior", "Marauder", "Shaman", "Assassin", "Warlord", "Berserker"],
};

const ELEMENT_ADJECTIVES: Record<EnemyElement, string[]> = {
  fire:     ["Blazing", "Infernal", "Searing", "Cinderborn", "Magma"],
  ice:      ["Frost", "Glacial", "Frozen", "Blizzard", "Arctic"],
  void:     ["Void", "Shadow", "Null", "Abyssal", "Hollow"],
  divine:   ["Radiant", "Holy", "Blessed", "Celestial", "Sacred"],
  poison:   ["Venomous", "Plague", "Toxic", "Festering", "Virulent"],
  physical: ["Iron", "Stone", "Battle-hardened", "Armored", "Scarred"],
};

const MODIFIER_PREFIX: Record<EnemyModifier, string> = {
  ancient: "Ancient ", corrupted: "Corrupted ", blessed: "Blessed ",
  enraged: "Enraged ", elite: "",
};

const MODIFIER_SUFFIX: Record<EnemyModifier, string> = {
  ancient: "", corrupted: "", blessed: "", enraged: "",
  elite: " Champion",
};

// ─── Ability templates ────────────────────────────────────────────────────────

const ROLE_ABILITIES: Record<EnemyRole, Omit<EnemyAbility, "id">[]> = {
  striker: [
    { name: "Rend", triggerType: "every_n_ticks", triggerValue: 4, effectType: "dot", effectValue: 0.3, duration: 3 },
    { name: "Savage Strike", triggerType: "on_hit_proc", triggerValue: 0.15, effectType: "damage", effectValue: 1.5 },
  ],
  tank: [
    { name: "Shield Wall", triggerType: "percent_hp", triggerValue: 50, effectType: "shield", effectValue: 0.3, duration: 5 },
    { name: "Taunt", triggerType: "every_n_ticks", triggerValue: 6, effectType: "frenzy", effectValue: 0.1, duration: 3 },
  ],
  caster: [
    { name: "Arcane Bolt", triggerType: "every_n_ticks", triggerValue: 3, effectType: "damage", effectValue: 1.8, unavoidable: true },
    { name: "Mana Drain", triggerType: "percent_hp", triggerValue: 40, effectType: "dot", effectValue: 0.2, duration: 4 },
  ],
  support: [
    { name: "Mending", triggerType: "every_n_ticks", triggerValue: 5, effectType: "heal", effectValue: 0.1 },
    { name: "Weaken", triggerType: "on_hit_proc", triggerValue: 0.20, effectType: "slow", effectValue: 0.2, duration: 2 },
  ],
};

// ─── Core factory ─────────────────────────────────────────────────────────────

export function generateEnemy(
  zoneId: string,
  level: number,
  isBoss: boolean,
  rng: Rng,
  forceTraits?: Partial<EnemyTraits>,
): GeneratedEnemy {
  // New-player protection: no modifiers or large sizes for low-level enemies
  const sizePool: EnemySize[] = level <= 3
    ? ["tiny", "small", "medium"]
    : level <= 6
    ? ["tiny", "small", "medium", "large"]
    : SIZES;

  const bossModifierPool: EnemyModifier[] = level <= 5
    ? ["blessed"]
    : MODIFIERS;

  const traits: EnemyTraits = {
    baseType: forceTraits?.baseType ?? pick(BASE_TYPES, rng),
    size: forceTraits?.size ?? (isBoss ? pick(["large", "colossal"] as EnemySize[], rng) : pick(sizePool, rng)),
    element: forceTraits?.element ?? pick(ELEMENTS, rng),
    role: forceTraits?.role ?? (isBoss ? pick(["striker", "tank", "caster"] as EnemyRole[], rng) : pick(ROLES, rng)),
    // No modifiers for levels 1-4 trash mobs; bosses only get weak modifier until level 5
    modifier: forceTraits?.modifier ?? (
      isBoss
        ? pick(bossModifierPool, rng)
        : (level >= 5 && rng() < 0.2 ? pick(MODIFIERS, rng) : null)
    ),
  };

  const profile = ROLE_STAT_PROFILE[traits.role];
  const sizeMult = SIZE_HP_MULT[traits.size];
  const dmgMult  = SIZE_DMG_MULT[traits.size];
  const modMult  = traits.modifier ? MODIFIER_MULT[traits.modifier] : 1.0;
  const bossMult = isBoss ? 3.5 : 1.0;

  const baseHp  = Math.floor((level * 30 + 50) * profile.hp * sizeMult * modMult * bossMult);
  const baseAtk = Math.floor((level * 8 + 20)  * profile.atk * modMult * (isBoss ? 1.5 : 1.0));
  const baseDef = Math.floor((level * 5 + 15)  * profile.def * modMult);
  const baseMit = Math.min(0.75, (level * 0.01 + 0.05) * profile.mit * modMult);
  const baseAvo = Math.min(0.60, (level * 0.008 + 0.03) * (traits.role === "striker" ? 1.3 : 1.0));
  const dmgMin  = Math.floor((level * 4 + 8)   * dmgMult * modMult * (isBoss ? 1.4 : 1.0));
  const dmgMax  = Math.floor((level * 8 + 16)  * dmgMult * modMult * (isBoss ? 1.4 : 1.0));

  // Name
  const adjective = pick(ELEMENT_ADJECTIVES[traits.element], rng);
  const noun      = pick(TYPE_NAMES[traits.baseType], rng);
  const modPre    = traits.modifier ? MODIFIER_PREFIX[traits.modifier] : "";
  const modSuf    = traits.modifier ? MODIFIER_SUFFIX[traits.modifier] : "";
  const name      = isBoss
    ? `${modPre}${adjective} ${noun} Lord${modSuf}`
    : `${adjective} ${noun}${modSuf}`;

  // Resistances — elemental enemies resist their own element
  const resistances: Partial<Record<EnemyElement, number>> = {
    [traits.element]: 0.35,
  };

  // Abilities — base role abilities + boss extras
  const abilityTemplates = [...(ROLE_ABILITIES[traits.role] ?? [])];
  const abilities: EnemyAbility[] = abilityTemplates.slice(0, isBoss ? 2 : 1).map((tmpl, i) => ({
    ...tmpl,
    id: `ability_${i}`,
    effectValue: tmpl.effectValue * (isBoss ? 1.3 : 1.0),
  }));

  // Boss personality matrix
  const personality = isBoss ? {
    aggression:  randInt(20, 90, rng),
    cunning:     randInt(10, 85, rng),
    patience:    randInt(10, 80, rng),
    desperation: randInt(30, 95, rng),
  } : undefined;

  return {
    id: `${zoneId}_enemy_${traits.baseType}_${traits.role}_${Date.now()}`,
    name,
    traits,
    level,
    isBoss,
    hp: baseHp,
    maxHp: baseHp,
    attackRating: baseAtk,
    defenseRating: baseDef,
    mitigation: baseMit,
    avoidance: baseAvo,
    dmgMin,
    dmgMax,
    abilities,
    resistances,
    personality,
    xpReward: xpReward(level, level),
    goldReward: Math.floor((level * 3 + randInt(1, 5, rng)) * (isBoss ? 4 : 1) * modMult),
    lootQuality: Math.min(100, level * 2 + (isBoss ? 20 : 0) + (traits.modifier ? 10 : 0)),
  };
}
