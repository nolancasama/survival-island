# Survival Island

A 3D survival crafting adventure for Japanese grade 5–6 students learning
English. The player is shipwrecked on a tropical island: explore, collect,
craft, build a camp, help Kai, and escape. English is how you act. You say
"Get the wood." to pick up your first log, "I want to make a campfire." to
craft it, and "I need water." when you are stuck.

**Status:** Phase 2 implemented: Days 1–3, the forest and pond, bridge building,
water, fishing, cooking, shelters and sleeping, then free play from Day 4.
The cave and cliff remain closed until Phase 3. Executor acceptance is pending.
See `CURRENT_STATE.md`.
Design decisions and the reasons for them are in `DESIGN_DECISIONS.md`.

## Play

```
npm install
npm run dev          # http://localhost:5173
```

- Walk: WASD / arrow keys (Shift to run) · Look: drag · Zoom: mouse wheel
- Use / talk / build / fill / fish / cook / sleep: **E** · Eat or drink the first food in bag order: **F**
- "I need…": **Q** · Make (craft): **C** · Settings: **Esc**
- Click water in the bag to drink, or grilled fish to eat. Raw fish needs a lit campfire.
- Speak: press **Space** (or the mic button) once, then say the sentence
- Placing a building: walk to choose the spot, **R** turns it, **E** puts it down
- Touch: left stick, the hand button to use things, the run toggle

**Answer by Speaking / Tapping** on the title screen is the teacher's choice.
Tapping (mic-free) keeps the same progression. Students pick the right
sentence for the picture, so they still have to read and understand. A blocked
or missing microphone switches to tapping automatically.

## Test

```
npm test             # unit tests (Vitest): inventory, crafting, stats, quest, speech matching, save, world layout,
                     # Day 3 actions/refusals, quick actions, fishing phases/rests and night resume
npm run typecheck    # TypeScript, including the E2E specs
npm run build        # TypeScript + production bundle
npm run e2e          # build + Playwright: full Day 1 by speech and by tapping, help ladder, mic blocked,
                     # interim acceptance, save/resume, beacons, fainting, placement rules;
                     # Day 2 axe/forest/shelter/night; Day 3 tapping, both Kai choices,
                     # bridge/tool gates, water/fishing/cooking, night resume and free-day sleeping
npm run shots        # screenshots of a whole playthrough into .tmp/shots (needs `npm run preview -- --port 5287`)
                     # options: node scripts/shots.mjs <url> 1024x768 --touch --tap
```

Test-only URL flags: `?e2e=1` exposes `window.__si` (state + teleport helpers),
`?fast=1` skips pauses and auto-advances dialogue.
The read-only `state()` surface includes quest steps and counters, `kai.want`,
`fishing.phase`, `fishRests` (live seconds left), `freePlay`, clock and sleep state.
`startDay(3)` begins the real Day 3 morning; `world()` supplies stable target IDs.
The screenshot playthrough covers Days 1–3 and Day 4 free play, including the
bridge, water, fishing bobber and cooking. Final browser acceptance and visual
review are performed by the executor.

## Deploy

`.github/workflows/deploy-pages.yml` tests, builds and deploys `dist/` to
GitHub Pages on a push to `main`. The deploy job is skipped while the
repository is private. The build uses a relative base, so it works from any
Pages sub-path or a plain folder.
