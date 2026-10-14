# Current State

## Status
Phase 1 (beach, Day 1) is on `main` (`125a6e3`; the repo is private).
**Phase 2 so far (the world, the logic and story slice A: Days 1–2 with
day/night and sleeping) is committed on branch `phase-2-days-1-2` (`3a1953e`,
pushed); `main` is not updated yet.** Story slice B (Day 3) is next. The design is in
DESIGN_DECISIONS.md under "2026-10-13 — Phase 2 (Exploration) design" plus
"2026-10-14 — Phase 2 decisions made while building". Read those first.

## Phase 2: done (committed on the branch, reviewed)
- **World slice (accepted visually):** forest, stream, broken/built bridge,
  pond with dock and fish spots, cave mouth, cliff path rockfall, signs,
  regions and gates (`pathCleared` / `bridgeBuilt`), forest nodes, shelter
  frame/built model, stars and moonlight, line-of-sight dither fade. Perf in
  the Day 1–2 playthrough: 40–79 draw calls, ≤62k triangles.
- **Logic slice:** Days 1–3 quest data plus free-play days, the clock
  (`logic/clock.ts`), night/shelter stamina, `afterSleep`, `consume`,
  `cookFish`, `BRIDGE_NEEDS`, the new phrases, save v2 with v1 migration.
- **Story slice A (done this session, Claude direct; Codex was out of quota):**
  - `flow/places.ts`: `targetPosition(id)` / `targetReachable` for nodes,
    places (fallen tree, bridge, crate, water/fish spots, signs) and
    buildings. Used by beacons (`scene/Nodes.tsx`), focus, edge arrows and
    the e2e hook.
  - `flow/days.ts` (new): Day 1 `celebrate()` → "It's late. Let's sleep." →
    the "I want to sleep." prompt; `eveningCue()` for Day 2+; `trySleep` /
    `sleepTonight` (starry overlay, `afterSleep`, `sleptDay`, card);
    `nextDay()` (morning, day title, Kai's talk); `sleepPlace`,
    `canSleepNow`, `placeKaiAtCamp`.
  - `session.ts`: the clock drives the light and the music (`LIGHT_STEPS`
    removed), storyFloor on quest change, night/shelter stamina, faint wakes
    at shelter > fire > Kai, the clock is saved, resuming a finished day goes
    to `nextDay`. `showBeacons` takes several kinds, only lights reachable
    nodes, and falls back to the fallen palm; `showPlaces(ids)`.
  - `kai.ts`: Day 2 morning talk ("Can you make a stone axe?"), Day 2 hints
    per step with beacons, bedtime lines, a generic morning for later days.
  - `actions.ts`: trees need the axe (chop, +2 wood), leaves (+2, the first
    teaches the shelter), the fallen palm (camera shot, "Wow! The forest!"),
    building the shelter, sleeping at a shelter or lit fire, the three
    signs, relevance-ordered "I need…" (max 4, incl. sleep and water), F eats
    the first food.
  - UI: dynamic day-end card ("Day N+1 →", today's English, NEW badges),
    `DayTitle`, `SleepOverlay`, edge arrows in `WorldOverlay`, icons `tree`
    and `moon`, Day 2 hints, free-play objective.
  - e2e hook: `startDay(n)`, `setClock(t)`, `reachable(id)`, reachable
    `nodes()`, goTo for places, more state (day, clock, isNight, sleptDay,
    daySaid, dayNew, toasts, placeOk…).
- **Verified:** typecheck, `npm test` (94), `npm run e2e` (12: 9 Day 1 +
  3 new Day 2). The Day 2 spec was checked to fail on a broken build (sleep
  allowed by day). `npm run shots` plays Days 1–2 (54 shots in .tmp/shots);
  reviewed: sleep prompt, starry sleep, both day cards, Day 2 title, axe
  question, palm cut and forest shot, edge arrows, leaves discovery, chop,
  shelter frame/built, evening, night, sleep label.

## Next Steps
1. **Story slice B.** The work order is `.ai/story-b.json` (Day 3: bridge,
   water and drinking, fishing, cooking, Kai's water/fish choice, the
   after-Day-3 card, free play, README). Route it:
   `node ~/.claude/workers/bin/route.js .ai/story-b.json`. Update its brief
   first: slice A now exists (`flow/days.ts`, `flow/places.ts`, the e2e
   `startDay`), Kai's Day 3 morning replaces the generic one in
   `morningTalk`, "I need water." already lights water/bridge/palm, and
   `DAY_DONE` in `ui/Screens.tsx` needs a Day 3 entry.
2. Acceptance after slice B: `npm run e2e`, `npm run shots`, `npm run
   shots:world` (shots need `npx vite preview --port 5287`; it binds to
   `localhost`, so pass `http://localhost:5287/` to the script).
3. Merge `phase-2-days-1-2` into `main` when the user wants (a
   fast-forward), and commit slice B when the user asks.

## Known Issues / Unverified
- Real speech recognition, sound and Chromebook GPU are untested (as in
  Phase 1). SwiftShader fps is low (4–7), which is expected.
- Night at clock 0.95 reads grey-blue rather than deep blue on the beach; it
  is the accepted world lighting, but worth a look on a real screen.
- The dither fade can still show a light stipple at the edges of near
  canopies. `THREE.Clock` deprecation warning (harmless).

## Codex / Delegated Work
No run is in flight. Codex was in a usage-limit window (until about
2026-10-14 22:58 local) when slice A was routed, so the router assigned it to
Claude. Work orders and results are in `.ai/` (gitignored), incl.
`story-a2.json` (the completion order) and `snapshot-pre-a2/` (a copy of the
tree before slice A was finished).
