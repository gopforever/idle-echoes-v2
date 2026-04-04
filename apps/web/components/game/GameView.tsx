"use client";
import { useState, useCallback } from "react";
import { WorldMap } from "./WorldMap";
import { CombatPanel } from "./CombatPanel";
import type { CombatInitial } from "./CombatPanel";
import type { ZoneGraph, FactionWeb, WorldHistory, GeneratedEnemy } from "@repo/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharacterSnapshot {
  id: string;
  name: string;
  className: string;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  hp: number;
  maxHp: number;
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

// ─── GameView ─────────────────────────────────────────────────────────────────

export function GameView({ worldName, zoneGraph, factionWeb, history, character, seed }: Props) {
  const [currentZoneId, setCurrentZoneId] = useState(character.currentZoneId);
  const [combat, setCombat]               = useState<CombatInitial | null>(null);
  const [isTraveling, setIsTraveling]     = useState(false);

  // Shared character stats (updated from CombatPanel tick responses)
  const [charLevel,    setCharLevel]    = useState(character.level);
  const [charXp,       setCharXp]       = useState(character.xp);
  const [charXpToNext, setCharXpToNext] = useState(character.xpToNext);
  const [charGold,     setCharGold]     = useState(character.gold);
  const [charHp,       setCharHp]       = useState(character.hp);

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

  return (
    <div className="space-y-4">
      {/* Character status bar */}
      <div className="flex items-center gap-6 px-1 text-sm">
        <span className="font-medium text-foreground">{character.name}</span>
        <span className="text-muted-foreground">Lv.{charLevel} {character.className}</span>
        {/* HP inline bar */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (charHp / character.maxHp) > 0.5 ? "bg-green-500" :
                (charHp / character.maxHp) > 0.25 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.max(0, (charHp / character.maxHp) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{charHp}/{character.maxHp}</span>
        </div>
        {/* XP inline bar */}
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (charXp / charXpToNext) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">XP</span>
        </div>
        <span className="text-amber-400 ml-auto">{charGold}g</span>
      </div>

      {/* Main layout: map left, combat panel right */}
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
    </div>
  );
}
