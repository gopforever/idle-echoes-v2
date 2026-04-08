import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, inventoryTable } from "@repo/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  doGatherTick,
  initTradeskills,
  awardTradeskillXp,
  MATERIALS,
  type Tradeskills,
  type GatherResult,
  type TradeskillEntry,
  type ZoneGraph,
} from "@repo/engine";

const GATHERING_SKILLS = ["mining", "foraging", "fishing"] as const;
// 60% base chance each skill yields anything per tick
const YIELD_CHANCE = 0.6;

/**
 * POST /api/gathering/tick
 *
 * Called every 30s by the client when not in combat.
 * Runs a gather tick for all three gathering skills simultaneously.
 * Adds materials to inventory (stacks with existing, respects stackSize).
 * Awards tradeskill XP.
 * Returns: { ok, results: GatherResult[], tradeskills }
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.userId, user.id))
    .limit(1);

  const char = rows[0];
  if (!char) return NextResponse.json({ error: "No character found" }, { status: 404 });

  // Merge stored tradeskills with defaults so new characters always have full data
  const stored = (char.tradeskills ?? {}) as Partial<Tradeskills>;
  const tradeskills: Tradeskills = { ...initTradeskills(), ...stored };

  // Resolve biome from world's zoneGraph
  // We need to fetch the world to get the zoneGraph
  const worldRows = await db
    .select()
    .from((await import("@repo/db")).worldsTable)
    .where(eq((await import("@repo/db")).worldsTable.id, char.worldId))
    .limit(1);

  const world = worldRows[0];
  let biome = "grasslands";
  if (world) {
    const zoneGraph = world.zoneGraph as unknown as ZoneGraph;
    const zone = zoneGraph.zones.find(z => z.id === char.currentZoneId);
    if (zone) biome = zone.biome;
  }

  const results: GatherResult[] = [];
  const updatedTradeskills = { ...tradeskills };

  for (const skillId of GATHERING_SKILLS) {
    // 60% chance to yield anything this tick
    if (Math.random() > YIELD_CHANCE) continue;

    const entry: TradeskillEntry = updatedTradeskills[skillId];
    const result = doGatherTick(skillId, entry, biome, Math.random);
    if (!result) continue;

    results.push(result);

    // Update the tradeskill entry with earned XP
    updatedTradeskills[skillId] = awardTradeskillXp(entry, result.xpGained);
  }

  // Add yielded materials to inventory
  for (const result of results) {
    const matDef = MATERIALS[result.materialId];
    if (!matDef) continue;

    // Try to find existing stack for this material (slot IS NULL = bag item)
    const existing = await db
      .select()
      .from(inventoryTable)
      .where(
        and(
          eq(inventoryTable.characterId, char.id),
          isNull(inventoryTable.slot),
          sql`${inventoryTable.itemData}->>'materialId' = ${result.materialId}`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      const newQty = Math.min((row.quantity ?? 1) + result.quantity, matDef.stackSize);
      await db
        .update(inventoryTable)
        .set({ quantity: newQty })
        .where(eq(inventoryTable.id, row.id));
    } else {
      // Insert new material stack
      await db.insert(inventoryTable).values({
        id: createId(),
        characterId: char.id,
        itemData: {
          type: "material",
          materialId: result.materialId,
          name: matDef.name,
          icon: matDef.icon,
          tier: matDef.tier,
        },
        quantity: result.quantity,
        slot: null,
      });
    }
  }

  // Persist updated tradeskills
  await db
    .update(charactersTable)
    .set({
      tradeskills: updatedTradeskills as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(charactersTable.id, char.id));

  return NextResponse.json({
    ok: true,
    results,
    tradeskills: updatedTradeskills,
  });
}
