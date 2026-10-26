import { expect, it } from "vitest";
import { LEG_LENGTH, pickupAmount, plantedLeg } from "./pickup";

it("eases into the pickup and returns to idle without a sudden change of speed", () => {
  expect(pickupAmount(0)).toBe(0);
  expect(pickupAmount(0.45)).toBe(1);
  expect(pickupAmount(1)).toBe(0);
  expect(pickupAmount(0.001)).toBeLessThan(0.0001);
  expect(pickupAmount(0.999)).toBeLessThan(0.0001);
});

it.each([-0.06, 0, 0.06])("plants the sole on a surface offset by %f through the entire crouch", (surface) => {
  for (let i = 0; i <= 100; i++) {
    const bodyY = -0.19 * pickupAmount(i / 100);
    const leg = plantedLeg(bodyY, surface);
    // Forward kinematics of the two bones and counter-rotated shoe.
    const ankleY = 0.5 + bodyY - LEG_LENGTH * leg.stretch * (Math.cos(leg.hip) + Math.cos(leg.hip + leg.knee));
    const ankleZ = -LEG_LENGTH * (Math.sin(leg.hip) + Math.sin(leg.hip + leg.knee));
    expect(ankleY - 0.08).toBeCloseTo(surface, 8);
    expect(ankleZ).toBeCloseTo(0, 8);
    expect(leg.hip + leg.knee + leg.ankle).toBeCloseTo(0, 8);
  }
});
