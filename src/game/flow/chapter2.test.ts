import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskRequest } from "./ask";
import type { PhraseId } from "../logic/english";

const prompts = vi.hoisted(() => ({
  ask: vi.fn<(request: AskRequest) => Promise<PhraseId | null>>(),
  say: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./ask", () => ({ ...prompts, fastMode: () => false }));
vi.mock("../../audio/audio", () => ({
  audio: { unlock: vi.fn(), play: vi.fn(), setVolumes: vi.fn(), startAmbience: vi.fn(), startMusic: vi.fn(), setDaylight: vi.fn(), setRain: vi.fn() }
}));
vi.mock("../../audio/tts", () => ({ tts: { setRate: vi.fn() } }));
vi.mock("../../audio/recognition", () => ({ recognition: { supported: false }, requestMicPermission: vi.fn() }));

import { freshGameData, getGame, setGame } from "../store";
import { resetRuntime, rt } from "../runtime";
import { BASE_STACK, STORAGE_STACK, setStackLimit, stackLimit } from "../logic/inventory";
import type { PlacedBuilding } from "../world/placement";
import { putDown, useSocket } from "./chapter2";
import { findFocus } from "./focus";
import { offeredSockets } from "./chapter2Focus";

const TENT: PlacedBuilding = { id: "tent", type: "shelter", x: -2.5, z: 7, rot: 0, built: true };
const FRAME = ["leg1", "leg2", "leg3", "leg4", "barN", "barS", "barW", "barE"];

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("window", { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  });
  resetRuntime();
  setStackLimit(BASE_STACK);
  setGame({
    ...freshGameData(),
    screen: "game",
    mode: "explore",
    settingsOpen: false,
    quest: { day: 6, done: ["cove", "askKai", "coveBox", "canvas"], complete: false },
    pathCleared: true,
    bridgeBuilt: true,
    coveOpen: true,
    buildings: [TENT],
    focus: null,
    toasts: [],
    hint: null
  });
  prompts.ask.mockImplementation(async (request) => {
    const phrase = request.options[0];
    setGame({ known: [...getGame().known, phrase] });
    return phrase;
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setStackLimit(BASE_STACK);
});

describe("carrying the chest", () => {
  it("comes down between the pair at camp, becomes the storage box and doubles the bag", async () => {
    // The player leads; Kai holds the far end 1.8 m behind.
    rt.player.x = 2;
    rt.player.z = 10;
    rt.player.yaw = Math.PI / 2;
    rt.kai.x = 0.2;
    rt.kai.z = 10;
    setGame({ carry: "chest", chestTaken: true });
    const done = putDown();
    await vi.runAllTimersAsync();
    await done;
    const g = getGame();
    expect(g.carry).toBeNull();
    const box = g.buildings.find((b) => b.type === "storage");
    expect(box).toBeDefined();
    expect(box!.x).toBeCloseTo(1.1);
    expect(stackLimit()).toBe(STORAGE_STACK);
    expect(prompts.ask.mock.calls.map(([r]) => r.options[0])).toEqual(["putHere", "foundRope"]);
    expect(g.kai.found).toBe("rope");
  });

  it("can rest away from camp, but the bag only grows once the box is at camp", async () => {
    rt.player.x = 64;
    rt.player.z = 8;
    rt.player.yaw = -Math.PI / 2;
    rt.kai.x = 65.8;
    rt.kai.z = 8;
    setGame({ carry: "chest", chestTaken: true, known: ["putHere"] });
    await putDown();
    expect(getGame().buildings.some((b) => b.type === "storage")).toBe(true);
    expect(stackLimit()).toBe(BASE_STACK);
    expect(getGame().toasts.at(-1)?.en).toBe("Take it to the camp!");
  });
});

describe("rack focus", () => {
  const rack = (parts: string[], fish: number[] = []): PlacedBuilding => ({ id: "r1", type: "rack", x: 4, z: 11, rot: 0, parts, fish });

  it("offers shelves once the frame stands, and no spare braces once it is strong", () => {
    expect(offeredSockets(rack(FRAME.slice(0, 4))).map((s) => s.id)).toEqual(["barN", "barS", "barW", "barE"]);
    expect(offeredSockets(rack(FRAME)).map((s) => s.id)).toEqual(["braceN", "braceS", "braceW", "braceE", "shelfN", "shelfS"]);
    expect(offeredSockets(rack([...FRAME, "braceN", "braceW"])).map((s) => s.id)).toEqual(["shelfN", "shelfS"]);
  });

  it("prefers the strong rack itself when there is a fish to hang or to take", () => {
    // South of the rack, facing it: the shelf socket is nearer than the rack's middle.
    const strong = [...FRAME, "braceN", "braceW"];
    setGame({ buildings: [TENT, rack(strong)], bag: {} });
    expect(findFocus(4, 12.6, Math.PI)?.id).toBe("r1:shelfS");
    setGame({ bag: { fish: 1 } });
    expect(findFocus(4, 12.6, Math.PI)?.id).toBe("r1");
    setGame({ bag: {}, buildings: [TENT, rack(strong, [0])] });
    expect(findFocus(4, 12.6, Math.PI)).toMatchObject({ id: "r1", verb: "Get fish from" });
    // An unbraced frame keeps offering its braces first.
    setGame({ bag: { fish: 1 }, buildings: [TENT, rack(FRAME)] });
    expect(findFocus(4, 12.6, Math.PI)?.kind).toBe("socket");
  });
});

describe("building the rack", () => {
  it("hands control back after Kai praises the strong rack", async () => {
    // Like the real say(): a line puts the game in talk mode (unless busy) until the caller hands it back.
    prompts.say.mockImplementation(async () => {
      setGame({ mode: getGame().mode === "busy" ? "busy" : "talk" });
    });
    const parts = ["leg1", "leg2", "leg3", "leg4", "barN", "barS", "barW", "barE", "braceN"];
    setGame({
      quest: { day: 7, done: ["grove", "poles", "rackSite", "rackFrame"], complete: false },
      known: ["putHere"],
      bag: { pole: 1 },
      buildings: [TENT, { id: "r1", type: "rack", x: 4, z: 11, rot: 0, parts, fish: [] }]
    });
    rt.kai.x = 2;
    rt.kai.z = 11;
    const building = useSocket("r1:braceW");
    await vi.runAllTimersAsync();
    await building;
    expect(prompts.say).toHaveBeenCalledWith("kai", "Great! It's strong now!", expect.any(String));
    expect(getGame().buildings[1].parts).toContain("braceW");
    expect(getGame().mode).toBe("explore");
  });
});
