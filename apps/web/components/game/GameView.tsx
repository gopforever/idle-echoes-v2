"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { WorldMap } from "./WorldMap";
import { CombatPanel } from "./CombatPanel";
import { InventoryPanel } from "./InventoryPanel";
import { SkillsAAPanel } from "./SkillsAAPanel";
import { WorldEventsFeed } from "./WorldEventsFeed";
import { cn } from "@/lib/utils";
import type { CombatInitial } from "./CombatPanel";
import type { ActiveAAResult } from "./SkillsAAPanel";
import type { ZoneGraph, FactionWeb, WorldHistory, GeneratedEnemy } from "@repo/engine";

const MEDITATE_INTERVAL_MS = 6_000; // EQ tick = 6 seconds

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharacterSnapshot {
  id: string;
  name: string;
  className: string;
  archetype: string;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  hp: number;
  maxHp: number;
  power: number;
  maxPower: number;
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
  enemy: GeneratedEnemy;
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

// ─── GameView ─────────────────────────────────────────────────────────────────

export function GameView({ worldName, zoneGraph, factionWeb, history, character, seed }: Props) {
  const isMagicUser = character.archetype === "Mage" || character.archetype === "Priest";

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
        enemy:        data.enemy,
        playerHp:     data.playerHp,
        playerMaxHp:  data.playerMaxHp,
        log:          data.log,
        zoneId:       data.zoneId,
        zoneName:     data.zoneName,
      });
    } finally {
      setIsTraveling(false);
    }
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
    if (result.hp != null) setCharHp(result.hp);
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
        if ((data.hpHealed ?? 0) > 0)    parts.push(`+${data.hpHealed} HP`);
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
      // In combat — stop meditating
      setMeditating(false);
      if (meditateRef.current) { clearInterval(meditateRef.current); meditateRef.current = null; }
    } else {
      // Out of combat — start passive regen
      setMeditating(true);
      meditateRef.current = setInterval(() => void doMeditateTick(), MEDITATE_INTERVAL_MS);
    }
    return () => { if (meditateRef.current) { clearInterval(meditateRef.current); meditateRef.current = null; } };
  }, [combat, doMeditateTick]);

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
      const res = await fetch("/api/character/ascend", { method: "POST" });
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

  const hpPct    = Math.max(0, (charHp    / character.maxHp)    * 100);
  const powerPct = Math.max(0, (charPower / character.maxPower) * 100);
  const xpPct    = Math.min(100, (charXp  / charXpToNext)        * 100);

  return (
    <div className="space-y-4">
      {/* ── Character status bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-sm">
        <span className="font-medium text-foreground">{character.name}</span>
        <span className="text-muted-foreground">Lv.{charLevel} {character.className}</span>

        {/* HP bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400/70">HP</span>
          <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                hpPct > 50 ? "bg-green-500" : hpPct > 25 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{charHp}/{character.maxHp}</span>
        </div>

        {/* Power / Mana bar */}
        <div className="flex items-center gap-2">
          <span className={cn("text-xs", isMagicUser ? "text-blue-400/70" : "text-gray-500/70")}>
            {isMagicUser ? "MP" : "SP"}
          </span>
          <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500",
                isMagicUser ? "bg-blue-500" : "bg-gray-500")}
              style={{ width: `${powerPct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{charPower}/{character.maxPower}</span>
        </div>

        {/* XP bar */}
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">XP</span>
        </div>

        <span className="text-amber-400">{charGold}g</span>

        {/* Ascensions badge */}
        {(character.ascensions ?? 0) > 0 && (
          <span className="text-xs text-purple-400">✦ ×{character.ascensions}</span>
        )}

        {/* Meditation status */}
        <div className="ml-auto flex items-center gap-3">
          {regenFlash && (
            <span className="text-xs text-cyan-300 animate-pulse">{regenFlash}</span>
          )}
          {meditating && !regenFlash && (
            <span className="text-xs text-cyan-500/60 animate-pulse">🧘 Meditating...</span>
          )}
          {!meditating && (
            <span className="text-xs text-gray-500">⚔️ In Combat</span>
          )}

          {/* Ascend button — only at level 60 */}
          {charLevel >= 60 && (
            <button
              onClick={() => void handleAscend()}
              disabled={isAscending}
              className="text-xs px-2 py-1 rounded border border-purple-500/50 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-40"
            >
              {isAscending ? "..." : "🌀 Ascend"}
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout: map left, combat panel right ────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
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

        <div>
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
            <div className="game-panel flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="text-5xl">🗡️</div>
              <h3 className="text-lg font-semibold text-amber-300">Ready for Battle</h3>
              <p className="text-sm text-muted-foreground max-w-48">
                Select a zone and click <strong>Travel Here</strong> to start fighting.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom panels ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InventoryPanel
            currentZoneId={currentZoneId}
            characterLevel={charLevel}
            onGoldUpdate={handleGoldUpdate}
          />
        </div>
        <div className="space-y-4">
          <SkillsAAPanel
            archetype={character.archetype}
            className={character.className}
            ascensions={character.ascensions ?? 0}
            inCombat={combat !== null}
            aaCooldowns={aaCooldowns}
            onActiveAAUsed={handleActiveAAUsed}
          />
          <WorldEventsFeed />
        </div>
      </div>
    </div>
  );
}
