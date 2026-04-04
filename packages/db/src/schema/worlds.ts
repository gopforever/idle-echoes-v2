import { pgTable, text, integer, bigint, jsonb, timestamp, index } from "drizzle-orm/pg-core";

// ─── Worlds ───────────────────────────────────────────────────────────────────
// Each world is generated from a unique 64-bit seed. The same seed always
// produces the same zone graph, faction web, and history timeline.

export const worldsTable = pgTable("worlds", {
  id:          text("id").primaryKey(),            // cuid2
  seed:        bigint("seed", { mode: "number" }).notNull().unique(),
  name:        text("name").notNull(),             // AI-generated world name
  era:         integer("era").notNull().default(1),// increments on each global ascension

  // Generated world data (stored so we don't re-derive on every request)
  zoneGraph:   jsonb("zone_graph").notNull(),      // ZoneGraph type
  factionWeb:  jsonb("faction_web").notNull(),     // FactionWeb type
  history:     jsonb("history").notNull(),         // WorldHistory type

  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("worlds_seed_idx").on(t.seed),
]);
