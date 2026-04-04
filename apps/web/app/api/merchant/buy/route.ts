import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, inventoryTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { getMerchantStock } from "@repo/engine";
import { createId } from "@paralleldrive/cuid2";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { zoneId?: string; itemIndex?: number };
  const { zoneId, itemIndex } = body;
  if (!zoneId || itemIndex === undefined) {
    return NextResponse.json({ error: "zoneId and itemIndex required" }, { status: 400 });
  }

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  const stock = getMerchantStock(zoneId, char.level, 6);
  const item = stock[itemIndex];
  if (!item) return NextResponse.json({ error: "Item not found in merchant stock" }, { status: 404 });

  if (char.gold < item.buyPrice) {
    return NextResponse.json({ error: "Not enough gold", needed: item.buyPrice, have: char.gold }, { status: 400 });
  }

  const newGold = char.gold - item.buyPrice;
  await db.update(charactersTable).set({ gold: newGold, updatedAt: new Date() })
    .where(eq(charactersTable.id, char.id));

  await db.insert(inventoryTable).values({
    id: createId(),
    characterId: char.id,
    itemData: item as unknown as Record<string, unknown>,
    quantity: 1,
    slot: null,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, newGold, item });
}
