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

  // Find the item to equip
  const rows = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.id, inventoryId), eq(inventoryTable.characterId, char.id)))
    .limit(1);
  if (!rows.length) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  const row = rows[0]!;
  const item = row.itemData as unknown as GeneratedItem;

  // If already equipped, unequip it instead
  if (row.slot !== null) {
    await db.update(inventoryTable).set({ slot: null })
      .where(eq(inventoryTable.id, inventoryId));

    const newGear = { ...(char.gear as Record<string, unknown>) };
    delete newGear[item.slot];
    await db.update(charactersTable).set({ gear: newGear, updatedAt: new Date() })
      .where(eq(charactersTable.id, char.id));

    return NextResponse.json({ action: "unequipped", slot: item.slot, gear: newGear });
  }

  // Find any existing item in this slot and unequip it
  const existingInSlot = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.characterId, char.id), eq(inventoryTable.slot, item.slot)))
    .limit(1);

  if (existingInSlot.length) {
    await db.update(inventoryTable).set({ slot: null })
      .where(eq(inventoryTable.id, existingInSlot[0]!.id));
  }

  // Equip the new item
  await db.update(inventoryTable).set({ slot: item.slot })
    .where(eq(inventoryTable.id, inventoryId));

  // Update paperdoll on character
  const newGear = {
    ...(char.gear as Record<string, unknown>),
    [item.slot]: item,
  };
  await db.update(charactersTable).set({ gear: newGear, updatedAt: new Date() })
    .where(eq(charactersTable.id, char.id));

  return NextResponse.json({ action: "equipped", slot: item.slot, gear: newGear });
}
