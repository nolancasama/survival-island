import { describe, expect, it } from "vitest";
import { PHRASES, type PhraseId } from "./english";
import { judgeSpeech, matchesPhrase, tokenize } from "./speechMatch";

const P = (...ids: PhraseId[]) => ids.map((id) => PHRASES[id]);

describe("tokenize", () => {
  it("ignores punctuation and capitals", () => {
    expect(tokenize("Get the WOOD!")).toEqual(["get", "the", "wood"]);
    expect(tokenize("No, I can’t.")).toEqual(["no", "i", "can't"]);
  });
});

describe("matchesPhrase", () => {
  const cases: Array<[PhraseId, string, boolean]> = [
    ["getWood", "get the wood", true],
    ["getWood", "Get wood.", true],
    ["getWood", "get the would", true],
    ["getWood", "take the wood", true],
    ["getWood", "the wood", false],
    ["getWood", "get the stone", false],
    ["getStone", "get the rock", true],
    ["getCoconut", "get the coco nut", true],
    ["eatCoconut", "it the coconut", true],
    ["eatCoconut", "eat", false],
    ["openBox", "open the bucks", true],
    ["makeFire", "make a fire", true],
    ["makeFire", "make a far", true],
    ["craftCampfire", "I want to make a camp fire", true],
    ["craftCampfire", "I wanna make a campfire", true],
    ["craftCampfire", "make campfire", true],
    ["craftCampfire", "campfire", false],
    ["hungry", "I'm hungry", true],
    ["hungry", "I'm angry", true],
    ["needWater", "I need water", true],
    ["needWater", "I need some water", true],
    ["needWater", "water", false],
    ["needFood", "I need foot", true],
    ["yesICan", "yes I can", true],
    ["yesICan", "I can", true],
    ["yesICan", "no I can't", false],
    ["yesICan", "I can not", false],
    ["noICant", "no I can't", true],
    ["noICant", "know I can't", true],
    ["noICant", "yes I can", false]
  ];
  for (const [id, text, want] of cases) {
    it(`${id} ${want ? "accepts" : "rejects"} "${text}"`, () => {
      expect(matchesPhrase(text, PHRASES[id])).toBe(want);
    });
  }
});

describe("judgeSpeech", () => {
  it("picks the one sentence heard among choices", () => {
    const j = judgeSpeech(["I need water"], P("needWater", "needFood", "needWood"));
    expect(j).toMatchObject({ kind: "match", id: "needWater" });
  });

  it("two sentences at once is unclear", () => {
    const j = judgeSpeech(["I need wood and water"], P("needWater", "needFood", "needWood"));
    expect(j.kind).toBe("unclear");
  });

  it("alternatives rescue only a top result that matched nothing", () => {
    expect(judgeSpeech(["hello there", "get the wood"], P("getWood"))).toMatchObject({ kind: "match", id: "getWood" });
    // The top hypothesis said "food": alternative #2 ("wood") must not overrule it.
    const j = judgeSpeech(["I need food", "I need wood"], P("needWater", "needFood", "needWood"));
    expect(j).toMatchObject({ kind: "match", id: "needFood" });
  });

  it("nothing heard is none", () => {
    expect(judgeSpeech([], P("getWood")).kind).toBe("none");
    expect(judgeSpeech(["banana"], P("getWood")).kind).toBe("none");
  });

  it("yes / no are never both", () => {
    expect(judgeSpeech(["no I can't"], P("yesICan", "noICant"))).toMatchObject({ kind: "match", id: "noICant" });
    expect(judgeSpeech(["yes I can"], P("yesICan", "noICant"))).toMatchObject({ kind: "match", id: "yesICan" });
  });
});

describe("phrase bank", () => {
  it("every phrase accepts its own display text", () => {
    for (const p of Object.values(PHRASES)) expect(matchesPhrase(p.en, p), p.id).toBe(true);
  });

  it("no distractor accepts the target's display text (mic-free choices are unambiguous)", () => {
    for (const p of Object.values(PHRASES)) {
      for (const d of p.distractors ?? []) {
        expect(matchesPhrase(p.en, PHRASES[d]), `${p.id} vs ${d}`).toBe(false);
        expect(PHRASES[d].en).not.toBe(p.en);
      }
    }
  });
});
