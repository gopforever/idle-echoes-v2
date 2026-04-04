// ─── EQ2-Style Stat Formulas ──────────────────────────────────────────────────
// Pure functions — no side effects, no DB. Used by combat engine + UI.

export interface CharacterStats {
  level: number;
  strength: number;
  agility: number;
  stamina: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  // Gear-derived additions
  attackRating?: number;
  defenseRating?: number;
  mitigation?: number;
  avoidance?: number;
  haste?: number;
  critChance?: number;
  critBonus?: number;
  weaponDamageMin?: number;
  weaponDamageMax?: number;
  weaponDelay?: number;
  // Echo bonuses (from ascensions) as % multipliers
  echoStrBonus?: number;
  echoStaBonus?: number;
  echoAgiBonus?: number;
}

// ─── Derived stats ────────────────────────────────────────────────────────────

export function maxHp(s: CharacterStats): number {
  const base = 10 * s.stamina + 50 + (s.level - 1) * 15;
  const echo = 1 + (s.echoStaBonus ?? 0) / 100;
  return Math.floor(base * echo);
}

export function maxPower(s: CharacterStats): number {
  return Math.floor((s.wisdom + s.intelligence) * 5 + s.stamina * 2 + s.level * 10);
}

export function effectiveAttack(s: CharacterStats): number {
  const base = s.strength * 1.2 + (s.attackRating ?? 0) + s.level * 2;
  const echo = 1 + (s.echoStrBonus ?? 0) / 100;
  return Math.floor(base * echo);
}

export function effectiveDefense(s: CharacterStats): number {
  return Math.floor(s.agility * 0.8 + (s.defenseRating ?? 0) + s.level * 1.5);
}

export function effectiveMitigation(s: CharacterStats): number {
  const raw = 0.8 * s.stamina + 3 * s.level + (s.mitigation ?? 0);
  return Math.min(0.80, raw / 1000); // cap at 80%
}

export function effectiveAvoidance(s: CharacterStats): number {
  const raw = 0.5 * s.agility + 0.8 * s.level + 5 + (s.avoidance ?? 0);
  const echo = 1 + (s.echoAgiBonus ?? 0) / 100;
  return Math.min(0.70, (raw * echo) / 1000); // cap at 70%
}

export function effectiveHaste(s: CharacterStats): number {
  return Math.min(0.50, (s.haste ?? 0) / 200); // cap at 50% haste
}

export function critMultiplier(s: CharacterStats): number {
  const chance = Math.min(0.80, (s.critChance ?? 0) / 100);
  const bonus = 1.5 + (s.critBonus ?? 0) / 100;
  return 1 + chance * (bonus - 1);
}

export function weaponDps(s: CharacterStats): number {
  const dmgMin = s.weaponDamageMin ?? s.strength * 0.8;
  const dmgMax = s.weaponDamageMax ?? s.strength * 1.5;
  const avgDmg = (dmgMin + dmgMax) / 2;
  const delay  = Math.max(0.5, (s.weaponDelay ?? 2.0) * (1 - effectiveHaste(s)));
  return (avgDmg * critMultiplier(s)) / delay;
}

// ─── XP curve ─────────────────────────────────────────────────────────────────

export function xpToLevel(level: number): number {
  // Classic exponential curve: roughly doubles every 5 levels
  return Math.floor(100 * Math.pow(1.18, level - 1));
}

export function xpReward(enemyLevel: number, playerLevel: number): number {
  const diff = enemyLevel - playerLevel;
  const base = enemyLevel * 12;
  const modifier = diff >= 2 ? 1.5 : diff >= 0 ? 1.0 : diff >= -3 ? 0.7 : 0.3;
  return Math.max(1, Math.floor(base * modifier));
}

// ─── Ascension echo bonus ─────────────────────────────────────────────────────
// Each ascension grants a small permanent % bonus to 3 random stats.

export function echoBonus(ascensions: number): number {
  // 2% per ascension, diminishing returns after 10
  return ascensions <= 10
    ? ascensions * 2
    : 20 + (ascensions - 10) * 0.5;
}
