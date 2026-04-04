"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { GeneratedEnemy } from "@repo/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusEffect {
  id: string;
  name: string;
  type: string;
  value: number;
  remainingTicks: number;
}

interface TickResponse {
  tick: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemy: GeneratedEnemy;
  statusEffects: StatusEffect[];
  log: string[];
  leveledUp: boolean;
  newLevel: number;
  newXp: number;
  newXpToNext: number;
  newGold: number;
  noCombat?: boolean;
}

interface CombatState {
  tick: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemy: GeneratedEnemy;
  statusEffects: StatusEffect[];
  log: string[];
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
}

export interface CombatInitial {
  enemy: GeneratedEnemy;
  playerHp: number;
  playerMaxHp: number;
  log: string[];
  zoneId: string;
  zoneName: string;
}

interface Props {
  initialState: CombatInitial;
  characterLevel: number;
  characterXp: number;
  characterXpToNext: number;
  characterGold: number;
  onFlee: () => void;
  onStatsUpdate: (stats: { level: number; xp: number; xpToNext: number; gold: number; hp: number }) => void;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const ELEMENT_COLOR: Record<string, string> = {
  fire:     "text-red-400",
  ice:      "text-blue-300",
  void:     "text-purple-400",
  divine:   "text-yellow-300",
  poison:   "text-green-400",
  physical: "text-gray-300",
};

const ROLE_ICON: Record<string, string> = {
  striker: "⚔️",
  tank:    "🛡️",
  caster:  "🔮",
  support: "💫",
};

function logColor(entry: string): string {
  if (entry.includes("CRIT") || entry.includes("LEVEL UP")) return "text-amber-300 font-semibold";
  if (entry.includes("💀") || entry.includes("Defeated")) return "text-red-400";
  if (entry.includes("appears") || entry.includes("lurks")) return "text-blue-300";
  if (entry.includes("💎")) return "text-purple-300";
  if (entry.includes("🏆")) return "text-green-300";
  if (entry.includes("🌟")) return "text-amber-400 font-semibold";
  if (entry.includes("💥") || entry.includes("☠️")) return "text-orange-400";
  if (entry.includes("🛡️")) return "text-cyan-400";
  return "text-muted-foreground";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CombatPanel({
  initialState,
  characterLevel,
  characterXp,
  characterXpToNext,
  characterGold,
  onFlee,
  onStatsUpdate,
}: Props) {
  const [combat, setCombat] = useState<CombatState>({
    tick: 0,
    playerHp: initialState.playerHp,
    playerMaxHp: initialState.playerMaxHp,
    enemyHp: initialState.enemy.hp,
    enemy: initialState.enemy,
    statusEffects: [],
    log: initialState.log,
    level: characterLevel,
    xp: characterXp,
    xpToNext: characterXpToNext,
    gold: characterGold,
  });
  const [isFleeing, setIsFleeing] = useState(false);
  const [active, setActive] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // Keep log scrolled to top (newest entry first)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [combat.log]);

  const runTick = useCallback(async () => {
    try {
      const res  = await fetch("/api/combat/tick", { method: "POST" });
      const data = await res.json() as TickResponse;
      if (data.noCombat) { setActive(false); return; }
      setCombat(prev => ({
        ...prev,
        tick:          data.tick,
        playerHp:      data.playerHp,
        playerMaxHp:   data.playerMaxHp,
        enemyHp:       data.enemyHp,
        enemy:         data.enemy,
        statusEffects: data.statusEffects,
        log:           data.log,
        level:         data.newLevel,
        xp:            data.newXp,
        xpToNext:      data.newXpToNext,
        gold:          data.newGold,
      }));
      onStatsUpdate({
        level:    data.newLevel,
        xp:       data.newXp,
        xpToNext: data.newXpToNext,
        gold:     data.newGold,
        hp:       data.playerHp,
      });
    } catch {
      // Network blip — keep ticking next round
    }
  }, [onStatsUpdate]);

  // Tick every 3 seconds
  useEffect(() => {
    if (!active) return;
    const id = setInterval(runTick, 3000);
    return () => clearInterval(id);
  }, [active, runTick]);

  async function handleFlee() {
    setIsFleeing(true);
    setActive(false);
    await fetch("/api/combat/flee", { method: "POST" });
    onFlee();
  }

  const playerHpPct = Math.max(0, (combat.playerHp / combat.playerMaxHp) * 100);
  const enemyHpPct  = Math.max(0, (combat.enemyHp  / combat.enemy.maxHp)  * 100);
  const xpPct       = Math.min(100, (combat.xp / combat.xpToNext) * 100);

  const elemColor = ELEMENT_COLOR[combat.enemy.traits.element] ?? "text-gray-300";
  const roleIcon  = ROLE_ICON[combat.enemy.traits.role] ?? "👹";

  return (
    <div className="game-panel space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          ⚔️ {initialState.zoneName}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
          Tick {combat.tick}
        </div>
      </div>

      {/* Enemy card */}
      <div className="border border-red-900/50 rounded-lg p-3 bg-red-950/20 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span>{roleIcon}</span>
              <span className="font-semibold text-red-300 leading-tight">{combat.enemy.name}</span>
            </div>
            <div className={`text-xs ${elemColor} capitalize mt-0.5`}>
              {combat.enemy.traits.element} {combat.enemy.traits.baseType}
              {combat.enemy.traits.modifier && (
                <span className="text-muted-foreground"> · {combat.enemy.traits.modifier}</span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">Lv.{combat.enemy.level}</div>
            <div className="text-xs tabular-nums">
              <span className="text-red-400">{combat.enemyHp}</span>
              <span className="text-muted-foreground">/{combat.enemy.maxHp}</span>
            </div>
          </div>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-700"
            style={{ width: `${enemyHpPct}%` }}
          />
        </div>
        {/* Abilities */}
        {combat.enemy.abilities.length > 0 && (
          <div className="text-xs text-red-400/60">
            {(combat.enemy.abilities as { name: string }[]).map(a => a.name).join(" · ")}
          </div>
        )}
      </div>

      {/* Player HP */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Your HP</span>
          <span className="tabular-nums text-xs">
            <span className={playerHpPct > 50 ? "text-green-400" : playerHpPct > 25 ? "text-yellow-400" : "text-red-400"}>
              {combat.playerHp}
            </span>
            <span className="text-muted-foreground">/{combat.playerMaxHp}</span>
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              playerHpPct > 50 ? "bg-green-500" :
              playerHpPct > 25 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${playerHpPct}%` }}
          />
        </div>
      </div>

      {/* XP bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Lv.{combat.level} XP</span>
          <span className="tabular-nums">{combat.xp} / {combat.xpToNext}</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-700"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <div className="text-right text-xs text-amber-400">{combat.gold}g</div>
      </div>

      {/* Status effects */}
      {combat.statusEffects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {combat.statusEffects.map(eff => (
            <span
              key={eff.id}
              className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 border border-purple-700/50 text-purple-300"
            >
              {eff.name} ×{eff.remainingTicks}
            </span>
          ))}
        </div>
      )}

      {/* Combat log */}
      <div
        ref={logRef}
        className="h-44 overflow-y-auto space-y-0.5 font-mono text-xs bg-gray-950/60 rounded-lg p-2 border border-border"
      >
        {combat.log.map((entry, i) => (
          <div key={i} className={`leading-relaxed ${logColor(entry)}`}>
            {entry}
          </div>
        ))}
      </div>

      {/* Flee */}
      <button
        onClick={handleFlee}
        disabled={isFleeing}
        className="w-full py-2 rounded-lg border border-gray-700 text-muted-foreground text-sm hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40"
      >
        {isFleeing ? "Fleeing..." : "⬅ Flee Combat"}
      </button>
    </div>
  );
}
