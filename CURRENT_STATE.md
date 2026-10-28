# Current State

## Microphone startup and solid-object collision release — 2026-10-28

Implemented in [PR #1](https://github.com/nolancasama/survival-island/pull/1),
on top of the earlier ten-issue polish pass already integrated on `main`
(commit `79ec58f`). User authorized deployment after successful validation.

### Changes

1. **Mic startup:** Removed the title-screen Speaking/Tapping mode selector
   and the separate Settings microphone toggle. On Start and Continue,
   the browser first checks speech recognition support and microphone
   access. If it cannot confirm a working microphone, a bilingual overlay
   asks the student to get a teacher, with a Retry action and an expandable
   teacher-assisted tapping fallback for the session. Mic timeouts no longer
   count as permission granted. An in-game speech failure still falls back
   to existing tappable responses, with no recurring startup overlay.
2. **Solid procedural trees:** Decorative jungle trees now have light
   collision circles generated from the same deterministic positions and
   visual trunk dimensions as the rendered trees. Movement checks only
   nearby fixed colliders using 8 m spatial cells. Existing authored palms,
   resource trees, boulders, placed buildings and wreck collision remain.
   Small vegetation stays nonblocking.
3. **Test harness:** Updated title and saved-game regression tests to use
   teacher-assisted tapping; updated screenshot scripts; added microphone
   startup tests and an explicit jungle trunk collision test. Added
   `.github/workflows/check-pr.yml` for PR unit, build and E2E verification.

### Validation

- GitHub Actions [run 40661957648](https://github.com/nolancasama/survival-island/actions/runs/40661957648):
  **154/154 unit tests**, TypeScript production build, and
  **38/38 Chromebook-emulated Playwright E2E tests** passed on the
  implementation commit `b17c783`.
- Test coverage includes startup help, microphone Retry, teacher fallback,
  normal speech and tapped commands, save/Continue migration, quest flow,
  bridge walking/running, cave exit and tree-collider geometry.
- CI uses software-rendered Chromium. Real school Chromebook performance,
  microphone permissions, speech recognition and classroom behavior remain
  **hardware validation TODOs**. No claims of real-device testing.
- This file is a documentation-only release update after the successful
  code verification, prepared before PR merge. GitHub Pages deployment
  status is authoritative in the `main` workflow after merging.

### Next steps

1. Verify `main` deploy workflow completes successfully and test the
   published GitHub Pages site.
2. Trial on real managed school Chromebooks, including unavailable/blocked
   microphones, microphone reconnection, slow rendering and speech accuracy.
3. Walk into representative decorative trees, authored trees, palms,
   large rocks, wreck, tents and other solids; adjust any remaining
   visually solid scenery missing collision.
4. After classroom validation, continue optional Phase 4 design work
   recorded in the historical Next Steps below.

---

## Ten-issue polish pass — 2026-10-27

The supplied plan was accepted with shared fade/surface helpers and focused
regression coverage. Local `main` was clean and matched fetched GitHub
`origin/main` at `3d61a58` before implementation.

1. **Standing/lying:** opening, bedtime, mornings, migrated mornings and
   faint/recovery switch completed poses under the existing fade overlay.
   The flow checks actual CSS opacity and renders the new pose under black;
   it no longer interpolates body rotation. Lying shots, sleeping overlay,
   dialogue and day progression remain.
2. **Pickup:** procedural thigh, knee and ankle pivots lower the hips, reach,
   and return smoothly. Each shoe samples the current walking surface and
   follows its slope. Movement resumes during recovery; no new dependency.
3. **Wreck:** one merged low-poly mesh now has a tapered open hull, ribs,
   fractured planks, partial deck, snapped mast, torn sail and broken rails.
   Position, scale, collision and existing debris remain compatible.
4. **Tent:** all active English/Japanese display and speech/tapping sentences
   use tent / テント. Internal `shelter` and phrase/building/save IDs remain.
5. **Day cards:** removed Title from day-complete and Rescue cards. Next day /
   Keep exploring remain; Settings still has Title.
6. **Roof:** overlapping leaf bands and ridge caps meet without gaps, with
   varied greens and economical bindings. One merged mesh still supports the
   existing preview and roof construction animation.
7. **Cup:** all active display and sentence wording uses cup / カップ. The
   `container` ID, recipes and water/drinking behavior remain unchanged.
8. **Bridge:** character feet previously used depressed river terrain while
   the visible deck had a separate height and narrower width. A shared
   `walkingSurfaceY` now matches the plank top and smooth bank approaches;
   collision follows the usable visible width. Feet, follow camera and shadow
   use that surface. `groundY` and saved placements are unchanged. Approaches
   merge into the existing rail mesh, adding no bridge draw call.
9. **Cave artifact:** rendered isolation proved the wall occlusion shader was
   discarding cave-floor fragments. Hiding blob shadows left the semicircle;
   using the opaque material removed it. The existing floor is now a separate
   opaque mesh; walls keep their fade/camera behavior. Walkable bridge geometry
   also uses the opaque ground material to avoid the same shader problem.
10. **Cave exit:** the old tiny circle was off-centre relative to the visible
    corridor opening. The trigger covers its illuminated throat at z ≥ 997.2;
    entry at (994, 995) stays safely inside. Q remains help. New tests walk
    from the chamber through two lanes with different camera orientations.

Important files: `game/flow/transition.ts`, `days.ts`, `session.ts`, `cave.ts`;
`game/world/surface.ts`, `collision.ts`, `phase3.ts`; `scene/Characters.tsx`,
`pickup.ts`, `Buildings.tsx`, `Environment.tsx`, `Phase3World.tsx`, model
generators; `game/types.ts`, `logic/english.ts`, `quest.ts`, UI labels/cards;
focused unit/E2E specs and the two existing screenshot scripts. Paths above
are under `src/` unless stated otherwise. Design rationale is recorded in
`DESIGN_DECISIONS.md`.

**Verification:** `npm run typecheck`, `npm test` (153), `npm run build` and
`npm run e2e` (36) pass. Browser coverage includes normal-speed fade opacity
at every pose switch, sleep/faint recovery, real keyboard bridge movement
both directions walking/running near both edges, two chamber-to-exit cave
routes, one-button day/Rescue cards, normal/classroom × speech/tapping
craft/inventory/save-resume, and legacy v1/v2 migration coverage. The Windows
runner stalled stopping its preview server after all cases completed; stopping
that test-owned server released teardown and the command exited 0.

**Rendering, SwiftShader 1024×768; calls / triangles before → after:**

| View | Before | After |
| --- | ---: | ---: |
| Beach spawn | 66 / 137,691 | 70 / 137,851 |
| Forest gap | 75 / 142,059 | 79 / 142,219 |
| Forest centre | 47 / 112,331 | 51 / 112,491 |
| Bridge | 39 / 53,162 | 43 / 53,462 |
| Pond | 36 / 52,500 | 40 / 52,660 |
| Camp at night | 95 / 149,968 | 99 / 150,964 |
| Cave chamber | 18 / 6,220 | 23 / 6,380 |
| Clifftop, worst view | 107 / 153,576 | 111 / 155,594 |

The extra four outdoor calls are the articulated player legs; the cave adds
one opaque floor call. Wreck: 272 → 1,294 triangles; roof: 168 → 864, each
still one merged mesh. Bridge approaches add 140 triangles inside an existing
draw call. The 120-call / 200,000-triangle budget is preserved.

`npm run shots:world` passes with 41 views, including the new wreck, player on
the deck, and pickup/recovery on flat ground and a cliff slope. Evidence is
in `.tmp/shots/world`, `.tmp/shots/polish-animation` (normal-speed lying,
standing, faint recovery and sleeping overlay), `.tmp/shots/polish-models`
(wreck angles, tent frame/built/ridge), and `.tmp/cave-isolate-*.png` (causal
material/shadow isolation). Logs: `.tmp/polish-final-{typecheck,unit,e2e}.log`,
`.tmp/polish-baseline-world.log`, `.tmp/polish-after-world.log`.

The existing story screenshot script also passes:
`npm run shots -- http://127.0.0.1:5287/ 1024x768 --tap` produced 118 frames
covering Days 1–5, Rescue, Day 6 and the classroom pass. It verifies the actual
tent preview/build sequence, tent/cup prompts and inventory, one-button day
and Rescue cards, cave transitions, and classroom counts/hints. Frames are
`.tmp/shots/1024x768-tap-*.png`; log `.tmp/polish-story-shots.log`. No browser
console errors occurred; the existing `THREE.Clock` deprecation warning remains.

**Remaining:** real school Chromebook GPU, real speech/audio, and classroom
timing still require hardware/student trials. Browser speech/audio are
stubbed; software rendering statistics are not a hardware FPS benchmark.
Claude retains final aesthetic review of the captured frames.

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
   additional character animation, music/SFX pass, Free Survival mode (camp expansion,
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
The ten-issue polish work is integrated, with focused model, wording/UI and
world investigations. No delegated work remains. Phase 3 work orders and
results are in `.ai/p3-*.json` (gitignored); the latest acceptance evidence is
listed above. Claude's final aesthetic review remains separate.
