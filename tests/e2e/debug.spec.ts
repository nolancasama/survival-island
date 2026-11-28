import { expect, test } from "@playwright/test";
import { boot, state, waitFor } from "./helpers";

test("the day picker is hidden without ?debug=1", async ({ page }) => {
  const errors = await boot(page);
  await expect(page.getByTestId("start")).toBeVisible();
  await expect(page.getByTestId("debug-days")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("?debug=1: a day button starts that day's morning after the microphone check", async ({ page }) => {
  const errors = await boot(page, "&debug=1");
  await expect(page.getByTestId("debug-days")).toBeVisible();
  await expect(page.getByTestId("debug-day-11")).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("debug-day-7").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.getByTestId("teacher-options").click();
  await page.getByTestId("teacher-tap").click();
  await waitFor(page, (s) => s.day === 7 && s.step === "grove" && s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt, 45_000);
  const s = await state(page);
  expect(s.radioTried).toBe(true);
  expect(s.rescued).toBe(false);
  expect(s.buildings.some((b) => b.type === "storage")).toBe(true);
  expect(s.known).toContain("putHere");
  expect(errors).toEqual([]);
});
