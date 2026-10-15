import { pace } from "./pace";

/**
 * Classroom-tunable day clock: t = 0 is sunrise, CAP is golden hour ("the sun waits"),
 * DUSK is night, and t = 1 is night held until sleep.
 */

/** Golden-hour cap while the story is waiting for the student. */
export const CAP = 0.62;
/** Night begins at this point in the evening. */
export const DUSK = 0.75;
/** Daylight duration in seconds; classroom-tunable. */
export const DAY_SECONDS = pace(false).daySeconds;
/** Evening duration in seconds; classroom-tunable. */
export const EVENING_SECONDS = pace(false).eveningSeconds;

/** Advance the clock without ever moving time backwards. */
export function advanceClock(t: number, dt: number, { capped }: { capped: boolean }, daySeconds = DAY_SECONDS, eveningSeconds = EVENING_SECONDS): number {
  const limit = capped ? CAP : 1;
  if (t >= limit) return t;
  const rate = t < CAP ? CAP / daySeconds : (1 - CAP) / eveningSeconds;
  return Math.min(limit, 1, t + Math.max(0, dt) * rate);
}

/** Return the story-progress daylight floor. */
export function storyFloor(doneCount: number, stepCount: number): number {
  return Math.max(0, Math.min(CAP, doneCount / Math.max(1, stepCount - 1) * CAP));
}

/** Return the starting clock value for a story day. */
export function dayStartT(day: number): number {
  return day === 1 ? 0.05 : 0;
}

/** Convert clock time to scene light. */
export function lightAt(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x <= CAP ? 1 - x / CAP * 0.52 : 0.48 - (x - CAP) / (1 - CAP) * 0.36;
}

/** Return whether the clock is in night. */
export const isNight = (t: number) => t >= DUSK;
/** Return whether sleeping is available at this clock time. */
export const canSleepAt = (t: number) => t >= CAP;
/** Apply the small clock advance caused by fainting. */
export const faintPenalty = (t: number, capped: boolean, daySeconds = DAY_SECONDS, eveningSeconds = EVENING_SECONDS) =>
  advanceClock(t, 0.05 * daySeconds / CAP, { capped }, daySeconds, eveningSeconds);
