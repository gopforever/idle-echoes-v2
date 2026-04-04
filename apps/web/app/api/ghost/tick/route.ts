// Ghost world simulation tick — called by Vercel Cron every 5 minutes.
// Simulates ghost player activity and populates world_events for all worlds.
import { NextResponse } from "next/server";
import { db, worldsTable, ghostPlayersTable, worldEventsTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { simulateGhostBatch, mulberry32 } from "@repo/engine";
import { createId } from "@paralleldrive/cuid2";
import type { ZoneGraph } from "@repo/engine";

export async function POST() {
  // Basic cron auth — Vercel sets this header automatically
  // In production add: if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) return 401

  const worlds = await db.select().from(worldsTable).limit(20);

  let totalEvents = 0;

  for (const world of worlds) {
    const ghosts = await db.select().from(ghostPlayersTable)
      .where(eq(ghostPlayersTable.worldId, world.id))
      .limit(30);

    if (!ghosts.length) continue;

    const zoneGraph = world.zoneGraph as unknown as ZoneGraph;
    const zones = zoneGraph.zones;
    const rng = mulberry32((Date.now() ^ Number(world.seed)) >>> 0);

    const results = simulateGhostBatch(
      ghosts.map(g => ({
        id: g.id, name: g.name, level: g.level,
        personality: g.personality, currentZoneId: g.currentZoneId,
        killCount: g.killCount, gold: g.gold,
      })),
      zones,
      rng,
    );

    for (const result of results) {
      // Update ghost stats
      await db.update(ghostPlayersTable).set({
        level:         result.newLevel,
        killCount:     result.newKillCount,
        gold:          result.newGold,
        currentZoneId: result.newZoneId,
        updatedAt:     new Date(),
      }).where(eq(ghostPlayersTable.id, result.ghostId));

      // Create world event for notable actions
      if (result.eventMessage && result.eventType) {
        await db.insert(worldEventsTable).values({
          id:        createId(),
          worldId:   world.id,
          ghostId:   result.ghostId,
          zoneId:    result.newZoneId,
          eventType: result.eventType,
          message:   result.eventMessage,
          metadata:  {} as Record<string, unknown>,
          createdAt: new Date(),
        });
        totalEvents++;
      }
    }
  }

  return NextResponse.json({ ok: true, worldsProcessed: worlds.length, eventsCreated: totalEvents });
}

// Also support GET for easy manual triggering in dev
export const GET = POST;
