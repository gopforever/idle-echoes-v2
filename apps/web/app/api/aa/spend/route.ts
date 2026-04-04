import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { AA_NODES } from "@repo/engine";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { nodeId?: string };
  const { nodeId } = body;
  if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });

  // Find node definition
  const node = AA_NODES.find(n => n.id === nodeId);
  if (!node) return NextResponse.json({ error: "Unknown AA node" }, { status: 400 });

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  // Tier 4 gate: requires at least one ascension
  if (node.tier === 4 && char.ascensions < 1) {
    return NextResponse.json({ error: "Requires ascension" }, { status: 400 });
  }

  // Archetype gate
  if (node.archetype && !node.archetype.includes(char.archetype as import("@repo/engine").Archetype)) {
    return NextResponse.json({ error: "Wrong archetype" }, { status: 400 });
  }

  // Class gate
  if (node.classes && !node.classes.includes(char.className)) {
    return NextResponse.json({ error: "Wrong class" }, { status: 400 });
  }

  const nodes = (char.aaNodes as Record<string, number>) ?? {};
  const currentRank = nodes[nodeId] ?? 0;

  if (currentRank >= node.maxRank) {
    return NextResponse.json({ error: `${node.name} is already at max rank (${node.maxRank})` }, { status: 400 });
  }

  // Cost is for the next rank (index = currentRank)
  const cost = node.costPerRank[currentRank] ?? 1;

  if (char.aaPoints < cost) {
    return NextResponse.json({ error: "Not enough AA points" }, { status: 400 });
  }

  const newNodes = { ...nodes, [nodeId]: currentRank + 1 };
  const newPoints = char.aaPoints - cost;

  await db.update(charactersTable).set({
    aaNodes:  newNodes as unknown as Record<string, unknown>,
    aaPoints: newPoints,
    updatedAt: new Date(),
  }).where(eq(charactersTable.id, char.id));

  return NextResponse.json({
    ok: true,
    nodeId,
    newRank: currentRank + 1,
    maxRank: node.maxRank,
    aaPoints: newPoints,
    aaNodes: newNodes,
  });
}
