import { expect, test, type Page } from "@playwright/test";
import { boot, firstNode, goTo, hook, speak, state, tap, waitFor } from "./helpers";

for (const classroom of [false, true]) {
  for (const how of ["speak", "tap"] as const) {
    test(`${classroom ? "classroom" : "normal"} ${how}: tent and cup crafting, inventory and resume`, async ({ page }) => {
      const errors = await boot(page);
      if (how === "tap") await hook(page, "setMic", false);
      if (classroom) await page.getByTestId("mode-classroom").click();
      await hook(page, "startDay", 3, classroom);
      await waitFor(page, (s) => s.prompt?.question === "What do you want to do?", 30_000);
      await answer(page, "wantWater", "I want to get water");
      await waitFor(page, (s) => s.mode === "explore" && !s.line && !s.prompt, 30_000);

      await collect("leaves", "leaves", classroom ? 3 : 6);
      await collect("tree", "wood", classroom ? 2 : 4);
      await make("shelter", "tent", "craftShelter", "I want to make a tent.");
      await waitFor(page, (s) => s.mode === "place" && s.bag.shelter === 1);
      await expect(page.getByTestId("placebar")).toContainText("Put the tent down.");
      await page.keyboard.press("Escape");
      await waitFor(page, (s) => s.mode === "explore");
      await expect(page.getByTestId("slot-shelter")).toContainText("tent");
      await make("container", "cup", "craftContainer", "I want to make a cup.");
      await waitFor(page, (s) => s.mode === "explore" && s.bag.container === 1);
      await expect(page.getByTestId("slot-container")).toContainText("cup");

      const before = await state(page);
      await page.getByTestId("btn-settings").click();
      await expect(page.getByTestId("settings-title")).toBeVisible();
      await page.getByTestId("settings-title").click();
      await page.reload();
      await page.getByTestId("continue").click();
      await waitFor(page, (s) => s.screen === "game" && s.mode === "explore", 30_000);
      const after = await state(page);
      expect(after.bag).toEqual(before.bag);
      expect(after.crafted).toEqual(before.crafted);
      expect(after.classroom).toBe(classroom);
      await expect(page.getByTestId("slot-shelter")).toContainText("tent");
      await expect(page.getByTestId("slot-container")).toContainText("cup");
      expect(errors).toEqual([]);

      async function answer(p: Page, phrase: string, sentence: string) {
        if (how === "tap") await tap(p, phrase);
        else await speak(p, sentence);
      }

      async function collect(kind: string, item: string, amount: number) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const before = (await state(page)).bag[item] ?? 0;
          if (before >= amount) return;
          await goTo(page, await firstNode(page, kind));
          await page.keyboard.press("KeyE");
          await waitFor(page, (s, arg) => (s.bag[arg.item] ?? 0) > arg.before && s.mode === "explore", 20_000, { item, before });
        }
        throw new Error(`HARNESS_PRECONDITION_FAILED: could not collect ${amount} ${item}`);
      }

      async function make(item: string, label: string, phrase: string, sentence: string) {
        await page.keyboard.press("KeyC");
        await expect(page.getByTestId(`recipe-${item}`).locator("strong")).toHaveText(label);
        await page.getByTestId(`make-${item}`).click();
        await waitFor(page, (s) => s.prompt?.question === "What do you want to make?");
        expect((await state(page)).prompt!.sentences).toEqual([sentence]);
        if (how === "tap") {
          await expect(page.locator(`[data-testid="choice"][data-id="${phrase}"]`)).toContainText(sentence);
        } else {
          await expect(page.getByTestId("sentence")).toHaveText(sentence);
        }
        await answer(page, phrase, sentence);
      }
    });
  }
}
