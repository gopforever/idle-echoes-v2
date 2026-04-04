import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, worldsTable, combatStateTable, inventoryTable, worldEventsTable } from "@repo/db";
import { eq, and } from "drizzle-orm";
import {
  generateEnemy, rollLoot, mulberry32, generateWorldUniqueItem,
  effectiveMitigation, effectiveAvoidance,
  xpToLevel, xpReward,
  getSkillBonuses, awardSkillXp, initSkill,
  getAABonuses, AA_KILLS_PER_POINT,
} from "@repo/engine";
import { createId } from "@paralleldrive/cuid2";
import type { GeneratedEnemy, ZoneGraph, GeneratedItem, ItemStats, CharacterSkills, SkillId } from "@repo/engine";

// ─── Boss spawn threshold ─────────────────────────────────────────────────────
const BOSS_EVERY_N_KILLS = 15;

// ─── Gear stat aggregation ────────────────────────────────────────────────────
// IMPORTANT: weaponDamageMin/Max are ONLY carried from items that also have
// weaponDelay set (i.e. actual weapons). Armor/jewelry that has those fields
// set to 0 must not zero-out the player's unarmed base damage.

function sumGearStats(gear: Record<string, unknown>): ItemStats {
  const totals: ItemStats = {};
  let hasWeapon = false;
  let weaponDmgMin = 0;
  let weaponDmgMax = 0;

  for (const raw of Object.values(gear)) {
    const item = raw as GeneratedItem;
    if (!item?.stats) continue;
    const stats = item.stats as Record<string, number>;

    // Detect weapons by presence of weaponDelay > 0
    if ((stats["weaponDelay"] ?? 0) > 0) {
      hasWeapon = true;
      // Use first weapon's delay
      if (!totals.weaponDelay) totals.weaponDelay = stats["weaponDelay"]!;
      weaponDmgMin += stats["weaponDamageMin"] ?? 0;
      weaponDmgMax += stats["weaponDamageMax"] ?? 0;
      continue; // weapon stats handled separately
    }

    for (const [k, v] of Object.entries(stats)) {
      if (typeof v !== "number") continue;
      // Skip weapon damage on non-weapon items entirely
      if (k === "weaponDamageMin" || k === "weaponDamageMax" || k === "weaponDelay") continue;
      const key = k as keyof ItemStats;
      (totals as Record<string, number>)[key] = ((totals as Record<string, number>)[key] ?? 0) + v;
    }
  }

  // Only set weapon damage if a real weapon is equipped
  if (hasWeapon && weaponDmgMin > 0) {
    totals.weaponDamageMin = weaponDmgMin;
    totals.weaponDamageMax = Math.max(weaponDmgMin, weaponDmgMax);
  }

  return totals;
}

// ─── EQ P99-style Wrath (offensive power) ────────────────────────────────────
// Wrath = Combat Skill + Strength Modifier + Worn ATK
// Strength Modifier = max(0, (2×STR − 20) / 3)  (adjusted threshold for our stat ranges)
// Wrath drives both hit-rate (d20 roll) and damage bonus

function calcWrath(
  combatSkillLevel: number,
  strength: number,
  attackRating: number,
): number {
  const strMod = Math.max(0, Math.floor((2 * strength - 20) / 3));
  return combatSkillLevel + strMod + attackRating;
}

