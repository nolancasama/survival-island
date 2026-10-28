import { expect, test } from "@playwright/test";
import { boot, state, waitFor } from "./helpers";

test("missing microphone shows startup teacher warning, without student mode choices", async ({ page }) => {
  const errors = await boot(page);
  await expect(page.getByTestId("mode-speak")).toHaveCount(0);
  await expect(page.getByTestId("mode-tap")).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("start").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await expect(page.getByText("Please ask your teacher for help.")).toBeVisible();
  await page.getByTestId("mic-retry").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.getByTestId("teacher-options").click();
  await page.getByTestId("teacher-tap").click();
  await expect(page.getByTestId("mic-startup-overlay")).toHaveCount(0);
  await waitFor(page, (s) => s.prompt !== null && s.prompt.buttons);
  expect((await state(page)).micState).toBe("blocked");
  expect(errors).toEqual([]);
});

test("retry after connecting a microphone resumes speaking", async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("start").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = false; });
  await page.getByTestId("mic-retry").click();
  await expect(page.getByTestId("mic-startup-overlay")).toHaveCount(0);
  await waitFor(page, (s) => s.prompt !== null && !s.prompt.buttons);
  expect((await state(page)).micState).toBe("ready");
  expect(errors).toEqual([]);
});
