import {
  pgTable, text, integer, real, boolean,
  jsonb, timestamp, index,
} from "drizzle-orm/pg-core";
import { worldsTable } from "./worlds.js";

// ─── Characters ───────────────────────────────────────────────────────────────

export const charactersTable = pgTable("characters", {
  id:           text("id").primaryKey(),
  userId:       text("user_id").notNull(),
  worldId:      text("world_id").notNull().references(() => worldsTable.id),

  name:         text("name").notNull(),
  race:         text("race").notNull(),
  archetype:    text("archetype").notNull(),   // Fighter / Scout / Mage / Priest
  className:    text("class_name").notNull(),

  level:        integer("level").notNull().default(1),
  xp:           integer("xp").notNull().default(0),
  xpToNext:     integer("xp_to_next").notNull().default(100),

  // Ascension — the prestige loop
  ascensions:   integer("ascensions").notNull().default(0),
  echoBonus:    jsonb("echo_bonus").notNull().default({}), // stat % bonuses carried over

  // Base stats (race + class derived, before gear)
  strength:     integer("strength").notNull().default(10),
  agility:      integer("agility").notNull().default(10),
  stamina:      integer("stamina").notNull().default(10),
  intelligence: integer("intelligence").notNull().default(10),
  wisdom:       integer("wisdom").notNull().default(10),
  charisma:     integer("charisma").notNull().default(10),

  // Resources
  hp:           integer("hp").notNull().default(100),
  maxHp:        integer("max_hp").notNull().default(100),
  power:        integer("power").notNull().default(50),
  maxPower:     integer("max_power").notNull().default(50),
  gold:         integer("gold").notNull().default(0),

  // Location
  currentZoneId: text("current_zone_id").notNull().default("zone_0"),

  // Gear (paperdoll slot → item JSON)
  gear:         jsonb("gear").notNull().default({}),

  // Skills: { combatSkill, archerySkill, defenseSkill, magicSkill, ... }
  skills:       jsonb("skills").notNull().default({}),

  // AA tree: { nodeId → rank }
  aaNodes:      jsonb("aa_nodes").notNull().default({}),
  aaPoints:     integer("aa_points").notNull().default(0),

  // Lifetime stats
  totalKills:   integer("total_kills").notNull().default(0),
  totalDeaths:  integer("total_deaths").notNull().default(0),
  bossKills:    integer("boss_kills").notNull().default(0),
  goldEarned:   integer("gold_earned").notNull().default(0),

  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("characters_user_id_idx").on(t.userId),
  index("characters_world_id_idx").on(t.worldId),
]);

// ─── Ghost Players ────────────────────────────────────────────────────────────
// NPC "world players" that simulate an active server economy and world events.
// Each ghost has individual traits on top of a base personality.

export const ghostPlayersTable = pgTable("ghost_players", {
  id:           text("id").primaryKey(),
  worldId:      text("world_id").notNull().references(() => worldsTable.id),

  name:         text("name").notNull(),
  race:         text("race").notNull(),
  archetype:    text("archetype").notNull(),
  className:    text("class_name").notNull(),
  alignment:    text("alignment").notNull(),  // Qeynos / Freeport / Neutral
  personality:  text("personality").notNull(), // Aggressive/Cautious/Explorer/Greedy/Scholarly/Devout

  // Individual traits that layer on top of personality
  traits:       jsonb("traits").notNull().default({}), // GhostTraits type

  level:        integer("level").notNull().default(1),
  xp:           integer("xp").notNull().default(0),
  gold:         integer("gold").notNull().default(0),
  currentZoneId: text("current_zone_id").notNull(),

  killCount:    integer("kill_count").notNull().default(0),
  deathCount:   integer("death_count").notNull().default(0),
  bossKills:    integer("boss_kills").notNull().default(0),
  totalGoldEarned: integer("total_gold_earned").notNull().default(0),

  // Generation — ghosts "die" and are reborn as descendants
  generation:   integer("generation").notNull().default(1),
  ancestorName: text("ancestor_name"),

  // Stats
  strength:     integer("strength").notNull().default(10),
  agility:      integer("agility").notNull().default(10),
  stamina:      integer("stamina").notNull().default(10),
  intelligence: integer("intelligence").notNull().default(10),
  wisdom:       integer("wisdom").notNull().default(10),
  charisma:     integer("charisma").notNull().default(10),

  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ghost_players_world_id_idx").on(t.worldId),
]);

// ─── World Events ─────────────────────────────────────────────────────────────

export const worldEventsTable = pgTable("world_events", {
  id:           text("id").primaryKey(),
  worldId:      text("world_id").notNull().references(() => worldsTable.id),
  ghostId:      text("ghost_id"),
  zoneId:       text("zone_id").notNull(),
  eventType:    text("event_type").notNull(), // kill/boss/loot/discovery/economy/rivalry
  message:      text("message").notNull(),    // narrative text
  metadata:     jsonb("metadata").notNull().default({}),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("world_events_world_id_idx").on(t.worldId),
  index("world_events_created_at_idx").on(t.createdAt),
]);

// ─── Combat State ─────────────────────────────────────────────────────────────

export const combatStateTable = pgTable("combat_state", {
  id:           text("id").primaryKey(),
  characterId:  text("character_id").notNull().references(() => charactersTable.id).unique(),
  zoneId:       text("zone_id").notNull(),
  enemyData:    jsonb("enemy_data").notNull(),     // current enemy being fought
  playerHp:     integer("player_hp").notNull(),
  enemyHp:      integer("enemy_hp").notNull(),
  tick:         integer("tick").notNull().default(0),
  statusEffects: jsonb("status_effects").notNull().default([]),
  log:          jsonb("log").notNull().default([]), // last N tick messages
  isActive:     boolean("is_active").notNull().default(true),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryTable = pgTable("inventory", {
  id:           text("id").primaryKey(),
  characterId:  text("character_id").notNull().references(() => charactersTable.id),
  itemData:     jsonb("item_data").notNull(),
  quantity:     integer("quantity").notNull().default(1),
  slot:         text("slot"),                       // null = bag, set = equipped
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("inventory_character_id_idx").on(t.characterId),
]);
