import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, worldsTable, combatStateTable, inventoryTable, worldEventsTable } from "@repo/db";
import { eq, and } from "drizzle-orm";
import {
  generateEnemy, rollLoot, mulberry32, generateWorldUniqueItem,
  effectiveMitigation, effectiveAvoidance,
  xpToLevel, xpReward,
} from "@repo/engine";
import { createId } from "@paralleldrive/cuid2";
import type { GeneratedEnemy, ZoneGraph, GeneratedItem, ItemStats } from "@repo/engine";

// ─── Gear stat aggregation ────────────────────────────────────────────────────

function sumGearStats(gear: Record<string, unknown>): ItemStats {
  const totals: ItemStats = {};
  for (const raw of Object.values(gear)) {
    const item = raw as GeneratedItem;
    if (!item?.stats) continue;
    for (const [k, v] of Object.entries(item.stats)) {
      if (typeof v !== "number") continue;
      const key = k as keyof ItemStats;
      if (key === "weaponDelay") {
        // Use the equipped weapon delay directly, don't sum
        if (!totals.weaponDelay) totals.weaponDelay = v;
      } else {
        (totals as Record<string, number>)[key] = ((totals as Record<string, number>)[key] ?? 0) + v;
      }
    }
  }
  return totals;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusEffect {
  id: string;
  name: string;
  type: "dot" | "stun" | "slow" | "shield" | "frenzy";
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
  let enemyHp = state.enemyHp;
  let effects = (state.statusEffects as unknown as StatusEffect[]).map(e => ({ ...e }));
  const prevLog = state.log as unknown as string[];
  const tick = state.tick + 1;
  const newEntries: string[] = [];

  // Per-tick RNG (non-deterministic — combat should feel random)
  const rng = mulberry32((Date.now() ^ (tick * 2_654_435_761)) >>> 0);

  // ── Phase 1: Apply active status effects ────────────────────────────────────
  const isStunned = effects.some(e => e.type === "stun");
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

  // ── Phase 2: Player attacks enemy ───────────────────────────────────────────
  const gearStats = sumGearStats(char.gear as Record<string, unknown>);
  if (!isStunned && enemyHp > 0) {
    const baseCrit = 0.05 + char.level * 0.001 + (gearStats.critChance ?? 0) / 100;
    const isCrit   = rng() < Math.min(0.60, baseCrit);
    const critMult = 1.5 + (gearStats.critBonus ?? 0) / 100;
    const hasteRed = Math.min(0.50, (gearStats.haste ?? 0) / 200);

    // Weapon damage — use equipped weapon if available, else str-based
    const dmgMin = gearStats.weaponDamageMin ?? Math.max(1, char.strength * 1.2 + char.level * 2);
    const dmgMax = gearStats.weaponDamageMax ?? Math.max(2, char.strength * 2.5 + char.level * 4);
    const atkBonus = 1 + (gearStats.attackRating ?? 0) / 200;
    const speedBonus = 1 + hasteRed; // haste = more attacks per tick

    const rawDmg = Math.floor(
      (dmgMin + rng() * (dmgMax - dmgMin)) * slowMult * (isCrit ? critMult : 1) * atkBonus * speedBonus
    );
    const dealt = Math.max(1, Math.floor(rawDmg * (1 - enemy.mitigation)));
    enemyHp = Math.max(0, enemyHp - dealt);
    newEntries.push(isCrit
      ? `⚔️ CRIT! You hit ${enemy.name} for ${dealt}!`
      : `⚔️ You hit ${enemy.name} for ${dealt}.`);
  } else if (isStunned) {
    newEntries.push(`😵 Stunned — you cannot act!`);
  }

  // ── Phase 3: Enemy abilities ────────────────────────────────────────────────
  if (enemyHp > 0) {
    for (const ability of (enemy.abilities as EnemyAbility[])) {
      let fires = false;
      const tv = Math.max(1, Math.floor(ability.triggerValue));
      if (ability.triggerType === "every_n_ticks" && tick % tv === 0) fires = true;
      if (ability.triggerType === "percent_hp"
        && enemyHp / enemy.maxHp <= ability.triggerValue / 100) fires = true;
      if (ability.triggerType === "on_hit_proc" && rng() < ability.triggerValue) fires = true;
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
          newEntries.push(`💚 ${enemy.name} heals ${heal} HP!`);
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
          break; // handled on enemy side later
      }
    }
  }

  // ── Phase 4: Enemy attacks player ───────────────────────────────────────────
  if (enemyHp > 0 && playerHp > 0) {
    const charStats = {
      level:         char.level,
      strength:      char.strength  + (gearStats.strength  ?? 0),
      agility:       char.agility   + (gearStats.agility   ?? 0),
      stamina:       char.stamina   + (gearStats.stamina   ?? 0),
      intelligence:  char.intelligence + (gearStats.intelligence ?? 0),
      wisdom:        char.wisdom    + (gearStats.wisdom    ?? 0),
      charisma:      char.charisma  + (gearStats.charisma  ?? 0),
      defenseRating: gearStats.defenseRating,
      mitigation:    gearStats.mitigation,
      avoidance:     gearStats.avoidance,
    };
    const avoidance  = effectiveAvoidance(charStats);
    const mitigation = effectiveMitigation(charStats);
    const avoided    = rng() < avoidance;

    if (avoided) {
      newEntries.push(`🛡️ You dodge ${enemy.name}'s attack!`);
    } else {
      const rawDmg  = Math.floor((enemy.dmgMin + rng() * (enemy.dmgMax - enemy.dmgMin)) * (1 + frenzyAdd));
      const dealt   = Math.max(1, Math.floor(rawDmg * (1 - mitigation)));
      playerHp = Math.max(0, playerHp - dealt);
      newEntries.push(`💢 ${enemy.name} hits you for ${dealt}.`);
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

  if (enemyHp <= 0) {
    // ── Enemy defeated ───────────────────────────────────────────────────────
    const earnedXp   = xpReward(enemy.level, char.level);
    const earnedGold = enemy.goldReward;
    newTotalKills++;
    if (enemy.isBoss) newBossKills++;
    newGold      += earnedGold;
    newGoldEarned += earnedGold;
    newXp        += earnedXp;
    newEntries.push(`🏆 ${enemy.name} defeated! +${earnedXp} XP  +${earnedGold}g`);

    // Level-up loop
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
        id: createId(),
        characterId: char.id,
        itemData: drop as unknown as Record<string, unknown>,
        quantity: 1,
        slot: null,
        createdAt: new Date(),
      });
    }

    // ── World Unique drop check (boss only, level 20+, 1% chance) ──────────────
    if (enemy.isBoss && newLevel >= 20 && lootRng() < 0.01 && worlds[0]) {
      const world = worlds[0];
      const alreadyClaimed = await db.select().from(worldEventsTable)
        .where(and(
          eq(worldEventsTable.worldId, world.id),
          eq(worldEventsTable.zoneId, state.zoneId),
          eq(worldEventsTable.eventType, "unique_claimed"),
        )).limit(1);

      if (!alreadyClaimed.length) {
        const zoneGraph = world.zoneGraph as unknown as ZoneGraph;
        const currentZone = zoneGraph.zones.find(z => z.id === state.zoneId);
        const uniqueItem = generateWorldUniqueItem(
          Number(world.seed),
          state.zoneId,
          currentZone?.name ?? state.zoneId,
          currentZone?.bossName ?? "the Ancient",
        );
        await db.insert(inventoryTable).values({
          id: createId(),
          characterId: char.id,
          itemData: uniqueItem as unknown as Record<string, unknown>,
          quantity: 1,
          slot: null,
          createdAt: new Date(),
        });
        await db.insert(worldEventsTable).values({
          id: createId(),
          worldId: world.id,
          ghostId: null,
          zoneId: state.zoneId,
          eventType: "unique_claimed",
          message: `${char.name} has claimed ${uniqueItem.name} — the only one in this world!`,
          metadata: { itemId: uniqueItem.id, itemName: uniqueItem.name, characterName: char.name } as Record<string, unknown>,
          createdAt: new Date(),
        });
        newEntries.push(`🌟 WORLD FIRST! You found ${uniqueItem.name} — the only one in existence!`);
      }
    }

    // Spawn next enemy
    const nextRng    = mulberry32((Date.now() + tick * 31_337) >>> 0);
    const nextLevel  = Math.min(zoneMax, Math.max(zoneMin, newLevel));
    nextEnemy = generateEnemy(state.zoneId, nextLevel, false, nextRng);
    enemyHp   = nextEnemy.hp;
    effects   = [];
    newEntries.push(`A ${nextEnemy.name} (Lv.${nextEnemy.level}) appears!`);

  } else if (playerHp <= 0) {
    // ── Player defeated ──────────────────────────────────────────────────────
    newDeaths++;
    const xpLoss = Math.floor(newXp * 0.10);
    newXp = Math.max(0, newXp - xpLoss);
    finalPlayerHp = Math.floor(char.maxHp * 0.30);
    newEntries.push(`💀 Defeated! -${xpLoss} XP. Respawning...`);

    const respawnRng = mulberry32((Date.now() + tick * 99_991) >>> 0);
    const nextLevel  = Math.min(zoneMax, Math.max(zoneMin, newLevel));
    nextEnemy = generateEnemy(state.zoneId, nextLevel, false, respawnRng);
    enemyHp   = nextEnemy.hp;
    effects   = [];
    newEntries.push(`A ${nextEnemy.name} (Lv.${nextEnemy.level}) lurks nearby.`);

  } else {
    finalPlayerHp = playerHp;
  }

  // ── Phase 6: Persist ─────────────────────────────────────────────────────────
  await db.update(charactersTable).set({
    hp: finalPlayerHp,
    xp: newXp,
    level: newLevel,
    xpToNext: newXpToNext,
    gold: newGold,
    totalKills: newTotalKills,
    bossKills: newBossKills,
    goldEarned: newGoldEarned,
    totalDeaths: newDeaths,
    updatedAt: new Date(),
  }).where(eq(charactersTable.id, char.id));

  const currentEnemy = nextEnemy ?? enemy;
  const combinedLog  = [...newEntries, ...prevLog].slice(0, MAX_LOG);

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
    enemyHp,
    enemy:       currentEnemy,
    statusEffects: effects,
    log:         combinedLog,
    leveledUp,
    newLevel,
    newXp,
    newXpToNext,
    newGold,
  });
}
