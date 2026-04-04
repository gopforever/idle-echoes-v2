import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, charactersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import {
  getMeditationRegen, awardSkillXp, initSkill,
  type CharacterSkills,
} from "@repo/engine";

const MAGE_ARCHETYPES = new Set(["Mage", "Priest"]);

/**
 * POST /api/character/meditate
 *
 * EQ-style passive regeneration tick. Called every 6 seconds by the client
 * when the character is NOT in active combat (i.e. "sitting / meditating").
 * No cooldown — each call grants one tick of HP + Power regeneration and
 * awards a small amount of Meditation skill XP.
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
  if (!char) return NextResponse.json({ error: "No character found" }, { status: 404 });

  const isMagicUser = MAGE_ARCHETYPES.has(char.archetype);
  const skills      = (char.skills ?? {}) as CharacterSkills;
  const medSkill    = skills.meditation ?? initSkill();
  const level       = medSkill.level ?? 1;

  const maxHp    = char.maxHp    ?? 100;
  const maxPower = char.maxPower ?? 50;

  // ── Per-tick regen amounts (EQ formula) ────────────────────────────────────
  const { hpPerTick, powerPerTick } = getMeditationRegen(level, maxHp, maxPower, isMagicUser);

  const newHp    = Math.min(maxHp,    (char.hp    ?? 0) + hpPerTick);
  const newPower = Math.min(maxPower, (char.power ?? 0) + powerPerTick);

  const actualHpHealed    = newHp    - (char.hp    ?? 0);
  const actualPowerGained = newPower - (char.power ?? 0);

  // ── Award meditation skill XP ───────────────────────────────────────────────
  // 3 XP per tick — small but consistent; accumulates quickly from passive use
  const { skill: updatedMedSkill, leveledUp } = awardSkillXp(medSkill, 3);
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
    ok:             true,
    hp:             newHp,
    maxHp,
    power:          newPower,
    maxPower,
    hpHealed:       actualHpHealed,
    powerGained:    actualPowerGained,
    skillLevel:     updatedMedSkill.level,
    skillXp:        updatedMedSkill.xp,
    skillXpToNext:  updatedMedSkill.xpToNext,
    leveledUp,
    isMagicUser,
  });
}
