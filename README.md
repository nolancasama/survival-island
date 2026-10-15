# Survival Island

A 3D survival crafting adventure for Japanese grade 5–6 students learning
English. The player is shipwrecked on a tropical island: explore, collect,
craft, build a camp, help Kai, and escape. English is how you act. You say
"Get the wood." to pick up your first log, "I want to make a campfire." to
craft it, and "I need water." when you are stuck.

**Status:** Phase 3 story slice A implemented: Days 1–4, including the torch,
cave exploration, metal, the old box and radio, Kai's inventory question,
and classroom mode. Day 3 now leads into Day 4; Day 4 leads into a safe
Day 5 start. Day 5's escape flow and rescue ending are the next slice;
free play begins after the story on Day 6+. Executor acceptance is pending.
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
                     # classroom counts, Settings switching and automatic hint timing
npm run shots        # screenshots of a whole playthrough into .tmp/shots (needs `npm run preview -- --port 5287`)
                     # options: node scripts/shots.mjs <url> 1024x768 --touch --tap
```

Test-only URL flags: `?e2e=1` exposes `window.__si` (state + teleport helpers),
`?fast=1` skips pauses and auto-advances dialogue.
The read-only `state()` surface includes quest steps and counters, Kai's memory,
`fishing.phase`, `fishRests` (live seconds left), `freePlay`, clock and sleep state,
`inCave`, `enteredCave`, `caveBoxOpened`, `classroom`, `stepIdleSeconds` and
`automaticHintCount`. These expose story and automatic-hint state for acceptance.
`startDay(3)`, `startDay(4)` and `startDay(5)` begin their real mornings with prior
days' facts; `world()` supplies stable target IDs and cave entry/exit coordinates.
The screenshot script covers Days 1–4, including cave entry/exit, metal, the
box/radio, Kai's new question and the Day 4 card, plus a classroom Day 1 pass
showing goals, recipe counts and an automatic hint. Final browser acceptance
and visual review are performed by the executor.

## Deploy

`.github/workflows/deploy-pages.yml` tests, builds and deploys `dist/` to
GitHub Pages on a push to `main`. The deploy job is skipped while the
repository is private. The build uses a relative base, so it works from any
Pages sub-path or a plain folder.
