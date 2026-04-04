import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, combatStateTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { AA_NODES } from "@repo/engine";
import { createId } from "@paralleldrive/cuid2";
import type { Archetype } from "@repo/engine";

interface StatusEffect {
  id: string;
  name: string;
  type: "dot" | "stun" | "slow" | "shield" | "frenzy" | "invulnerable";
  value: number;
  remainingTicks: number;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { nodeId?: string };
  const { nodeId } = body;
  if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });

  // Load character
  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  // Load combat state (must be active)
  const states = await db.select().from(combatStateTable)
    .where(eq(combatStateTable.characterId, char.id)).limit(1);
  if (!states.length || !states[0]!.isActive) {
    return NextResponse.json({ error: "Not in combat" }, { status: 400 });
  }
  const state = states[0]!;

  // Find node with active effect
  const node = AA_NODES.find(n => n.id === nodeId && n.active != null);
  if (!node || !node.active) {
    return NextResponse.json({ error: "Unknown active AA node" }, { status: 400 });
  }

  // Archetype gate
  if (node.archetype && !node.archetype.includes(char.archetype as Archetype)) {
    return NextResponse.json({ error: "Wrong archetype" }, { status: 400 });
  }

  // Class gate
  if (node.classes && !node.classes.includes(char.className)) {
    return NextResponse.json({ error: "Wrong class" }, { status: 400 });
  }

  // Must have at least rank 1
  const aaNodes = (char.aaNodes as Record<string, number>) ?? {};
  const rank = aaNodes[nodeId] ?? 0;
  if (rank < 1) {
    return NextResponse.json({ error: "Node not unlocked" }, { status: 400 });
  }

  // Cooldown check
  const aaCooldowns = (char.aaCooldowns as Record<string, number>) ?? {};
  const cooldownUntil = aaCooldowns[nodeId] ?? 0;
  if (cooldownUntil > Date.now()) {
    return NextResponse.json({
      error: "On cooldown",
      remainingMs: cooldownUntil - Date.now(),
    }, { status: 429 });
  }

  // Mutable state
  let playerHp = state.playerHp;
  let newPower = char.power;
  let enemyHp = state.enemyHp;
  let statusEffects = (state.statusEffects as unknown as StatusEffect[]).map(e => ({ ...e }));
  const prevLog = state.log as unknown as string[];
  const logEntries: string[] = [];

  const maxHp = char.maxHp;
  const maxPower = char.maxPower;

  const active = node.active;

  // Burst damage base: strength-derived
  const dmgBase = Math.floor(char.strength * 1.5 + char.level * 3);

  // Apply active effect
  switch (active.type) {
    case "heal": {
      const healAmt = Math.floor(maxHp * (active.healPct ?? 0));
      playerHp = Math.min(maxHp, playerHp + healAmt);
      logEntries.push(`✨ ${node.name}: Restored ${healAmt} HP!`);
      break;
    }
    case "manaburn": {
      const burnAmt = Math.floor(newPower * (active.burnPct ?? 0));
      newPower = newPower - burnAmt;
      enemyHp = Math.max(0, enemyHp - burnAmt);
      logEntries.push(`🔥 ${node.name}: Burned ${burnAmt} Power as ${burnAmt} damage!`);
      break;
    }
    case "lifeburn": {
      const sacrifice = Math.floor(playerHp * (active.burnPct ?? 0));
      playerHp = Math.max(1, playerHp - sacrifice);
      const lifeDmg = sacrifice * 2;
      enemyHp = Math.max(0, enemyHp - lifeDmg);
      logEntries.push(`💀 ${node.name}: Sacrificed ${sacrifice} HP for ${lifeDmg} damage!`);
      break;
    }
    case "escape": {
      logEntries.push(`🌫️ ${node.name}: You escape!`);
      // Mark combat inactive — handled below
      await db.update(combatStateTable).set({
        isActive: false,
        updatedAt: new Date(),
      }).where(eq(combatStateTable.characterId, char.id));
      const newCooldownEscape = Date.now() + active.cooldownMs;
      const newCooldownsEscape = { ...aaCooldowns, [nodeId]: newCooldownEscape };
      await db.update(charactersTable).set({
        aaCooldowns: newCooldownsEscape as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      }).where(eq(charactersTable.id, char.id));
      return NextResponse.json({
        ok: true, escaped: true,
        hp: playerHp, power: newPower, enemyHp,
        log: [logEntries[0]!, ...prevLog].slice(0, 20),
        cooldownUntil: newCooldownEscape,
        cooldownMs: active.cooldownMs,
      });
    }
    case "purify": {
      const before = statusEffects.length;
      statusEffects = statusEffects.filter(e => !["dot","stun","slow"].includes(e.type));
      const removed = before - statusEffects.length;
      logEntries.push(`🧘 ${node.name}: Removed ${removed} negative effect(s)!`);
      break;
    }
    case "damage_buff": {
      statusEffects.push({
        id: createId(),
        name: node.name,
        type: "frenzy",
        value: (active.buffMult ?? 1) - 1,
        remainingTicks: active.durationTicks ?? 3,
      });
      logEntries.push(`⚡ ${node.name}: Damage increased for ${active.durationTicks ?? 3} ticks!`);
      break;
    }
    case "power_restore": {
      const restoreAmt = Math.floor(maxPower * (active.powerPct ?? 0));
      newPower = Math.min(maxPower, newPower + restoreAmt);
      logEntries.push(`🔮 ${node.name}: Restored ${restoreAmt} Power!`);
      break;
    }
    case "burst_damage": {
      const burstDmg = Math.floor(dmgBase * (active.burstMult ?? 1));
      enemyHp = Math.max(0, enemyHp - burstDmg);
      logEntries.push(`💥 ${node.name}: ${burstDmg} burst damage!`);
      break;
    }
    case "invulnerable": {
      statusEffects.push({
        id: createId(),
        name: "Invulnerable",
        type: "invulnerable",
        value: 1,
        remainingTicks: active.durationTicks ?? 1,
      });
      logEntries.push(`🌟 ${node.name}: Invulnerable for ${active.durationTicks ?? 1} tick(s)!`);
      break;
    }
  }

  const newCooldown = Date.now() + active.cooldownMs;
  const newCooldowns = { ...aaCooldowns, [nodeId]: newCooldown };

  // Persist character
  await db.update(charactersTable).set({
    hp: playerHp,
    power: newPower,
    aaCooldowns: newCooldowns as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  }).where(eq(charactersTable.id, char.id));

  // Persist combat state
  const combinedLog = [...logEntries, ...prevLog].slice(0, 20);
  await db.update(combatStateTable).set({
    playerHp,
    enemyHp,
    statusEffects: statusEffects as unknown as Record<string, unknown>[],
    log: combinedLog as unknown as Record<string, unknown>[],
    updatedAt: new Date(),
  }).where(eq(combatStateTable.characterId, char.id));

  return NextResponse.json({
    ok: true,
    hp: playerHp,
    power: newPower,
    enemyHp,
    log: combinedLog,
    cooldownUntil: newCooldown,
    cooldownMs: active.cooldownMs,
  });
}
