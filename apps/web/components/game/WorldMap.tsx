"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ZoneGraph, FactionWeb, WorldHistory, Zone } from "@repo/engine";

interface Props {
  worldName: string;
  zoneGraph: ZoneGraph;
  factionWeb: FactionWeb;
  history: WorldHistory;
  currentZoneId: string;
  characterLevel: number;
  seed: number;
}

const BIOME_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  grasslands: { bg: "bg-green-900/40",  border: "border-green-700",  text: "text-green-300"  },
  forest:     { bg: "bg-emerald-900/40",border: "border-emerald-700",text: "text-emerald-300" },
  frozen:     { bg: "bg-blue-900/40",   border: "border-blue-600",   text: "text-blue-300"   },
  volcanic:   { bg: "bg-red-900/40",    border: "border-red-700",    text: "text-red-300"    },
  arcane:     { bg: "bg-purple-900/40", border: "border-purple-600", text: "text-purple-300" },
  corrupted:  { bg: "bg-gray-900/60",   border: "border-gray-600",   text: "text-gray-300"   },
  desert:     { bg: "bg-yellow-900/40", border: "border-yellow-700", text: "text-yellow-300" },
  swamp:      { bg: "bg-lime-900/40",   border: "border-lime-800",   text: "text-lime-300"   },
  undead:     { bg: "bg-stone-900/60",  border: "border-stone-600",  text: "text-stone-300"  },
  celestial:  { bg: "bg-amber-900/40",  border: "border-amber-500",  text: "text-amber-300"  },
};

const BIOME_ICON: Record<string, string> = {
  grasslands: "🌾", forest: "🌲", frozen: "❄️", volcanic: "🌋",
  arcane: "✨", corrupted: "💀", desert: "🏜️", swamp: "🐸",
  undead: "💀", celestial: "⭐",
};

export function WorldMap({ worldName, zoneGraph, factionWeb, history, currentZoneId, characterLevel, seed }: Props) {
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  const factionMap = new Map(factionWeb.factions.map(f => [f.id, f]));

  function isZoneLocked(zone: Zone): boolean {
    return zone.levelRange[0] > characterLevel + 5;
  }

  return (
    <div className="space-y-6">
      {/* World header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-amber-300">World of {worldName}</h2>
          <p className="text-muted-foreground text-sm">
            Seed #{seed.toLocaleString()} · {history.age} world · {zoneGraph.zones.length} zones
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground space-y-1">
          {history.events.slice(0, 2).map((e, i) => (
            <div key={i} className="italic">"{e.legacyEffect}"</div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Zone grid */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Zones</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {zoneGraph.zones.map(zone => {
              const colors = BIOME_COLORS[zone.biome] ?? BIOME_COLORS["grasslands"]!;
              const locked = isZoneLocked(zone);
              const isCurrent = zone.id === currentZoneId;
              const faction = zone.factionId ? factionMap.get(zone.factionId) : null;

              return (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone)}
                  disabled={locked}
                  className={cn(
                    "game-panel text-left transition-all space-y-1 hover:border-amber-500",
                    colors.bg, colors.border,
                    isCurrent && "ring-2 ring-amber-400",
                    locked && "opacity-40 cursor-not-allowed",
                    selectedZone?.id === zone.id && "border-amber-400",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{BIOME_ICON[zone.biome]}</span>
                    {isCurrent && <span className="text-xs text-amber-400 font-medium">HERE</span>}
                    {locked && <span className="text-xs text-muted-foreground">🔒 Lv.{zone.levelRange[0]}</span>}
                  </div>
                  <div className={cn("font-semibold text-sm leading-tight", colors.text)}>{zone.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Lv.{zone.levelRange[0]}–{zone.levelRange[1]}
                  </div>
                  {faction && (
                    <div className="text-xs text-amber-400/70 truncate">{faction.name}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zone detail / world info sidebar */}
        <div className="space-y-3">
          {selectedZone ? (
            <div className="game-panel space-y-4">
              <div>
                <div className="text-lg">{BIOME_ICON[selectedZone.biome]}</div>
                <h3 className="text-lg font-bold text-amber-300">{selectedZone.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{selectedZone.biome} region</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Level Range</div>
                  <div className="text-foreground">{selectedZone.levelRange[0]}–{selectedZone.levelRange[1]}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Loot Quality</div>
                  <div className="text-amber-400">{selectedZone.lootQuality}/100</div>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Zone Boss</div>
                <div className="text-red-400 text-sm font-medium">{selectedZone.bossName}</div>
                <div className="text-xs text-muted-foreground">Level {selectedZone.bossLevel}</div>
              </div>
              {selectedZone.factionId && (
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Controlled By</div>
                  <div className="text-amber-300 text-sm">
                    {factionMap.get(selectedZone.factionId)?.name}
                  </div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground text-xs mb-1">Connections</div>
                <div className="flex flex-wrap gap-1">
                  {selectedZone.connections.map(connId => {
                    const conn = zoneGraph.zones.find(z => z.id === connId);
                    return conn ? (
                      <button
                        key={connId}
                        onClick={() => setSelectedZone(conn)}
                        className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {conn.name}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
              <button
                className="w-full py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                disabled={isZoneLocked(selectedZone)}
              >
                {isZoneLocked(selectedZone)
                  ? `Requires Level ${selectedZone.levelRange[0]}`
                  : selectedZone.id === currentZoneId
                  ? "Currently Here"
                  : "Travel Here"}
              </button>
            </div>
          ) : (
            <div className="game-panel space-y-4">
              <h3 className="text-amber-300 font-semibold">World History</h3>
              <div className="space-y-3">
                {history.events.map((event, i) => (
                  <div key={i} className="border-l-2 border-amber-500/30 pl-3 space-y-0.5">
                    <div className="text-xs text-amber-400 uppercase tracking-wide">Era {event.era}</div>
                    <div className="text-sm text-foreground">{event.description}</div>
                    <div className="text-xs text-muted-foreground italic">{event.legacyEffect}</div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-border">
                <h4 className="text-sm font-medium text-amber-300 mb-2">World Factions</h4>
                <div className="space-y-1">
                  {factionWeb.factions.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{f.name}</span>
                      <span className={cn(
                        "capitalize",
                        f.alignment === "good" ? "text-green-400" :
                        f.alignment === "evil" ? "text-red-400" :
                        f.alignment === "chaotic" ? "text-orange-400" :
                        "text-gray-400"
                      )}>{f.alignment}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
