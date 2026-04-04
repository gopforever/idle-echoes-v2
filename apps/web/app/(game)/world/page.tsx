import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db, charactersTable, worldsTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { WorldMap } from "@/components/game/WorldMap";
import type { ZoneGraph, FactionWeb, WorldHistory } from "@repo/engine";

export default async function WorldPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get character
  const characters = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id))
    .limit(1);

  if (!characters.length) redirect("/create-character");
  const character = characters[0]!;

  // Get world
  const worlds = await db.select().from(worldsTable)
    .where(eq(worldsTable.id, character.worldId))
    .limit(1);

  if (!worlds.length) redirect("/create-character");
  const world = worlds[0]!;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-amber-300">Idle Echoes</h1>
          <span className="text-muted-foreground text-sm">World of {world.name}</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-foreground font-medium">{character.name}</div>
          <div className="text-muted-foreground">Lv.{character.level} {character.className}</div>
          <div className="text-amber-400">{character.gold}g</div>
          <div className="flex items-center gap-1">
            <div className="h-2 bg-border rounded-full w-24">
              <div
                className="h-2 bg-red-500 rounded-full"
                style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{character.hp}/{character.maxHp}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <WorldMap
          worldName={world.name}
          zoneGraph={world.zoneGraph as unknown as ZoneGraph}
          factionWeb={world.factionWeb as unknown as FactionWeb}
          history={world.history as unknown as WorldHistory}
          currentZoneId={character.currentZoneId}
          characterLevel={character.level}
          seed={Number(world.seed)}
        />
      </main>
    </div>
  );
}
