import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, worldsTable, ghostPlayersTable } from "@repo/db";
import { generateWorld, randomSeed, generateGhostSeeds, assignRivalries, mulberry32 } from "@repo/engine";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

/** GET /api/world — get or create the current user's world */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user already has a world
  const existing = await db.select().from(worldsTable)
    .where(eq(worldsTable.id, user.id))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(existing[0]);
  }

  // Generate a fresh world for this user
  const seed = randomSeed();
  const generated = generateWorld(seed);
  const worldId = createId();

  await db.insert(worldsTable).values({
    id: worldId,
    seed,
    name: generated.history.worldName,
    era: 1,
    zoneGraph: generated.zoneGraph as unknown as Record<string, unknown>,
    factionWeb: generated.factionWeb as unknown as Record<string, unknown>,
    history: generated.history as unknown as Record<string, unknown>,
  });

  // Generate and insert ghost players for this world
  const rng = mulberry32(seed + 1);
  const zoneIds = generated.zoneGraph.zones.map(z => z.id);
  let ghostSeeds = generateGhostSeeds(seed, zoneIds, rng);
  ghostSeeds = assignRivalries(ghostSeeds, rng);

  await db.insert(ghostPlayersTable).values(
    ghostSeeds.map(g => ({
      id: createId(),
      worldId,
      name: g.name,
      race: g.race,
      archetype: g.archetype,
      className: g.className,
      alignment: g.alignment,
      personality: g.personality,
      traits: g.traits as unknown as Record<string, unknown>,
      level: g.traits.startingLevel,
      xp: 0,
      gold: g.traits.startingGold,
      currentZoneId: generated.zoneGraph.startingZoneId,
      killCount: 0,
      deathCount: 0,
      bossKills: 0,
      totalGoldEarned: g.traits.startingGold,
      generation: 1,
      ancestorName: null,
      strength:     g.stats.strength,
      agility:      g.stats.agility,
      stamina:      g.stats.stamina,
      intelligence: g.stats.intelligence,
      wisdom:       g.stats.wisdom,
      charisma:     g.stats.charisma,
    }))
  );

  return NextResponse.json({ id: worldId, seed, name: generated.history.worldName, ...generated });
}
