import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { awardSkillXp, initSkill, skillXpToLevel, type CharacterSkills, type SkillId } from "@repo/engine";

/**
 * POST /api/character/reset-skills
 *
 * Heals corrupted skill entries where xpToNext was missing (stored without
 * the field, so xp accumulated at level 1 forever). Runs the stored xp
 * through the fixed awardSkillXp so the character gets all overdue level-ups.
 * Safe to call multiple times — skills that are already healthy are untouched.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.userId, user.id))
    .limit(1);

  const char = rows[0];
  if (!char) return NextResponse.json({ error: "No character" }, { status: 404 });

  const skills = (char.skills ?? {}) as CharacterSkills;
  const fixed: CharacterSkills = { ...skills };
  const report: Record<string, string> = {};

  for (const [id, entry] of Object.entries(skills) as [SkillId, typeof skills[SkillId]][]) {
    if (!entry) continue;
    const level   = entry.level   ?? 1;
    const xp      = entry.xp      ?? 0;
    const xpToNext = entry.xpToNext;

    // A skill is "corrupted" if:
    //   • xpToNext is missing/null/0, OR
    //   • xp far exceeds the threshold for the current level (xp > xpToLevel(level+1))
    const expectedXpToNext = skillXpToLevel(level + 1);
    const isCorrupted = !xpToNext || xpToNext <= 0 || xp >= expectedXpToNext;

    if (!isCorrupted) {
      report[id] = `ok (Lv.${level})`;
      continue;
    }

    // Treat stored xp as total accumulated XP from level 1, then re-resolve
    const { skill: healed } = awardSkillXp(initSkill(), xp);
    fixed[id] = healed;
    report[id] = `fixed Lv.${level}→${healed.level} (${xp} XP flushed)`;
  }

  await db
    .update(charactersTable)
    .set({ skills: fixed, updatedAt: new Date() })
    .where(eq(charactersTable.id, char.id));

  return NextResponse.json({ ok: true, report });
}
