CREATE TABLE "worlds" (
	"id" text PRIMARY KEY NOT NULL,
	"seed" bigint NOT NULL,
	"name" text NOT NULL,
	"era" integer DEFAULT 1 NOT NULL,
	"zone_graph" jsonb NOT NULL,
	"faction_web" jsonb NOT NULL,
	"history" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worlds_seed_unique" UNIQUE("seed")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"world_id" text NOT NULL,
	"name" text NOT NULL,
	"race" text NOT NULL,
	"archetype" text NOT NULL,
	"class_name" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"xp_to_next" integer DEFAULT 100 NOT NULL,
	"ascensions" integer DEFAULT 0 NOT NULL,
	"echo_bonus" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"strength" integer DEFAULT 10 NOT NULL,
	"agility" integer DEFAULT 10 NOT NULL,
	"stamina" integer DEFAULT 10 NOT NULL,
	"intelligence" integer DEFAULT 10 NOT NULL,
	"wisdom" integer DEFAULT 10 NOT NULL,
	"charisma" integer DEFAULT 10 NOT NULL,
	"hp" integer DEFAULT 100 NOT NULL,
	"max_hp" integer DEFAULT 100 NOT NULL,
	"power" integer DEFAULT 50 NOT NULL,
	"max_power" integer DEFAULT 50 NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"current_zone_id" text DEFAULT 'zone_0' NOT NULL,
	"gear" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aa_nodes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aa_points" integer DEFAULT 0 NOT NULL,
	"aa_cooldowns" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_kills" integer DEFAULT 0 NOT NULL,
	"total_deaths" integer DEFAULT 0 NOT NULL,
	"boss_kills" integer DEFAULT 0 NOT NULL,
	"gold_earned" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combat_state" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"zone_id" text NOT NULL,
	"enemy_data" jsonb NOT NULL,
	"player_hp" integer NOT NULL,
	"enemy_hp" integer NOT NULL,
	"tick" integer DEFAULT 0 NOT NULL,
	"status_effects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "combat_state_character_id_unique" UNIQUE("character_id")
);
--> statement-breakpoint
CREATE TABLE "ghost_players" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"name" text NOT NULL,
	"race" text NOT NULL,
	"archetype" text NOT NULL,
	"class_name" text NOT NULL,
	"alignment" text NOT NULL,
	"personality" text NOT NULL,
	"traits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"current_zone_id" text NOT NULL,
	"kill_count" integer DEFAULT 0 NOT NULL,
	"death_count" integer DEFAULT 0 NOT NULL,
	"boss_kills" integer DEFAULT 0 NOT NULL,
	"total_gold_earned" integer DEFAULT 0 NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"ancestor_name" text,
	"strength" integer DEFAULT 10 NOT NULL,
	"agility" integer DEFAULT 10 NOT NULL,
	"stamina" integer DEFAULT 10 NOT NULL,
	"intelligence" integer DEFAULT 10 NOT NULL,
	"wisdom" integer DEFAULT 10 NOT NULL,
	"charisma" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"item_data" jsonb NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"slot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"ghost_id" text,
	"zone_id" text NOT NULL,
	"event_type" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat_state" ADD CONSTRAINT "combat_state_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_players" ADD CONSTRAINT "ghost_players_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worlds_seed_idx" ON "worlds" USING btree ("seed");--> statement-breakpoint
CREATE INDEX "characters_user_id_idx" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "characters_world_id_idx" ON "characters" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "ghost_players_world_id_idx" ON "ghost_players" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "inventory_character_id_idx" ON "inventory" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "world_events_world_id_idx" ON "world_events" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "world_events_created_at_idx" ON "world_events" USING btree ("created_at");