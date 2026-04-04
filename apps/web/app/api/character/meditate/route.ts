import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import {
  getMeditationStats, awardSkillXp, initSkill,
  type CharacterSkills,
} from "@repo/engine";

const MAGE_ARCHETYPES = new Set(["Mage", "Priest"]);

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
  if (!char) return NextResponse.json({ error: "No character found" }, { status: 404 });

  const skills = (char.skills ?? {}) as CharacterSkills;
  const medSkill = skills.meditation ?? initSkill();
  const level = medSkill.level ?? 1;

  // ── Cooldown check ──────────────────────────────────────────────────────────
  const isMagicUser = MAGE_ARCHETYPES.has(char.archetype);
  const { hpFraction, powerFraction, cooldownMs } = getMeditationStats(level, isMagicUser);

  if (medSkill.lastUsed) {
    const elapsed = Date.now() - new Date(medSkill.lastUsed).getTime();
    if (elapsed < cooldownMs) {
      const remainingMs = cooldownMs - elapsed;
      return NextResponse.json({
        error:       "Meditating...",
        remainingMs,
        cooldownMs,
      }, { status: 429 });
    }
  }

  // ── Compute recovery ────────────────────────────────────────────────────────
  const maxHp    = char.maxHp    ?? 100;
  const maxPower = char.maxPower ?? 50;

  const hpHealed    = Math.max(1, Math.floor(maxHp    * hpFraction));
  const powerGained = Math.max(1, Math.floor(maxPower * powerFraction));

  const newHp    = Math.min(maxHp,    (char.hp    ?? 0) + hpHealed);
  const newPower = Math.min(maxPower, (char.power ?? 0) + powerGained);

  const actualHpHealed    = newHp    - (char.hp    ?? 0);
  const actualPowerGained = newPower - (char.power ?? 0);

  // ── Award meditation skill XP ───────────────────────────────────────────────
  // XP = 8 base + 1 per skill level (encourages use across all levels)
  const xpAmount = 8 + Math.floor(level / 10);
  const { skill: updatedMedSkill, leveledUp } = awardSkillXp(medSkill, xpAmount);
  updatedMedSkill.lastUsed = new Date().toISOString();

  const updatedSkills: CharacterSkills = { ...skills, meditation: updatedMedSkill };

  // ── Persist ─────────────────────────────────────────────────────────────────
  await db
    .update(charactersTable)
    .set({
      hp:        newHp,
      power:     newPower,
      skills:    updatedSkills,
      updatedAt: new Date(),
    })
    .where(eq(charactersTable.id, char.id));

  return NextResponse.json({
    ok:               true,
    hp:               newHp,
    maxHp,
    power:            newPower,
    maxPower,
    hpHealed:         actualHpHealed,
    powerGained:      actualPowerGained,
    cooldownMs,
    skillLevel:       updatedMedSkill.level,
    skillXp:          updatedMedSkill.xp,
    skillXpToNext:    updatedMedSkill.xpToNext,
    leveledUp,
    isMagicUser,
  });
}
