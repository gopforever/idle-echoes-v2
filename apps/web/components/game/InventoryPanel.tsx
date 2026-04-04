"use client";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { GeneratedItem, ItemSlot } from "@repo/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryRow {
  id: string;
  itemData: unknown;
  quantity: number;
  slot: string | null;
}

interface Props {
  currentZoneId: string;
  characterLevel: number;
  onGoldUpdate: (gold: number) => void;
}

type PanelTab = "bag" | "paperdoll" | "merchant";

// ─── Rarity styling ───────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common:    "text-gray-300  border-gray-600",
  uncommon:  "text-green-400 border-green-700",
  rare:      "text-blue-400  border-blue-700",
  legendary: "text-orange-400 border-orange-700",
  fabled:    "text-purple-400 border-purple-600",
  mythical:  "text-amber-300 border-amber-500",
};

const RARITY_BG: Record<string, string> = {
  common:    "bg-gray-900/40",
  uncommon:  "bg-green-950/40",
  rare:      "bg-blue-950/40",
  legendary: "bg-orange-950/40",
  fabled:    "bg-purple-950/40",
  mythical:  "bg-amber-950/60",
};

// ─── Paperdoll slot layout ────────────────────────────────────────────────────

const SLOT_LABEL: Record<string, string> = {
  head: "Head", chest: "Chest", shoulder: "Shoulders", back: "Back",
  wrist: "Wrist", hands: "Hands", waist: "Waist", legs: "Legs", feet: "Feet",
  primary: "Main Hand", secondary: "Off Hand",
  neck: "Neck", earLeft: "Ear L", earRight: "Ear R",
  ringLeft: "Ring L", ringRight: "Ring R", charm: "Charm",
};

const PAPERDOLL_SLOTS: ItemSlot[][] = [
  ["head"],
  ["shoulder", "chest", "back"],
  ["wrist", "hands", "waist"],
  ["legs", "feet"],
  ["primary", "secondary"],
  ["neck", "earLeft", "earRight"],
  ["ringLeft", "ringRight", "charm"],
];

// ─── Stat display ─────────────────────────────────────────────────────────────

const STAT_LABEL: Record<string, string> = {
  strength: "STR", agility: "AGI", stamina: "STA",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
  attackRating: "ATK", defenseRating: "DEF", mitigation: "MIT",
  avoidance: "AVOID", haste: "HASTE", critChance: "CRIT%",
  critBonus: "CRIT+", weaponDamageMin: "DMG Min", weaponDamageMax: "DMG Max",
  weaponDelay: "Delay", health: "HP+",
};

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground tabular-nums">+{value}</span>
    </div>
  );
}

function ItemTooltip({ item }: { item: GeneratedItem }) {
  const rarityClass = RARITY_COLOR[item.rarity] ?? RARITY_COLOR["common"]!;
  return (
    <div className={cn("absolute z-50 left-full top-0 ml-2 w-52 rounded-lg border p-3 shadow-xl bg-gray-950 space-y-2", rarityClass.split(" ")[1])}>
      <div>
        <div className={cn("font-semibold text-sm", rarityClass.split(" ")[0])}>{item.name}</div>
        <div className="text-xs text-muted-foreground capitalize">
          {item.rarity} {SLOT_LABEL[item.slot] ?? item.slot} · Lv.{item.level}
        </div>
        {item.worldUnique && (
          <div className="text-xs text-amber-300 font-semibold">✦ World Unique</div>
        )}
      </div>
      <div className="space-y-0.5 border-t border-border pt-1">
        {Object.entries(item.stats).map(([k, v]) => (
          typeof v === "number" && v !== 0
            ? <StatLine key={k} label={STAT_LABEL[k] ?? k} value={v} />
            : null
        ))}
      </div>
      <div className="border-t border-border pt-1 text-xs">
        {item.noSell
          ? <span className="text-muted-foreground italic">Cannot be sold</span>
          : <span className="text-amber-400">{item.sellPrice}g sell</span>
        }
      </div>
    </div>
  );
}

// ─── Main InventoryPanel ──────────────────────────────────────────────────────

