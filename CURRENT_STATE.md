# Current State

## Current Goal

Release **Chapter 3 "Running Water"** (Days 9–10, Expansion Plan Milestone 4) and the narrative correction (the
rescue moved to the end of the story). The user asked to push it live; the release is **paused mid-way** (the user
stopped the session for usage). Live site (https://nolancasama.github.io/survival-island/) still runs Chapter 2.

## Release status (where it stopped)

1. Feature commit `38f31a2` on branch `feature/chapter3-running-water`, pushed. **PR #5 open**
   (https://github.com/nolancasama/survival-island/pull/5); it showed CONFLICTING because `main` had moved.
2. `origin/main` (`0981728`) gained three testing-workflow commits from another session (machine-wide test lock,
   GPU-default Playwright, build-identity checks, screenshot scripts, a new `AGENTS.md`). They were merged into the
   branch locally: **the merge is resolved but NOT committed** (`git status` shows a merge in progress; only
   `AGENTS.md` conflicted and was resolved by taking main's version plus Chapter 3 rows in its test map).
3. After the merge: `npm run typecheck`, 224 unit tests and `npm run test:kit` (8/8) pass.
4. A full functional run (`npm run e2e`, GPU, Apple Metal renderer, 1 worker) is **inconclusive**: 38 passed,
   11 failed, but it took 3.4 h instead of ~15 min and failures are timeouts across untouched specs (Day 1,
   classroom) plus a 180 s browser-launch timeout — the machine stalled or slept. Treat it as untrusted.
   The pre-merge code passed the full suite 48/49 in 14 min (SwiftShader), and the one failure was fixed and
   re-passed (animation, Day 5, Chapter 3: 9/9). The merge changed only test infrastructure and docs.

**To finish:** `git commit` (concludes the merge) → rerun `npm run e2e` on an idle machine → if green, push →
PR #5's CI (`check-pr.yml`) → merge → `deploy-pages.yml` deploys on the push to `main` → check the live bundle.

## What Changed (2026-11-28)

- **The rescue moved to the end of the story.** Day 5 keeps the rockfall, signal fire and clifftop; the radio
  answers once and fades ("I can't … hear … you"), a camera cut shows the wreck's boxes in the next cove (with
  floating wreckage at its mouth in Chapter 1), and the **Chapter 1 card** follows (no sleep). Fact `radioTried`;
  `rescued` and the whole helicopter sequence are kept for the final chapter (`rescue()` in `flow/escape.ts`,
  played by the e2e hook `playRescue`).
- **Chapters are lessons:** cards at the ends of Days 5, 8 and 10 (`chapterEndingOn`, button `next-chapter`);
  title teacher starts for Chapter 2 and **Chapter 3** (`chapter-three`); debug picker Days 1–11.
- **Chapter 3:** the Upper Stream shelf above the beach's west headland (high waterfall, pool, stream with a
  ford, lower falls, table rock, two intakes), reached the long way from the pond; the rock stairs to the beach
  open on Day 9 by cutting fallen bamboo (+4 poles). Day 9: "What can you see?", "Let's build a pipe.", Kai's
  bucket test pipe (default post too high, one notch lower works, two too low). Day 10: 6 poles, a pipe down the
  stairs to Kai's tank (or carry the tank with Kai), the camera follows the water, "The tank is full.", boil.
  Free play from Day 11; the network keeps refilling the tank.
- **Modular pipes:** `logic/waterworks.ts` (pure, unit-tested): five post notches, long/short pieces, 16 aiming
  directions, snapping, deterministic flow (climbing pipes overflow, open ends pour, rims), Kai's diagnosis,
  branches in the model only. `world/pipeWorld.ts` adapts it to the world; `ui/PipeBar.tsx` is the UI.
- **Saves v5:** v4 rescued → `radioTried`; v4 free play (Day ≥ 9) → Day 9 morning; the network is saved.
- Tests: 224 unit tests; e2e `chapter3.spec.ts` (3 tests), Day 5 rewritten plus a rescue-hook test, others
  updated for v5. `scripts/shots-ch3.mjs` renders the region and budget views (GPU).

## Testing workflow (from main, 2026-11-28)

Browser tests go through the npm scripts, which take the machine-wide lock and default to hardware Chromium
(`CB_SWIFTSHADER=1` / `npm run e2e:compat` for SwiftShader). See `AGENTS.md` for tiers, the test map and when
to run all of Tier 1. One worker by default.

## Important Decisions

`DESIGN_DECISIONS.md` "2026-11-28 — Narrative correction and Chapter 3 (Milestone 4) design", including
"Changes made while building"; the testing workflow entries follow it. `EXPANSION_PLAN.md` has the corrected
story table.

## Relevant Files

- `src/game/logic/waterworks.ts`, `src/game/world/chapter3.ts`, `src/game/world/pipeWorld.ts` (+ tests).
- `src/game/flow/chapter3.ts`, `chapter3Focus.ts`, `escape.ts`; `src/scene/Chapter3World.tsx`,
  `src/scene/models/chapter3.ts`; `src/ui/PipeBar.tsx`, `src/ui/Screens.tsx`.
- `tests/e2e/chapter3.spec.ts`, `tests/e2e/day5.spec.ts`; `scripts/shots-ch3.mjs`.

## Codex / Delegated Work

None. The user said "no router for now since no usage"; Claude built everything directly.

## Known Issues

- Untested on real Chromebooks: speech of the ten new sentences, the pipe bar on touchpads/touch, frame rate
  on the shelf (Apple GPU: shelf with a full network 96 calls / 121k triangles, clifftop 118 / 180k, camp at
  night 106 / 175k), and whether Chapter 3 fits one lesson.
- Day 10 difficulty is unknown: the beach rises toward camp, so a middle-notch line climbs; Kai's hints and
  carrying the tank are the intended ways out.
- Kai's test runs only when you talk to him; only the last piece of a line can turn; no branching UI yet.
- The follow camera can sit inside the shelf's west cliff when looking back west (scenery dithers away).

## Next Steps

1. Finish the release (see "Release status").
2. Classroom trials of Chapters 1–3 on Chromebooks; record findings.
3. Fix what the trial shows; then a design pass for Milestone 5 (better housing).

## Repository State

- Branch `feature/chapter3-running-water`: feature commit `38f31a2` pushed; merge of `origin/main` (`0981728`)
  resolved locally, uncommitted. PR #5 open.

## Checkpoint

- Updated: 2026-11-28
- Reason: release paused at the user's request (usage); merge resolved but uncommitted, e2e rerun needed.
