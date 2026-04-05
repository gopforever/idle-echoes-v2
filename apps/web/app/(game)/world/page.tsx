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
        race:          "Human",
        level:         character.level,
        xp:            character.xp,
        xpToNext:      character.xpToNext,
        gold:          character.gold,
        aaPoints:      character.aaPoints ?? 0,
        hp:            character.hp,
        maxHp:         character.maxHp,
        power:         character.power,
        maxPower:      character.maxPower,
        strength:      character.strength ?? 10,
        agility:       character.agility ?? 10,
        stamina:       character.stamina ?? 10,
        intelligence:  character.intelligence ?? 10,
        wisdom:        character.wisdom ?? 10,
        charisma:      character.charisma ?? 10,
        currentZoneId: character.currentZoneId,
        ascensions:    character.ascensions ?? 0,
      }}
    />
  );
}
