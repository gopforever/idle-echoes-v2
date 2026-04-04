import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, inventoryTable } from "@repo/db";
import { eq, and } from "drizzle-orm";
import type { GeneratedItem } from "@repo/engine";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { inventoryId?: string };
  const { inventoryId } = body;
  if (!inventoryId) return NextResponse.json({ error: "inventoryId required" }, { status: 400 });

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  const rows = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.id, inventoryId), eq(inventoryTable.characterId, char.id)))
    .limit(1);
  if (!rows.length) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  const row = rows[0]!;
  const item = row.itemData as unknown as GeneratedItem;

  if (item.noSell) {
    return NextResponse.json({ error: "This item cannot be sold to vendors" }, { status: 400 });
  }
  if (row.slot !== null) {
    return NextResponse.json({ error: "Unequip the item before selling" }, { status: 400 });
  }

  const newGold = char.gold + item.sellPrice;
  await db.update(charactersTable).set({ gold: newGold, updatedAt: new Date() })
    .where(eq(charactersTable.id, char.id));
  await db.delete(inventoryTable).where(eq(inventoryTable.id, inventoryId));

  return NextResponse.json({ ok: true, soldFor: item.sellPrice, newGold });
}
