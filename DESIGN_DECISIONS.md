# Design Decisions

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

## 2026-10-13 — Brief accepted, with these changes

The brief "Survival Island" (survival crafting adventure, English as the
interaction layer, Japanese grade 5–6) is the product definition. Its phase
plan is kept: Phase 1 vertical slice first, fully playable and tested, before
the rest of the island. Changes made while planning:

**Accepted as written:** five handcrafted areas, third-person movement, no
permanent death, three stats, Kai, the crafting table, ghost-preview building,
the five challenges, scripted (not random) events, the five-day story,
mic-free parity, TTS for NPC lines and prompts, short Japanese help, the
reusable sentence patterns, modular code with tests, GitHub Pages.

**Changed:**

- **Hunger is shown as a Food meter that empties.** All three bars mean "full
  is good". A hunger bar that is bad when full, beside two bars that are good
  when full, is a trap for 10-year-olds. Internally the stat is `food`
  (100 = full); low food slows stamina recovery and, at zero, slowly drains HP.
- **Tap to talk, not hold to talk.** One press of Space or the 🎤 button opens
  one bounded listening session (7 s), which ends early on a match. Holding
  Space still works because the press starts it. esl-time showed that hold to
  talk clips the end of answers.
- **Speech is judged on key words, with variants.** Each phrase lists the
  content words that must be heard (verb + noun, pattern word + noun).
  Articles, "I", "some", "to" and punctuation are ignored. Each key word has
  tables of synonyms and common mishearings (would→wood, it→eat, angry→hungry,
  know→no). Adjacent words are also joined, so "camp fire" and "coco nut"
  match. Only the top hypothesis judges; alternatives can only rescue a result
  that matched nothing. These rules come from esl-time and esl-haunted-hotel.
- **Mic-free answers still need understanding.** For an action command, the
  student sees a picture of the target and three short sentences, one of them
  right (for example "Get the wood." / "Get the stone." / "Eat the coconut.").
  A wrong tap shakes and costs nothing. Kai's questions and the "I need..."
  choices have no wrong answer; the choice changes what happens. Rejected:
  only picking the verb, because it does not show that the sentence was
  understood.
- **Mic-free is a teacher setting, not a per-question button** (on the title
  screen and in Settings). In esl-verbs, most students ticked a per-question
  opt-out. In speech mode the choices become tappable only after the third
  miss, or at once if the microphone is blocked or unsupported.
- **The help ladder for each spoken prompt:** miss 1 → "Try again!"; miss 2 →
  the sentence is read aloud again and highlighted word by word; miss 3 → the
  choices become tappable. Only hardware or permission errors switch to buttons
  at once. Silence or a single network error counts as a miss.
- **What English gates.** The first collection of each resource type, the
  first time eating each food, opening the crate, every craft ("I want to make
  a ___."), lighting the fire, Kai's questions, and the voluntary "I need ___"
  help. After the first success, collecting that resource is instant (the word
  still floats up: "+1 wood"). That way English marks each new action and is
  not repeated for every log.
- **Commands use the brief's verb list.** "Pick up the wood." becomes "Get the
  wood.", because "pick up" is not in the target vocabulary. The plan also
  uses get, eat, open and make. Synonyms (take, grab, pick) are still accepted
  in speech.
- **Crafting happens anywhere, from the Craft menu.** Kai teaches recipes
  (Phase 1: the campfire) instead of crafting for you. Walking back to Kai for
  every craft would make Kai a vending machine. Recipe cards show icons with a
  ✓ or a count per ingredient: no arithmetic, nothing to calculate.
- **Two recipes share ingredients on purpose** (campfire and stone axe: wood +
  stone; shelter and torch: wood + leaves). The student chooses what to make,
  and the amounts differ. That is a decision, not a lookup.
- **The fence only ships with a reason to exist.** A fence has no use in the
  brief's list. It returns in Phase 4 together with the "animal steals food"
  event. The thief becomes a monkey or crab, a ground animal a fence can stop,
  not a bird.
- **Save/resume starts in Phase 1, not Phase 3.** Classroom sessions get
  interrupted. The state is small and serialisable now, and painful to retrofit
  later. The save is versioned (`si.save.v1`); an unknown version is discarded,
  never half-loaded.
- **Time of day follows the story in Phase 1.** The light goes from morning to
  golden hour to dusk as objectives are completed, so lighting the fire happens
  as night falls. The real day/night cycle arrives in Phase 2 as planned.
  Rejected: a clock-driven sunset, which could fall at the wrong moment in a
  45-minute lesson.

**Added:**

- **"I need ___" is the help system.** 💬 (Q) opens "I'm hungry." / "I need
  wood." / "I need stone." (later: water, "I want to sleep."). Saying one
  places beacons on the nearest matching sources for 12 s. The game opens this
  once at the start, when the player wakes up hungry, so the mechanic is
  learned by using it. After that it pulses when food is low.
- **Kai's choices change the outcome.** "What do you need?" → water / food /
  wood each get a different answer and a different gift or hint. "Can you make
  a fire?" → "Yes, I can." (Kai trusts you: "Show me!") or "No, I can't." (Kai
  helps: gives a stone and walks you through it). Both lead on.
