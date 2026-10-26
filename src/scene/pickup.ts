/** Lightweight two-bone crouch; the shoe stays on the sampled walking surface. */
export const LEG_LENGTH = 0.21;
export function pickupAmount(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  const v = t < 0.45 ? t / 0.45 : (1 - t) / 0.55;
  return v * v * (3 - 2 * v);
}

export function plantedLeg(bodyY: number, surfaceDelta: number) {
  const distance = Math.max(0.08, LEG_LENGTH * 2 + bodyY - surfaceDelta);
  const stretch = Math.max(1, distance / (LEG_LENGTH * 2));
  const angle = Math.acos(Math.min(1, distance / (LEG_LENGTH * 2)));
  return { hip: -angle, knee: angle * 2, ankle: -angle, stretch };
}
