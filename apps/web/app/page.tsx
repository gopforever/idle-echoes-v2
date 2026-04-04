import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/world");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      {/* Background texture */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(38,40%,15%,0.3),transparent_60%)]" />

      <div className="relative z-10 max-w-2xl space-y-8">
        {/* Title */}
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-amber-400/70 font-sans">
            An Infinite Procedural Idle RPG
          </p>
          <h1 className="text-6xl font-bold text-amber-300 drop-shadow-lg" style={{ fontFamily: "Georgia, serif" }}>
            Idle Echoes
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto text-base leading-relaxed">
            Every world is unique. Every ascension reveals a deeper world.
            Your legend echoes long after you are gone.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { icon: "⚔️", label: "Infinite Worlds", desc: "Seeded procedural generation" },
            { icon: "👻", label: "Living World", desc: "30 ghost players shape history" },
            { icon: "♾️", label: "No Cap", desc: "Ascend and grow forever" },
          ].map(f => (
            <div key={f.label} className="game-panel space-y-1">
              <div className="text-2xl">{f.icon}</div>
              <div className="font-semibold text-amber-300">{f.label}</div>
              <div className="text-muted-foreground text-xs">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 rounded-lg bg-amber-500 text-stone-900 font-bold hover:bg-amber-400 transition-colors"
          >
            Begin Your Legend
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
