"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface WorldEvent {
  id: string;
  eventType: string;
  message: string;
  zoneId: string;
  createdAt: string;
}

const EVENT_ICON: Record<string, string> = {
  kill:           "⚔️",
  boss_kill:      "👑",
  loot:           "💎",
  zone_change:    "🗺️",
  level_up:       "🌟",
  unique_claimed: "🔱",
  economy:        "💰",
  rivalry:        "⚡",
  discovery:      "🔍",
};

const EVENT_COLOR: Record<string, string> = {
  boss_kill:      "text-amber-300",
  unique_claimed: "text-purple-300",
  level_up:       "text-green-400",
  loot:           "text-blue-300",
  zone_change:    "text-cyan-400",
  kill:           "text-muted-foreground",
};

function timeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function WorldEventsFeed() {
  const [events, setEvents] = useState<WorldEvent[]>([]);

  async function load() {
    try {
      const res  = await fetch("/api/world-events");
      const data = await res.json() as { events: WorldEvent[] };
      setEvents(data.events ?? []);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    void load();
    // Refresh every 30 seconds
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="game-panel space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          🌍 World Events
        </h3>
        <button
          onClick={() => void load()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-xs">
          The world is quiet... for now.
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {events.map(ev => (
            <div key={ev.id} className="flex items-start gap-2 py-1 border-b border-border/40 last:border-0">
              <span className="shrink-0 text-sm mt-0.5">
                {EVENT_ICON[ev.eventType] ?? "📜"}
              </span>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs leading-snug",
                  EVENT_COLOR[ev.eventType] ?? "text-muted-foreground"
                )}>
                  {ev.message}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground/50 tabular-nums mt-0.5">
                {timeAgo(ev.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
