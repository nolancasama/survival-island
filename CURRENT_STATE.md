# Current State

## Status
Phase 1 vertical slice is playable end to end: the beach, Day 1 ("Survive"),
from waking up to lighting the campfire, by speech or by tapping. Not yet in
git (no repository, no commits).

## What Exists
- **World:** the handcrafted beach (shipwreck, crate, palms, driftwood, stone
  piles, coconuts), Kai's camp, the closed forest gap with a sign, an animated
  sea with foam, a tree line, and the far hills with the signal tower. Story
  light runs from midday to dusk as Day 1 progresses.
- **Player:** third-person movement (keys / joystick, Shift or toggle to run),
  collision, walk/run/gather/eat/craft animations, a steady follow camera
  (drag to turn, wheel to zoom), and palms that fade when they block the view.
- **Survival:** HP / Stamina / Food (food shown as a meter that empties). Stats
  pause during English and menus. Fainting returns you to camp with full health
  and nothing lost.
- **English layer** (`src/game/flow/ask.ts`): command and choice prompts, tap to
  talk, interim acceptance, one success = one action, the help ladder (try
  again → read again → choices), mic-free choices with distractors, and an
  automatic switch to tapping when the mic is blocked. The phrase bank and
  variant tables are in `src/game/logic/english.ts`.
- **Day 1:** "I'm hungry." (beacons) → get and eat a coconut → Kai ("What do you
  need?" / "Can you make a fire?", and the answers change his gift) → 3 wood +
  2 stones (first of each spoken, then quick) → craft ("I want to make a
  campfire.") → ghost-preview placement → "Make a fire." → celebration →
  day-end card listing the English used → free play at dusk.
- **Also:** "I need…" beacons (Q), the crate ("Open the box." → rope), resource
  respawn, save/resume (localStorage `si.save.v1`), Settings (mic, music/SFX
  volume, Japanese help, slow voice, camera speed), procedural audio.
- **Tests:** 74 unit tests; 9 Playwright e2e tests. The harness was checked
  with a deliberate known-bad build (known actions stop being quick), which the
  save/resume test and the full-loop test both caught.
- **Deploy workflow** in `.github/workflows/deploy-pages.yml`. Nothing has been
  pushed.

## Known Issues / Unverified
- **Real speech recognition is untested.** Only the stubbed recogniser was
  used. The variant tables need a classroom trial with real Japanese-accented
  speech.
- **Sound has not been listened to.** It is all synthesised and was checked
  only for errors.
- **Real Chromebook GPU performance is unmeasured.** Under SwiftShader:
  about 50–65 draw calls and about 80k triangles per frame.
- Touch was checked by emulation at 1024×768. Phone portrait is not tuned.
- The console shows a `THREE.Clock` deprecation warning from React Three Fiber
  internals (harmless).

## Next Steps
1. Playtest Phase 1 with real speech on a school Chromebook, and tune the
   variant tables and pacing (food drain, gather counts).
2. Phase 2 (Exploration): open the forest gap after Day 1; add the leaves
   resource; stone axe ("Cut the tree."); the stream and broken bridge (repair
   with wood); the pond with water (water container) and fish (rod: wood +
   rope; the crate's rope is already in the bag); the shelter plus a real
   day/night cycle with sleeping ("I want to sleep."). Re-sequence Days 2–3
   around these.
3. Phase 3: cave (torch), clifftop, signal fire, rescue ending, classroom mode
   (see DESIGN_DECISIONS).
4. Phase 4: polish, scripted events, Free Survival mode.
5. Create the GitHub repository and enable Pages when the user wants it public.

## Codex / Delegated Work
None. Phase 1 was built by Claude directly, at the user's request.
