/**
 * Deterministic PRNG so every synthetic admin number is stable across navigations and
 * reloads instead of re-randomizing on every render (which would look like a bug).
 */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number) {
  const next = mulberry32(seed);
  return {
    float(min = 0, max = 1) {
      return min + next() * (max - min);
    },
    int(min: number, max: number) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
    bool(pTrue = 0.5) {
      return next() < pTrue;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

/** A gently trending, weekday-varying daily series — reads as a real trend, not noise. */
export function buildDailySeries(
  rng: Rng,
  days: number,
  opts: { base: number; trendPerDay: number; noise: number; weekendFactor?: number }
): number[] {
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const dayOfWeek = i % 7;
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const weekendMul = isWeekend ? opts.weekendFactor ?? 1 : 1;
    const trendVal = opts.base + opts.trendPerDay * i;
    const noiseMul = 1 + rng.float(-opts.noise, opts.noise);
    out.push(Math.max(0, Math.round(trendVal * weekendMul * noiseMul)));
  }
  return out;
}

export function dateLabel(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function relativeTime(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${Math.round(minutesAgo)}m ago`;
  const hours = minutesAgo / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
