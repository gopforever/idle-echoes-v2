import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, worldsTable, worldEventsTable } from "@repo/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ events: [] });
  const char = chars[0]!;

  // Get world to find worldId
  const worlds = await db.select({ id: worldsTable.id }).from(worldsTable)
    .where(eq(worldsTable.id, char.worldId)).limit(1);
  if (!worlds.length) return NextResponse.json({ events: [] });

  const events = await db.select().from(worldEventsTable)
    .where(eq(worldEventsTable.worldId, worlds[0]!.id))
    .orderBy(desc(worldEventsTable.createdAt))
    .limit(25);

  return NextResponse.json({ events });
}
