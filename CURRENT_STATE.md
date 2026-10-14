# Current State

## Status
**Phase 2 is complete: Days 1–3 and free play from Day 4, all on `main`
and pushed** (Day 3 is `2077199`; the repo is private). The design is in
DESIGN_DECISIONS.md: "2026-10-13 — Phase 2 (Exploration) design",
"2026-10-14 — Phase 2 decisions made while building" and "2026-10-15 —
Phase 2 story slice B decisions". Read those first.

## Phase 2
- **World slice (accepted visually):** forest, stream, broken/built bridge,
  pond with dock and fish spots, cave mouth, cliff path rockfall, signs,
  regions and gates (`pathCleared` / `bridgeBuilt`), forest nodes, shelter,
  stars and moonlight, line-of-sight dither fade (a cone). Perf in the
  Day 1–2 playthrough: 40–79 draw calls, ≤62k triangles.
- **Logic slice:** Days 1–3 quest data plus free-play days, the clock
  (`logic/clock.ts`), night/shelter stamina, `afterSleep`, `consume`,
  `cookFish`, `BRIDGE_NEEDS`, the phrases, save v2 with v1 migration.
- **Story slice A (Days 1–2):** `flow/places.ts` (one id space for
  everything the game points at), `flow/days.ts` (celebrate, evening cue,
  sleeping, `nextDay`), clock-driven light and music, Day 2 in `kai.ts` and
  `actions.ts`, the dynamic day card, day title, sleep overlay, edge arrows,
  relevance-ordered "I need…", and the e2e hook (`startDay(n)`, `setClock`,
  `reachable`, `goTo` for places).
- **Story slice B (Day 3, Codex):** Kai's morning with "What do
  you want to do?" (water → coconut + container first; fish → rod first,
  plus a crate beacon if the rope box is closed); "Build a bridge." at the
  bridge with 4 wood; the water container, "Get some water." at the water
  spots, "Drink the water." (F or tapping water); the fishing rod, "Catch a
  fish." (automatic cast → wait → bite → fish, each spot rests 15 s, saved);
  "Cook the fish." at a lit fire, "Eat the fish."; Kai's evening thanks per
  choice; Day 3 hints; the Day 3 card ("To be continued... Next time: the
  cave!", "Keep playing"); free play from Day 4 (no checklist, free-day
  sleep goes straight to the next morning); cave/cliff sign texts; sounds
  (fill, gulp, cast, plop, fish splash, sizzle, bridge); fishing pose, rod,
  line, bobber and jumping fish; README updated.
  - Claude's fixes on review: the bobber now lands in open water toward the
    pond's middle from where the player stands (it used to land on the
    dock), the shots script waits for the Day 3 card's fade-in, the Day 3
    save/resume spec holds the spot rest long (it was flaky on a slow
    reload; `setTaken` in the e2e hook accepts fish spots), and the slice B
    decisions moved to the end of DESIGN_DECISIONS.md.
- **Verified for slice B:** typecheck, `npm test` (101), `npm run e2e` (16:
  9 Day 1, 3 Day 2, 4 Day 3). `npm run shots` plays Days 1–3 and Day 4
  (81 shots in .tmp/shots); reviewed: morning choice, bridge build and built
  bridge, fishing with the bobber in the water, catch, cooking, Day 3 card,
  Day 4 free play.

## Next Steps
1. Not yet looked at: the second fishing spot (the flat rock, `fish-1`) in a
   screenshot, and `npm run shots:world` after slice B (no world changes,
   so low risk).
2. Phase 3 (the cave, the clifftop, the torch, metal, the signal fire, and
   classroom mode, which tunes counts and clock speed) has no design yet.
   It starts with a design pass like "2026-10-13 — Phase 2 (Exploration)
   design", frozen before any worker builds it.

## Known Issues / Unverified
- Real speech recognition, sound and Chromebook GPU are untested (as in
  Phase 1). SwiftShader fps is low (4–7), which is expected.
- Night at clock 0.95 reads grey-blue rather than deep blue on the beach; it
  is the accepted world lighting, but worth a look on a real screen.
- The dither fade can still show a light stipple at the edges of near
  canopies, visible around the pond dock. `THREE.Clock` deprecation warning
  (harmless).

## Codex / Delegated Work
No run is in flight. Slice B (`.ai/story-b.json`) was built by Codex (Sol)
and is reviewed and accepted; its first e2e run had one flaky failure, since
fixed. Work orders and results are in `.ai/` (gitignored).
