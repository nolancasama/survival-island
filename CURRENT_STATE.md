# Current State

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
- **Verified:** typecheck, `npm test` (123), `npm run e2e` (26, incl. Day 4,
  Day 5 and classroom specs). `npm run shots` plays Days 1–5, the rescue and
  Day 6 plus a classroom pass (118 shots, ~12 min, in .tmp/shots);
  `npm run shots:world` 28 views. Perf worst view: clifftop, 98 draw calls,
  106k triangles (budget 120 / 200k). Reviewed by eye: cave, cliff trail,
  clifftop, signal fire, helicopter, every Day 4–5 story beat, Rescue card.

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
