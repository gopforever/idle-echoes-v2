"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const RACES = [
  { name: "Human",      bonus: "+Charisma",    desc: "Versatile and diplomatic"        },
  { name: "Dark Elf",   bonus: "+Intelligence", desc: "Masters of shadow magic"         },
  { name: "Wood Elf",   bonus: "+Agility",      desc: "Swift hunters of the forest"     },
  { name: "High Elf",   bonus: "+Intelligence", desc: "Ancient scholars of arcane arts"  },
  { name: "Gnome",      bonus: "+Intelligence", desc: "Brilliant tinkerers"             },
  { name: "Dwarf",      bonus: "+Stamina",      desc: "Stalwart defenders"              },
  { name: "Halfling",   bonus: "+Agility",      desc: "Nimble and lucky"                },
  { name: "Barbarian",  bonus: "+Strength",     desc: "Fearsome warriors of the north"  },
  { name: "Kerra",      bonus: "+Agility",      desc: "Feline hunters with sharp claws" },
  { name: "Fae",        bonus: "+Wisdom",       desc: "Winged creatures of nature"      },
  { name: "Sarnak",     bonus: "+Strength",     desc: "Dragonkin warriors"              },
  { name: "Ogre",       bonus: "+Strength",     desc: "Mightiest of all races"          },
];

const CLASSES_BY_ARCHETYPE: Record<string, { name: string; role: string }[]> = {
  "⚔️ Fighter": [
    { name: "Guardian",     role: "Tank"    },
    { name: "Berserker",    role: "DPS"     },
    { name: "Monk",         role: "DPS"     },
    { name: "Shadowknight", role: "Tank"    },
    { name: "Paladin",      role: "Tank"    },
  ],
  "🗡️ Scout": [
    { name: "Assassin",     role: "DPS"     },
    { name: "Ranger",       role: "DPS"     },
    { name: "Swashbuckler", role: "DPS"     },
    { name: "Troubador",    role: "Support" },
    { name: "Dirge",        role: "Support" },
  ],
  "🔮 Mage": [
    { name: "Wizard",       role: "DPS"     },
    { name: "Warlock",      role: "DPS"     },
    { name: "Necromancer",  role: "DPS"     },
    { name: "Illusionist",  role: "Support" },
    { name: "Coercer",      role: "Support" },
  ],
  "✨ Priest": [
    { name: "Templar",      role: "Healer"  },
    { name: "Mystic",       role: "Healer"  },
    { name: "Warden",       role: "Healer"  },
    { name: "Inquisitor",   role: "Support" },
    { name: "Fury",         role: "DPS"     },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  Tank: "text-blue-400", DPS: "text-red-400", Support: "text-yellow-400", Healer: "text-green-400",
};

type Step = "race" | "class" | "name";

export default function CreateCharacterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("race");
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [charName, setCharName] = useState("");
  const [worldId, setWorldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch or create the world on mount
  useEffect(() => {
    fetch("/api/world")
      .then(r => r.json())
      .then((w: { id: string }) => setWorldId(w.id))
      .catch(() => setError("Failed to generate world. Please refresh."));
  }, []);

  async function handleCreate() {
    if (!worldId || !selectedRace || !selectedClass || !charName.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: charName.trim(), race: selectedRace, className: selectedClass, worldId }),
    });

    if (!res.ok) {
      const data = await res.json() as { error: string };
      setError(data.error ?? "Failed to create character.");
      setLoading(false);
      return;
    }

    router.push("/world");
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-amber-300">Forge Your Hero</h1>
          <div className="flex justify-center gap-2 text-sm">
            {(["race", "class", "name"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={cn(
                  "px-3 py-1 rounded-full border text-xs",
                  step === s ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-border text-muted-foreground"
                )}>
                  {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
                {i < 2 && <span className="text-border">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Race */}
        {step === "race" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-amber-200">Choose Your Race</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {RACES.map(r => (
                <button
                  key={r.name}
                  onClick={() => setSelectedRace(r.name)}
                  className={cn(
                    "game-panel text-left transition-all hover:border-amber-500",
                    selectedRace === r.name && "border-amber-400 bg-amber-400/10"
                  )}
                >
                  <div className="font-semibold text-foreground">{r.name}</div>
                  <div className="text-xs text-amber-400">{r.bonus}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep("class")} disabled={!selectedRace}>
                Choose Class →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Class */}
        {step === "class" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-amber-200">Choose Your Class</h2>
            {Object.entries(CLASSES_BY_ARCHETYPE).map(([archetype, classes]) => (
              <div key={archetype} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{archetype}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {classes.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedClass(c.name)}
                      className={cn(
                        "game-panel text-left transition-all hover:border-amber-500",
                        selectedClass === c.name && "border-amber-400 bg-amber-400/10"
                      )}
                    >
                      <div className="font-semibold text-foreground">{c.name}</div>
                      <div className={cn("text-xs", ROLE_COLORS[c.role])}>{c.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("race")}>← Back</Button>
              <Button onClick={() => setStep("name")} disabled={!selectedClass}>Name Your Hero →</Button>
            </div>
          </div>
        )}

        {/* Step 3: Name + confirm */}
        {step === "name" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-amber-200">Name Your Hero</h2>
            <Card>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Race:</span>{" "}
                      <span className="text-foreground font-medium">{selectedRace}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Class:</span>{" "}
                      <span className="text-foreground font-medium">{selectedClass}</span>
                    </div>
                  </div>
                  <Input
                    placeholder="Enter your hero's name..."
                    value={charName}
                    onChange={e => setCharName(e.target.value)}
                    maxLength={32}
                    autoFocus
                  />
                  {error && (
                    <div className="rounded-lg bg-red-900/30 border border-red-700 px-3 py-2 text-sm text-red-300">
                      {error}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("class")}>← Back</Button>
              <Button
                onClick={handleCreate}
                disabled={!charName.trim() || loading || !worldId}
              >
                {loading ? "Entering the world..." : "Begin Adventure ⚔️"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
