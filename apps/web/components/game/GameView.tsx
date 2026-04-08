"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { WorldMap } from "./WorldMap";
import { CombatPanel } from "./CombatPanel";
import { InventoryPanel } from "./InventoryPanel";
import { SkillsAAPanel } from "./SkillsAAPanel";
import { WorldEventsFeed } from "./WorldEventsFeed";
import { GatheringPanel } from "./GatheringPanel";
import { CraftingPanel } from "./CraftingPanel";
import { cn } from "@/lib/utils";
import type { CombatInitial } from "./CombatPanel";
import type { ActiveAAResult } from "./SkillsAAPanel";
import type { ZoneGraph, FactionWeb, WorldHistory, GeneratedItem, GatherResult } from "@repo/engine";

const MEDITATE_INTERVAL_MS = 6_000;  // EQ tick = 6 seconds
const GATHER_INTERVAL_MS  = 30_000; // Gathering tick = 30 seconds

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharacterSnapshot {
  id: string;
  name: string;
  className: string;
  archetype: string;
  race: string;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  aaPoints: number;
  hp: number;
  maxHp: number;
  power: number;
  maxPower: number;
  strength: number;
  agility: number;
  stamina: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  currentZoneId: string;
  ascensions: number;
}

interface Props {
  worldName: string;
  zoneGraph: ZoneGraph;
  factionWeb: FactionWeb;
  history: WorldHistory;
  character: CharacterSnapshot;
  seed: number;
}

interface StartResponse {
  ok: boolean;
  error?: string;
  enemy: import("@repo/engine").GeneratedEnemy;
  playerHp: number;
  playerMaxHp: number;
  log: string[];
  zoneId: string;
  zoneName: string;
}

interface MeditateResponse {
  ok?: boolean;
  error?: string;
  hp?: number;
  power?: number;
  hpHealed?: number;
  powerGained?: number;
  skillLevel?: number;
  leveledUp?: boolean;
  isMagicUser?: boolean;
}

interface AscendResponse {
  ok?: boolean;
  error?: string;
  ascensions?: number;
  message?: string;
}

interface InventoryApiResponse {
  gear: Record<string, GeneratedItem>;
  items: Array<{ id: string; slot: string | null; itemData: unknown; quantity: number }>;
}

type NavId =
  | "dashboard" | "combat" | "character" | "inventory" | "bank" | "skills"
  | "gathering" | "crafting" | "dungeons" | "zones" | "auction" | "factions"
  | "achievements" | "aa" | "adornments" | "collections" | "mounts" | "living_world";

interface NavItem {
  id: NavId;
  label: string;
  icon: string;
  stub?: boolean;
}

interface NavSection {
  heading: string | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: null,
    items: [
      { id: "dashboard",  label: "Dashboard",  icon: "📊" },
      { id: "combat",     label: "Combat",     icon: "⚔️" },
      { id: "character",  label: "Character",  icon: "🧙" },
      { id: "inventory",  label: "Inventory",  icon: "🎒" },
      { id: "bank",       label: "Bank",       icon: "🏦", stub: true },
      { id: "skills",     label: "Skills",     icon: "⚡" },
      { id: "gathering",  label: "Gathering",  icon: "🌿" },
      { id: "crafting",   label: "Crafting",   icon: "🔨" },
    ],
  },
  {
    heading: "EVERQUEST II",
    items: [
      { id: "dungeons",     label: "Dungeons",       icon: "🗡️", stub: true },
      { id: "zones",        label: "Zones",          icon: "🗺️" },
      { id: "auction",      label: "Auction Hall",   icon: "🏛️", stub: true },
      { id: "factions",     label: "Factions",       icon: "⚑",  stub: true },
      { id: "achievements", label: "Achievements",   icon: "🏆", stub: true },
      { id: "aa",           label: "Adv. Abilities", icon: "✨" },
      { id: "adornments",   label: "Adornments",     icon: "💎", stub: true },
      { id: "collections",  label: "Collections",    icon: "📚", stub: true },
      { id: "mounts",       label: "Mounts",         icon: "🐴", stub: true },
      { id: "living_world", label: "Living World",   icon: "🌍" },
    ],
  },
];

