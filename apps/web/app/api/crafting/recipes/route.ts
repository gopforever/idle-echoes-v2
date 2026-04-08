import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, inventoryTable } from "@repo/db";
import { eq, isNull, and } from "drizzle-orm";
import {
  RECIPES,
  initTradeskills,
  type Tradeskills,
  type MaterialId,
} from "@repo/engine";

/**
 * GET /api/crafting/recipes
 *
 * Returns available recipes and current material counts.
 * Response: { recipes: Recipe[], materials: Record<MaterialId, number>, tradeskills: Tradeskills }
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.userId, user.id))
    .limit(1);

  const char = rows[0];
  if (!char) return NextResponse.json({ error: "No character found" }, { status: 404 });

  // Merge stored tradeskills with defaults
  const stored = (char.tradeskills ?? {}) as Partial<Tradeskills>;
  const tradeskills: Tradeskills = { ...initTradeskills(), ...stored };

  // Load material inventory — all bag items where type === "material"
  const inventoryItems = await db
    .select()
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.characterId, char.id),
        isNull(inventoryTable.slot),
      ),
    );

  // Build materialId → total quantity map
  const materials: Record<string, number> = {};
  for (const item of inventoryItems) {
    const data = item.itemData as Record<string, unknown>;
    if (data.type === "material" && typeof data.materialId === "string") {
      const mid = data.materialId as MaterialId;
      materials[mid] = (materials[mid] ?? 0) + (item.quantity ?? 1);
    }
  }

  return NextResponse.json({
    recipes: RECIPES,
    materials,
    tradeskills,
  });
}