export function InventoryPanel({ currentZoneId, characterLevel, onGoldUpdate }: Props) {
  const [tab, setTab] = useState<PanelTab>("bag");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [gear, setGear] = useState<Record<string, GeneratedItem>>({});
  const [merchantStock, setMerchantStock] = useState<GeneratedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<GeneratedItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const flash = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const loadInventory = useCallback(async () => {
    const res  = await fetch("/api/inventory");
    const data = await res.json() as { items: InventoryRow[]; gear: unknown; gold: number };
    setRows(data.items);
    setGear((data.gear as Record<string, GeneratedItem>) ?? {});
    onGoldUpdate(data.gold);
  }, [onGoldUpdate]);

  const loadMerchant = useCallback(async () => {
    const res  = await fetch(`/api/merchant?zoneId=${currentZoneId}`);
    const data = await res.json() as { stock: GeneratedItem[]; gold: number };
    setMerchantStock(data.stock);
    onGoldUpdate(data.gold);
  }, [currentZoneId, onGoldUpdate]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (tab === "merchant") void loadMerchant();
  }, [tab, loadMerchant]);

  async function handleEquip(rowId: string) {
    setLoading(true);
    const res  = await fetch("/api/inventory/equip", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryId: rowId }),
    });
    const data = await res.json() as { action: string; gear: Record<string, GeneratedItem> };
    setGear(data.gear);
    await loadInventory();
    flash(data.action === "equipped" ? "✅ Equipped!" : "🔄 Unequipped");
    setSelectedId(null);
    setLoading(false);
  }

  async function handleSell(rowId: string) {
    setLoading(true);
    const res  = await fetch("/api/inventory/sell", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryId: rowId }),
    });
    const data = await res.json() as { ok?: boolean; error?: string; soldFor?: number; newGold?: number };
    if (data.error) { flash(`❌ ${data.error}`); }
    else {
      onGoldUpdate(data.newGold ?? 0);
      flash(`💰 Sold for ${data.soldFor}g`);
    }
    await loadInventory();
    setSelectedId(null);
    setLoading(false);
  }

  async function handleBuy(idx: number) {
    setLoading(true);
    const res  = await fetch("/api/merchant/buy", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId: currentZoneId, itemIndex: idx }),
    });
    const data = await res.json() as { ok?: boolean; error?: string; newGold?: number };
    if (data.error) { flash(`❌ ${data.error}`); }
    else {
      onGoldUpdate(data.newGold ?? 0);
      flash("✅ Purchased!");
      await loadInventory();
    }
    setLoading(false);
  }

  const bagItems = rows.filter(r => r.slot === null);
  const equippedRows = rows.filter(r => r.slot !== null);

  // Sum gear stats for paperdoll
  const gearTotals: Record<string, number> = {};
  for (const item of Object.values(gear)) {
    for (const [k, v] of Object.entries(item.stats)) {
      if (typeof v === "number" && k !== "weaponDelay") {
        gearTotals[k] = (gearTotals[k] ?? 0) + v;
      }
    }
  }

  return (
    <div className="game-panel space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-2">
        {(["bag", "paperdoll", "merchant"] as PanelTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium capitalize transition-colors",
              tab === t
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "bag" ? `🎒 Bag (${bagItems.length})` :
             t === "paperdoll" ? `🧍 Gear (${equippedRows.length}/17)` :
             "🛒 Merchant"}
          </button>
        ))}
        {statusMsg && (
          <span className="ml-auto text-xs text-amber-300 animate-pulse self-center">{statusMsg}</span>
        )}
      </div>

      {/* ── BAG TAB ── */}
      {tab === "bag" && (
        <div>
          {bagItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Your bag is empty. Go fight something!
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {bagItems.map(row => {
                const item = row.itemData as GeneratedItem;
                const rarityClass = RARITY_COLOR[item.rarity] ?? RARITY_COLOR["common"]!;
                const selected = selectedId === row.id;
                return (
                  <div key={row.id} className="relative">
                    <button
                      onClick={() => setSelectedId(selected ? null : row.id)}
                      onMouseEnter={() => setTooltip(item)}
                      onMouseLeave={() => setTooltip(null)}
                      className={cn(
                        "w-full aspect-square rounded-lg border text-center text-xs p-1 flex flex-col items-center justify-center gap-0.5 transition-all",
                        RARITY_BG[item.rarity],
                        rarityClass,
                        selected && "ring-2 ring-amber-400",
                        item.worldUnique && "animate-pulse ring-1 ring-amber-400"
                      )}
                    >
                      <div className="text-base leading-none">
                        {item.type === "weapon" ? "⚔️" : item.type === "accessory" ? "💍" : "🛡️"}
                      </div>
                      <div className="leading-tight truncate w-full text-center" style={{ fontSize: "9px" }}>
                        {SLOT_LABEL[item.slot] ?? item.slot}
                      </div>
                    </button>
                    {tooltip === item && <ItemTooltip item={item} />}
                    {selected && (
                      <div className="absolute top-full left-0 z-40 mt-1 flex gap-1 w-max">
                        <button
                          onClick={() => void handleEquip(row.id)}
                          disabled={loading}
                          className="text-xs px-2 py-1 rounded bg-green-900/80 border border-green-700 text-green-300 hover:bg-green-900 disabled:opacity-40"
                        >Equip</button>
                        {!item.noSell && (
                          <button
                            onClick={() => void handleSell(row.id)}
                            disabled={loading}
                            className="text-xs px-2 py-1 rounded bg-gray-900/80 border border-gray-700 text-gray-300 hover:bg-gray-900 disabled:opacity-40"
                          >{item.sellPrice}g</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PAPERDOLL TAB ── */}
      {tab === "paperdoll" && (
        <div className="space-y-3">
          {PAPERDOLL_SLOTS.map((row, ri) => (
            <div key={ri} className={cn("grid gap-1.5", `grid-cols-${row.length}`)}>
              {row.map(slotKey => {
                const equipped = gear[slotKey];
                const invRow = equippedRows.find(r => r.slot === slotKey);
                return (
                  <div key={slotKey} className="relative">
                    <button
                      onMouseEnter={() => equipped && setTooltip(equipped)}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => invRow && void handleEquip(invRow.id)}
                      className={cn(
                        "w-full rounded-lg border p-2 text-center transition-colors",
                        equipped
                          ? cn(RARITY_BG[equipped.rarity], RARITY_COLOR[equipped.rarity])
                          : "border-dashed border-gray-700 text-gray-700 hover:border-gray-500"
                      )}
                    >
                      <div className="text-xs font-medium truncate" style={{ fontSize: "10px" }}>
                        {SLOT_LABEL[slotKey]}
                      </div>
                      {equipped ? (
                        <div className="text-xs truncate mt-0.5" style={{ fontSize: "9px" }}>
                          {equipped.name.split(" ").slice(0, 2).join(" ")}
                        </div>
                      ) : (
                        <div className="text-xs mt-0.5" style={{ fontSize: "9px" }}>Empty</div>
                      )}
                    </button>
                    {tooltip === equipped && equipped && <ItemTooltip item={equipped} />}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Gear totals */}
          {Object.keys(gearTotals).length > 0 && (
            <div className="border-t border-border pt-2 space-y-0.5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Gear Stats</div>
              {Object.entries(gearTotals).map(([k, v]) => (
                v > 0 ? <StatLine key={k} label={STAT_LABEL[k] ?? k} value={v} /> : null
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MERCHANT TAB ── */}
      {tab === "merchant" && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Zone merchant · Lv.{characterLevel} stock
          </div>
          {merchantStock.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
          ) : (
            <div className="space-y-1.5">
              {merchantStock.map((item, idx) => {
                const rarityClass = RARITY_COLOR[item.rarity] ?? RARITY_COLOR["common"]!;
                return (
                  <div key={idx} className="relative">
                    <div
                      onMouseEnter={() => setTooltip(item)}
                      onMouseLeave={() => setTooltip(null)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2",
                        RARITY_BG[item.rarity], rarityClass.split(" ")[1]
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium truncate", rarityClass.split(" ")[0])}>
                          {item.name}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {item.rarity} {SLOT_LABEL[item.slot] ?? item.slot}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleBuy(idx)}
                        disabled={loading}
                        className="ml-3 shrink-0 text-xs px-3 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
                      >
                        {item.buyPrice}g
                      </button>
                    </div>
                    {tooltip === item && <ItemTooltip item={item} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
