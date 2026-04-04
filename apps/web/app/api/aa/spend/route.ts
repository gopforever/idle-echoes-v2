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

  const nodeDef = AA_NODES.find(n => n.id === nodeId);
  if (!nodeDef) return NextResponse.json({ error: "Unknown AA node" }, { status: 400 });

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  if (char.aaPoints < 1) {
    return NextResponse.json({ error: "No AA points available" }, { status: 400 });
  }

  const nodes = (char.aaNodes as Record<string, number>) ?? {};
  const currentRank = nodes[nodeId] ?? 0;

  if (currentRank >= nodeDef.maxRank) {
    return NextResponse.json({ error: `${nodeDef.name} is already at max rank (${nodeDef.maxRank})` }, { status: 400 });
  }

  const newNodes = { ...nodes, [nodeId]: currentRank + 1 };
  const newPoints = char.aaPoints - 1;

  await db.update(charactersTable).set({
    aaNodes:  newNodes as unknown as Record<string, unknown>,
    aaPoints: newPoints,
    updatedAt: new Date(),
  }).where(eq(charactersTable.id, char.id));

  return NextResponse.json({
    ok: true,
    nodeId,
    newRank: currentRank + 1,
    maxRank: nodeDef.maxRank,
    aaPoints: newPoints,
    aaNodes: newNodes,
  });
}