const STUB_IDS: NavId[] = [
  "bank", "dungeons", "auction",
  "factions", "achievements", "adornments", "collections", "mounts",
];

// ─── Sub-panel components ─────────────────────────────────────────────────────

function StubPanel({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 p-8">
      <div className="text-5xl opacity-30">🚧</div>
      <h3 className="text-lg font-semibold text-muted-foreground capitalize">
        {name.replace(/_/g, " ")}
      </h3>
      <p className="text-sm text-muted-foreground/60">Coming in a future update.</p>
    </div>
  );
}

function DashboardPanel({
  charLevel, charHp, charMaxHp, charPower, charMaxPower,
  charGold, charXp, charXpToNext, meditating, combat, character,
}: {
  charLevel: number; charHp: number; charMaxHp: number; charPower: number; charMaxPower: number;
  charGold: number; charXp: number; charXpToNext: number; meditating: boolean;
  combat: CombatInitial | null; character: CharacterSnapshot;
}) {
  const hpPct = Math.max(0, (charHp / charMaxHp) * 100);
  const xpPct = Math.min(100, (charXp / charXpToNext) * 100);
  void charPower; void charMaxPower; void character;
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold text-amber-300">Dashboard</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Level",  value: charLevel,                                         color: "text-foreground" },
          { label: "Gold",   value: `${charGold.toLocaleString()}g`,                  color: "text-amber-400" },
          { label: "HP",     value: `${charHp}/${charMaxHp}`,                         color: "text-green-400" },
          { label: "Status", value: meditating ? "🧘 Resting" : "⚔️ Combat",          color: meditating ? "text-cyan-400" : "text-red-400" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-lg border border-border bg-card text-center">
            <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="p-4 rounded-lg border border-border bg-card space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Level {charLevel} XP</span>
          <span className="tabular-nums">{charXp} / {charXpToNext}</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${hpPct > 0 ? xpPct : 0}%` }}
          />
        </div>
      </div>
      <div className="p-4 rounded-lg border border-border bg-card space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Health</span>
          <span className="tabular-nums">{charHp} / {charMaxHp}</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", hpPct > 50 ? "bg-green-500" : hpPct > 25 ? "bg-yellow-500" : "bg-red-500")}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>
      {combat && (
        <div className="p-4 rounded-lg border border-red-800/50 bg-red-950/20 text-sm text-red-300">
          ⚔️ In combat — switch to <strong>Combat</strong> to manage the fight.
        </div>
      )}
    </div>
  );
}

function CharacterSheetPanel({
  character, charLevel, charXp, charXpToNext, charGold, charHp, charPower,
  isMagicUser, meditating, regenFlash, aaPoints,
}: {
  character: CharacterSnapshot;
  charLevel: number; charXp: number; charXpToNext: number; charGold: number;
  charHp: number; charPower: number; isMagicUser: boolean;
  meditating: boolean; regenFlash: string | null; aaPoints: number;
}) {
  const [tab, setTab] = useState<"overview" | "attributes" | "lore" | "progression" | "profile">("overview");
  const [gear, setGear] = useState<Record<string, GeneratedItem>>({});
  const [gearTotals, setGearTotals] = useState<Record<string, number>>({});
  const [gearScore, setGearScore] = useState(0);

  useEffect(() => {
    fetch("/api/inventory")
      .then(r => r.json())
      .then((data: InventoryApiResponse) => {
        const g = data.gear ?? {};
        setGear(g);
        const totals: Record<string, number> = {};
        let score = 0;
        for (const item of Object.values(g)) {
          score += item.level ?? 0;
          for (const [k, v] of Object.entries(item.stats)) {
            if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
          }
        }
        setGearTotals(totals);
        setGearScore(score);
      })
      .catch(() => {});
  }, []);

  const sta        = character.stamina    + (gearTotals.stamina    ?? 0);
  const agi        = character.agility    + (gearTotals.agility    ?? 0);
  const mitigation = Math.min(80, Math.round((0.05 + (0.8 * sta + 3 * charLevel + (gearTotals.mitigation ?? 0)) / 500 + 1 * 0.002) * 100));
  const avoidance  = Math.min(70, Math.round((0.03 + (0.5 * agi + 0.8 * charLevel + 5 + (gearTotals.avoidance ?? 0)) / 300 + 1 * 0.0015) * 100));
  const critChance = Math.min(60, Math.round((0.05 + (gearTotals.critChance ?? 0) / 100) * 100));
  const hasteVal   = gearTotals.haste ?? 0;
  const attackVal  = (gearTotals.attackRating  ?? 0) + Math.floor(character.strength / 2);
  const defenseVal = (gearTotals.defenseRating ?? 0) + Math.floor(character.agility  / 2);
  const dmgMin     = gearTotals.weaponDamageMin ?? 0;
  const dmgMax     = gearTotals.weaponDamageMax ?? 0;
  const dps        = dmgMin > 0 ? ((dmgMin + dmgMax) / 2 * (1 + critChance / 100 * 0.5)).toFixed(1) : "—";

  const hpPct    = Math.max(0, (charHp    / character.maxHp)    * 100);
  const powerPct = Math.max(0, (charPower / character.maxPower) * 100);
  const xpPct    = Math.min(100, (charXp  / charXpToNext)        * 100);

  const SLOT_LABEL: Record<string, string> = {
    head: "Head", chest: "Chest", shoulder: "Shoulder", back: "Back",
    wrist: "Wrist", hands: "Hands", waist: "Waist", legs: "Legs", feet: "Feet",
    primary: "Main Hand", secondary: "Off Hand",
    neck: "Neck", earLeft: "Ear L", earRight: "Ear R",
    ringLeft: "Ring L", ringRight: "Ring R", charm: "Charm",
  };

  const PAPERDOLL_LAYOUT: (string | null)[][] = [
    [null,       "earLeft",  "head",      "earRight",  null       ],
    [null,       "neck",     null,        "wrist",     null       ],
    ["shoulder", null,       "chest",     null,        "back"     ],
    [null,       null,       null,        null,        "hands"    ],
    ["ringLeft", null,       "waist",     null,        "ringRight"],
    [null,       "primary",  null,        "secondary", null       ],
    [null,       null,       "legs",      null,        null       ],
    [null,       "feet",     null,        "charm",     null       ],
  ];

  const RARITY_COLORS: Record<string, string> = {
    common:    "border-gray-600 text-gray-300",
    uncommon:  "border-green-700 text-green-400",
    rare:      "border-blue-700 text-blue-400",
    legendary: "border-orange-700 text-orange-400",
    fabled:    "border-purple-600 text-purple-400",
    mythical:  "border-amber-500 text-amber-300",
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Top section */}
      <div className="flex items-start gap-5">
        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-amber-900/60 to-amber-700/30 border border-amber-500/40 flex items-center justify-center text-2xl font-bold text-amber-300 shrink-0">
          {character.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-amber-300 leading-tight">{character.name}</h2>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <span className="badge-tag">{character.race}</span>
            <span className="badge-tag badge-tag-green">{character.archetype} → {character.className}</span>
            <span className="badge-tag badge-tag-blue">
              🌍 {character.currentZoneId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
          <div className="flex flex-wrap gap-5 mt-3 text-center">
            {[
              { label: "Level",      value: charLevel,                  color: "text-foreground"   },
              { label: "Gold",       value: charGold.toLocaleString(),  color: "text-amber-400"    },
              { label: "AA",         value: aaPoints,                   color: "text-amber-300"    },
              { label: "Ascensions", value: character.ascensions,       color: "text-purple-400"   },
            ].map(s => (
              <div key={s.label}>
                <div className={cn("text-lg font-bold tabular-nums leading-tight", s.color)}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HP / Power / XP bars */}
      <div className="space-y-2.5 max-w-lg">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Level {charLevel} XP</span>
            <span className="tabular-nums text-muted-foreground">{charXp} / {charXpToNext}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center gap-1.5 text-red-400">❤️ Health</span>
            <span className="tabular-nums text-sm">{charHp} / {character.maxHp}</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700",
                hpPct > 50 ? "bg-green-500" : hpPct > 25 ? "bg-yellow-500" : "bg-red-500")}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className={cn("flex items-center gap-1.5", isMagicUser ? "text-blue-400" : "text-gray-400")}>
              {isMagicUser ? "🔷" : "⚡"} {isMagicUser ? "Power" : "Stamina"}
            </span>
            <span className="tabular-nums text-sm">{charPower} / {character.maxPower}</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", isMagicUser ? "bg-blue-500" : "bg-gray-500")}
              style={{ width: `${powerPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Meditate row */}
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium",
          meditating
            ? "border-green-600 bg-green-900/20 text-green-300"
            : "border-gray-700 text-gray-500",
        )}>
          🧘 {meditating ? "Meditating" : "In Combat"}
        </div>
        {regenFlash && (
          <span className="text-sm text-cyan-300 animate-pulse">{regenFlash}</span>
        )}
        {meditating && !regenFlash && (
          <span className="text-xs text-muted-foreground">
            Passive: +{((1 + (charLevel - 1) * 0.001) * character.maxHp * 0.01).toFixed(1)} HP / +{(2 + Math.floor(1 / 15))} Pwr / tick
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(["overview", "attributes", "lore", "progression", "profile"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm capitalize font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Paper doll */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Equipment — Paper Doll
            </h3>
            <div className="space-y-1.5">
              {PAPERDOLL_LAYOUT.map((row, ri) => (
                <div key={ri} className="grid grid-cols-5 gap-1.5">
                  {row.map((slot, ci) => {
                    if (!slot) return <div key={ci} />;
                    const item = gear[slot];
                    const rarClass = item ? (RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common) : "";
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "rounded border p-1.5 text-center transition-colors",
                          item ? cn("bg-gray-900/60", rarClass) : "border-dashed border-gray-700/50",
                        )}
                      >
                        <div className="text-muted-foreground/60 leading-tight" style={{ fontSize: "9px" }}>
                          {SLOT_LABEL[slot]}
                        </div>
                        {item ? (
                          <div className="leading-tight mt-0.5 truncate" style={{ fontSize: "9px" }}>
                            {item.name.split(" ").slice(0, 2).join(" ")}
                          </div>
                        ) : (
                          <div className="text-gray-700 mt-0.5" style={{ fontSize: "9px" }}>—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* At a Glance */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              ⚡ At a Glance
            </h3>
            <div className="space-y-2">
              {[
                { label: "Gear Score",  value: gearScore,                               color: "text-foreground" },
                { label: "DPS",         value: dps,                                     color: "text-amber-400" },
                { label: "Attack",      value: attackVal,                               color: "text-amber-300" },
                { label: "Defense",     value: defenseVal,                              color: "text-blue-400" },
                { label: "Mitigation",  value: `${mitigation}%`,                       color: "text-green-400" },
                { label: "Avoidance",   value: avoidance > 0 ? `${avoidance}%` : "—", color: "text-cyan-400" },
                { label: "Crit Chance", value: `${critChance}%`,                       color: "text-orange-400" },
                { label: "Haste",       value: `${hasteVal}%`,                         color: hasteVal > 0 ? "text-yellow-400" : "text-muted-foreground" },
                { label: "Weapon Dmg",  value: dmgMin > 0 ? `${dmgMin}–${dmgMax}` : "Unarmed", color: "text-red-400" },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className={cn("text-sm font-medium tabular-nums", s.color)}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "attributes" && (
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          {[
            { label: "Strength",     key: "strength"     as const, icon: "💪", color: "text-red-400"    },
            { label: "Agility",      key: "agility"      as const, icon: "🏃", color: "text-green-400"  },
            { label: "Stamina",      key: "stamina"      as const, icon: "❤️", color: "text-orange-400" },
            { label: "Intelligence", key: "intelligence" as const, icon: "🧠", color: "text-blue-400"   },
            { label: "Wisdom",       key: "wisdom"       as const, icon: "📖", color: "text-purple-400" },
            { label: "Charisma",     key: "charisma"     as const, icon: "✨", color: "text-yellow-400" },
          ].map(a => (
            <div key={a.key} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2">
                <span>{a.icon}</span>
                <span className="text-sm text-muted-foreground">{a.label}</span>
              </div>
              <span className={cn("text-lg font-bold tabular-nums", a.color)}>
                {character[a.key] as number}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "lore" && (
        <div className="max-w-lg space-y-3 text-sm text-muted-foreground">
          <p>A {character.race} {character.className} of the {character.archetype} archetype, making their mark on the world.</p>
          <p>Currently exploring the lands, growing in power with each echo of the past that shapes their journey.</p>
          {character.ascensions > 0 && (
            <p className="text-purple-300">
              This adventurer has ascended <strong>{character.ascensions}×</strong>, carrying the weight of past lives as eternal echoes.
            </p>
          )}
        </div>
      )}

      {tab === "progression" && (
        <div className="space-y-4 max-w-md">
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <h4 className="text-sm font-medium text-amber-300">Level Progress</h4>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Level {charLevel}</span>
                <span>{charXp} / {charXpToNext} XP</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${xpPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{charXpToNext - charXp} XP to next level</p>
            </div>
          </div>
          {character.ascensions > 0 && (
            <div className="p-4 rounded-lg border border-purple-700/50 bg-purple-950/20 space-y-1">
              <h4 className="text-sm font-medium text-purple-300">Ascension ✦ ×{character.ascensions}</h4>
              <p className="text-xs text-muted-foreground">Each ascension grants permanent echo bonuses to all stats.</p>
            </div>
          )}
          <div className="p-4 rounded-lg border border-border bg-card">
            <h4 className="text-sm font-medium text-amber-300 mb-2">AA Points</h4>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{aaPoints}</p>
            <p className="text-xs text-muted-foreground">Available to spend in Adv. Abilities</p>
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="space-y-4 max-w-sm">
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Account</h4>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="w-full py-2 rounded-lg border border-red-700/50 text-red-400 text-sm hover:bg-red-950/30 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GameView ─────────────────────────────────────────────────────────────────

export function GameView({ worldName, zoneGraph, factionWeb, history, character, seed }: Props) {
  const isMagicUser = character.archetype === "Mage" || character.archetype === "Priest";

  const [activePanel, setActivePanel] = useState<NavId>("dashboard");
  const [currentZoneId, setCurrentZoneId] = useState(character.currentZoneId);
  const [combat, setCombat]               = useState<CombatInitial | null>(null);
  const [isTraveling, setIsTraveling]     = useState(false);

  // Shared character stats (updated from CombatPanel tick responses)
  const [charLevel,    setCharLevel]    = useState(character.level);
  const [charXp,       setCharXp]       = useState(character.xp);
  const [charXpToNext, setCharXpToNext] = useState(character.xpToNext);
  const [charGold,     setCharGold]     = useState(character.gold);
  const [charHp,       setCharHp]       = useState(character.hp);
  const [charPower,    setCharPower]    = useState(character.power);
  const [aaCooldowns,  setAaCooldowns]  = useState<Record<string, number>>({});
  const [isAscending,  setIsAscending]  = useState(false);

  // Passive meditation regen (runs every 6s when not in combat)
  const meditateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [meditating, setMeditating] = useState(false);
  const [regenFlash, setRegenFlash] = useState<string | null>(null);

  // Gathering tick (runs every 30s when not in combat)
  const gatherRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recentYields, setRecentYields] = useState<GatherResult[]>([]);

  // Called by WorldMap "Travel Here" button
  async function handleTravel(zoneId: string, zoneName: string) {
    setIsTraveling(true);
    try {
      const res  = await fetch("/api/combat/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ zoneId }),
      });
      const data = await res.json() as StartResponse;
      if (!res.ok || data.error) return;

      setCurrentZoneId(zoneId);
      setCharHp(data.playerHp);
      setCombat({
        enemy:       data.enemy,
        playerHp:    data.playerHp,
        playerMaxHp: data.playerMaxHp,
        log:         data.log,
        zoneId:      data.zoneId,
        zoneName:    data.zoneName,
      });
      // Auto-switch to combat panel
      setActivePanel("combat");
    } finally {
      setIsTraveling(false);
    }
    void zoneName;
  }

  // Called by CombatPanel on each tick
  const handleStatsUpdate = useCallback((stats: {
    level: number; xp: number; xpToNext: number; gold: number; hp: number;
  }) => {
    setCharLevel(stats.level);
    setCharXp(stats.xp);
    setCharXpToNext(stats.xpToNext);
    setCharGold(stats.gold);
    setCharHp(stats.hp);
  }, []);

  // Handle active AA ability used during combat
  const handleActiveAAUsed = useCallback((nodeId: string, result: ActiveAAResult) => {
    if (result.hp    != null) setCharHp(result.hp);
    if (result.power != null) setCharPower(result.power);
    if (result.cooldownUntil != null) {
      setAaCooldowns(prev => ({ ...prev, [nodeId]: result.cooldownUntil! }));
    }
  }, []);

  // ── Passive meditation tick ──────────────────────────────────────────────────
  const doMeditateTick = useCallback(async () => {
    try {
      const res  = await fetch("/api/character/meditate", { method: "POST" });
      const data = await res.json() as MeditateResponse;
      if (!data.ok) return;
      if (data.hp    != null) setCharHp(data.hp);
      if (data.power != null) setCharPower(data.power);
      if ((data.hpHealed ?? 0) > 0 || (data.powerGained ?? 0) > 0) {
        const parts: string[] = [];
        if ((data.hpHealed    ?? 0) > 0) parts.push(`+${data.hpHealed} HP`);
        if ((data.powerGained ?? 0) > 0) parts.push(`+${data.powerGained} ${isMagicUser ? "MP" : "SP"}`);
        const msg = `🧘 ${parts.join("  ")}${data.leveledUp ? ` · Meditation Lv.${data.skillLevel}!` : ""}`;
        setRegenFlash(msg);
        setTimeout(() => setRegenFlash(null), 4_000);
      }
    } catch { /* ignore — passive, non-critical */ }
  }, [isMagicUser]);

  // Start/stop meditation interval based on whether player is in combat
  useEffect(() => {
    if (combat) {
      setMeditating(false);
      if (meditateRef.current) { clearInterval(meditateRef.current); meditateRef.current = null; }
    } else {
      setMeditating(true);
      meditateRef.current = setInterval(() => void doMeditateTick(), MEDITATE_INTERVAL_MS);
    }
    return () => { if (meditateRef.current) { clearInterval(meditateRef.current); meditateRef.current = null; } };
  }, [combat, doMeditateTick]);

  // ── Gathering tick ───────────────────────────────────────────────────────────
  const doGatheringTick = useCallback(async () => {
    try {
      const res  = await fetch("/api/gathering/tick", { method: "POST" });
      const data = await res.json() as { ok: boolean; results?: GatherResult[] };
      if (data.ok && data.results && data.results.length > 0) {
        setRecentYields(prev => [...prev, ...data.results!].slice(-20));
      }
    } catch { /* passive, non-critical */ }
  }, []);

  // Start/stop gathering interval based on whether player is in combat
  useEffect(() => {
    if (combat) {
      if (gatherRef.current) { clearInterval(gatherRef.current); gatherRef.current = null; }
    } else {
      gatherRef.current = setInterval(() => void doGatheringTick(), GATHER_INTERVAL_MS);
    }
    return () => { if (gatherRef.current) { clearInterval(gatherRef.current); gatherRef.current = null; } };
  }, [combat, doGatheringTick]);

  function handleFlee() {
    setCombat(null);
  }

  const handleGoldUpdate = useCallback((gold: number) => {
    setCharGold(gold);
  }, []);

  // Ascend handler
  async function handleAscend() {
    if (!confirm("Ascend? Your level resets to 1, skills reduced by 30%, and you gain permanent echo bonuses.")) return;
    setIsAscending(true);
    try {
      const res  = await fetch("/api/character/ascend", { method: "POST" });
      const data = await res.json() as AscendResponse;
      if (data.ok) {
        alert(`${data.message ?? "Ascended!"} (Ascension #${data.ascensions ?? "?"})`);
        window.location.reload();
      } else {
        alert(data.error ?? "Failed to ascend");
      }
    } finally {
      setIsAscending(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-card overflow-y-auto">
        {/* Brand */}
        <div className="px-4 py-3 border-b border-border">
          <h1 className="text-amber-300 font-bold text-lg tracking-tight">Idle Echoes</h1>
          <p className="text-xs text-muted-foreground truncate">{character.name}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className="mb-1">
              {section.heading && (
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  {section.heading}
                </div>
              )}
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                    activePanel === item.id
                      ? "bg-amber-500/15 text-amber-300 font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    item.stub && "opacity-60",
                  )}
                >
                  <span className="text-base leading-none w-5 text-center">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                  {item.id === "combat" && combat !== null && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom: ascend button */}
        <div className="p-3 border-t border-border space-y-2">
          {(character.ascensions ?? 0) > 0 && (
            <div className="text-xs text-center text-purple-400">✦ Ascension ×{character.ascensions}</div>
          )}
          {charLevel >= 60 && (
            <button
              onClick={() => void handleAscend()}
              disabled={isAscending}
              className="w-full text-xs py-1.5 rounded border border-purple-500/50 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-40"
            >
              {isAscending ? "..." : "🌀 Ascend"}
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Dashboard */}
        {activePanel === "dashboard" && (
          <DashboardPanel
            charLevel={charLevel}
            charHp={charHp}
            charMaxHp={character.maxHp}
            charPower={charPower}
            charMaxPower={character.maxPower}
            charGold={charGold}
            charXp={charXp}
            charXpToNext={charXpToNext}
            meditating={meditating}
            combat={combat}
            character={character}
          />
        )}

        {/* Combat */}
        {activePanel === "combat" && (
          <div className="p-6">
            {combat ? (
              <CombatPanel
                initialState={combat}
                characterLevel={charLevel}
                characterXp={charXp}
                characterXpToNext={charXpToNext}
                characterGold={charGold}
                onFlee={handleFlee}
                onStatsUpdate={handleStatsUpdate}
              />
            ) : (
              <div className="game-panel flex flex-col items-center justify-center py-12 text-center space-y-3 max-w-md">
                <div className="text-5xl">🗡️</div>
                <h3 className="text-lg font-semibold text-amber-300">Ready for Battle</h3>
                <p className="text-sm text-muted-foreground max-w-48">
                  Select a zone in <strong>Zones</strong> and click <strong>Travel Here</strong> to start fighting.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Character sheet */}
        {activePanel === "character" && (
          <CharacterSheetPanel
            character={character}
            charLevel={charLevel}
            charXp={charXp}
            charXpToNext={charXpToNext}
            charGold={charGold}
            charHp={charHp}
            charPower={charPower}
            isMagicUser={isMagicUser}
            meditating={meditating}
            regenFlash={regenFlash}
            aaPoints={character.aaPoints}
          />
        )}

        {/* Inventory */}
        {activePanel === "inventory" && (
          <div className="p-6">
            <InventoryPanel
              currentZoneId={currentZoneId}
              characterLevel={charLevel}
              onGoldUpdate={handleGoldUpdate}
            />
          </div>
        )}

        {/* Skills */}
        {activePanel === "skills" && (
          <div className="p-6">
            <SkillsAAPanel
              archetype={character.archetype}
              className={character.className}
              ascensions={character.ascensions ?? 0}
              inCombat={combat !== null}
              aaCooldowns={aaCooldowns}
              onActiveAAUsed={handleActiveAAUsed}
            />
          </div>
        )}

        {/* Zones */}
        {activePanel === "zones" && (
          <div className="p-6">
            <WorldMap
              worldName={worldName}
              zoneGraph={zoneGraph}
              factionWeb={factionWeb}
              history={history}
              currentZoneId={currentZoneId}
              characterLevel={charLevel}
              seed={seed}
              onTravel={handleTravel}
              isTraveling={isTraveling}
            />
          </div>
        )}

        {/* AA */}
        {activePanel === "aa" && (
          <div className="p-6">
            <SkillsAAPanel
              archetype={character.archetype}
              className={character.className}
              ascensions={character.ascensions ?? 0}
              inCombat={combat !== null}
              aaCooldowns={aaCooldowns}
              onActiveAAUsed={handleActiveAAUsed}
            />
          </div>
        )}

        {/* Gathering */}
        {activePanel === "gathering" && (
          <div className="p-6">
            <GatheringPanel
              inCombat={combat !== null}
              currentZoneId={currentZoneId}
              recentYields={recentYields}
            />
          </div>
        )}

        {/* Crafting */}
        {activePanel === "crafting" && (
          <div className="p-6">
            <CraftingPanel />
          </div>
        )}

        {/* Living World */}
        {activePanel === "living_world" && (
          <div className="p-6">
            <WorldEventsFeed />
          </div>
        )}

        {/* Stub panels */}
        {STUB_IDS.includes(activePanel) && (
          <StubPanel name={activePanel} />
        )}
      </div>
    </div>
  );
}
