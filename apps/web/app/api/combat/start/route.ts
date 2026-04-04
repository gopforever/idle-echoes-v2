import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, worldsTable, combatStateTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { generateEnemy, mulberry32 } from "@repo/engine";
import { createId } from "@paralleldrive/cuid2";
import type { ZoneGraph } from "@repo/engine";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { zoneId?: string };
  const zoneId = body.zoneId;
  if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });

  // Get character
  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  // Get world + zone graph
  const worlds = await db.select().from(worldsTable)
    .where(eq(worldsTable.id, char.worldId)).limit(1);
  if (!worlds.length) return NextResponse.json({ error: "World not found" }, { status: 404 });
  const world = worlds[0]!;

  const zoneGraph = world.zoneGraph as unknown as ZoneGraph;
  const zone = zoneGraph.zones.find(z => z.id === zoneId);
  if (!zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  if (zone.levelRange[0] > char.level + 5) {
    return NextResponse.json({ error: "Zone level too high" }, { status: 403 });
  }

  // Enemy level scales WITH the player (capped at zone max).
  // A level 1 character in a level 4-14 zone still fights level 1 enemies.
  // This prevents new characters from being one-shot by their own starter zone.
  const rng = mulberry32(Date.now() >>> 0);
  const enemyLevel = Math.min(zone.levelRange[1], Math.max(1, char.level));
  const enemy = generateEnemy(zoneId, enemyLevel, false, rng);

  // Heal player to max on zone entry, update location
  await db.update(charactersTable).set({
    currentZoneId: zoneId,
    hp: char.maxHp,
    updatedAt: new Date(),
  }).where(eq(charactersTable.id, char.id));

  const initLog = [
    `A ${enemy.name} (Lv.${enemy.level}) appears!`,
    `You enter ${zone.name}.`,
  ];

  // Upsert combat state (one row per character via unique constraint)
  await db.insert(combatStateTable).values({
    id: createId(),
    characterId: char.id,
    zoneId,
    enemyData: enemy as unknown as Record<string, unknown>,
    playerHp: char.maxHp,
    enemyHp: enemy.hp,
    tick: 0,
    statusEffects: [] as unknown as Record<string, unknown>[],
    log: initLog as unknown as Record<string, unknown>[],
    isActive: true,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: combatStateTable.characterId,
    set: {
      zoneId,
      enemyData: enemy as unknown as Record<string, unknown>,
      playerHp: char.maxHp,
      enemyHp: enemy.hp,
      tick: 0,
      statusEffects: [] as unknown as Record<string, unknown>[],
      log: initLog as unknown as Record<string, unknown>[],
      isActive: true,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    zoneId,
    zoneName: zone.name,
    enemy,
    playerHp: char.maxHp,
    playerMaxHp: char.maxHp,
    log: initLog,
  });
}
