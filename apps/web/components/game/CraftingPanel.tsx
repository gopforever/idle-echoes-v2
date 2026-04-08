"use client";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { MATERIALS } from "@repo/engine";
import type { Recipe, Tradeskills, MaterialId } from "@repo/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialCount { [materialId: string]: number }
interface RecipesApiResponse {
  recipes: Recipe[];
  materials: MaterialCount;
  tradeskills: Tradeskills;
}

interface CraftResponse {
  ok: boolean;
  error?: string;
  output?: Record<string, unknown>;
  tradeskills?: Tradeskills;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function XpBar({ xp, xpToNext }: { xp: number; xpToNext: number }) {
  const pct = Math.min(100, xpToNext > 0 ? (xp / xpToNext) * 100 : 0);
  return (
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-amber-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── CraftingPanel ────────────────────────────────────────────────────────────

export function CraftingPanel() {
  const [tab, setTab] = useState<"blacksmithing" | "tailoring" | "alchemy">("blacksmithing");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<MaterialCount>({});
  const [tradeskills, setTradeskills] = useState<Tradeskills | null>(null);
  const [crafting, setCrafting] = useState<string | null>(null); // recipeId being crafted
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    fetch("/api/crafting/recipes")
      .then(r => r.json())
      .then((data: RecipesApiResponse) => {
        setRecipes(data.recipes ?? []);
        setMaterials(data.materials ?? {});
        setTradeskills(data.tradeskills ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCraft(recipeId: string) {
    if (crafting) return;
    setCrafting(recipeId);
    setFlash(null);
    try {
      const res = await fetch("/api/crafting/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
      const data = await res.json() as CraftResponse;
      if (data.ok) {
        if (data.tradeskills) setTradeskills(data.tradeskills);
        // Re-fetch materials since they changed
        fetchData();

        // Build flash message
        const output = data.output;
        if (output?.type === "material") {
          const icon = MATERIALS[output.materialId as MaterialId]?.icon ?? "📦";
          setFlash({ msg: `${icon} Crafted ${output.name as string} ×${output.quantity as number}!`, ok: true });
        } else if (output?.type === "item") {
          const item = output.item as { name: string; rarity: string } | undefined;
          setFlash({ msg: `✨ Crafted ${item?.name ?? "item"} (${item?.rarity ?? ""})!`, ok: true });
        } else {
          setFlash({ msg: "Crafted successfully!", ok: true });
        }
      } else {
        setFlash({ msg: data.error ?? "Craft failed", ok: false });
      }
    } catch {
      setFlash({ msg: "Request failed", ok: false });
    } finally {
      setCrafting(null);
      setTimeout(() => setFlash(null), 4_000);
    }
  }

  const tabs = [
    { id: "blacksmithing" as const, label: "Blacksmithing", icon: "🔨" },
    { id: "tailoring"     as const, label: "Tailoring",     icon: "🧵" },
    { id: "alchemy"       as const, label: "Alchemy",       icon: "⚗️" },
  ];

  const activeSkill = tradeskills?.[tab];
  const tabRecipes  = recipes.filter(r => r.skill === tab);

  function canCraft(recipe: Recipe): { craftable: boolean; meetsLevel: boolean; hasMats: boolean } {
    const meetsLevel = (tradeskills?.[recipe.skill]?.level ?? 1) >= recipe.requiredLevel;
    const hasMats = recipe.inputs.every(inp => (materials[inp.materialId] ?? 0) >= inp.quantity);
    return { craftable: meetsLevel && hasMats, meetsLevel, hasMats };
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="text-xl font-bold text-amber-300">Crafting</h2>

      {/* Flash message */}
      {flash && (
        <div className={cn(
          "p-3 rounded-lg border text-sm font-medium transition-all",
          flash.ok
            ? "border-green-600 bg-green-900/20 text-green-300"
            : "border-red-700 bg-red-950/20 text-red-400",
        )}>
          {flash.msg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Active skill level + XP bar */}
      {activeSkill && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground capitalize">{tab} Level</span>
            <span className="text-lg font-bold text-foreground tabular-nums">{activeSkill.level}</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>XP</span>
              <span className="tabular-nums">{activeSkill.xp} / {activeSkill.xpToNext}</span>
            </div>
            <XpBar xp={activeSkill.xp} xpToNext={activeSkill.xpToNext} />
          </div>
        </div>
      )}

      {/* Recipe list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading recipes...</div>
      ) : tabRecipes.length === 0 ? (
        <div className="text-sm text-muted-foreground/60 italic">No recipes available.</div>
      ) : (
        <div className="space-y-2">
          {tabRecipes.map(recipe => {
            const { craftable, meetsLevel, hasMats } = canCraft(recipe);
            const isCrafting = crafting === recipe.id;

            return (
              <div
                key={recipe.id}
                className={cn(
                  "p-4 rounded-lg border transition-colors",
                  craftable
                    ? "border-green-700/50 bg-green-950/10"
                    : !meetsLevel
                      ? "border-border bg-card opacity-60"
                      : "border-red-800/40 bg-red-950/10",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Recipe info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{recipe.name}</span>
                      {!meetsLevel && (
                        <span className="text-xs text-muted-foreground/60 px-1.5 py-0.5 rounded bg-gray-800 border border-border/50">
                          Requires Lv.{recipe.requiredLevel}
                        </span>
                      )}
                      <span className="text-xs text-amber-400/70">+{recipe.xpReward} XP</span>
                    </div>

                    {/* Inputs */}
                    <div className="flex flex-wrap gap-2">
                      {recipe.inputs.map(inp => {
                        const have = materials[inp.materialId] ?? 0;
                        const enough = have >= inp.quantity;
                        const matDef = MATERIALS[inp.materialId];
                        return (
                          <div
                            key={inp.materialId}
                            className={cn(
                              "flex items-center gap-1 text-xs px-2 py-1 rounded border",
                              enough
                                ? "border-green-700/40 bg-green-950/20 text-green-300"
                                : "border-red-700/40 bg-red-950/20 text-red-400",
                            )}
                          >
                            <span>{matDef?.icon ?? "📦"}</span>
                            <span>{matDef?.name ?? inp.materialId}</span>
                            <span className="font-medium tabular-nums">
                              {have}/{inp.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Output */}
                    <div className="text-xs text-muted-foreground">
                      {"→ "}
                      {recipe.output.type === "material" ? (
                        <span className="text-foreground">
                          {MATERIALS[recipe.output.materialId]?.icon ?? "📦"}{" "}
                          {MATERIALS[recipe.output.materialId]?.name ?? recipe.output.materialId}{" "}
                          ×{recipe.output.quantity}
                        </span>
                      ) : (
                        <span className="text-foreground capitalize">
                          {recipe.output.rarity} {recipe.output.slot.replace(/_/g, " ")} item
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Craft button */}
                  <button
                    onClick={() => void handleCraft(recipe.id)}
                    disabled={!craftable || crafting !== null}
                    className={cn(
                      "shrink-0 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                      craftable && crafting === null
                        ? "border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                        : "border-border text-muted-foreground/40 cursor-not-allowed",
                    )}
                  >
                    {isCrafting ? "..." : "Craft"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