- **Classroom mode is deferred to Phase 3.** The brief names it but does not
  specify it. It will be the same story with smaller gather counts, slower food
  drain and automatic hints, so the five days fit into 10–15 minutes. It must
  not be a different game.

**Rejected:**

- Requiring the noun alone ("wood") for commands. The brief wants the command
  spoken. The key-word judge is already forgiving about articles and grammar.
- Random events that could block the quest. Phase 4 events are scripted and
  always recoverable, as the brief says.

## 2026-10-13 — Island layout (fixed now so Phase 1 fits the full map)

The beach runs along the south shore, with the shipwreck at its east end and
the spawn beside the wreck. The forest is north of the beach, and the beach's
tree line has one gap, closed in Phase 1 by a fallen palm and a sign. A stream
west of the forest separates it from the pond (the broken bridge). The cave is
in the north-east hillside. The clifftop and signal tower are the highest point
in the north. Coordinates: +x east, +z south (toward the sea); the beach is
roughly x −36…36, z −4…24.

## 2026-10-13 — Phase 1 decisions made while building

- **Day 1 is the vertical slice.** It is called "Day 1: Survive": eat, meet
  Kai, 3 wood + 2 stones, make, place and light the campfire. The brief's Day 1
  (food, water, Kai) and Day 2 (camp) are merged for the slice. Water needs the
  pond, so it waits for Phase 2. Days are re-sequenced when the forest opens.
- **The first English is "I'm hungry."** The player wakes up hungry and the
  game asks how they feel. Saying it lights up coconuts, so the "I need ___"
  help mechanic is learned in the first minute by using it, with no tutorial
  text.
- **Kai's choices:** "I need water / food / wood" each get a different reply
  and gift (coconut / coconut + beacons / wood + beacons). "Yes, I can." → "Show
  me!"; "No, I can't." → he helps with a stone. Every branch leads on. Later
  visits give a hint for the current step, or his repeatable "What do you
  need?". Kai's questions are target English and have no Japanese gloss; his
  other lines do.
- **The building preview sits ahead along the camera direction**, not the
  player's facing. A preview in front of a player who faces the camera hid
  under the bottom panels. Ahead on screen is always visible and predictable.
- **Palms fade when they block the camera.** Each palm is its own mesh, 10
  draw calls. A frond across the lens hid the player. Rejected: pulling the
  camera in, which jumps.
- **The camera is lower than haunted-hotel's** (pitch 0.42 rad, distance 9.5).
  Outdoors, seeing the tree line, the sea and the tower matters more than a
  top-down view.
- **The craft prompt asks "What do you want to make?" on every craft.** The
  question is read aloud only the first time. The sentence must still be
  produced each time, because making things is the core action and the brief
  requires English for crafting.
- **In mic-free mode, 🔊 reads all the choices in order.** Reading only the
  right one would give the answer away. In speech mode the target sentence is
  read automatically the first time, as a model to repeat.

## 2026-10-13 — Engineering inherited from esl-haunted-hotel

- **Stack:** React 19, React Three Fiber 9, three 0.186, zustand, Vite,
  Vitest, Playwright. The base path is relative (`./`), so the build works
  under any GitHub Pages path.
- **Everything procedural, nothing downloaded.** Models are merged primitives
  (one draw call per model via `PartBuilder`), icons are inline SVG, and audio
  is Web Audio synthesis. No asset files, webfonts or CDNs: school networks
  block them.
- **Chromebook budget:** a fixed light set (hemisphere, sun, one campfire point
  light that is always present, dimmed to 0 when unused), no real-time shadows
  (blob shadows), instanced trees, dpr ≤ 1.5, fog to cut the far plane.
- **Per-frame state lives outside React** (`runtime.ts`). zustand holds UI
  state. Pure game rules live in `game/logic/` with unit tests. The scripted
  flow is async (`await kai.say(...)`, `await ask(...)`) so that no single
  director file holds everything.
- **Test hook** `window.__si` (only with `?e2e=1`) and browser stubs for TTS,
  SpeechRecognition and the microphone. Playwright drives the real UI.
