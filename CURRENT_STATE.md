# Current State

## Current Goal

The narrative correction and **Chapter 3 "Running Water"** (Days 9–10, Expansion Plan Milestone 4) are built on
branch `feature/chapter3-running-water`, **uncommitted** (the user has not asked for a commit, PR or deploy yet).
Next: the user's review, then commit → PR → CI → deploy; then classroom trials of Chapters 1–3 on Chromebooks.

## What Changed (2026-11-28)

- **The rescue moved to the end of the story.** Day 5 keeps the rockfall, signal fire and clifftop; the radio
  answers once and fades ("I can't … hear … you"), Kai sees the wreck's boxes in the next cove (a cut over the
  east headland into the cove; floating wreckage at its mouth in Chapter 1), and the **Chapter 1 card** follows
  (no sleep). Day 6's first line refers back to it. Fact `radioTried`; `rescued` and the whole helicopter
  sequence are kept for the final chapter (`rescue()` in `flow/escape.ts`, played by the e2e hook `playRescue`).
- **Chapters are lessons:** cards at the ends of Days 5, 8 and 10 (`chapterEndingOn`, button test id
  `next-chapter`); title teacher starts for Chapter 2 and **Chapter 3** (`chapter-three`); debug picker Days 1–11.
- **Chapter 3 (Days 9–10):** the Upper Stream shelf above the beach's west headland (high waterfall, pool,
  stream with a ford, lower falls, table rock, two intakes), reached the long way from the pond clearing; the
  rock stairs to the beach open on Day 9 by cutting fallen bamboo (+4 poles). Day 9: "What can you see?",
  "Let's build a pipe.", Kai's bucket on the table rock, a test pipe (the default post is too high, one notch
  lower works, two is too low), "The water is flowing." Day 10: 6 poles from the grove, a pipe down the stairs
  to Kai's tank at camp (or carry the tank with Kai), the water followed down the pipe by the camera, "The tank
  is full.", boil it. Free play from Day 11; the network keeps working and refills the tank.
- **Modular pipes:** `logic/waterworks.ts` (pure, unit-tested): joints with five notches, long/short pieces,
  16 aiming directions, snapping to containers and dry joints, deterministic flow (climbing pipes overflow at the
  lower post, open ends pour, containers catch above the rim), diagnosis for Kai's test (too high / too low /
  missed / too short / gap / far), branches supported in the model. `world/pipeWorld.ts` is the real-world
  adapter (intake heights, containers, posts and channels vs water/rocks/paths). UI: `ui/PipeBar.tsx` (lay bar
  and post panel, keys T/X/Z/E/Backspace/Esc and Q/R/Delete).
- **Saves v5** (`si.save.v5`): v4 rescued → `radioTried` (not rescued); v4 free play (Day ≥ 9) resumes at the
  Day 9 morning; the network, bucket/tank water, carry `tank`, Kai stage `upper` are saved.
- Old scenery fixes: the west headland's green hill mesh removed (it covered the shelf); a headland boulder moved
  off the stairs' foot.
- Tests: 224 unit tests (new: waterworks, chapter 3 world/routes, v5 migration, quest, day starts). E2E: new
  `chapter3.spec.ts` (3 tests), Day 5 rewritten for the new ending plus a rescue-hook test, Day 4/Chapter 2/debug
  updated for v5 and the moved rescue. `scripts/shots-ch3.mjs` renders the region and the budget views on the GPU.
- `AGENTS.md` (new) holds the test map.
- Verified 2026-11-28: typecheck, 224 unit tests, production build; full Playwright suite 48/49 (the one failure, the
  bedtime animation test still using Day 9 as free play, was moved to Day 11 and then passed with Day 5 and Chapter 3
  after the last source changes: 9/9). GPU render pass of all Chapter 3 views reviewed.

## Important Decisions

All in `DESIGN_DECISIONS.md` "2026-11-28 — Narrative correction and Chapter 3 (Milestone 4) design", including
"Changes made while building" (the cove shot, tank size/position, plan-on-put fix, exact turning, Kai's focus,
distance culling with measured draw calls). `EXPANSION_PLAN.md` has the corrected story table.

## Relevant Files

- `src/game/logic/waterworks.ts` (+ test) — the water network model.
- `src/game/world/chapter3.ts` (+ test) — shelf geometry, ground shaping, walkability, intakes, stairs, Kai routes.
- `src/game/world/pipeWorld.ts` — the model's environment and world checks.
- `src/game/flow/chapter3.ts`, `chapter3Focus.ts` — Days 9–10, laying/editing, containers, live water, scenes.
- `src/game/flow/escape.ts` — Day 5's radio call, the cove shot, the kept `rescue()`.
- `src/scene/Chapter3World.tsx`, `src/scene/models/chapter3.ts` — scenery, falls, pipes, water FX, preview.
- `src/ui/PipeBar.tsx`, `src/ui/Screens.tsx` (chapter cards, Chapter 3 start).
- `tests/e2e/chapter3.spec.ts`, `tests/e2e/day5.spec.ts`; `scripts/shots-ch3.mjs`.

## Codex / Delegated Work

None. The user said "no router for now since no usage"; Claude built everything directly.

## Known Issues

- **Untested on real Chromebooks:** speech recognition of the ten new sentences, touchpad/touch use of the pipe
  bar, frame rate on the shelf (measured only on an Apple GPU: shelf with a full network 96 calls / 121k
  triangles, clifftop 118 / 180k, camp at night 106 / 175k), and classroom timing of Chapter 3 (target one lesson).
- Whether Grade 5 students can solve Day 10 without help is unknown: the beach rises toward camp, so the
  middle-notch line climbs; Kai's hints and carrying the tank are the intended ways out. Watch this in the trial.
- Kai's test only runs when you talk to him (he stays at camp on Day 10); there is no automatic commentary.
- Only the last piece of a line can turn; branching, valves and wheels are model-only (not in the UI).
- The follow camera can end up inside the shelf's west cliff when looking back west (scenery dithers away).
- E2E runs on SwiftShader (the project's config); a full run takes about 15 minutes.

## Next Steps

1. User review; then commit, PR, CI, deploy (not yet asked for).
2. Classroom trials of Chapters 1–3 on Chromebooks; record findings (speech, pipe UI, timing, frame rate).
3. Fix what the trial shows. Then Milestone 5 (better housing) needs a design pass.

## Repository State

- Branch `feature/chapter3-running-water` off `main` (`719ed4a`), all changes uncommitted.

## Checkpoint

- Updated: 2026-11-28
- Reason: narrative correction and Chapter 3 built and verified locally.
