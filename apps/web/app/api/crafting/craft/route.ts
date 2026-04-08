import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable, inventoryTable } from "@repo/db";
import { eq, isNull, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  RECIPES,
  MATERIALS,
  initTradeskills,
  awardTradeskillXp,
  generateItem,
  mulberry32,
  type Tradeskills,
  type ItemRarity,
  type ItemSlot,
} from "@repo/engine";

/**
 * POST /api/crafting/craft
 *
 * Body: { recipeId: string }
 *
 * Validates: recipe exists, character has the required tradeskill level,
 * character has all materials.
 * Consumes materials from inventory.
 * If output.type === "material": adds output material to inventory (or stacks).
 * If output.type === "item": generates an item using generateItem.
 * Awards XP to the crafting skill.
 * Returns: { ok, output, tradeskills, error? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { recipeId?: string };
  try {
    body = await req.json() as { recipeId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipeId } = body;
  if (!recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 });

  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

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

  // Check tradeskill level requirement
  const skillEntry = tradeskills[recipe.skill];
  if (skillEntry.level < recipe.requiredLevel) {
    return NextResponse.json({
      ok: false,
      error: `Requires ${recipe.skill} level ${recipe.requiredLevel} (you have ${skillEntry.level})`,
    }, { status: 400 });
  }

  // Load bag inventory for material checking
  const inventoryItems = await db
    .select()
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.characterId, char.id),
        isNull(inventoryTable.slot),
      ),
    );

  // Build materialId → { rowId, quantity } map
  const matMap: Record<string, { id: string; quantity: number }> = {};
  for (const item of inventoryItems) {
    const data = item.itemData as Record<string, unknown>;
    if (data.type === "material" && typeof data.materialId === "string") {
      const mid = data.materialId;
      if (!matMap[mid]) {
        matMap[mid] = { id: item.id, quantity: item.quantity ?? 1 };
      } else {
        // Accumulate across stacks (in practice there should only be one)
        matMap[mid]!.quantity += item.quantity ?? 1;
      }
    }
  }

  // Validate we have all inputs
  for (const input of recipe.inputs) {
    const have = matMap[input.materialId]?.quantity ?? 0;
    if (have < input.quantity) {
      const matDef = MATERIALS[input.materialId];
      return NextResponse.json({
        ok: false,
        error: `Not enough ${matDef?.name ?? input.materialId} (need ${input.quantity}, have ${have})`,
      }, { status: 400 });
    }
  }

  // Consume input materials
  for (const input of recipe.inputs) {
    const entry = matMap[input.materialId]!;
    const newQty = entry.quantity - input.quantity;
    if (newQty <= 0) {
      // Delete the row
      await db
        .delete(inventoryTable)
        .where(eq(inventoryTable.id, entry.id));
    } else {
      await db
        .update(inventoryTable)
        .set({ quantity: newQty })
        .where(eq(inventoryTable.id, entry.id));
    }
  }

  // Produce output
  let outputDescription: Record<string, unknown> = {};

  if (recipe.output.type === "material") {
    const matDef = MATERIALS[recipe.output.materialId];
    const stackSize = matDef?.stackSize ?? 100;

    // Try to find existing stack
    const existing = await db
      .select()
      .from(inventoryTable)
      .where(
        and(
          eq(inventoryTable.characterId, char.id),
          isNull(inventoryTable.slot),
          sql`${inventoryTable.itemData}->>'materialId' = ${recipe.output.materialId}`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      const newQty = Math.min((row.quantity ?? 1) + recipe.output.quantity, stackSize);
      await db
        .update(inventoryTable)
        .set({ quantity: newQty })
        .where(eq(inventoryTable.id, row.id));
    } else {
      await db.insert(inventoryTable).values({
        id: createId(),
        characterId: char.id,
        itemData: {
          type: "material",
          materialId: recipe.output.materialId,
          name: matDef?.name ?? recipe.output.materialId,
          icon: matDef?.icon ?? "📦",
          tier: matDef?.tier ?? 1,
        },
        quantity: recipe.output.quantity,
        slot: null,
      });
    }

    outputDescription = {
      type: "material",
      materialId: recipe.output.materialId,
      name: matDef?.name ?? recipe.output.materialId,
      icon: matDef?.icon ?? "📦",
      quantity: recipe.output.quantity,
    };
  } else {
    // Generate a procedural item
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const rng = mulberry32(seed);
    const generatedItem = generateItem(
      char.currentZoneId,
      char.level,
      rng,
      {
        forceSlot: recipe.output.slot as ItemSlot,
        forceRarity: recipe.output.rarity as ItemRarity,
      },
    );

    await db.insert(inventoryTable).values({
      id: createId(),
      characterId: char.id,
      itemData: generatedItem as unknown as Record<string, unknown>,
      quantity: 1,
      slot: null,
    });

    outputDescription = {
      type: "item",
      item: generatedItem,
    };
  }

  // Award XP to crafting skill
  const updatedSkillEntry = awardTradeskillXp(skillEntry, recipe.xpReward);
  const updatedTradeskills: Tradeskills = {
    ...tradeskills,
    [recipe.skill]: updatedSkillEntry,
  };

  // Persist tradeskills
  await db
    .update(charactersTable)
    .set({
      tradeskills: updatedTradeskills as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(charactersTable.id, char.id));

  return NextResponse.json({
    ok: true,
    output: outputDescription,
    tradeskills: updatedTradeskills,
  });
}
