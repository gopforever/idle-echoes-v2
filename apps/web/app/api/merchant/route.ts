import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { getMerchantStock } from "@repo/engine";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const zoneId = req.nextUrl.searchParams.get("zoneId");
  if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  const stock = getMerchantStock(zoneId, char.level, 6);
  return NextResponse.json({ stock, gold: char.gold });
}
