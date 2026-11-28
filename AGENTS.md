# Agent Instructions

Keep implementation scoped to the request. Inspect relevant existing code and
design documents before changes. Preserve unrelated behavior. Do not commit or
push unless explicitly instructed.

## Testing

Read `C:/Users/nolan/.claude/testing/TESTING_WORKFLOW.md` before writing or
running browser tests. The accepted, self-contained kit is in `tests/support/`.

Preview port: **4174**, or **4274** in a git worktree (`.git` is a file).
`PREVIEW_PORT` overrides this. Global setup compares the served HTML with the
current `dist/index.html`; a mismatch fails with `WRONG_SERVER`. `BASE_URL`
selects an external server and skips that local build identity comparison.

Every browser run must use the npm scripts, which take the machine-wide lock
before building. Never bypass it, run alongside another browser suite, or stop
another agent's run. Playwright defaults to hardware Chromium at 1366 x 768,
device scale factor 1. Verify and report `[WebGL UNMASKED_RENDERER]`, workers,
elapsed time and pass/fail. SwiftShader is only for compatibility or an
unavailable GPU, never a Chromebook simulation.

| Tier / check | Command | Scope |
| --- | --- | --- |
| 1 Functional | `npm run e2e` | `tests/e2e/` |
| 2 Visual | `npm run e2e:visual` | `tests/visual/` |
| 3 Performance | `npm run e2e:perf` | `tests/perf/` |
| 4 Full regression | `npm run e2e:full` | All tiers, including `tests/soak/` |
| Compatibility | `npm run e2e:compat` | Functional with `CB_SWIFTSHADER=1` |
| Reusable kit | `npm run test:kit` | Node self-tests for lock and identity |
| Types | `npm run typecheck` | TypeScript checks |
| Unit | `npm test` | Existing Vitest tests |

Select affected specs with, for example, `npm run e2e -- tests/e2e/day1.spec.ts`.
Visual, perf and soak tiers are currently empty. Run visual for rendering,
layout, art, camera or UI appearance changes; perf for changes to frame cost.
Full regression is for releases, major cross-system changes or explicit requests.
The legacy `shots` and `shots:world` commands also build under the lock, but
their existing standalone scripts still launch SwiftShader and require an
already running external preview (default port 5287). They are legacy evidence
tools, not the hardware Chromium tier runner. Do not use their FPS as a device
benchmark; shut down any preview you start for them.

### Test map

| Spec | Coverage | Source areas |
| --- | --- | --- |
| `tests/e2e/day1.spec.ts` | Day 1 speech/tap loop, help ladder, mic denial/interim result, save/resume, beacons, fainting, placement refusal | `src/game/flow/`, `src/game/logic/`, `src/audio/`, `src/ui/`, `src/game/store.ts` |
| `tests/e2e/day2.spec.ts` | Day 2 crafting, axe/forest gates, leaves, tent, sleep and evening resume | `src/game/flow/`, `src/game/logic/`, `src/game/world/`, `src/ui/` |
| `tests/e2e/day3.spec.ts` | Bridge, cup/water, fishing/cooking, refusals, beacons, night saves and Day 4 morning | `src/game/flow/`, `src/game/logic/`, `src/game/world/`, `src/ui/` |
| `tests/e2e/day4.spec.ts` | Cave/torch branches, metal/radio, cave resume and v2 save migration | `src/game/flow/`, `src/game/logic/`, `src/game/world/phase3.ts`, `src/ui/` |
| `tests/e2e/day5.spec.ts` | Escape, Kai routes, signal fire, radio answers, rescue, Day 6 and classroom costs | `src/game/flow/escape.ts`, `src/game/logic/`, `src/game/world/phase3.ts`, `src/scene/`, `src/ui/` |
| `tests/e2e/classroom.spec.ts` | Classroom costs, Settings toggle, live idle hints and normal-pace exclusion | `src/game/logic/pace.ts`, `src/game/flow/`, `src/game/store.ts`, `src/ui/` |
| `tests/e2e/animation.spec.ts` | Normal-time intro/faint/sleep pose switches covered by fade; sleeping overlay | `src/game/flow/transition.ts`, `src/game/flow/`, `src/scene/`, `src/ui/` |
| `tests/e2e/terminology.spec.ts` | Tent/cup craft prompts, inventory and resume across speech/tap and normal/classroom | `src/game/logic/`, `src/game/flow/`, `src/ui/`, `src/audio/` |
| `tests/e2e/world-movement.spec.ts` | Bridge banks/deck and closed crossing; keyboard cave exit at two camera yaws | `src/game/world/surface.ts`, `src/game/world/island.ts`, `src/game/flow/cave.ts`, `src/game/runtime.ts`, `src/scene/` |
| `tests/e2e/chapter2.spec.ts` | Chapter 2 Days 6–8: cove, chest carrying, thicket/bamboo rack, rain barrel and boiling; v3 save resumes into Chapter 2 | `src/game/flow/`, `src/game/logic/`, `src/game/world/`, `src/game/store.ts`, `src/scene/`, `src/ui/` |
| `tests/e2e/debug.spec.ts` | Hidden `?debug=1` day picker: hidden by default, a day button starts that morning | title/debug UI in `src/ui/`, `src/game/flow/` |
| `tests/e2e/microphone.spec.ts` | Missing-microphone teacher warning, retry resumes speaking, teacher options start closed | `src/audio/`, `src/ui/`, `src/game/flow/` |
| `tests/support/kit.selftest.mjs` | Lock serialization, stale recovery, waiting timeout, nesting, unavailable directory and server identity | `tests/support/test-lock.mjs`, `tests/support/server-identity.ts` |

All existing specs remain functional. Animation screenshots accompany semantic
pose/overlay assertions. Triangle/draw-call checks belong in Tier 1; FPS-only
budget specs belong in perf and evidence-only specs belong in visual.

Run **all of Tier 1** for shared/core changes: game loop/runtime, input/movement,
save/progress, speech/audio, scene/level loading, renderer setup, shared UI shell,
story flow/transition machinery, shared game rules/world gates, build config or
browser test setup. For localized changes, run mapped specs and direct consumers.

One worker is the default. **PW_WORKERS=2 is not yet eligible here:** no project
benchmark records identical results with at least 25% faster execution and no
more than 50% additional CPU work. Never use more than two workers. Functional
tier measured 2026-11-28 (before the Chapter 2 merge): 36/36 in 364 s on the GTX 1080.

The kit lock's read-only semantic state is the `holder` JSON record and
`tickets/*.json` queue under `AGENT_TEST_LOCK_DIR` (default:
`<LOCALAPPDATA or homedir>/agent-test-lock`); modification times are heartbeats.
Its harness establishes holder/queue preconditions before checking outcomes.
Unavailable lock storage logs `TEST_LOCK_UNAVAILABLE` and uses the kit fallback.
Existing gameplay state is available through `window.__si.state()` with
`?e2e=1`; this migration adds no gameplay state machine or acceptance checks.

Wait on semantic readiness state. Preserve timed-mechanic waits with a comment.
Desktop FPS is a GTX 1080 benchmark; Chromebook performance is unmeasured.
Never update snapshots/evidence to make tests pass. Stop after required checks
pass. Leave no preview servers or browsers running.
