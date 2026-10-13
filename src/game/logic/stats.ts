/**
 * Survival stats. All three bars mean "full is good" (100 = fine).
 * Tuned to create decisions without stress: food lasts about ten minutes of
 * walking, hunger only slows stamina recovery, and an empty food bar drains
 * health slowly enough to notice and fix.
 */

export interface Stats {
  hp: number;
  stamina: number;
  food: number;
}

export interface Activity {
  dt: number;
  moving: boolean;
  running: boolean;
  /** Close to a lit campfire (warm rest). */
  nearFire: boolean;
}

export type StatEvent = "hungry" | "starving" | "tired" | "faint";

export const START_STATS: Stats = { hp: 100, stamina: 100, food: 45 };

export const RATES = {
  foodIdle: 0.1,
  foodWalk: 0.16,
  foodRun: 0.3,
  staminaRun: 12,
  staminaIdle: 10,
  staminaWalk: 5,
  /** Stamina recovery multiplier when food is low. */
  hungrySlow: 0.4,
  starveDamage: 0.5,
  healWhenFed: 0.3,
  fireHeal: 1,
  fireStamina: 15
};

export const HUNGRY_AT = 25;
/** After stamina runs out, running waits until it is back to this. */
export const RUN_AGAIN_AT = 25;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function tickStats(s: Stats, a: Activity): { stats: Stats; events: StatEvent[] } {
  const events: StatEvent[] = [];
  const dt = a.dt;
  const foodRate = a.running ? RATES.foodRun : a.moving ? RATES.foodWalk : RATES.foodIdle;
  const food = clamp(s.food - foodRate * dt);

  let stamina = s.stamina;
  if (a.running) {
    stamina -= RATES.staminaRun * dt;
  } else {
    let regen = a.moving ? RATES.staminaWalk : RATES.staminaIdle;
    if (a.nearFire) regen += RATES.fireStamina;
    if (food < HUNGRY_AT) regen *= RATES.hungrySlow;
    stamina += regen * dt;
  }
  stamina = clamp(stamina);

  let hp = s.hp;
  if (food <= 0) hp -= RATES.starveDamage * dt;
  else if (food > 50) hp += RATES.healWhenFed * dt;
  if (a.nearFire && food > 0) hp += RATES.fireHeal * dt;
  hp = clamp(hp);

  if (s.food >= HUNGRY_AT && food < HUNGRY_AT) events.push("hungry");
  if (s.food > 0 && food <= 0) events.push("starving");
  if (s.stamina > 0 && stamina <= 0) events.push("tired");
  if (s.hp > 0 && hp <= 0) events.push("faint");
  return { stats: { hp, stamina, food }, events };
}

/** Running needs stamina; once exhausted, wait for RUN_AGAIN_AT. */
export function canRun(stamina: number, exhausted: boolean): boolean {
  return exhausted ? stamina >= RUN_AGAIN_AT : stamina > 0;
}

export function eat(s: Stats, amount: number): Stats {
  return { ...s, food: clamp(s.food + amount), hp: clamp(s.hp + amount * 0.2) };
}

export function spend(s: Stats, stamina: number): Stats {
  return { ...s, stamina: clamp(s.stamina - stamina) };
}

/** Waking up after fainting: no death, no lost items. */
export function afterFaint(): Stats {
  return { hp: 100, stamina: 100, food: 60 };
}
