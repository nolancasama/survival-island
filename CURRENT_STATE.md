# Current State

## Current Goal

Chapter 2 "A Better Camp" (Days 6–8, Expansion Plan Milestones 0–3) is **built and live** at
https://nolancasama.github.io/survival-island/. The next real step is a classroom trial of Days 6–8 on school
Chromebooks; Milestone 4 needs a design pass before any building.

## What Changed

- **Chapter 2, after the rescue:** Day 6, Shipwreck Cove: a tidal passage opens east of the beach; "What is this?";
  a cove crate; canvas and rope; the sea chest carried home with Kai becomes the storage box (the bag holds 20).
  Day 7, Bamboo Grove: cut the thicket, bamboo poles, socket-built drying rack that shakes until braced on a long
  and a short side, dried fish. Day 8, Rain: scripted rain, barrel from the cove, rain catcher (corner heights,
  barrel position, Kai's "How is it?" test), boil the rain water. Free play from Day 9 with a daily shower.
- **Safe water on all days:** collected water must be boiled at a lit fire before drinking; Day 3 gained a Boil step.
- **Saves v4** (`si.save.v4`): v3 water becomes boiled water; a v3 free-play save resumes at the Day 6 morning.
- **Entry points:** title "Chapter 2" button (teacher start, test id `chapter-two`); Rescue card button "Chapter 2 →"
  (test id still `keep-exploring`).
- Bugs found by the new tests and fixed: chest could not be put down; strong rack could not be focused; Kai's rack
  praise left the game stuck in talk mode; microphone overlay kept "Teacher options" open on a second showing.
- **Debug day picker (branch `feature/debug-day-picker`, not yet merged):** with `?debug=1`, the title shows
  "Debug: start at day" 1–9; the day setup is shared with the e2e `startDay` (`src/game/flow/dayStart.ts`).
- Released in PR #2 (merge `24831d5`); CI on the final head: 187 unit tests, build, 43/43 e2e; `deploy-pages`
  succeeded and the live bundle was checked to contain the Chapter 2 build.

## Important Decisions

All durable decisions are in `DESIGN_DECISIONS.md` "2026-11-23 — Chapter 2 (Milestones 1–3) design", including
"Changes made while building" (four lashing notches, chest may rest anywhere but the bag grows only at camp, rack
focus bias, draw-call consolidation with numbers). The user asked Claude to build this directly ("no codex").

## Relevant Files

- `EXPANSION_PLAN.md` — the plan, Claude's review (Part A), as-built roadmap, risks; Milestones 4–12 are outline only.
- `src/game/flow/chapter2.ts` — all Day 6–8 flows (mornings, help, carrying, sockets, rack, catcher, barrel, boiling, rain ticks).
- `src/game/flow/chapter2Focus.ts` — Chapter 2 focus candidates, `offeredSockets`, the rack focus bias.
- `src/game/logic/structures.ts` / `weather.ts` — pure rack/catcher/flow model and scripted rain (unit-tested).
- `src/game/world/chapter2.ts` — cove, passage, grove coordinates, gates, nodes, `DETAIL_DISTANCE`.
- `src/scene/Chapter2World.tsx` — cove, grove, structures, carried object, rain; merged meshes for the draw-call budget.
- `tests/e2e/chapter2.spec.ts` — tapping playthrough of Days 6–8 plus the v3 save migration.
- `scripts/shots-ch2.mjs` — renders Chapter 2 views and budget worst cases (needs `npx vite --port 5287`).
- `src/game/flow/dayStart.ts` — story state for starting any day (debug picker and e2e `startDay`).

## Codex / Delegated Work

None. Everything was built by Claude directly at the user's request.

## Known Issues

- Untested on real Chromebooks: speech recognition of the new sentences, audio, frame rate in the cove and rain
  (all measurements are SwiftShader), and classroom timing of Days 6–8.
- The Day 8 e2e moves the barrel under the stream with a test hook; "Move it left/right" is not covered end to end.
- Kai following the player's path while co-carrying can look odd on sharp reversals.
- Chapter 2's post-rescue framing is temporary (EXPANSION_PLAN.md A1/A5).
- Draw-call headroom is small: clifftop 117/120 calls (185k triangles); new scenery must stay merged.

## Next Steps

1. Classroom trial of Days 6–8 on real Chromebooks; record findings.
2. Fix what the trial reveals (speech matching, performance, confusing steps).
3. Draft a frozen design for Milestone 4 (Upper Stream and Water Distribution) in `DESIGN_DECISIONS.md` before building.

## Repository State

- `main` = `origin/main` at `fceefaa` (Chapter 2 live). Work in progress on `feature/debug-day-picker` (the picker,
  `dayStart.ts`, tests, and this file); merge it to deploy the picker.

## Checkpoint

- Updated: 2026-11-23
- Reason: Chapter 2 released and deployed; handoff rewritten as current state.
