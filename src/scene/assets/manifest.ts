/** Same-origin files copied by Vite from public/. Paths are relative to
 * import.meta.env.BASE_URL, so './' builds work in folders and Pages subpaths.
 * Swap a model's path here; runtime models must have metre units, y-up, a base
 * at y=0 and x/z centred on its footprint, with POSITION and linear COLOR_0.
 * Materials/textures are ignored: scenery always uses shared occluderMat.
 * Re-bake the original Pirate Kit atlas GLBs with npm run models:bake.
 */
export const MODEL_PATHS = {
  palmA: "assets/models/pirate/palm-a.glb",
  palmB: "assets/models/pirate/palm-b.glb",
  palmC: "assets/models/pirate/palm-c.glb",
  rockA: "assets/models/pirate/rock-a.glb",
  rockB: "assets/models/pirate/rock-b.glb",
  rockC: "assets/models/pirate/rock-c.glb",
  rockD: "assets/models/pirate/rock-d.glb",
  rockE: "assets/models/pirate/rock-e.glb",
  barrel: "assets/models/pirate/barrel.glb",
  bucket: "assets/models/pirate/bucket.glb",
  bottle: "assets/models/pirate/bottle.glb",
  post: "assets/models/pirate/post.glb",
} as const;

export type ModelKey = keyof typeof MODEL_PATHS;
