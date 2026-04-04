import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, combatStateTable } from "@repo/db";
import { eq } from "drizzle-orm";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  await db.update(combatStateTable).set({
    isActive: false,
    updatedAt: new Date(),
  }).where(eq(combatStateTable.characterId, char.id));

  return NextResponse.json({ ok: true });
}
