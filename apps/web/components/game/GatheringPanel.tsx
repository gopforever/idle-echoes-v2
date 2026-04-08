"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BIOME_GATHERING_BONUS } from "@repo/engine";
import type { GatherResult, Tradeskills } from "@repo/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  inCombat: boolean;
  currentZoneId: string;
  recentYields: GatherResult[];
}

interface RecipesApiResponse {
  tradeskills: Tradeskills;
}

const SKILL_META: Record<string, { label: string; icon: string; color: string; barColor: string }> = {
  mining:   { label: "Mining",   icon: "⛏️",  color: "text-orange-400",  barColor: "bg-orange-500" },
  foraging: { label: "Foraging", icon: "🌿",  color: "text-green-400",   barColor: "bg-green-500"  },
  fishing:  { label: "Fishing",  icon: "🎣",  color: "text-blue-400",    barColor: "bg-blue-500"   },
};

function XpBar({ xp, xpToNext, barColor }: { xp: number; xpToNext: number; barColor: string }) {
  const pct = Math.min(100, xpToNext > 0 ? (xp / xpToNext) * 100 : 0);
  return (
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
      <div
        className={cn("h-full rounded-full transition-all duration-500", barColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── GatheringPanel ───────────────────────────────────────────────────────────

export function GatheringPanel({ inCombat, currentZoneId, recentYields }: Props) {
  const [tradeskills, setTradeskills] = useState<Tradeskills | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive biome from zoneId — we don't have direct access to world here, but
  // we can infer it from a lightweight fetch or just show biome bonuses based
  // on what the gathering tick returns. We'll fetch tradeskills from the recipes endpoint.
  const [biome, setBiome] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/crafting/recipes")
      .then(r => r.json())
      .then((data: RecipesApiResponse) => {
        if (data.tradeskills) setTradeskills(data.tradeskills);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Update tradeskills live when new yields come in
  useEffect(() => {
    if (recentYields.length === 0) return;
    // Re-fetch to get latest tradeskill data after a tick
    fetch("/api/crafting/recipes")
      .then(r => r.json())
      .then((data: RecipesApiResponse) => {
        if (data.tradeskills) setTradeskills(data.tradeskills);
      })
      .catch(() => {});
  }, [recentYields]);

  // Fetch biome from world data
  useEffect(() => {
    fetch("/api/world")
      .then(r => r.json())
      .then((data: { zoneGraph?: { zones: Array<{ id: string; biome: string }> } }) => {
        if (data.zoneGraph?.zones) {
          const zone = data.zoneGraph.zones.find(z => z.id === currentZoneId);
          if (zone) setBiome(zone.biome);
        }
      })
      .catch(() => {});
  }, [currentZoneId]);

  // Which skills get a bonus in this biome
  const bonusSkills: string[] = biome ? (BIOME_GATHERING_BONUS[biome] ?? []) : [];

  const GATHERING_SKILLS = ["mining", "foraging", "fishing"] as const;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-amber-300">Gathering</h2>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium",
          inCombat
            ? "border-red-700 bg-red-950/20 text-red-400"
            : "border-green-600 bg-green-900/20 text-green-300",
        )}>
          {inCombat ? "⚔️ Combat — gathering paused" : "🌿 Gathering..."}
        </div>
      </div>

      {/* Skill cards */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading skills...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {GATHERING_SKILLS.map(skillId => {
            const meta = SKILL_META[skillId]!;
            const entry = tradeskills?.[skillId];
            const hasBonus = bonusSkills.includes(skillId);

            return (
              <div
                key={skillId}
                className={cn(
                  "p-4 rounded-lg border bg-card space-y-2 transition-colors",
                  hasBonus ? "border-amber-500/50 bg-amber-950/10" : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{meta.icon}</span>
                    <span className={cn("text-sm font-medium", meta.color)}>{meta.label}</span>
                  </div>
                  {hasBonus && (
                    <span className="text-xs text-amber-400 font-medium px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                      +Bonus
                    </span>
                  )}
                </div>

                <div className="text-2xl font-bold tabular-nums text-foreground">
                  Lv. {entry?.level ?? 1}
                </div>

                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                    <span>XP</span>
                    <span className="tabular-nums">{entry?.xp ?? 0} / {entry?.xpToNext ?? 100}</span>
                  </div>
                  <XpBar
                    xp={entry?.xp ?? 0}
                    xpToNext={entry?.xpToNext ?? 100}
                    barColor={meta.barColor}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Biome bonus info */}
      {biome && (
        <div className="p-3 rounded-lg border border-border bg-card/50 text-sm">
          <span className="text-muted-foreground">Current biome: </span>
          <span className="font-medium text-foreground capitalize">{biome}</span>
          {bonusSkills.length > 0 && (
            <span className="text-amber-400 ml-2">
              · Bonus yield for {bonusSkills.map(s => SKILL_META[s]?.label ?? s).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Recent yields feed */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Recent Yields
        </h3>
        {recentYields.length === 0 ? (
          <div className="text-sm text-muted-foreground/60 italic">
            {inCombat ? "Gathering paused during combat." : "Gathering every 30 seconds..."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...recentYields].reverse().slice(0, 5).map((r, i) => (
              <div
                key={`${r.skillId}-${r.materialId}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-card/60 text-sm"
              >
                <span className="text-base leading-none w-6 text-center">
                  {SKILL_META[r.skillId]?.icon ?? "📦"}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium capitalize">
                    {r.materialId.replace(/_/g, " ")}
                  </span>
                  <span className="text-muted-foreground ml-1">×{r.quantity}</span>
                  {r.leveledUp && (
                    <span className="ml-2 text-xs text-amber-400 font-medium">
                      Level Up! → {r.newLevel}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  +{r.xpGained} XP
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
