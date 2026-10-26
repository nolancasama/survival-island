import { describe, expect, it } from "vitest";
import { ITEMS } from "../types";
import { hints } from "../../ui/i18n";
import { PHRASES } from "./english";
import { DAYS } from "./quest";
import { recipeNeeds } from "./pace";
import { matchesPhrase } from "./speechMatch";

describe("tent and cup terminology", () => {
  it("uses the new names while preserving item, building and phrase identities", () => {
    expect(ITEMS.shelter).toMatchObject({ id: "shelter", en: "tent", ja: "テント", places: "shelter" });
    expect(ITEMS.container).toMatchObject({ id: "container", en: "cup", ja: "カップ", kind: "tool" });
    expect(PHRASES.craftShelter.en).toBe("I want to make a tent.");
    expect(PHRASES.buildShelter.en).toBe("Build a tent.");
    expect(PHRASES.craftContainer.en).toBe("I want to make a cup.");
    expect(DAYS[1].steps.find((step) => step.id === "shelter")).toMatchObject({ en: "Make a tent", ja: "テントを つくろう" });
    expect(DAYS[2].steps.find((step) => step.id === "container")).toMatchObject({ en: "Make a cup", ja: "カップを つくろう" });
  });

  for (const classroom of [false, true]) {
    it(`keeps keyboard and touch hints consistent at ${classroom ? "classroom" : "normal"} pace`, () => {
      const help = hints(classroom);
      for (const id of ["shelter", "placeShelter", "build", "sleep"]) {
        for (const mode of ["keys", "touch"] as const) {
          expect(help[id][mode].en).toContain("tent");
          expect(help[id][mode].ja).toContain("テント");
        }
      }
      for (const id of ["container", "water"]) {
        for (const mode of ["keys", "touch"] as const) {
          expect(help[id][mode].en).toContain("cup");
          expect(help[id][mode].ja).toContain("カップ");
        }
      }
      expect(recipeNeeds("shelter", classroom)).toEqual(classroom ? { wood: 2, leaves: 2 } : { wood: 4, leaves: 4 });
      expect(recipeNeeds("container", classroom)).toEqual({ coconut: 1, leaves: classroom ? 1 : 2 });
      const display = [
        ...Object.values(ITEMS).flatMap((item) => [item.en, item.ja]),
        ...Object.values(PHRASES).map((phrase) => phrase.en),
        ...DAYS.flatMap((day) => day.steps.flatMap((step) => [step.en, step.ja])),
        ...Object.values(help).flatMap((hint) => [hint.keys.en, hint.keys.ja, hint.touch.en, hint.touch.ja])
      ].join("\n");
      expect(display).not.toMatch(/\bshelter\b|\bcontainer\b|こや|みずいれ/i);
    });
  }

  it("accepts conservative tent and cup variants without matching unrelated nouns", () => {
    for (const noun of ["tent", "tents", "tent's", "tento", "ten t"]) {
      expect(matchesPhrase(`I want to make a ${noun}`, PHRASES.craftShelter), noun).toBe(true);
      expect(matchesPhrase(`build a ${noun}`, PHRASES.buildShelter), noun).toBe(true);
    }
    for (const noun of ["cup", "cups", "cup's", "kappu"]) {
      expect(matchesPhrase(`I want to make a ${noun}`, PHRASES.craftContainer), noun).toBe(true);
    }
    for (const noun of ["ten", "rent", "intent", "tentacle", "shoulder", "cup", "bridge"]) {
      expect(matchesPhrase(`make a ${noun}`, PHRASES.craftShelter), noun).toBe(false);
      expect(matchesPhrase(`build a ${noun}`, PHRASES.buildShelter), noun).toBe(false);
    }
    for (const noun of ["cap", "cut", "cub", "couple", "tent", "water"]) {
      expect(matchesPhrase(`make a ${noun}`, PHRASES.craftContainer), noun).toBe(false);
    }
    expect(matchesPhrase("tent", PHRASES.craftShelter)).toBe(false);
    expect(matchesPhrase("cup", PHRASES.craftContainer)).toBe(false);
  });
});
