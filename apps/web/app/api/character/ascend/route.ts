import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import {
  skillXpToLevel, xpToLevel,
  type CharacterSkills, type SkillId,
} from "@repo/engine";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chars = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id)).limit(1);
  if (!chars.length) return NextResponse.json({ error: "No character" }, { status: 404 });
  const char = chars[0]!;

  if (char.level < 60) {
    return NextResponse.json({ error: "Must reach level 60 to ascend" }, { status: 400 });
  }

  const newAscensions = char.ascensions + 1;

  // Reduce all skills by 30%: level = max(1, floor(level * 0.70)), xp=0
  const skills = (char.skills ?? {}) as CharacterSkills;
  const reducedSkills: CharacterSkills = {};
  for (const [skillId, entry] of Object.entries(skills)) {
    if (!entry) continue;
    const newLevel = Math.max(1, Math.floor((entry.level ?? 1) * 0.70));
    reducedSkills[skillId as SkillId] = {
      level: newLevel,
      xp: 0,
      xpToNext: skillXpToLevel(newLevel + 1),
    };
  }

  // Echo bonus: determine which 3 stats get +2% (deterministic based on ascension count)
  // Pick indices using modulo spread
  const statKeys = ["str", "sta", "agi", "int", "wis"];
  const idx0 = newAscensions % 5;
  const idx1 = (newAscensions + 1) % 4;
  const idx2 = (newAscensions + 2) % 3;
  const chosenStats = [statKeys[idx0]!, statKeys[idx1]!, statKeys[idx2]!];

  const currentEchoBonus = (char.echoBonus ?? {}) as Record<string, number>;
  const newEchoBonus: Record<string, number> = { ...currentEchoBonus };
  for (const stat of chosenStats) {
    newEchoBonus[stat] = (newEchoBonus[stat] ?? 0) + 2;
  }

  await db.update(charactersTable).set({
    level: 1,
    xp: 0,
    xpToNext: xpToLevel(2),
    ascensions: newAscensions,
    echoBonus: newEchoBonus as unknown as Record<string, unknown>,
    skills: reducedSkills as unknown as Record<string, unknown>,
    hp: char.maxHp,
    updatedAt: new Date(),
  }).where(eq(charactersTable.id, char.id));

  return NextResponse.json({
    ok: true,
    ascensions: newAscensions,
    echoBonus: newEchoBonus,
    message: "Ascended! Skills reduced by 30%. Echo bonuses gained.",
  });
}