// ─── EQ P99-style Defense rating ─────────────────────────────────────────────
// Defense = Defense Skill + Agility Modifier + Worn Defense Rating
function calcDefenseRating(
  defenseSkillLevel: number,
  agility: number,
  defenseRating: number,
): number {
  const agiMod = Math.max(0, Math.floor((2 * agility - 20) / 3));
  return defenseSkillLevel + agiMod + defenseRating;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusEffect {
  id: string;
  name: string;
  type: "dot" | "stun" | "slow" | "shield" | "frenzy" | "invulnerable";
  value: number;
  remainingTicks: number;
}

interface EnemyAbility {
  id: string;
  name: string;
  triggerType: "every_n_ticks" | "percent_hp" | "on_hit_proc";
  triggerValue: number;
  effectType: "damage" | "dot" | "stun" | "slow" | "heal" | "shield" | "frenzy";
  effectValue: number;
  duration?: number;
  unavoidable?: boolean;
}

const MAX_LOG = 20;

// ─── POST /api/combat/tick ────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Load character ──────────────────────────────────────────────────────────
  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  // ── Load combat state ───────────────────────────────────────────────────────
  const states = await db.select().from(combatStateTable)
    .where(eq(combatStateTable.characterId, char.id)).limit(1);
  if (!states.length || !states[0]!.isActive) {
    return NextResponse.json({ noCombat: true });
  }
  const state = states[0]!;

  // ── Load zone for level-range reference ──────────────────────────────────────
  const worlds = await db.select().from(worldsTable)
    .where(eq(worldsTable.id, char.worldId)).limit(1);
  const zoneGraph = worlds[0] ? (worlds[0].zoneGraph as unknown as ZoneGraph) : null;
  const zone = zoneGraph?.zones.find(z => z.id === state.zoneId);

  // ── Mutable state for this tick ─────────────────────────────────────────────
  const enemy = state.enemyData as unknown as GeneratedEnemy;
  let playerHp = state.playerHp;
  let enemyHp  = state.enemyHp;
  let effects  = (state.statusEffects as unknown as StatusEffect[]).map(e => ({ ...e }));
  const prevLog = state.log as unknown as string[];
  const tick    = state.tick + 1;
  const newEntries: string[] = [];

  // Per-tick RNG (non-deterministic)
  const rng = mulberry32((Date.now() ^ (tick * 2_654_435_761)) >>> 0);

  // ── Skill + AA bonuses ──────────────────────────────────────────────────────
  const gearStats  = sumGearStats(char.gear as Record<string, unknown>);
  const skills     = (char.skills as unknown as CharacterSkills) ?? {};
  const aaNodes    = (char.aaNodes as Record<string, number>) ?? {};
  const skillBonus = getSkillBonuses(skills);
  const aaBonus    = getAABonuses(aaNodes);

  // Track skill XP earned this tick
  const skillXpGains: Partial<Record<SkillId, number>> = {};

  // ── Derived combat skills (EQ-style) ────────────────────────────────────────
  const combatSkillLv  = skills["combat"]?.level  ?? 1;
  const defenseSkillLv = skills["defense"]?.level ?? 1;
  const archerySkillLv = skills["archery"]?.level ?? 1;

  // Include AA stat bonuses in player stats
  const playerStr = char.strength + (gearStats.strength ?? 0) + Math.floor(aaBonus.strBonus);
  const playerAgi = char.agility  + (gearStats.agility  ?? 0) + Math.floor(aaBonus.agiBonus);

  const wrath         = calcWrath(combatSkillLv, playerStr, gearStats.attackRating ?? 0);
  const playerDefense = calcDefenseRating(defenseSkillLv, playerAgi, gearStats.defenseRating ?? 0);

  // Power tracking
  let newPower = char.power;

  // ── Phase 1: Apply active status effects ────────────────────────────────────
  const isStunned = effects.some(e => e.type === "stun");
  const isInvulnerable = effects.some(e => e.type === "invulnerable");
  const slowMult  = effects.filter(e => e.type === "slow")
    .reduce((acc, e) => acc * (1 - e.value), 1.0);
  const frenzyAdd = effects.filter(e => e.type === "frenzy")
    .reduce((acc, e) => acc + e.value, 0.0);

  for (const eff of effects) {
    if (eff.type === "dot") {
      const dotDmg = Math.max(1, Math.floor(eff.value * char.maxHp));
      playerHp = Math.max(0, playerHp - dotDmg);
      newEntries.push(`☠️ ${eff.name}: ${dotDmg} damage over time.`);
    }
    eff.remainingTicks--;
  }
  effects = effects.filter(e => e.remainingTicks > 0);

  // ── Phase 2: Player attacks enemy (EQ P99 Wrath formula) ────────────────────
  if (!isStunned && enemyHp > 0) {
    // d20 hit check — Wrath vs enemy defense rating
    // hitRoll = d20 (1-20) + floor(wrath/8)
    // Must beat: floor(enemy.defenseRating / 5)
    const d20     = Math.floor(rng() * 20) + 1;
    const hitRoll = d20 + Math.floor(wrath / 8);
    const hitTarget = Math.floor(enemy.defenseRating / 5);
    const isHit   = hitRoll > hitTarget;

    // Crit: base 5% + archery skill/10 (capped 60%)
    const critChance = Math.min(0.60,
      0.05
      + archerySkillLv * 0.001
      + (gearStats.critChance ?? 0) / 100
      + skillBonus.critChanceBonus
      + aaBonus.critChanceBonus
    );
    const isCrit     = isHit && rng() < critChance;
    const critMult   = (1.5 + (gearStats.critBonus ?? 0) / 100) * skillBonus.critDamageMult;
    const hasteBonus = Math.min(0.50, (gearStats.haste ?? 0) / 200) * aaBonus.hasteMult;

    // Weapon damage — only from actual weapon; unarmed if none equipped
    const unarmedMin = Math.max(1, Math.floor(char.strength * 1.2 + char.level * 2));
    const unarmedMax = Math.max(2, Math.floor(char.strength * 2.5 + char.level * 4));
    const dmgMin = (gearStats.weaponDamageMin ?? 0) > 0 ? gearStats.weaponDamageMin! : unarmedMin;
    const dmgMax = (gearStats.weaponDamageMax ?? 0) > 0 ? gearStats.weaponDamageMax! : unarmedMax;

    // Wrath damage bonus: each 10 wrath = +3% damage (EQ-inspired)
    const wrathDmgBonus = 1 + Math.floor(wrath / 10) * 0.03;

    if (isHit) {
      const rawDmg = Math.floor(
        (dmgMin + rng() * (dmgMax - dmgMin))
        * wrathDmgBonus
        * slowMult
        * (isCrit ? critMult : 1)
        * (1 + hasteBonus)
        * (1 + frenzyAdd)
        * skillBonus.damageMult
        * aaBonus.damageMult
      );
      const dealt = Math.max(1, Math.floor(rawDmg * (1 - enemy.mitigation)));
      enemyHp = Math.max(0, enemyHp - dealt);

      // Leech: restore HP based on damage dealt
      if (aaBonus.leechPct > 0) {
        playerHp = Math.min(char.maxHp, playerHp + Math.floor(dealt * aaBonus.leechPct));
      }

      skillXpGains["combat"]  = (skillXpGains["combat"]  ?? 0) + 8;
      if (isCrit) skillXpGains["archery"] = (skillXpGains["archery"] ?? 0) + 20;

      const prefix = enemy.isBoss ? `👑 ` : ``;
      newEntries.push(isCrit
        ? `${prefix}⚔️ CRIT! You hit ${enemy.name} for ${dealt}! (Wrath: ${wrath})`
        : `${prefix}⚔️ You hit ${enemy.name} for ${dealt}.`);

      // Flurry: bonus attack after main hit
      if (aaBonus.flurryChance > 0 && !isStunned && enemyHp > 0 && rng() < aaBonus.flurryChance) {
        const flurryDmg = Math.max(1, Math.floor((dmgMin + rng() * (dmgMax - dmgMin)) * 0.5 * (1 - enemy.mitigation)));
        enemyHp = Math.max(0, enemyHp - flurryDmg);
        skillXpGains["combat"] = (skillXpGains["combat"] ?? 0) + 4;
        newEntries.push(`⚡ Flurry! +${flurryDmg} bonus hit.`);
      }

      // Finishing blow: execute enemy below 10% HP
      if (enemyHp > 0 && enemyHp / enemy.maxHp < 0.10 && aaBonus.finishingBlowChance > 0 && rng() < aaBonus.finishingBlowChance) {
        enemyHp = 0;
        newEntries.push(`⚡ FINISHING BLOW! ${enemy.name} slain!`);
      }
    } else {
      // Miss — still award small combat XP for the attempt
      skillXpGains["combat"] = (skillXpGains["combat"] ?? 0) + 3;
      newEntries.push(`⚔️ You swing at ${enemy.name} — MISS! (roll: ${hitRoll} vs ${hitTarget})`);
    }
  } else if (isStunned) {
    newEntries.push(`😵 Stunned — you cannot act!`);
  }

  // ── Phase 3: Enemy abilities ────────────────────────────────────────────────
  if (enemyHp > 0) {
    for (const ability of (enemy.abilities as EnemyAbility[])) {
      let fires = false;
      const tv = Math.max(1, Math.floor(ability.triggerValue));
      if (ability.triggerType === "every_n_ticks"  && tick % tv === 0) fires = true;
      if (ability.triggerType === "percent_hp"
        && enemyHp / enemy.maxHp <= ability.triggerValue / 100)         fires = true;
      if (ability.triggerType === "on_hit_proc"    && rng() < ability.triggerValue) fires = true;
      if (!fires) continue;

      switch (ability.effectType) {
        case "damage": {
          const dmg = Math.max(1, Math.floor(enemy.dmgMax * ability.effectValue * (1 + frenzyAdd)));
          playerHp = Math.max(0, playerHp - dmg);
          newEntries.push(`💥 ${enemy.name} uses ${ability.name} for ${dmg}!`);
          break;
        }
        case "dot":
          effects.push({
            id: createId(), name: ability.name, type: "dot",
            value: ability.effectValue / 20, remainingTicks: ability.duration ?? 3,
          });
          newEntries.push(`☠️ ${enemy.name} applies ${ability.name}!`);
          break;
        case "heal": {
          const heal = Math.floor(enemy.maxHp * ability.effectValue);
          enemyHp = Math.min(enemy.maxHp, enemyHp + heal);
          newEntries.push(`💚 ${enemy.name} heals itself for ${heal} HP!`);
          break;
        }
        case "stun":
          effects.push({
            id: createId(), name: ability.name, type: "stun",
            value: 1, remainingTicks: ability.duration ?? 1,
          });
          newEntries.push(`😵 ${enemy.name} stuns you with ${ability.name}!`);
          break;
        case "slow":
          effects.push({
            id: createId(), name: ability.name, type: "slow",
            value: ability.effectValue, remainingTicks: ability.duration ?? 2,
          });
          newEntries.push(`🐌 ${enemy.name} slows you with ${ability.name}!`);
          break;
        case "frenzy":
          effects.push({
            id: createId(), name: ability.name, type: "frenzy",
            value: ability.effectValue, remainingTicks: ability.duration ?? 3,
          });
          newEntries.push(`😡 ${enemy.name} enters a frenzy!`);
          break;
        case "shield":
          break;
      }
    }
  }

  // ── Phase 4: Enemy attacks player (EQ-style defense check) ──────────────────
  if (enemyHp > 0 && playerHp > 0) {
    if (isInvulnerable) {
      newEntries.push(`🌟 Invulnerable! ${enemy.name}'s attack is blocked!`);
    } else {
      // Enemy d20 hit check vs player defense
      const enemyWrath   = Math.floor(enemy.attackRating / 4) + enemy.level;
      const eD20         = Math.floor(rng() * 20) + 1;
      const eHitRoll     = eD20 + Math.floor(enemyWrath / 8);
      const eHitTarget   = Math.floor(playerDefense / 5);
      const enemyHit     = eHitRoll > eHitTarget;

      if (!enemyHit) {
        // Full dodge / parry
        skillXpGains["defense"] = (skillXpGains["defense"] ?? 0) + 20;
        newEntries.push(`🛡️ You parry ${enemy.name}'s attack! (Defense: ${playerDefense})`);
      } else {
        // Mitigation check — EQ: partial mitigation from AC/stamina
        const charStats = {
          level:         char.level,
          strength:      playerStr,
          agility:       playerAgi,
          stamina:       char.stamina   + (gearStats.stamina   ?? 0) + Math.floor(aaBonus.staBonus),
          intelligence:  char.intelligence + (gearStats.intelligence ?? 0) + Math.floor(aaBonus.intBonus),
          wisdom:        char.wisdom    + (gearStats.wisdom    ?? 0) + Math.floor(aaBonus.wisBonus),
          charisma:      char.charisma  + (gearStats.charisma  ?? 0),
          defenseRating: gearStats.defenseRating,
          mitigation:    gearStats.mitigation,
          avoidance:     gearStats.avoidance,
        };
        const mitigation = Math.min(0.85,
          effectiveMitigation(charStats, defenseSkillLv) + skillBonus.mitigationBonus + aaBonus.mitigationBonus
        );

        const rawDmg = Math.floor((enemy.dmgMin + rng() * (enemy.dmgMax - enemy.dmgMin)) * (1 + frenzyAdd));
        const avoided = !enemyHit;
        void avoided; // used below for reflect
        const dealt  = Math.max(1, Math.floor(rawDmg * (1 - mitigation)));
        playerHp = Math.max(0, playerHp - dealt);

        skillXpGains["defense"] = (skillXpGains["defense"] ?? 0) + 5;
        if (playerHp / char.maxHp < 0.25) skillXpGains["survival"] = (skillXpGains["survival"] ?? 0) + 15;
        newEntries.push(`💢 ${enemy.name} hits you for ${dealt}. (mit: ${Math.round(mitigation * 100)}%)`);

        // Reflect damage back to enemy
        if (aaBonus.reflectPct > 0) {
          const reflected = Math.floor(dealt * aaBonus.reflectPct);
          if (reflected > 0) {
            enemyHp = Math.max(0, enemyHp - reflected);
            newEntries.push(`🔄 ${reflected} reflected!`);
          }
        }
      }
    }

    // Passive magic XP every combat tick
    skillXpGains["magic"] = (skillXpGains["magic"] ?? 0) + 3;
    skillXpGains["luck"]  = (skillXpGains["luck"]  ?? 0) + 1;

    // Passive AA HP and Power regen
    if (aaBonus.hpRegenPerTick > 0 && playerHp > 0) {
      playerHp = Math.min(char.maxHp, playerHp + aaBonus.hpRegenPerTick);
    }
    if (aaBonus.powerRegenPerTick > 0) {
      newPower = Math.min(char.maxPower, newPower + aaBonus.powerRegenPerTick);
    }
  }

  // ── Phase 5: Outcome resolution ──────────────────────────────────────────────
  let nextEnemy: GeneratedEnemy | null = null;
  let leveledUp     = false;
  let newLevel      = char.level;
  let newXp         = char.xp;
  let newXpToNext   = char.xpToNext;
  let newGold       = char.gold;
  let newTotalKills = char.totalKills;
  let newBossKills  = char.bossKills;
  let newGoldEarned = char.goldEarned;
  let newDeaths     = char.totalDeaths;
  let finalPlayerHp = playerHp;

  const zoneMin = zone?.levelRange[0] ?? 1;
  const zoneMax = zone?.levelRange[1] ?? (char.level + 3);
  void zoneMin;

  if (enemyHp <= 0) {
    // ── Enemy defeated ────────────────────────────────────────────────────────
    const baseXp     = xpReward(enemy.level, char.level);
    const baseGold   = enemy.goldReward;
    const earnedXp   = Math.floor(baseXp   * skillBonus.xpMult * aaBonus.xpMult);
    const earnedGold = Math.floor(baseGold * skillBonus.goldMult * aaBonus.goldMult);
    newTotalKills++;
    if (enemy.isBoss) newBossKills++;
    newGold       += earnedGold;
    newGoldEarned += earnedGold;
    newXp         += earnedXp;

    skillXpGains["combat"]  = (skillXpGains["combat"]  ?? 0) + 40;
    skillXpGains["luck"]    = (skillXpGains["luck"]    ?? 0) + 15;
    if (enemy.isBoss) {
      skillXpGains["survival"] = (skillXpGains["survival"] ?? 0) + 50;
      newEntries.push(`👑 BOSS DEFEATED! ${enemy.name} falls! +${earnedXp} XP  +${earnedGold}g`);
    } else {
      newEntries.push(`🏆 ${enemy.name} defeated! +${earnedXp} XP  +${earnedGold}g`);
    }

    // Character level-up loop
    while (newXp >= newXpToNext) {
      newXp    -= newXpToNext;
      newLevel++;
      newXpToNext = xpToLevel(newLevel + 1);
      leveledUp = true;
      newEntries.push(`🌟 LEVEL UP! You are now level ${newLevel}!`);
    }

    // Roll loot
    const lootRng = mulberry32((Date.now() + tick * 137) >>> 0);
    const drops   = rollLoot(state.zoneId, newLevel, enemy.isBoss, lootRng);
    for (const drop of drops) {
      const item = drop as { name: string; rarity: string };
      newEntries.push(`💎 ${item.name} [${item.rarity}]`);
      await db.insert(inventoryTable).values({
        id: createId(), characterId: char.id,
        itemData: drop as unknown as Record<string, unknown>,
        quantity: 1, slot: null, createdAt: new Date(),
      });
    }

    // ── World Unique drop check ───────────────────────────────────────────────
    if (enemy.isBoss && newLevel >= 20 && lootRng() < 0.01 && worlds[0]) {
      const world = worlds[0];
      const alreadyClaimed = await db.select().from(worldEventsTable)
        .where(and(
          eq(worldEventsTable.worldId, world.id),
          eq(worldEventsTable.zoneId,  state.zoneId),
          eq(worldEventsTable.eventType, "unique_claimed"),
        )).limit(1);

      if (!alreadyClaimed.length) {
        const zg = world.zoneGraph as unknown as ZoneGraph;
        const currentZone = zg.zones.find(z => z.id === state.zoneId);
        const uniqueItem = generateWorldUniqueItem(
          Number(world.seed),
          state.zoneId,
          currentZone?.name ?? state.zoneId,
          currentZone?.bossName ?? "the Ancient",
        );
        await db.insert(inventoryTable).values({
          id: createId(), characterId: char.id,
          itemData: uniqueItem as unknown as Record<string, unknown>,
          quantity: 1, slot: null, createdAt: new Date(),
        });
        await db.insert(worldEventsTable).values({
          id: createId(), worldId: world.id, ghostId: null,
          zoneId: state.zoneId, eventType: "unique_claimed",
          message: `${char.name} has claimed ${uniqueItem.name} — the only one in this world!`,
          metadata: { itemId: uniqueItem.id, itemName: uniqueItem.name, characterName: char.name } as Record<string, unknown>,
          createdAt: new Date(),
        });
        newEntries.push(`🌟 WORLD FIRST! You found ${uniqueItem.name} — the only one in existence!`);
      }
    }

    // ── AA point award ────────────────────────────────────────────────────────
    const aaPointsEarned = Math.floor(newTotalKills / AA_KILLS_PER_POINT)
      - Math.floor((newTotalKills - 1) / AA_KILLS_PER_POINT);
    if (aaPointsEarned > 0) {
      newEntries.push(`✨ AA Point earned! (${char.aaPoints + aaPointsEarned} total)`);
    }

    // ── Spawn next enemy — boss every N kills ──────────────────────────────────
    const nextRng   = mulberry32((Date.now() + tick * 31_337) >>> 0);
    const nextLevel = Math.min(zoneMax, Math.max(1, newLevel));
    const spawnBoss = newTotalKills % BOSS_EVERY_N_KILLS === 0;
    nextEnemy = generateEnemy(state.zoneId, spawnBoss ? Math.min(zoneMax, nextLevel + 2) : nextLevel, spawnBoss, nextRng);
    enemyHp   = nextEnemy.hp;
    effects   = [];
    if (spawnBoss) {
      newEntries.push(`👑 A BOSS appears: ${nextEnemy.name} (Lv.${nextEnemy.level})!`);
    } else {
      newEntries.push(`A ${nextEnemy.name} (Lv.${nextEnemy.level}) appears!`);
    }

  } else if (playerHp <= 0) {
    // ── Player defeated ───────────────────────────────────────────────────────
    newDeaths++;
    const xpLoss = Math.floor(newXp * 0.10);
    newXp = Math.max(0, newXp - xpLoss);
    finalPlayerHp = Math.floor(char.maxHp * 0.30);
    newEntries.push(`💀 Defeated! -${xpLoss} XP. Respawning...`);

    const respawnRng = mulberry32((Date.now() + tick * 99_991) >>> 0);
    const nextLevel  = Math.min(zoneMax, Math.max(1, newLevel));
    nextEnemy = generateEnemy(state.zoneId, nextLevel, false, respawnRng);
    enemyHp   = nextEnemy.hp;
    effects   = [];
    newEntries.push(`A ${nextEnemy.name} (Lv.${nextEnemy.level}) lurks nearby.`);

  } else {
    finalPlayerHp = playerHp;
  }

  // ── Phase 6: Process skill XP gains ──────────────────────────────────────────
  const updatedSkills = { ...skills } as CharacterSkills;
  const skillLevelUps: string[] = [];
  for (const [skillId, xpAmount] of Object.entries(skillXpGains) as [SkillId, number][]) {
    const current = updatedSkills[skillId] ?? initSkill();
    const { skill: newSkill, leveledUp: skillUp } = awardSkillXp(current, xpAmount);
    updatedSkills[skillId] = newSkill;
    if (skillUp) skillLevelUps.push(`📈 ${skillId} Lv.${newSkill.level}!`);
  }
  const newAaPointsTotal = Math.floor(newTotalKills / AA_KILLS_PER_POINT);

  // ── Phase 7: Persist ──────────────────────────────────────────────────────────
  await db.update(charactersTable).set({
    hp:          finalPlayerHp,
    power:       newPower,
    xp:          newXp,
    level:       newLevel,
    xpToNext:    newXpToNext,
    gold:        newGold,
    totalKills:  newTotalKills,
    bossKills:   newBossKills,
    goldEarned:  newGoldEarned,
    totalDeaths: newDeaths,
    skills:      updatedSkills as unknown as Record<string, unknown>,
    aaPoints:    newAaPointsTotal,
    updatedAt:   new Date(),
  }).where(eq(charactersTable.id, char.id));

  const currentEnemy = nextEnemy ?? enemy;
  const combinedLog  = [...skillLevelUps, ...newEntries, ...prevLog].slice(0, MAX_LOG);

  await db.update(combatStateTable).set({
    enemyData:     currentEnemy as unknown as Record<string, unknown>,
    playerHp:      finalPlayerHp,
    enemyHp,
    tick,
    statusEffects: effects as unknown as Record<string, unknown>[],
    log:           combinedLog as unknown as Record<string, unknown>[],
    updatedAt:     new Date(),
  }).where(eq(combatStateTable.characterId, char.id));

  return NextResponse.json({
    tick,
    playerHp:    finalPlayerHp,
    playerMaxHp: char.maxHp,
    power:       newPower,
    enemyHp,
    enemy:       currentEnemy,
    statusEffects: effects,
    log:         combinedLog,
    leveledUp,
    newLevel,
    newXp,
    newXpToNext,
    newGold,
    aaPoints:    newAaPointsTotal,
    skills:      updatedSkills,
    isBossFight: nextEnemy?.isBoss ?? enemy.isBoss,
    wrath,
    playerDefense,
  });
}
