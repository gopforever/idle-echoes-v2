"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { WorldMap } from "./WorldMap";
import { CombatPanel } from "./CombatPanel";
import { InventoryPanel } from "./InventoryPanel";
import { SkillsAAPanel } from "./SkillsAAPanel";
import { WorldEventsFeed } from "./WorldEventsFeed";
import { cn } from "@/lib/utils";
import type { CombatInitial } from "./CombatPanel";
import type { ZoneGraph, FactionWeb, WorldHistory, GeneratedEnemy } from "@repo/engine";

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
  remainingMs?: number;
  cooldownMs?: number;
  hp?: number;
  maxHp?: number;
  power?: number;
  maxPower?: number;
  hpHealed?: number;
  powerGained?: number;
  skillLevel?: number;
  leveledUp?: boolean;
  isMagicUser?: boolean;
}

// ─── MeditateButton ───────────────────────────────────────────────────────────

function MeditateButton({
  hp, maxHp, power, maxPower, isMagicUser,
  onHeal,
}: {
  hp: number; maxHp: number; power: number; maxPower: number;
  isMagicUser: boolean;
  onHeal: (hp: number, power: number, msg: string) => void;
}) {
  const [cooldownMs,  setCooldownMs]  = useState(0);
  const [remaining,   setRemaining]   = useState(0);
  const [busy,        setBusy]        = useState(false);
  const [flash,       setFlash]       = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick down the cooldown display every second
  useEffect(() => {
    if (remaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        const next = r - 1000;
        if (next <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [remaining]);

  async function handleMeditate() {
    if (busy || remaining > 0) return;
    setBusy(true);
    try {
      const res  = await fetch("/api/character/meditate", { method: "POST" });
      const data = await res.json() as MeditateResponse;

      if (res.status === 429 && data.remainingMs) {
        // Already on cooldown (e.g. just refreshed the page)
        setCooldownMs(data.cooldownMs ?? 90_000);
        setRemaining(data.remainingMs);
        return;
      }
      if (data.error && !data.ok) {
        setFlash(`❌ ${data.error}`);
        setTimeout(() => setFlash(null), 2500);
        return;
      }

      const newHp    = data.hp    ?? hp;
      const newPower = data.power ?? power;
      const healed   = data.hpHealed    ?? 0;
      const powered  = data.powerGained ?? 0;

      let msg = `🧘 +${healed} HP`;
      if (isMagicUser || powered > 0) msg += ` +${powered} Power`;
      if (data.leveledUp) msg += ` · Meditation Lv.${data.skillLevel}!`;

      onHeal(newHp, newPower, msg);

      const cd = data.cooldownMs ?? 90_000;
      setCooldownMs(cd);
      setRemaining(cd);
    } finally {
      setBusy(false);
    }
  }

  const pct  = cooldownMs > 0 ? Math.max(0, remaining / cooldownMs) : 0;
  const secs = Math.ceil(remaining / 1000);
  const canMeditate = remaining <= 0 && !busy;

  return (
    <div className="flex items-center gap-2">
      {flash && (
        <span className="text-xs text-cyan-300 animate-pulse">{flash}</span>
      )}
      <div className="relative">
        <button
          onClick={() => void handleMeditate()}
          disabled={!canMeditate}
          className={cn(
            "relative overflow-hidden text-xs px-3 py-1 rounded border transition-colors font-medium",
            canMeditate
              ? "border-cyan-500/60 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20"
              : "border-gray-700 text-gray-500 cursor-not-allowed"
          )}
        >
          {/* cooldown progress fill */}
          {pct > 0 && (
            <span
              className="absolute inset-0 bg-cyan-900/30 origin-left transition-none"
              style={{ transform: `scaleX(${pct})` }}
            />
          )}
          <span className="relative">
            {busy           ? "..." :
             remaining > 0  ? `🧘 ${secs}s` :
                              "🧘 Meditate"}
          </span>
        </button>
      </div>
    </div>
  );
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

  // Flash message for meditate heals
  const [healFlash, setHealFlash] = useState<string | null>(null);

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

  function handleFlee() {
    setCombat(null);
  }

  const handleGoldUpdate = useCallback((gold: number) => {
    setCharGold(gold);
  }, []);

  function handleMeditateHeal(newHp: number, newPower: number, msg: string) {
    setCharHp(newHp);
    setCharPower(newPower);
    setHealFlash(msg);
    setTimeout(() => setHealFlash(null), 3000);
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

        {/* Meditate button */}
        <div className="ml-auto flex items-center gap-3">
          {healFlash && (
            <span className="text-xs text-cyan-300 animate-pulse">{healFlash}</span>
          )}
          <MeditateButton
            hp={charHp}
            maxHp={character.maxHp}
            power={charPower}
            maxPower={character.maxPower}
            isMagicUser={isMagicUser}
            onHeal={handleMeditateHeal}
          />
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
          <SkillsAAPanel />
          <WorldEventsFeed />
        </div>
      </div>
    </div>
  );
}
