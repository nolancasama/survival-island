# Survival Island

A 3D survival crafting adventure for Japanese grade 5–6 students learning
English. The player is shipwrecked on a tropical island: explore, collect,
craft, build a camp, help Kai, and escape. English is how you act. You say
"Get the wood." to pick up your first log, "I want to make a campfire." to
craft it, and "I need water." when you are stuck.

**Status:** Phase 3 complete: the five-day story goes from shipwreck to a
helicopter rescue, followed by free play from Day 6. Days 4–5 add the torch,
cave, old radio, Kai's walk, clearing the cliff path together and the signal
fire. Classroom mode plays the same story with smaller counts and automatic
hints. Controller acceptance and final visual review are pending.
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
- Enter the cave with **E** and a torch in the bag; walk into its entrance light to leave.
  The clock pauses inside. Saving there resumes at the cave mouth with discoveries kept.
- On Day 5, ask Kai for help at the rockfall, climb the path, then use **E** at
  the signal pad with a crafted signal fire in your bag. The signal fire goes
  on this pad; it has no building preview or bag "Put down" action.
- Speak: press **Space** (or the mic button) once, then say the sentence
- Placing a building: walk to choose the spot, **R** turns it, **E** puts it down
- Touch: left stick, the hand button to use things, the run toggle

**Answer by Speaking / Tapping** on the title screen is the teacher's choice.
Tapping (mic-free) keeps the same progression. Students pick the right
sentence for the picture, so they still have to read and understand. A blocked
or missing microphone switches to tapping automatically.

**Classroom mode** is a separate teacher toggle on the title screen and in
Settings, switchable during play. It uses smaller recipe and gather counts,
slower food drain, shorter days and automatic hints after 20 seconds without
quest progress during live play. The HUD and recipe cards show the active counts.

## Test

```
npm test             # unit tests (Vitest): inventory, crafting, stats, quest, speech matching, save and world layout;
                     # Phase 3 pace/phrases/migrations, cave reachability and clock/save behavior,
                     # reachable session beacons and automatic-hint timing/reset rules
npm run typecheck    # TypeScript, including the E2E specs
npm run build        # TypeScript + production bundle
npm run e2e          # build + Playwright: full Day 1 by speech and by tapping, help ladder, mic blocked,
                     # interim acceptance, save/resume, beacons, fainting, placement rules;
                     # Day 2 axe/forest/shelter/night; Day 3 tapping, both Kai choices,
                     # bridge/tool gates, water/fishing/cooking and night resume;
                     # Day 3-to-4 transition; Day 4 tapping, both torch and inventory answers,
                     # cave gates, metal/radio, cave save/resume and v2 migration;
                     # Day 5 tapping, Kai's walk/wait, help command, gathering/crafting,
                     # climb/pad gates, radio help/water answers, rescue and Day 6;
                     # Day 5 stage saves and interrupted Kai walks;
                     # classroom counts (including Day 5), Settings switching and automatic hints
npm run shots        # screenshots of a whole playthrough into .tmp/shots (needs `npm run preview -- --port 5287`)
                     # options: node scripts/shots.mjs <url> 1024x768 --touch --tap
```

Test-only URL flags: `?e2e=1` exposes `window.__si` (state + teleport helpers),
`?fast=1` skips pauses and auto-advances dialogue.
The read-only `state()` surface includes quest steps and counters, Kai's memory,
`fishing.phase`, `fishRests` (live seconds left), `freePlay`, clock and sleep state,
`inCave`, `enteredCave`, `caveBoxOpened`, `classroom`, `stepIdleSeconds` and
`automaticHintCount`. These expose story and automatic-hint state for acceptance.
Day 5 adds `kaiStage`, `kaiAt`, `kaiRouteEmpty`, `cliffOpen`, `reachedClifftop`,
`signalLit`, `rescued`, animation timestamps and `rescue.phase` / `elapsed` /
`duration`. Prompt speaker/gloss and screen fade are also readable.
`startDay(3)`, `startDay(4)` and `startDay(5)` begin their real mornings with prior
days' facts; `startDay(5, true)` selects classroom pace. `world()` supplies stable
target IDs, cave entry/exit coordinates, Kai routes and the cliff/rescue points.
The screenshot script covers all five days through the Rescue card and Day 6,
including Kai walking, the rockfall, cliff climb, pad refusal, smoke, radio and
helicopter landing, plus a classroom Day 1 pass showing goals, recipe counts
and an automatic hint. Browser acceptance and screenshot execution belong to
the controller; Claude performs final aesthetic review.

## Third-party assets

Environment palms, small rocks and wreck props use **Pirate Kit by Quaternius**,
believed CC0 — **verify licence** against the downloaded kit before release.
Only the baked, texture-free GLBs under `public/assets/models/pirate/` ship;
the original kit/zip stays ignored under `.tmp/`.

Run `npm run models:bake` (defaults to `.tmp/pirate-kit-src`), or
`node scripts/bake-models.mjs <sourceDir>`. The script expects the original
filenames listed inside it and an embedded 8-bit RGB/RGBA PNG palette atlas.
It applies node transforms, samples linear vertex colours and ground AO, and
centres each base at y=0. Swap public paths in `src/scene/assets/manifest.ts`;
replacement models must be metre-scale, y-up, base-centred, and vertex-coloured
in linear space. Paths resolve through Vite's relative `BASE_URL`, including
GitHub Pages subfolders. Missing files use procedural scenery.

## Deploy

`.github/workflows/deploy-pages.yml` tests, builds and deploys `dist/` to
GitHub Pages on a push to `main`. The deploy job is skipped while the
repository is private. The build uses a relative base, so it works from any
Pages sub-path or a plain folder.
