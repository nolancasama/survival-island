# Survival Island — working notes for agents

Read `CURRENT_STATE.md` first (the handoff), then `DESIGN_DECISIONS.md` for why
things are the way they are. `EXPANSION_PLAN.md` is the long-term direction.

## Testing

- Unit: `npm test` (Vitest, no browser, no lock). Typecheck: `npm run typecheck`.
- E2E: `npm run e2e` builds, then runs Playwright against `vite preview` on
  port 4174. The config uses SwiftShader (CI parity); a full run is about
  15 minutes on one worker. Run only the affected specs:
  `npx playwright test tests/e2e/<spec>` after `npm run build`.
- Visual: `node scripts/shots-ch3.mjs http://localhost:5287/` (and
  `shots.mjs`, `shots-world.mjs`, `shots-ch2.mjs`) with `npx vite --port 5287`
  running. `shots-ch3.mjs` uses the hardware GPU (`channel: "chromium"`) and
  logs the WebGL renderer; set `CB_SWIFTSHADER=1` for SwiftShader. Draw-call
  budget: 120 calls / 200k triangles in the worst view (the clifftop).

### Test map

| Source area | Specs |
| --- | --- |
| `logic/quest.ts`, `flow/days.ts`, `flow/session.ts`, `logic/save.ts` (shared: story, save, game loop) | all of Tier 1 |
| Days 1–3 (`flow/actions.ts`, `flow/kai.ts`) | `day1`, `day2`, `day3`, `classroom`, `microphone`, `animation`, `world-movement`, `terminology` |
| Day 4 cave (`flow/cave.ts`, `world/phase3.ts`) | `day4` |
| Day 5, the radio, the kept rescue (`flow/escape.ts`) | `day5`, `debug` |
| Chapter 2 (`flow/chapter2*.ts`, `logic/structures.ts`, `world/chapter2.ts`, `scene/Chapter2World.tsx`) | `chapter2`, plus `chapter3` (the co-carry is shared) |
| Chapter 3 (`flow/chapter3*.ts`, `logic/waterworks.ts`, `world/chapter3.ts`, `world/pipeWorld.ts`, `scene/Chapter3World.tsx`, `ui/PipeBar.tsx`) | `chapter3`; world/terrain changes also `world-movement` and `day3` (the pond clearing) |
| Title, chapter starts, debug picker (`ui/Screens.tsx`, `flow/dayStart.ts`) | `debug`, `chapter2`, `chapter3` |
| Terrain or collision (`world/island.ts`, `world/collision.ts`) | shared: all of Tier 1 |
