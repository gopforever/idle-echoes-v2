// ─── Skills System ────────────────────────────────────────────────────────────
// Seven skills that level through use, each granting milestone bonuses.

export type SkillId = "combat" | "defense" | "archery" | "magic" | "survival" | "luck" | "meditation";

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface SkillEntry {
  level: number;
  xp: number;
  xpToNext: number;
  /** ISO timestamp of last meditate use — only set on the meditation skill */
  lastUsed?: string;
}

export type CharacterSkills = Partial<Record<SkillId, SkillEntry>>;

// ─── Definitions ──────────────────────────────────────────────────────────────

export const SKILL_DEFS: Record<SkillId, SkillDef> = {
  combat:    { id: "combat",    name: "Combat Mastery", description: "Melee damage at milestones",           icon: "⚔️",  color: "text-red-400"    },
  defense:   { id: "defense",   name: "Defense",         description: "Mitigation & avoidance milestones",    icon: "🛡️",  color: "text-blue-400"   },
  archery:   { id: "archery",   name: "Archery",          description: "Critical hit chance & damage",         icon: "🏹",  color: "text-green-400"  },
  magic:     { id: "magic",     name: "Magic Mastery",    description: "XP gain bonuses at milestones",        icon: "🔮",  color: "text-purple-400" },
  survival:  { id: "survival",  name: "Survival",         description: "Max HP & death recovery milestones",   icon: "💪",  color: "text-orange-400" },
  luck:      { id: "luck",      name: "Luck",             description: "Gold & loot bonuses at milestones",    icon: "🍀",  color: "text-amber-400"  },
  meditation:{ id: "meditation",name: "Meditation",       description: "Recover HP & Power; cooldown shrinks", icon: "🧘",  color: "text-cyan-400"   },
};

export const SKILL_MILESTONES: Record<SkillId, [number, string][]> = {
  combat:    [[10,"+5% dmg"],[25,"+10% dmg"],[50,"+15% dmg"],[100,"+25% dmg+haste"],[200,"+40% dmg"]],
  defense:   [[10,"+5% mit"],[25,"+10% mit"],[50,"+15% mit +5% avoid"],[100,"+20% mit +10% avoid"],[200,"+30% mit"]],
  archery:   [[10,"+3% crit"],[25,"+6% crit"],[50,"+10% crit +25% cdmg"],[100,"+15% crit +50% cdmg"],[200,"+20% crit"]],
  magic:     [[10,"+5% XP"],[25,"+10% XP"],[50,"+15% XP"],[100,"+20% XP"],[200,"+25% XP"]],
  survival:  [[10,"+5% HP"],[25,"+10% HP"],[50,"+15% HP -25% death"],[100,"+20% HP -50% death"],[200,"+30% HP"]],
  luck:      [[10,"+10% gold"],[25,"+20% gold"],[50,"+25% gold"],[100,"+35% gold"],[200,"+50% gold"]],
  meditation:[[10,"75s CD"],[25,"+25% HP/Power"],[50,"45s CD"],[100,"+50% HP/Power"],[200,"15s CD, full restore"]],
};

export const SKILL_MAX = 200;

// ─── XP curve ─────────────────────────────────────────────────────────────────

export function skillXpToLevel(level: number): number {
  return Math.floor(40 * Math.pow(1.12, Math.max(0, level - 1)));
}

export function initSkill(): SkillEntry {
  return { level: 1, xp: 0, xpToNext: skillXpToLevel(2) };
}

export function awardSkillXp(
  skill: SkillEntry,
  amount: number,
): { skill: SkillEntry; leveledUp: boolean } {
  let { level, xp, xpToNext } = skill;
  // Guard: xpToNext can be undefined/null if stored before initialization
  xpToNext = (xpToNext != null && xpToNext > 0) ? xpToNext : skillXpToLevel(level + 1);
  xp += amount;
  let leveledUp = false;
  while (xp >= xpToNext && level < SKILL_MAX) {
    xp -= xpToNext;
    level++;
    xpToNext = skillXpToLevel(level + 1);
    leveledUp = true;
  }
  return { skill: { level, xp, xpToNext }, leveledUp };
}

// ─── Milestone bonus calculator ───────────────────────────────────────────────

function ms(level: number, table: [number, number][]): number {
  let val = 0;
  for (const [t, b] of table) { if (level >= t) val = b; }
  return val;
}

export function getSkillBonuses(skills: CharacterSkills) {
  const lv = (id: SkillId) => skills[id]?.level ?? 0;
  return {
    damageMult:          1 + ms(lv("combat"),   [[10,.05],[25,.10],[50,.15],[100,.25],[200,.40]]),
    mitigationBonus:         ms(lv("defense"),  [[10,.05],[25,.10],[50,.15],[100,.20],[200,.30]]),
    avoidanceBonus:          ms(lv("defense"),  [[50,.05],[100,.10],[200,.15]]),
    critChanceBonus:         ms(lv("archery"),  [[10,.03],[25,.06],[50,.10],[100,.15],[200,.20]]),
    critDamageMult:      1 + ms(lv("archery"),  [[50,.25],[100,.50],[200,1.0]]),
    xpMult:              1 + ms(lv("magic"),    [[10,.05],[25,.10],[50,.15],[100,.20],[200,.25]]),
    maxHpMult:           1 + ms(lv("survival"), [[10,.05],[25,.10],[50,.15],[100,.20],[200,.30]]),
    deathPenaltyMult:    1 - ms(lv("survival"), [[50,.25],[100,.50],[200,.75]]),
    goldMult:            1 + ms(lv("luck"),     [[10,.10],[25,.20],[50,.25],[100,.35],[200,.50]]),
  };
}

// ─── Meditation stats ─────────────────────────────────────────────────────────
// Returns how much HP/Power is recovered as a fraction of max, plus cooldown ms.

// ─── Meditation passive regen (EQ-style) ─────────────────────────────────────
// Called every 6 seconds when the player is not in active combat ("sitting").
// HP regen scales with skill level. Mana uses the EQ formula: 2 + floor(skill/15).
// Magic users (Mage/Priest) get 2× mana regeneration.

export interface MeditationRegen {
  /** Flat HP to restore this tick */
  hpPerTick: number;
  /** Flat Power/mana to restore this tick */
  powerPerTick: number;
}

export function getMeditationRegen(
  level: number,
  maxHp: number,
  maxPower: number,
  isMagicUser: boolean,
): MeditationRegen {
  // HP: 1% of maxHp base + 0.1% per skill level (capped at 15% of maxHp per tick)
  const hpPerTick = Math.max(1, Math.min(
    Math.floor(maxHp * 0.15),
    Math.floor(maxHp * (0.01 + (level - 1) * 0.001)),
  ));

  // Mana: EQ formula — 2 base + floor(skill/15), doubled for magic users
  const basePower  = 2 + Math.floor(level / 15);
  const powerPerTick = Math.min(
    Math.floor(maxPower * 0.15),
    isMagicUser ? basePower * 2 : basePower,
  );

  return { hpPerTick, powerPerTick };
}
