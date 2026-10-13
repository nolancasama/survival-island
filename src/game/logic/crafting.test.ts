import { describe, expect, it } from "vitest";
import { RECIPES, RECIPE_ORDER, checkCraft, craft } from "./crafting";
import { PHRASES } from "./english";
import { count } from "./inventory";

describe("crafting", () => {
  it("campfire needs three wood and two stones (the Phase 1 task)", () => {
    expect(RECIPES.campfire.needs).toEqual({ wood: 3, stone: 2 });
  });

  it("is locked until Kai teaches it", () => {
    expect(checkCraft({ wood: 3, stone: 2 }, "campfire", [])).toBe("locked");
    expect(craft({ wood: 3, stone: 2 }, "campfire", [])).toBeNull();
  });

  it("reports missing ingredients", () => {
    expect(checkCraft({ wood: 3, stone: 1 }, "campfire", ["campfire"])).toBe("missing");
    expect(craft({ wood: 3, stone: 1 }, "campfire", ["campfire"])).toBeNull();
  });

  it("consumes exactly the ingredients and adds the item", () => {
    const after = craft({ wood: 5, stone: 2, coconut: 1 }, "campfire", ["campfire"]);
    expect(after).toEqual({ wood: 2, coconut: 1, campfire: 1 });
    expect(count(after!, "stone")).toBe(0);
  });

  it("every recipe has its own sentence that names it", () => {
    const seen = new Set<string>();
    for (const id of RECIPE_ORDER) {
      const r = RECIPES[id];
      expect(PHRASES[r.phrase], id).toBeDefined();
      expect(seen.has(r.phrase), `${id} reuses ${r.phrase}`).toBe(false);
      seen.add(r.phrase);
    }
  });

  it("recipes that share ingredients differ in amounts", () => {
    expect(RECIPES.axe.needs).not.toEqual(RECIPES.campfire.needs);
    expect(RECIPES.torch.needs).not.toEqual(RECIPES.shelter.needs);
  });
});
