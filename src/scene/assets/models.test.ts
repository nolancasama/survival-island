import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const arrayBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;

/** A tiny texture-free GLB exercises real GLTFLoader parsing and nested node
 * transforms without requiring an image decoder or browser DOM in Vitest. */
function transformedFixture(mirrored = false): ArrayBuffer {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const colours = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2]);
  const binary = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(colours.buffer), Buffer.from(indices.buffer), Buffer.alloc(2)]);
  const json = Buffer.from(JSON.stringify({
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0, 2] }],
    nodes: [
      { translation: [10, 2, 3], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2], children: [1] },
      { mesh: 0, translation: [1, 1, 1], scale: [2, 3, 4] },
      { mesh: 0, translation: [-3, 0, 0], scale: [mirrored ? -1 : 1, 1, 1] },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2 }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: colours.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength + colours.byteLength, byteLength: indices.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
    ],
  }));
  const jsonBytes = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonBytes.length + binary.length, 8);
  const chunk = (size: number, type: number) => {
    const result = Buffer.alloc(8);
    result.writeUInt32LE(size, 0);
    result.writeUInt32LE(type, 4);
    return result;
  };
  return arrayBuffer(Buffer.concat([header, chunk(jsonBytes.length, 0x4e4f534a), jsonBytes, chunk(binary.length, 0x004e4942), binary]));
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("BASE_URL", "./");
  vi.stubGlobal("document", { baseURI: "https://school.example/games/island/" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("same-origin model geometry", () => {
  it("shares one pending fetch, retains the result and resolves a Pages subpath", async () => {
    const bytes = await readFile(new URL("../../../public/assets/models/pirate/palm-a.glb", import.meta.url));
    let finish!: (response: Response) => void;
    const response = new Promise<Response>(resolve => { finish = resolve; });
    const fetchMock = vi.fn<typeof fetch>(() => response);
    vi.stubGlobal("fetch", fetchMock);
    const { loadModelGeometry } = await import("./models");
    const { rt } = await import("../../game/runtime");
    const first = loadModelGeometry("palmA");
    expect(loadModelGeometry("palmA")).toBe(first);
    expect(rt.modelsReady).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://school.example/games/island/assets/models/pirate/palm-a.glb");
    finish(new Response(arrayBuffer(bytes)));
    const geometry = await first;
    expect(geometry).not.toBeNull();
    expect(geometry!.getAttribute("position").count).toBe(3208 * 3);
    expect(geometry!.getAttribute("color").count).toBe(3208 * 3);
    expect(geometry!.boundingBox!.min.y).toBeCloseTo(0);
    expect(rt.modelsReady).toBe(true);
    expect(await loadModelGeometry("palmA")).toBe(geometry);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches a failure as null, warns once and considers it settled", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    const { loadModelGeometry } = await import("./models");
    const { rt } = await import("../../game/runtime");
    expect(await loadModelGeometry("barrel")).toBeNull();
    expect(await loadModelGeometry("barrel")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(rt.modelsReady).toBe(true);
  });

  it("merges meshes after applying the complete node transform chain", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(transformedFixture())));
    const { loadModelGeometry } = await import("./models");
    const geometry = await loadModelGeometry("post");
    expect(geometry).not.toBeNull();
    const position = geometry!.getAttribute("position");
    const expected = [[9, 3, 4], [9, 5, 4], [6, 3, 4], [-3, 0, 0], [-2, 0, 0], [-3, 1, 0]];
    expect(position.count).toBe(6);
    for (let i = 0; i < expected.length; i++) {
      expect(position.getX(i)).toBeCloseTo(expected[i][0]);
      expect(position.getY(i)).toBeCloseTo(expected[i][1]);
      expect(position.getZ(i)).toBeCloseTo(expected[i][2]);
    }
    expect(Array.from(geometry!.getAttribute("color").array)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(geometry!.boundingBox!.max.toArray()).toEqual([9, 5, 4]);
  });

  it("preserves outward winding and vertex colours when flattening a mirrored mesh", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(transformedFixture(true))));
    const { loadModelGeometry } = await import("./models");
    const geometry = (await loadModelGeometry("post"))!;
    const p = geometry.getAttribute("position");
    expect([p.getX(3), p.getY(3), p.getX(4), p.getY(4), p.getX(5), p.getY(5)]).toEqual([-3, 0, -3, 1, -4, 0]);
    expect(Array.from(geometry.getAttribute("color").array).slice(9)).toEqual([1, 0, 0, 0, 0, 1, 0, 1, 0]);
  });

  it("keeps readiness pending until both successful and failed preloads settle", async () => {
    let finish!: (response: Response) => void;
    const second = new Promise<Response>(resolve => { finish = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(transformedFixture()))
      .mockReturnValueOnce(second);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    const { loadModelGeometry, preloadModels } = await import("./models");
    const { rt } = await import("../../game/runtime");
    const all = preloadModels(["rockA", "rockB"]);
    expect(await loadModelGeometry("rockA")).not.toBeNull();
    expect(rt.modelsReady).toBe(false);
    finish(new Response(null, { status: 503 }));
    await all;
    expect(rt.modelsReady).toBe(true);
    expect(await loadModelGeometry("rockB")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
