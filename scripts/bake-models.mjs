import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { Matrix4, Quaternion, Vector3 } from "three";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(process.argv[2] ?? resolve(root, ".tmp/pirate-kit-src"));
const outputDir = resolve(root, "public/assets/models/pirate");
// Only the small, used individual models belong in the shipped palette bake.
const sources = {
  "palm-a": "Palm Tree.glb",
  "palm-b": "Palm Tree-A6cKJYFsIb.glb",
  "palm-c": "Palm Tree-P0tgwyXBgr.glb",
  "rock-a": "Rock.glb",
  "rock-b": "Rock-4vHWF8XUBn.glb",
  "rock-c": "Rock-6cytS1cPiL.glb",
  "rock-d": "Rock-cg6yBEddtZ.glb",
  "rock-e": "Rock-KvXSMwoftt.glb",
  barrel: "Barrel.glb",
  bucket: "Bucket.glb",
  bottle: "Prop Bottle.glb",
  post: "Post.glb",
};

/** The supplied atlas is PNG, 8-bit, non-interlaced RGB/RGBA. Decode filters
 * locally rather than shipping an image library or retaining texture assets. */
function decodePng(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Not a PNG atlas");
  let width, height, channels;
  const compressed = [];
  for (let p = 8; p < bytes.length;) {
    const length = bytes.readUInt32BE(p);
    const type = bytes.toString("ascii", p + 4, p + 8);
    const data = bytes.subarray(p + 8, p + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = data[9] === 2 ? 3 : data[9] === 6 ? 4 : 0;
      if (data[8] !== 8 || !channels || data[10] || data[11] || data[12]) throw new Error("Expected 8-bit non-interlaced RGB/RGBA PNG");
    }
    if (type === "IDAT") compressed.push(data);
    p += length + 12;
    if (type === "IEND") break;
  }
  if (!width || !height) throw new Error("PNG missing IHDR");
  const rows = inflateSync(Buffer.concat(compressed));
  const stride = width * channels;
  if (rows.length !== height * (stride + 1)) throw new Error("Unexpected PNG byte count");
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = rows[y * (stride + 1)];
    if (filter > 4) throw new Error(`Unknown PNG filter ${filter}`);
    for (let x = 0; x < stride; x++) {
      const dst = y * stride + x;
      const a = x >= channels ? pixels[dst - channels] : 0;
      const b = y ? pixels[dst - stride] : 0;
      const c = y && x >= channels ? pixels[dst - stride - channels] : 0;
      const predict = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      pixels[dst] = (rows[y * (stride + 1) + x + 1] + predict) & 255;
    }
  }
  return { width, height, channels, pixels };
}

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("Invalid GLB 2 header");
  let json, bin;
  for (let p = 12; p < bytes.length;) {
    const length = bytes.readUInt32LE(p), type = bytes.readUInt32LE(p + 4);
    const data = bytes.subarray(p + 8, p + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    if (type === 0x004e4942) bin = data;
    p += length + 8;
  }
  if (!json || !bin) throw new Error("GLB missing JSON/BIN");
  return { json, bin };
}

function accessor(json, bin, index) {
  const a = json.accessors[index];
  if (a.sparse) throw new Error("Sparse accessors are not supported by this kit bake");
  const view = json.bufferViews[a.bufferView];
  const component = {
    5121: [1, "readUInt8", 255], 5123: [2, "readUInt16LE", 65535],
    5125: [4, "readUInt32LE", 4294967295], 5126: [4, "readFloatLE", 1],
  }[a.componentType];
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  if (!component || !size || view.buffer !== 0) throw new Error("Unsupported accessor layout");
  const [bytes, read, max] = component;
  const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = view.byteStride ?? size * bytes;
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, j) => bin[read](offset + i * stride + j * bytes) / (a.normalized ? max : 1)));
}

const linear = (byte) => {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const pad = (bytes, value = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, value)]);

/** Bake metre-space transforms and linear vertex colours into a GLB containing
 * just POSITION, COLOR_0 and indices; the runtime supplies its shared material. */
