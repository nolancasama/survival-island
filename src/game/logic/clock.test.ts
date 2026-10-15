import { describe, expect, it } from "vitest";
import { CAP, advanceClock } from "./clock";
import { pace } from "./pace";

describe("clock pace", () => {
  it("uses the supplied daylight and evening durations", () => {
    const normal = pace(false);
    const classroom = pace(true);
    expect(advanceClock(0, normal.daySeconds, { capped: true }, normal.daySeconds, normal.eveningSeconds)).toBeCloseTo(CAP);
    expect(advanceClock(0, classroom.daySeconds, { capped: true }, classroom.daySeconds, classroom.eveningSeconds)).toBeCloseTo(CAP);
    expect(advanceClock(CAP, classroom.eveningSeconds, { capped: false }, classroom.daySeconds, classroom.eveningSeconds)).toBeCloseTo(1);
  });
});
