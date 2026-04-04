"use client";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  SKILL_DEFS, SKILL_MILESTONES, AA_NODES,
} from "@repo/engine";
import type { CharacterSkills, SkillId } from "@repo/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillsAAData {
  skills: CharacterSkills;
  aaNodes: Record<string, number>;
  aaPoints: number;
}

interface SpendResponse {
  ok?: boolean;
  error?: string;
  aaPoints?: number;
  aaNodes?: Record<string, number>;
}

type Tab = "skills" | "aa";

// ─── Component ────────────────────────────────────────────────────────────────

export function SkillsAAPanel() {
  const [tab, setTab]       = useState<Tab>("skills");
  const [data, setData]     = useState<SkillsAAData | null>(null);
  const [spending, setSpending] = useState<string | null>(null);
  const [flash, setFlash]   = useState<string | null>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };

  const load = useCallback(async () => {
    const res  = await fetch("/api/inventory"); // reuse — returns char data including skills
    const raw  = await res.json() as { skills?: CharacterSkills; aaNodes?: Record<string, number>; aaPoints?: number };
    // Fallback: load from character API
    const res2 = await fetch("/api/character");
    const char = await res2.json() as { skills?: CharacterSkills; aaNodes?: Record<string, number>; aaPoints?: number };
    setData({
      skills:   char.skills   ?? {},
      aaNodes:  char.aaNodes  ?? {},
      aaPoints: char.aaPoints ?? 0,
    });
    void raw;
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Refresh on tab switch
  useEffect(() => { void load(); }, [tab, load]);

  // Live poll every 10 seconds so skills update without tab-switching
  useEffect(() => {
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleSpend(nodeId: string) {
    setSpending(nodeId);
    const res  = await fetch("/api/aa/spend", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId }),
    });
    const result = await res.json() as SpendResponse;
    if (result.error) {
      showFlash(`❌ ${result.error}`);
    } else {
      setData(prev => prev ? {
        ...prev,
        aaPoints: result.aaPoints ?? prev.aaPoints,
        aaNodes:  result.aaNodes  ?? prev.aaNodes,
      } : prev);
      showFlash(`✅ Point spent!`);
    }
    setSpending(null);
  }

  if (!data) {
    return <div className="game-panel text-center text-muted-foreground text-sm py-6">Loading...</div>;
  }

  const SKILL_IDS: SkillId[] = ["combat", "defense", "archery", "magic", "survival", "luck", "meditation"];

  return (
    <div className="game-panel space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        {(["skills", "aa"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium transition-colors",
              tab === t
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "skills" ? "📈 Skills" : `✨ AA (${data.aaPoints} pts)`}
          </button>
        ))}
        {flash && <span className="ml-auto text-xs text-amber-300 animate-pulse">{flash}</span>}
      </div>

      {/* ── SKILLS TAB ── */}
      {tab === "skills" && (
        <div className="space-y-3">
          {SKILL_IDS.map(id => {
            const def   = SKILL_DEFS[id];
            const entry = data.skills[id];
            const level = entry?.level ?? 1;
            const xp    = entry?.xp ?? 0;
            const xpNext = entry?.xpToNext ?? 40;
            const pct   = Math.min(100, (xp / xpNext) * 100);
            const milestones = SKILL_MILESTONES[id];
            const nextMs = milestones.find(([t]) => t > level);
            const curMs  = [...milestones].reverse().find(([t]) => t <= level);

            return (
              <div key={id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{def.icon}</span>
                    <span className={cn("text-sm font-medium", def.color)}>{def.name}</span>
                    <span className="text-xs text-muted-foreground">Lv.{level}</span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">{xp}/{xpNext}</div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/70 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground/70">
                  {curMs  && <span className="text-green-400/70">{curMs[1]}</span>}
                  {nextMs && <span>Next: Lv.{nextMs[0]} → {nextMs[1]}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── AA TAB ── */}
      {tab === "aa" && (
        <div className="space-y-2">
          {data.aaPoints === 0 && (
            <div className="text-xs text-muted-foreground text-center pb-1">
              Earn 1 AA point every {10} kills. Keep fighting!
            </div>
          )}
          {(["offense", "defense", "utility"] as const).map(cat => (
            <div key={cat}>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 capitalize">{cat}</div>
              <div className="space-y-1.5">
                {AA_NODES.filter(n => n.category === cat).map(node => {
                  const currentRank = data.aaNodes[node.id] ?? 0;
                  const maxed       = currentRank >= node.maxRank;
                  const canSpend    = data.aaPoints > 0 && !maxed;
                  return (
                    <div key={node.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 bg-gray-900/30"
                    >
                      <span className="text-lg">{node.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{node.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {currentRank}/{node.maxRank}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground/70">{node.bonusPerRank}</div>
                        {/* Rank pips */}
                        <div className="flex gap-0.5 mt-0.5">
                          {Array.from({ length: node.maxRank }).map((_, i) => (
                            <div key={i}
                              className={cn(
                                "h-1 flex-1 rounded-full",
                                i < currentRank ? "bg-amber-400" : "bg-gray-700"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleSpend(node.id)}
                        disabled={!canSpend || spending === node.id}
                        className={cn(
                          "shrink-0 text-xs px-2 py-1 rounded border transition-colors",
                          maxed
                            ? "border-gray-700 text-gray-600 cursor-default"
                            : canSpend
                            ? "border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                            : "border-gray-700 text-gray-600 cursor-not-allowed"
                        )}
                      >
                        {maxed ? "MAX" : spending === node.id ? "..." : "+1"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
