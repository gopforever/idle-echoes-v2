import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db, charactersTable, worldsTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { GameView } from "@/components/game/GameView";
import type { ZoneGraph, FactionWeb, WorldHistory } from "@repo/engine";

export default async function WorldPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const characters = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!characters.length) redirect("/create-character");
  const character = characters[0]!;

  const worlds = await db.select().from(worldsTable)
    .where(eq(worldsTable.id, character.worldId)).limit(1);
  if (!worlds.length) redirect("/create-character");
  const world = worlds[0]!;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-amber-300">Idle Echoes</h1>
          <span className="text-muted-foreground text-sm hidden sm:block">
            World of {world.name}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Seed #{Number(world.seed).toLocaleString()}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <GameView
          worldName={world.name}
          zoneGraph={world.zoneGraph as unknown as ZoneGraph}
          factionWeb={world.factionWeb as unknown as FactionWeb}
          history={world.history as unknown as WorldHistory}
          seed={Number(world.seed)}
          character={{
            id:            character.id,
            name:          character.name,
            className:     character.className,
            archetype:     character.archetype,
            level:         character.level,
            xp:            character.xp,
            xpToNext:      character.xpToNext,
            gold:          character.gold,
            hp:            character.hp,
            maxHp:         character.maxHp,
            power:         character.power,
            maxPower:      character.maxPower,
            currentZoneId: character.currentZoneId,
            ascensions:    character.ascensions ?? 0,
          }}
        />
      </main>
    </div>
  );
}
