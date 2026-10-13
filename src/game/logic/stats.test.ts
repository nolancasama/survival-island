import { describe, expect, it } from "vitest";
import { HUNGRY_AT, RATES, START_STATS, afterFaint, canRun, eat, tickStats, type Stats } from "./stats";

const idle = { dt: 1, moving: false, running: false, nearFire: false };

function run(s: Stats, seconds: number, a: Partial<typeof idle> = {}) {
  const events: string[] = [];
  for (let i = 0; i < seconds; i++) {
    const r = tickStats(s, { ...idle, ...a, dt: 1 });
    s = r.stats;
    events.push(...r.events);
  }
  return { s, events };
}

describe("stats", () => {
  it("food drains faster when running than walking than idling", () => {
    const base = { hp: 100, stamina: 100, food: 80 };
    const i = tickStats(base, idle).stats.food;
    const w = tickStats(base, { ...idle, moving: true }).stats.food;
    const r = tickStats(base, { ...idle, moving: true, running: true }).stats.food;
    expect(i).toBeGreaterThan(w);
    expect(w).toBeGreaterThan(r);
  });

  it("a full food bar lasts several minutes of walking", () => {
    expect(100 / RATES.foodWalk).toBeGreaterThan(8 * 60);
  });

  it("running spends stamina, resting recovers it", () => {
    const tired = run({ ...START_STATS, stamina: 100 }, 5, { moving: true, running: true }).s;
    expect(tired.stamina).toBeLessThan(100);
    const rested = run(tired, 3).s;
    expect(rested.stamina).toBeGreaterThan(tired.stamina);
  });

  it("low food slows stamina recovery", () => {
    const fed = tickStats({ hp: 100, stamina: 10, food: 80 }, idle).stats.stamina;
    const hungry = tickStats({ hp: 100, stamina: 10, food: HUNGRY_AT - 5 }, idle).stats.stamina;
    expect(fed - 10).toBeGreaterThan(hungry - 10);
  });

  it("fires 'hungry' once when crossing the line", () => {
    const { events } = run({ hp: 100, stamina: 100, food: HUNGRY_AT + 0.15 }, 5);
    expect(events.filter((e) => e === "hungry")).toHaveLength(1);
  });

  it("empty food drains health slowly, and fainting is reported once", () => {
    const { s, events } = run({ hp: 3, stamina: 100, food: 0 }, 10);
    expect(s.hp).toBe(0);
    expect(events.filter((e) => e === "faint")).toHaveLength(1);
    // Slow enough to notice: more than three minutes from full health.
    expect(100 / RATES.starveDamage).toBeGreaterThan(180);
  });

  it("stays inside 0..100", () => {
    const s = eat({ hp: 99, stamina: 100, food: 95 }, 30);
    expect(s.food).toBe(100);
    expect(s.hp).toBe(100);
  });

  it("an exhausted runner waits for stamina to come back", () => {
    expect(canRun(5, false)).toBe(true);
    expect(canRun(5, true)).toBe(false);
    expect(canRun(30, true)).toBe(true);
  });

  it("fainting restores health and keeps the game going", () => {
    expect(afterFaint().hp).toBe(100);
  });
});
