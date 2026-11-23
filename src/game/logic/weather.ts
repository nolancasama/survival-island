/**
 * Scripted rain (Chapter 2). Never random and never blocking, as the brief
 * requires: Day 8 dawns raining until the rain catcher works (then a little
 * longer, see pace.rainStopSeconds), and from Day 9 on a short shower falls at
 * the same time every day. Days 1–7 are always dry.
 */

/** The daily free-play shower, as day-clock times (0 sunrise … CAP golden hour). */
export const SHOWER = { from: 0.25, to: 0.33 } as const;

/** The rain day of Chapter 2. */
export const RAIN_DAY = 8;

/** Whether it should be raining now. `rainDone` is Day 8's rain having stopped. */
export function rainWanted(day: number, t: number, rainDone: boolean): boolean {
  if (day === RAIN_DAY) return !rainDone;
  if (day > RAIN_DAY) return t >= SHOWER.from && t < SHOWER.to;
  return false;
}

/** Rain weight eases in over about 3 s and out over about 5 s. */
export function easeRain(k: number, wanted: boolean, dt: number): number {
  const target = wanted ? 1 : 0;
  const rate = wanted ? 1 / 3 : 1 / 5;
  if (k < target) return Math.min(target, k + dt * rate);
  return Math.max(target, k - dt * rate);
}

/** An open campfire goes out after this many seconds of heavy rain. */
export const FIRE_OUT_SECONDS = 4;
/** Rain heavy enough to put fires out and fill barrels. */
export const HEAVY = 0.6;
