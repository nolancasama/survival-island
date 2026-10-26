import { expect, type Page } from "@playwright/test";
import { BROWSER_STUBS } from "./stubs";

export interface SiState {
  screen: string;
  mode: string;
  micState: string;
  stats: { hp: number; stamina: number; food: number };
  bag: Record<string, number>;
  quest: { day: number; done: string[]; complete: boolean };
  step: string | null;
  known: string[];
  said: string[];
  unlocked: string[];
  crafted: string[];
  buildings: Array<{ id: string; type: string; x: number; z: number; lit?: boolean; built?: boolean }>;
  metKai: boolean;
  kai: { need?: string; canFire?: boolean; canAxe?: boolean; canTorch?: boolean; want?: string; have?: string; escapeMorning?: boolean };
  ate: number;
  crateOpened: boolean;
  focus: { id: string; kind: string } | null;
  prompt: {
    id: number;
    kind: string;
    status: string;
    buttons: boolean;
    misses: number;
    sentences: string[];
    choices: string[];
    question: string | null;
    questionBy: string | null;
    questionJa: string | null;
  } | null;
  line: { by: string; en: string; ja?: string | null } | null;
  placing: { item: string; rot: number; problem: string | null } | null;
  placeOk: boolean;
  hint: string | null;
  player: { x: number; y: number; z: number; yaw: number; speed: number; lying: number; lyingTarget: number };
  taken: string[];
  beacons: string[];
  hasSave: boolean;
  pathCleared: boolean;
  bridgeBuilt: boolean;
  day: number;
  clock: number;
  isNight: boolean;
  sleptDay: number;
  daySaid: string[];
  dayNew: string[];
  dayTitle: number | null;
  sleeping: boolean;
  toasts: string[];
  kaiAt: { x: number; z: number };
  counters: { gotWater: number; drank: number; caught: number; cooked: number };
  fishRests: Record<string, number>;
  fishing: { spotId: string; phase: "cast" | "wait" | "bite" | "reel"; t0: number; x: number; z: number; yaw: number } | null;
  action: { kind: string; t0: number } | null;
  freePlay: boolean;
  inCave: boolean;
  enteredCave: boolean;
  caveBoxOpened: boolean;
  classroom: boolean;
  stepIdleSeconds: number;
  automaticHintCount: number;
  time: number;
  craftOpen: boolean;
  settingsOpen: boolean;
  cliffOpen: boolean;
  reachedClifftop: boolean;
  signalLit: boolean;
  rescued: boolean;
  kaiStage: "camp" | "rockfall" | "clifftop";
  kaiRouteEmpty: boolean;
  fade: number;
  rescue: { phase: "none" | "flight" | "landed"; elapsed: number; duration: number };
  worldAnimation: { caveBoxOpenT0: number; cliffOpenT0: number; signalLitT0: number; rescueT0: number };
}

/** Open the game with speech stubs, fast pacing and the test hook. Returns collected page errors. */
export async function boot(page: Page, query = ""): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(BROWSER_STUBS);
  await page.goto(`/?e2e=1&fast=1&seed=5${query}`);
  await expect(page.getByTestId("title")).toBeVisible();
  return errors;
}

export function state(page: Page): Promise<SiState> {
  return page.evaluate(() => (window as unknown as { __si: { state(): SiState } }).__si.state());
}

export async function hook<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ([name, a]) => {
      const api = (window as unknown as { __si: Record<string, (...x: unknown[]) => unknown> }).__si;
      return api[name as string](...(a as unknown[])) as T;
    },
    [fn, args] as const
  );
}

/**
 * Wait until `pred(state, arg)` holds. The predicate runs in the page, so it
 * cannot close over test variables: pass them as `arg`.
 */
export async function waitFor<A = undefined>(page: Page, pred: (s: SiState, arg: A) => boolean, timeout = 20_000, arg?: A) {
  await page.waitForFunction(
    ([src, a]) => {
      const s = (window as unknown as { __si: { state(): SiState } }).__si.state();
      return new Function("s", "a", `return (${src})(s, a);`)(s, a) as boolean;
    },
    [pred.toString(), arg ?? null] as const,
    { timeout, polling: 30 }
  );
}

/** Wait until the prompt with this id has closed (a new prompt may already be open). */
async function waitAnswered(page: Page, id: number) {
  await waitFor(page, (s, pid) => s.prompt === null || s.prompt.id !== pid, 20_000, id);
}

export async function setSpeech(page: Page, plan: { say?: string | null; error?: string | null }) {
  await page.evaluate((p) => {
    const w = window as unknown as { __speech: { say: string | null; error: string | null } };
    w.__speech.say = p.say ?? null;
    w.__speech.error = p.error ?? null;
  }, plan);
}

export const promptOpen = (s: SiState) => s.prompt !== null && s.prompt.status !== "correct";
export const promptClosed = (s: SiState) => s.prompt === null;

/** Say a sentence into the (stubbed) microphone and wait for the prompt to close. */
export async function speak(page: Page, text: string) {
  await waitFor(page, promptOpen);
  const pid = (await state(page)).prompt!.id;
  await setSpeech(page, { say: text });
  await page.keyboard.press("Space");
  await waitAnswered(page, pid);
}

/** Tap a choice by phrase id and wait for that prompt to be answered. */
export async function tap(page: Page, id: string) {
  await waitFor(page, (s) => s.prompt !== null && s.prompt.buttons && s.prompt.status !== "correct");
  const pid = (await state(page)).prompt!.id;
  await page.locator(`[data-testid=choice][data-id=${id}]`).click();
  await waitAnswered(page, pid);
}

/** Start a new game and get through the intro (the "I'm hungry." prompt) by speaking or tapping. */
export async function startGame(page: Page, how: "speak" | "tap" = "speak") {
  if (how === "tap") await page.getByTestId("mode-tap").click();
  await page.getByTestId("start").click();
  await waitFor(page, promptOpen);
  if (how === "speak") await speak(page, "I'm hungry");
  else await tap(page, "hungry");
  await waitFor(page, (s) => s.mode === "explore");
}

export async function goTo(page: Page, id: string) {
  await hook(page, "goTo", id);
  // Wait for this target's focus: on a slow frame the previous focus is still showing.
  await waitFor(page, (s, want) => s.focus?.id === want, 20_000, id);
}

export async function firstNode(page: Page, kind: string): Promise<string> {
  const ids = await hook<string[]>(page, "nodes", kind);
  if (!ids.length) throw new Error(`no ${kind} left`);
  return ids[0];
}