function bake(json, bin) {
  const positions = [], colours = [], indices = [];
  const atlasCache = new Map();
  const visit = (nodeIndex, parent) => {
    const node = json.nodes[nodeIndex];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation ?? [0, 0, 0])),
      new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
      new Vector3(...(node.scale ?? [1, 1, 1])),
    );
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) {
      if ((primitive.mode ?? 4) !== 4) throw new Error("Expected triangle primitives");
      const texture = json.materials[primitive.material]?.pbrMetallicRoughness?.baseColorTexture;
      if (!texture || (texture.texCoord ?? 0) !== 0 || texture.extensions) throw new Error("Expected untransformed TEXCOORD_0 base-colour atlas");
      const imageIndex = json.textures[texture.index].source;
      if (!atlasCache.has(imageIndex)) {
        const image = json.images[imageIndex];
        if (image.mimeType !== "image/png" || image.bufferView === undefined) throw new Error("Expected embedded PNG atlas");
        const view = json.bufferViews[image.bufferView];
        atlasCache.set(imageIndex, decodePng(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)));
      }
      const atlas = atlasCache.get(imageIndex);
      const sourcePositions = accessor(json, bin, primitive.attributes.POSITION);
      const uvs = accessor(json, bin, primitive.attributes.TEXCOORD_0);
      if (uvs.length !== sourcePositions.length) throw new Error("Mismatched position/UV counts");
      const offset = positions.length;
      const factor = json.materials[primitive.material].pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1];
      for (let i = 0; i < sourcePositions.length; i++) {
        positions.push(new Vector3(...sourcePositions[i]).applyMatrix4(world).toArray());
        // glTF UV origin is the image's top left. PNG rows already have that
        // order: unlike a traditional OpenGL upload, CPU sampling needs no flip.
        const x = Math.max(0, Math.min(atlas.width - 1, Math.floor(uvs[i][0] * atlas.width)));
        const y = Math.max(0, Math.min(atlas.height - 1, Math.floor(uvs[i][1] * atlas.height)));
        const at = (y * atlas.width + x) * atlas.channels;
        colours.push([0, 1, 2].map(c => linear(atlas.pixels[at + c]) * factor[c]));
      }
      const sourceIndices = primitive.indices === undefined ? sourcePositions.map((_, i) => [i]) : accessor(json, bin, primitive.indices);
      for (let i = 0; i < sourceIndices.length; i += 3) {
        const triangle = sourceIndices.slice(i, i + 3).map(([v]) => v + offset);
        if (world.determinant() < 0) [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
        indices.push(...triangle);
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const node of json.scenes[json.scene ?? 0].nodes) visit(node, new Matrix4());
  if (!positions.length) throw new Error("No scene geometry");
  const minY = Math.min(...positions.map(p => p[1]));
  const maxY = Math.max(...positions.map(p => p[1]));
  // Lower vertices identify the trunk/base, rather than centring a palm on its
  // asymmetric crown. Anchoring here makes runtime trunk colliders trustworthy.
  const base = positions.filter(p => p[1] <= minY + Math.min(0.3, (maxY - minY) * 0.06));
  const cx = (Math.min(...base.map(p => p[0])) + Math.max(...base.map(p => p[0]))) / 2;
  const cz = (Math.min(...base.map(p => p[2])) + Math.max(...base.map(p => p[2]))) / 2;
  for (let i = 0; i < positions.length; i++) {
    positions[i][0] -= cx;
    positions[i][1] -= minY;
    positions[i][2] -= cz;
    const t = Math.max(0, Math.min(1, positions[i][1] / 0.55));
    const ao = 0.58 + 0.42 * t * t * (3 - 2 * t);
    colours[i] = colours[i].map(c => c * ao);
  }
  const bounds = [0, 1, 2].map(axis => [Math.min(...positions.map(p => p[axis])), Math.max(...positions.map(p => p[axis]))]);
  const chunks = [Buffer.from(new Float32Array(positions.flat()).buffer), Buffer.from(new Float32Array(colours.flat()).buffer), Buffer.from((positions.length <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices)).buffer)];
  const views = [];
  let offset = 0;
  for (const [i, chunk] of chunks.entries()) {
    views.push({ buffer: 0, byteOffset: offset, byteLength: chunk.length, target: i === 2 ? 34963 : 34962 });
    offset += pad(chunk).length;
  }
  const binary = Buffer.concat(chunks.map(c => pad(c)));
  const output = {
    asset: { version: "2.0", generator: "Survival Island palette bake" },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2, material: 0 }] }],
    materials: [{}], buffers: [{ byteLength: binary.length }], bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length, type: "VEC3", min: bounds.map(b => b[0]), max: bounds.map(b => b[1]) },
      { bufferView: 1, componentType: 5126, count: colours.length, type: "VEC3" },
      { bufferView: 2, componentType: positions.length <= 65535 ? 5123 : 5125, count: indices.length, type: "SCALAR" },
    ],
  };
  const jsonChunk = pad(Buffer.from(JSON.stringify(output)), 32);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonChunk.length + binary.length, 8);
  const chunkHeader = (bytes, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(bytes, 0); h.writeUInt32LE(type, 4); return h; };
  return {
    bytes: Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binary.length, 0x004e4942), binary]),
    triangles: indices.length / 3,
    size: bounds.map(b => b[1] - b[0]),
    footprint: Math.max(...base.map(p => Math.hypot(p[0], p[2]))),
  };
}

await mkdir(outputDir, { recursive: true });
let totalBytes = 0;
for (const [name, source] of Object.entries(sources)) {
  const { json, bin } = parseGlb(await readFile(resolve(sourceDir, source)));
  const result = bake(json, bin);
  await writeFile(resolve(outputDir, `${name}.glb`), result.bytes);
  totalBytes += result.bytes.length;
  console.log(`${name}.glb: ${result.triangles} tris, ${result.bytes.length} bytes; xyz ${result.size.map(v => v.toFixed(3)).join(" / ")} m; base radius ${result.footprint.toFixed(3)} m`);
}
console.log(`Total: ${totalBytes} bytes (${Object.keys(sources).length} models)`);
