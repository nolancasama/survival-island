import { expect, test, type Page } from "@playwright/test";
import { boot, goTo, hook, state, tap, waitFor } from "./helpers";

// Normal timing is essential: fast tests cannot prove that black covers a pose switch.
async function watchPoses(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__poseSamples = [];
    clearInterval(w.__poseTimer);
    w.__poseTimer = setInterval(() => {
      const p = w.__si.state().player;
      w.__poseSamples.push({ lying: p.lying, opacity: Number(getComputedStyle(document.querySelector('.fade')!).opacity) });
    }, 16);
  });
}

async function expectCoveredSwitches(page: Page, minimum: number) {
  const samples = await page.evaluate(() => {
    const w = window as any;
    clearInterval(w.__poseTimer);
    return w.__poseSamples as Array<{ lying: number; opacity: number }>;
  });
  expect(samples.length).toBeGreaterThan(10);
  expect(samples.every((s) => s.lying === 0 || s.lying === 1)).toBe(true);
  const switches = samples.filter((s, i) => i > 0 && s.lying !== samples[i - 1].lying);
  expect(switches.length).toBeGreaterThanOrEqual(minimum);
  for (const sample of switches) expect(sample.opacity).toBeGreaterThanOrEqual(0.99);
}

test('normal-time intro and faint recovery switch poses only under black', async ({ page }) => {
  const errors = await boot(page);
  await page.goto('/?e2e=1&seed=5');
  await page.getByTestId('mode-tap').click();
  await page.getByTestId('start').click();
  await waitFor(page, (s) => s.player.lying === 1 && s.fade === 0);
  await watchPoses(page);
  await page.screenshot({ path: '.tmp/shots/polish-animation/intro-lying.png' });
  await waitFor(page, (s) => s.line?.en === 'Where am I?');
  await expectCoveredSwitches(page, 1);
  await page.screenshot({ path: '.tmp/shots/polish-animation/intro-standing.png' });
  await page.keyboard.press('KeyE');
  await waitFor(page, (s) => s.line?.by === 'game');
  await page.keyboard.press('KeyE');
  await tap(page, 'hungry');
  await waitFor(page, (s) => s.mode === 'explore');
  await watchPoses(page);
  await hook(page, 'setStats', { hp: 0.001, food: 0 });
  await waitFor(page, (s) => s.line?.en === 'You fainted. Kai helped you.');
  await page.screenshot({ path: '.tmp/shots/polish-animation/faint-recovery-lying.png' });
  await page.keyboard.press('KeyE');
  await waitFor(page, (s) => s.line?.by === 'kai');
  await page.keyboard.press('KeyE');
  await waitFor(page, (s) => s.mode === 'explore' && s.player.lying === 0);
  await expectCoveredSwitches(page, 2);
  expect((await state(page)).stats.hp).toBe(100);
  expect(errors).toEqual([]);
});

test('normal-time bedtime keeps the sleeping overlay and wakes under black', async ({ page }) => {
  const errors = await boot(page);
  await page.goto('/?e2e=1&seed=5');
  await page.getByTestId('mode-tap').click();
  await hook(page, 'startDay', 6);
  await waitFor(page, (s) => s.line?.en === "Good morning! Let's explore the island!");
  await page.keyboard.press('KeyE');
  await waitFor(page, (s) => s.mode === 'explore' && s.day === 6);
  await hook(page, 'setClock', 1);
  await goTo(page, 'bE2eShelter');
  await watchPoses(page);
  await page.keyboard.press('KeyE');
  await tap(page, 'sleep');
  await expect(page.getByTestId('sleeping')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: '.tmp/shots/polish-animation/sleeping-overlay.png' });
  await waitFor(page, (s) => s.mode === 'explore' && s.day === 7);
  await expectCoveredSwitches(page, 2);
  expect(errors).toEqual([]);
});
