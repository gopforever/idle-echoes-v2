"use client";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  SKILL_DEFS, SKILL_MILESTONES, AA_NODES,
} from "@repo/engine";
import type { CharacterSkills, SkillId, Archetype } from "@repo/engine";

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

export interface ActiveAAResult {
  hp?: number;
  power?: number;
  enemyHp?: number;
  log?: string[];
  cooldownUntil?: number;
}

interface ActiveAAResponse {
  ok?: boolean;
  error?: string;
  remainingMs?: number;
  hp?: number;
  power?: number;
  enemyHp?: number;
  log?: string[];
  cooldownUntil?: number;
  cooldownMs?: number;
  escaped?: boolean;
}

interface Props {
  archetype: string;
  className: string;
  ascensions: number;
  inCombat: boolean;
  aaCooldowns: Record<string, number>;
  onActiveAAUsed?: (nodeId: string, result: ActiveAAResult) => void;
}

type Tab = "skills" | "aa_general" | "aa_archetype" | "aa_class" | "aa_planar";

// ─── Component ────────────────────────────────────────────────────────────────

export function SkillsAAPanel({
  archetype,
  className,
  ascensions,
  inCombat,
  aaCooldowns,
  onActiveAAUsed,
}: Props) {
  const [tab, setTab]           = useState<Tab>("skills");
  const [data, setData]         = useState<SkillsAAData | null>(null);
  const [spending, setSpending] = useState<string | null>(null);
  const [flash, setFlash]       = useState<string | null>(null);
  const [activeUsing, setActiveUsing] = useState<string | null>(null);
  const [localCooldowns, setLocalCooldowns] = useState<Record<string, number>>({ ...aaCooldowns });
  const [now, setNow]           = useState(Date.now());

  // Sync prop cooldowns into local state
  useEffect(() => {
    setLocalCooldowns(prev => ({ ...prev, ...aaCooldowns }));
  }, [aaCooldowns]);

  // 1-second interval to update countdown display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };

  const load = useCallback(async () => {
    const res2 = await fetch("/api/character");
    const char = await res2.json() as { skills?: CharacterSkills; aaNodes?: Record<string, number>; aaPoints?: number };
    setData({
      skills:   char.skills   ?? {},
      aaNodes:  char.aaNodes  ?? {},
      aaPoints: char.aaPoints ?? 0,
    });
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

  async function handleActiveAA(nodeId: string) {
    setActiveUsing(nodeId);
    try {
      const res = await fetch("/api/combat/active-aa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      const result = await res.json() as ActiveAAResponse;
      if (result.error) {
        showFlash(`❌ ${result.error}`);
      } else {
        if (result.cooldownUntil) {
          setLocalCooldowns(prev => ({ ...prev, [nodeId]: result.cooldownUntil! }));
        }
        showFlash(`✅ Used!`);
        onActiveAAUsed?.(nodeId, {
          hp: result.hp,
          power: result.power,
          enemyHp: result.enemyHp,
          log: result.log,
          cooldownUntil: result.cooldownUntil,
        });
      }
    } catch {
      showFlash(`❌ Error`);
    }
    setActiveUsing(null);
  }

  function formatCooldown(cooldownUntil: number): string {
    const remaining = Math.max(0, cooldownUntil - now);
    if (remaining <= 0) return "";
    const s = Math.floor(remaining / 1000) % 60;
    const m = Math.floor(remaining / 60000);
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  if (!data) {
    return <div className="game-panel text-center text-muted-foreground text-sm py-6">Loading...</div>;
  }

  const SKILL_IDS: SkillId[] = ["combat", "defense", "archery", "magic", "survival", "luck", "meditation"];

  // Tab labels
  const tabs: { id: Tab; label: string }[] = [
    { id: "skills",       label: "📈 Skills" },
    { id: "aa_general",   label: `✨ General` },
    { id: "aa_archetype", label: `🏛️ Archetype` },
    { id: "aa_class",     label: `⚔️ Class` },
    { id: "aa_planar",    label: `🌌 Planar` },
  ];

  // Filter nodes per tab
  const generalNodes   = AA_NODES.filter(n => n.tier === 1 && !n.archetype && !n.classes);
  const archetypeNodes = AA_NODES.filter(n =>
    n.tier === 2 && (!n.archetype || n.archetype.includes(archetype as Archetype))
  );
  const classNodes     = AA_NODES.filter(n =>
    n.tier === 3 && (!n.classes || n.classes.includes(className))
  );
  const planarNodes    = AA_NODES.filter(n => n.tier === 4);

  function renderNode(node: typeof AA_NODES[0]) {
    const currentRank = data!.aaNodes[node.id] ?? 0;
    const maxed       = currentRank >= node.maxRank;
    const nextCost    = !maxed ? (node.costPerRank[currentRank] ?? 1) : null;
    const canSpend    = data!.aaPoints > 0 && !maxed && (nextCost == null || data!.aaPoints >= nextCost);
    const hasActive   = node.active != null;
    const cdUntil     = localCooldowns[node.id] ?? 0;
    const onCooldown  = cdUntil > now;
    const cdDisplay   = onCooldown ? formatCooldown(cdUntil) : "";
    const canUseActive = hasActive && inCombat && !onCooldown && currentRank >= 1;

    return (
      <div key={node.id}
        className="flex items-start gap-2 rounded-lg border border-border px-2 py-1.5 bg-gray-900/30"
      >
        <span className="text-lg shrink-0 mt-0.5">{node.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-foreground">{node.name}</span>
            <span className="text-xs text-muted-foreground">
              {currentRank}/{node.maxRank}
            </span>
            {nextCost != null && !maxed && (
              <span className="text-xs text-amber-400/70">Cost: {nextCost} pts</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground/70 leading-snug">{node.description}</div>
          {/* Rank pips */}
          <div className="flex gap-0.5 mt-0.5">
            {Array.from({ length: Math.min(node.maxRank, 10) }).map((_, i) => (
              <div key={i}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i < currentRank ? "bg-amber-400" : "bg-gray-700"
                )}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {/* Spend button */}
          <button
            onClick={() => void handleSpend(node.id)}
            disabled={!canSpend || spending === node.id}
            className={cn(
              "text-xs px-2 py-1 rounded border transition-colors",
              maxed
                ? "border-gray-700 text-gray-600 cursor-default"
                : canSpend
                ? "border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                : "border-gray-700 text-gray-600 cursor-not-allowed"
            )}
          >
            {maxed ? "MAX" : spending === node.id ? "..." : "+1"}
          </button>
          {/* Active ability button */}
          {hasActive && (
            <button
              onClick={() => void handleActiveAA(node.id)}
              disabled={!canUseActive || activeUsing === node.id}
              title={!inCombat ? "Must be in combat" : onCooldown ? `Cooldown: ${cdDisplay}` : node.description}
              className={cn(
                "text-xs px-2 py-1 rounded border transition-colors",
                canUseActive && activeUsing !== node.id
                  ? "border-blue-500/50 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                  : "border-gray-700 text-gray-600 cursor-not-allowed"
              )}
            >
              {activeUsing === node.id ? "..." : onCooldown ? cdDisplay : "Use ⚡"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel space-y-3">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium transition-colors",
              tab === t.id
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {t.id === "aa_general" ? `✨ General (${data.aaPoints} pts)` : t.label}
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

      {/* ── AA GENERAL TAB ── */}
      {tab === "aa_general" && (
        <div className="space-y-1.5">
          {data.aaPoints === 0 && (
            <div className="text-xs text-muted-foreground text-center pb-1">
              Earn 1 AA point every 10 kills. Keep fighting!
            </div>
          )}
          {generalNodes.map(renderNode)}
        </div>
      )}

      {/* ── AA ARCHETYPE TAB ── */}
      {tab === "aa_archetype" && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground text-center pb-1">
            {archetype} archetype nodes
          </div>
          {archetypeNodes.map(renderNode)}
        </div>
      )}

      {/* ── AA CLASS TAB ── */}
      {tab === "aa_class" && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground text-center pb-1">
            {className} class nodes
          </div>
          {classNodes.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No class-specific nodes found for {className}.
            </div>
          ) : classNodes.map(renderNode)}
        </div>
      )}

      {/* ── AA PLANAR TAB ── */}
      {tab === "aa_planar" && (
        <div className="space-y-1.5">
          {ascensions === 0 ? (
            <div className="text-center py-6 space-y-2">
              <div className="text-2xl">🔒</div>
              <div className="text-sm font-medium text-muted-foreground">Planar Nodes Locked</div>
              <div className="text-xs text-muted-foreground/70">
                Reach level 60 and ascend to unlock Planar advancement nodes.
              </div>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground text-center pb-1">
                Ascension {ascensions} — Planar advancement nodes
              </div>
              {planarNodes.map(renderNode)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
