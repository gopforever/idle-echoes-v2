import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, worldsTable, charactersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ─── Race & class base stats ──────────────────────────────────────────────────

const RACE_STATS: Record<string, Record<string, number>> = {
  Human:      { strength: 10, agility: 10, stamina: 10, intelligence: 10, wisdom: 10, charisma: 12 },
  "Dark Elf": { strength: 8,  agility: 14, stamina: 8,  intelligence: 16, wisdom: 12, charisma: 8  },
  "Wood Elf": { strength: 9,  agility: 16, stamina: 9,  intelligence: 10, wisdom: 12, charisma: 10 },
  "High Elf": { strength: 7,  agility: 12, stamina: 8,  intelligence: 18, wisdom: 14, charisma: 12 },
  Gnome:      { strength: 6,  agility: 14, stamina: 8,  intelligence: 20, wisdom: 12, charisma: 10 },
  Dwarf:      { strength: 14, agility: 8,  stamina: 16, intelligence: 10, wisdom: 12, charisma: 8  },
  Halfling:   { strength: 8,  agility: 16, stamina: 10, intelligence: 10, wisdom: 10, charisma: 14 },
  Barbarian:  { strength: 18, agility: 10, stamina: 16, intelligence: 6,  wisdom: 8,  charisma: 8  },
  "Half Elf": { strength: 10, agility: 12, stamina: 10, intelligence: 12, wisdom: 12, charisma: 14 },
  Kerra:      { strength: 12, agility: 18, stamina: 10, intelligence: 8,  wisdom: 8,  charisma: 10 },
  Ratonga:    { strength: 6,  agility: 18, stamina: 8,  intelligence: 14, wisdom: 8,  charisma: 10 },
  Fae:        { strength: 6,  agility: 14, stamina: 8,  intelligence: 12, wisdom: 16, charisma: 16 },
  Arasai:     { strength: 8,  agility: 14, stamina: 8,  intelligence: 14, wisdom: 10, charisma: 12 },
  Sarnak:     { strength: 14, agility: 10, stamina: 14, intelligence: 10, wisdom: 14, charisma: 6  },
  Ogre:       { strength: 22, agility: 6,  stamina: 20, intelligence: 4,  wisdom: 6,  charisma: 4  },
  Froglok:    { strength: 8,  agility: 14, stamina: 10, intelligence: 12, wisdom: 16, charisma: 10 },
};

const CLASS_ARCHETYPE: Record<string, string> = {
  Guardian: "Fighter", Berserker: "Fighter", Monk: "Fighter", Bruiser: "Fighter",
  Shadowknight: "Fighter", Paladin: "Fighter",
  Assassin: "Scout", Ranger: "Scout", Brigand: "Scout",
  Swashbuckler: "Scout", Troubador: "Scout", Dirge: "Scout",
  Wizard: "Mage", Warlock: "Mage", Conjuror: "Mage",
  Necromancer: "Mage", Illusionist: "Mage", Coercer: "Mage",
  Templar: "Priest", Inquisitor: "Priest", Mystic: "Priest",
  Defiler: "Priest", Warden: "Priest", Fury: "Priest",
};

/** POST /api/character — create a new character */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name: string; race: string; className: string; worldId: string };
  const { name, race, className, worldId } = body;

  if (!name?.trim() || !race || !className || !worldId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify world exists
  const world = await db.select().from(worldsTable).where(eq(worldsTable.id, worldId)).limit(1);
  if (!world.length) return NextResponse.json({ error: "World not found" }, { status: 404 });

  const archetype = CLASS_ARCHETYPE[className] ?? "Fighter";
  const raceStats = RACE_STATS[race] ?? RACE_STATS["Human"]!;
  const maxHp = 10 * (raceStats["stamina"] ?? 10) + 50;
  const maxPower = ((raceStats["wisdom"] ?? 10) + (raceStats["intelligence"] ?? 10)) * 5 + 10 * 10;

  const character = {
    id: createId(),
    userId: user.id,
    worldId,
    name: name.trim(),
    race,
    archetype,
    className,
    level: 1,
    xp: 0,
    xpToNext: 100,
    ascensions: 0,
    echoBonus: {},
    strength:     raceStats["strength"]     ?? 10,
    agility:      raceStats["agility"]      ?? 10,
    stamina:      raceStats["stamina"]      ?? 10,
    intelligence: raceStats["intelligence"] ?? 10,
    wisdom:       raceStats["wisdom"]       ?? 10,
    charisma:     raceStats["charisma"]     ?? 10,
    hp: maxHp,
    maxHp,
    power: maxPower,
    maxPower,
    gold: 50,
    currentZoneId: "zone_0",
    gear: {},
    skills: { combat: 0, archery: 0, defense: 0, magic: 0 },
    aaNodes: {},
    aaPoints: 0,
    totalKills: 0,
    totalDeaths: 0,
    bossKills: 0,
    goldEarned: 50,
    isActive: true,
  };

  await db.insert(charactersTable).values(character);
  return NextResponse.json(character, { status: 201 });
}

/** GET /api/character — get the user's active character */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const characters = await db.select().from(charactersTable)
    .where(eq(charactersTable.userId, user.id))
    .limit(1);

  if (!characters.length) return NextResponse.json(null);
  return NextResponse.json(characters[0]);
}
