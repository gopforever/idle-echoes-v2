// ─── Seeded RNG (Mulberry32) ──────────────────────────────────────────────────
// Deterministic: same seed always produces the same sequence.
// Critical for reproducible world generation.

export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function rng(): number {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export type Rng = ReturnType<typeof mulberry32>;

export function pick<T>(arr: readonly T[], rng: Rng): T {
  const result = arr[Math.floor(rng() * arr.length)];
  if (result === undefined) throw new Error("pick() called on empty array");
  return result;
}

export function pickN<T>(arr: readonly T[], n: number, rng: Rng): T[] {
  const pool = [...arr];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool.splice(idx, 1)[0] as T);
  }
  return result;
}

export function randInt(min: number, max: number, rng: Rng): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randFloat(min: number, max: number, rng: Rng): number {
  return rng() * (max - min) + min;
}

/** Shuffle array in-place using Fisher-Yates. */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}
