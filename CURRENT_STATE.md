# Current State

## Vegetation overhaul — 2026-10-22
- Procedural vegetation now targets a shared stylized tropical family, with
  jungle archetypes, continuous palm trunks and leaflet crowns, darker layered
  decorative bushes, a distinct choppable tree and bright broad-leaf harvest bushes.
- Static jungle trees, palms and decorative bushes share one merged mesh per
  40 m tile using `occluderMat`; deterministic prototype selection preserves the
  existing authored placements and seeded spot stream. Gameplay is unchanged.
- Generators: `scene/models/vegetationBroadleaf.ts` (jungle archetypes, bushes,
  choppable tree, leaf bush), `vegetationPalms.ts` (palms, `palmAt`),
  `vegetationLayout.ts` (`treeSpots`, moved verbatim from Environment.tsx, and
  the per-tile merge). Parameters are in DESIGN_DECISIONS "Vegetation overhaul".
- `npm run shots:world` now has 35 views (seven vegetation close-ups appended).
- **Measured (SwiftShader 1024×768), calls / triangles before → after:**
  clifftop 116/98k → 107/154k (worst view), camp at night 100/95k → 95/150k,
  beach spawn 70/86k → 66/138k, forest gap 78/89k → 75/142k, forest centre
  48/70k → 47/112k, bridge 41/38k → 39/53k, pond 37/37k → 36/53k. Draw calls
  fell in every view; triangles rose ~45–60k but stay under the 200k budget.
- Verified: typecheck, `npm test` (133), build, `npm run e2e` (26, incl.
  chop/stump/regrow, leaf collection, save migration), placement checksums
  locked by test and the moved `treeSpots` checked byte-identical to the old one.
  Reviewed by eye: palms, forest, choppable tree and stump, leaf bush, clifftop.

## Status
**Phase 3 is complete: the whole five-day story (Days 1–5), the helicopter
rescue, the Rescue card, free play from Day 6, and classroom mode, all on
`main`.** The design is in DESIGN_DECISIONS.md: "2026-10-15 — Phase 3 (Full
Story) design" plus the Phase 3 logic, world, story slice A and story slice B
decision sections after it. Read those first. Phase 2 sections still apply.

## Phase 3
- **Logic:** Days 4–5 quest data (Day 5 has no Sleep; it ends on "Call for
  help"), `LAST_STORY_DAY = 5`, the Phase 3 phrases, `logic/pace.ts` (normal
  and classroom recipe/bridge counts, clock seconds, food drain, automatic
  hint delay), `stepGoal`, save v3 with v2/v1 migration (a Phase 2 free-play
  save resumes at the Day 4 morning).
- **World:** the cave interior far off the map at (1000, 980), entered and
  left by a fade (`flow/cave.ts`), torchlit rig, metal parts, old box; the
  rockfall, cliff trail and clifftop plateau behind `cliffOpen`; signal pad
  and fire with smoke; the rescue helicopter (`RESCUE_SECONDS`,
  `RESCUE_SHOT`); Kai's Day 5 routes (`kaiRoute.ts`). All in
  `world/phase3.ts`, `scene/Phase3World.tsx`, `scene/models/phase3.ts`,
  `scene/models/cliffTrail.ts`.
- **Story A (Day 4 + classroom):** torch question, "Go in the cave.",
  metal, the box and the radio, "What do you have?" → "I have a radio." /
  "I have metal.", the Day 3/4 cards, "I need metal.", classroom mode
  (title + Settings toggle, pace-aware HUD/craft/hint counts, automatic
  hints after 20 s of live idle play).
- **Story B (Day 5 + ending, `flow/escape.ts`):** Kai walks to the rockfall,
  "Can you help me?", the climb, "Wow! I can see the whole island!", "Make a
  fire." at the pad, the radio's "What do you need?" (three answers, none
  wrong), the helicopter landing, the Rescue card, Day 6 free play.
- **Controller fixes on review:** quest.ts layout and doc comments restored
  after the logic worker packed it; e2e and shots open the craft menu with C
  (the pulsing Make button is never "stable" for a click); shots wait for
  camera catch-up and card fades; the Rescue card's sentence list is bounded
  so its buttons stay on a 768 px screen.
- **Verified:** typecheck, `npm test` (127), `npm run e2e` (26, incl. Day 4,
  Day 5 and classroom specs). `npm run shots` plays Days 1–5, the rescue and
  Day 6 plus a classroom pass (118 shots, ~12 min, in .tmp/shots);
  `npm run shots:world` 28 views. Reviewed by eye: cave, cliff trail,
  clifftop, signal fire, helicopter, every Day 4–5 story beat, Rescue card.
- **Performance (2026-10-22, tiled culling, `scene/tiles.ts`):** terrain and
  all static vegetation are split into 40 m frustum-culled tiles. After the
  vegetation overhaul the worst view is the clifftop at 107 draw calls / 154k
  triangles (budget 120 / 200k). New static scenery should join the existing
  vegetation tiles rather than add island-wide meshes. A Pirate Kit palm pass was
  tried and reverted (f091cb3 → bf34c1f); its measurements are in the revert
  message.

## Next Steps
1. **Classroom trial.** The real check now is students: does classroom mode
   fit the whole story in one 45-minute lesson (target 30–35 min of play),
   and do they find the cave, the rockfall and the clifftop? Untested on real
   Chromebooks, real speech recognition and real audio.
2. Phase 4 (polish) per the brief: environmental events (rain, the fire
   going out, an animal stealing food with the fence, Kai's missing tool),
   character animation, music/SFX pass, Free Survival mode (camp expansion,
   optional challenges, storage box, cooking station). It needs a design pass
   frozen before any worker builds it, like Phases 2 and 3.
3. Optional small polish seen in review: Kai half-hidden behind the CLIFF
   sign while waiting at the rockfall; the pad beacon pillar sits in the
   middle of the clifftop panorama on arrival.

## Known Issues / Unverified
- Real speech recognition, sound and Chromebook GPU are untested.
  SwiftShader fps is low (2–20), which is expected.
- The dither fade can still show a light stipple at the edges of near
  canopies (pond dock, tower legs). `THREE.Clock` deprecation warning
  (harmless).
- The full screenshot playthrough exceeds 10 minutes; run it in the
  background.

## Codex / Delegated Work
No run is in flight, and none is pending review. Codex usage ran out on
2026-10-15, after story slice B finished; the router checks availability
itself. Phase 3 work orders and results are in `.ai/p3-*.json` (gitignored).
