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

## 2026-10-13 — Phase 2 (Exploration) design

Phase 2 adds the forest, the stream and broken bridge, the pond, the stone axe,
the shelter, the water container, the fishing rod, cooking, and a basic
day/night cycle with sleeping. It also re-sequences Days 2 and 3. These
decisions were frozen before implementation started, and the workers build
against them.

### Story

Every day's checklist now ends with **Sleep**. When every other step of the
day is done, evening falls, Kai says it is time to sleep, and sleeping ends
the day. The day-end card appears after sleeping, not after the last task.
Rejected: ending the day on the last task, which leaves "I want to sleep."
(a brief example) with no place in the story.

- **Day 1: Survive** is unchanged up to the fire. After the celebration, Kai
  says "It's late. Let's sleep." and the student says **"I want to sleep."**
  at once, by the fire. There is no shelter yet: the cold sand is the reason
  for Day 2. The Day 1 card's "keep playing at dusk" button becomes "Day 2".
- **Day 2: Make Camp** (the brief's Day 2, without the campfire, which Day 1
  already made). Morning talk: "Brr! The sand was cold. Let's make a
  shelter." / "Leaves are in the forest. But a big tree is in the way." /
  Kai asks **"Can you make a stone axe?"**. Yes → "Show me!"; No → he gives a
  stone. Then he unlocks the axe recipe (2 wood + 1 stone). Steps:
  1. Make a stone axe.
  2. Cut the big tree: at the fallen palm in the forest gap, **"Cut the
     tree."**. This needs the axe, gives +2 wood and opens the forest.
  3. Get leaves (4). Forest bushes, **"Get the leaves."**, +2 per bush. The
     first leaves trigger a self line, "Leaves! I can make a shelter!", and
     unlock the shelter recipe. The student discovers the recipe by using
     "I can ___".
  4. Get wood (4). Standing forest trees need the axe ("Cut the tree.", +2
     wood, the tree becomes a stump that regrows). Driftwood and forest logs
     still give +1 without the axe. The brief's axe purpose, "cut wood
     faster", is now real.
  5. Make a shelter (4 wood + 4 leaves).
  6. Build the shelter: place it with the preview, then say **"Build a
     shelter."** at the frame and the roof goes on. This mirrors the
     campfire (craft, place, "Make a fire.").
  7. Sleep in the shelter.
- **Day 3: Explore** (the brief's Day 3, plus the brief's Day 1 "find
  water", which needs the pond). Morning: "I'm thirsty. The pond has water
  and fish. But the bridge is broken." / Kai asks **"What do you want to
  do?"** → "I want to get water." (he gives a coconut and talks about the
  container first) or "I want to catch a fish." (he talks about the rod
  first; if the crate is still closed he says "Open the box on the beach.
  There is rope!" and lights it up). Both answers unlock both recipes and
  end with "You need four wood for the bridge." Steps:
  1. Build the bridge: at the broken bridge with 4 wood, **"Build a
     bridge."**.
  2. Make a water container (1 coconut + 2 leaves).
  3. Get water: at the pond shore, with the container, **"Get some
     water."**.
  4. Drink water: **"Drink the water."** (from the bag, like eating).
  5. Make a fishing rod (2 wood + 1 rope).
  6. Catch a fish: at a fishing spot, with the rod, **"Catch a fish."**.
     Cast, a short wait, the fish jumps, +1 fish.
  7. Cook the fish: at a lit campfire, **"Cook the fish."**. Raw fish
     becomes grilled fish ("Eat the fish." eats it).
  8. Sleep in the shelter.
- **After Day 3** the card says the cave is next (Phase 3) and "Keep
  playing" starts Day 4 as free play: no checklist ("Explore the
  island!"), and the clock runs.
- **World facts are sticky and the world gates actions, not the
  checklist** (as in Phase 1). A student who builds the bridge on Day 2
  finds it already ticked on Day 3. Recipes unlock in story order (axe and
  shelter on Day 2, container and rod on Day 3), so a student cannot skip
  far ahead.

### Day and night

- **The clock runs, but the sun waits.** Time of day advances with live play
  (sunrise to late afternoon in about 7 minutes) and at least as fast as the
  checklist (each finished step pushes it on, as in Phase 1). While the day
  has open steps other than Sleep, it never passes late afternoon (golden
  hour). When only Sleep is left, evening falls over about 30 s and night
  follows. This keeps the brief's "basic day/night cycle" without the risk
  Phase 1 rejected: night never arrives in the middle of a task in a 45-minute
  lesson.
- **Night lasts until you sleep**, in the story and in free play. Night is
  dark blue moonlight with stars and lit fires glowing, and it is never black
  or scary. Stamina recovers at half speed at night, except near a lit fire.
  Nothing harms you at night. In free play the evening comes from the clock
  alone (about 7 minutes of day).
- **Where you sleep:** in a built shelter. If no shelter exists (Day 1), by
  a lit campfire. Asking to sleep in daytime gets "It's not night yet!". By
  day a built shelter acts like a fire for stamina (resting near it
  recovers faster). The brief says "Shelter restores stamina".
- **Sleeping:** "I want to sleep." → the player lies down, the screen fades
  through a starry night, and morning comes. Stamina is full, HP is full,
  and food drops by 20 but never below 30, so you wake hungry and never
  starving. The day number goes up, Kai's morning talk starts the new day,
  and the day's title shows briefly.
- **"I want to sleep." is also an "I need…" choice at night.** It lights the
  shelter (or the fire).
- **The faint penalty** (the brief's "small time penalty") moves the clock
  forward a little. It never pushes past the sun-wait cap.

### English added in Phase 2

New sentences: "Cut the tree.", "Get the leaves.", "Build a shelter.",
"Build a bridge.", "Get some water.", "Drink the water.", "Catch a fish.",
"Cook the fish.", "Eat the fish.", "I want to sleep.", "I need leaves.",
"I want to get water.", "I want to catch a fish.", and Kai's questions "Can
you make a stone axe?" and "What do you want to do?". The rules from Phase 1
still hold: the first success makes the action quick, key words with
variants, mic-free picture + 3 sentences, and Kai's questions have no wrong
answer.

- **"Build" and "drink" and "cut" come from the brief's verb list.**
  **"Catch" and "cook" do not.** Fishing and cooking have no natural verb in
  the list, and "Get a fish." does not say what the rod is for. The speech
  judge also accepts "get" for catch, and "make/fix" for build.
- **"Build a bridge.", not "Fix the bridge."** "Build" is in the list, and
  the student is building a new bridge with their own wood.
- **The "I need…" menu shows at most 4 choices**, chosen by relevance: at
  night "I want to sleep." comes first, then "I'm hungry.", then the needs of
  the open steps (wood / stone / leaves / water). "I need water." lights the
  pond's water spots. If the bridge is still broken, it lights the bridge
  instead. "I need leaves." lights bushes. If the forest is closed, it lights
  the fallen tree.

### World (layout extends the Phase 1 island)

Approximate positions. The world worker may move things by a few metres for
looks and play, and records the final numbers here.

- **Forest:** north of the beach, about x −27…27, z −3…−42, entered only
  through the forest gap (x −9). Mixed jungle trees: the dense background ones
  are decoration, and a smaller, recognisable kind is choppable. It also has
  leaf bushes, fallen logs, a few stones, and paths that read as walkable.
- **Stream:** along the west side of the forest, about x −30, from the
  northern hills down to the west headland rocks behind the beach tree line.
  It never crosses the beach, and it cannot be waded.
- **Broken bridge:** about (−30, −22). Broken: two posts and a gap. Built:
  planks across, walkable.
- **Pond:** a clearing west of the stream, around (−46, −24), with water
  about 8 m across. It has water spots on the shore, two fishing spots (a
  flat rock and a small plank dock) with fish shadows, stones and reeds.
- **Cave mouth** (NE hillside, around (22, −44)) and **cliff path** (north,
  climbing toward the signal tower, blocked at its foot by a rockfall) are
  visible but closed until Phase 3. Each has a sign.
- **Walkable area is a set of regions plus gates**, not one box. The gates
  are the fallen palm (open after "Cut the tree.") and the bridge (open after
  "Build a bridge."). Placement uses the same walkability, so buildings can
  go in the forest too, but not in water or on the stream.
- **Chromebook budget for the worst view** (SwiftShader at 1024×768): at
  most about 120 draw calls and 200k triangles. Trees, bushes and stumps are
  instanced. There is still one shared fire point light, and fog hides the
  far plane.
- **Line-of-sight fading now applies to all large scenery occluders.** This
  generalises the Phase 1 decision that palms fade when they block the camera:
  a shared Lambert screen-door capsule clears decorative and choppable trees,
  bushes, rocks, hills, cliffs and buildings between the follow camera and the
  player without adding draw calls. The player, Kai, ground and water never
  fade. Terrain is the exception to the old "do not pull the camera in" rule:
  because the camera cannot dither through the ground, it eases upward and, if
  needed, inward until its position and view ray clear the land.

Final world coordinates:

- Fallen tree interaction (-9, -3.6); bridge centre (-30.25, -22), east-west,
  with its forest-side build point at (-27.2, -22).
- Stream centre x=-30.5 from z=-44…-3, 4 m wide; pond centre (-45.5, -24),
  radius 4.2.
- Water spots (-40.8, -24), (-45.5, -18.9), (-49.1, -27.8); fishing rock
  (-49.5, -28.1); dock (-40.8, -22).
- Cave sign (21, -40); cliff sign (6, -40).

Cave mouth and cliff-path terrain remain north of the walkable forest edge at
z=-42; the signal tower stays at its existing (26, 25, -78), supported by the
steep closed clifftop terrain beyond that edge.

The walkable world is a union of separately inset beach, gap, forest, bridge
and pond-clearing regions. Their overlaps form the only connections: the gap
corridor exists only after the fallen tree is cleared, and the pond region and
deck exist only after both gates are open. The deliberate 4 m break between
forest and pond regions is the stream, so neither end can be walked around.

### Beacons in a bigger world

Beacons can point at places (the bridge, the water, the fallen tree, the
shelter) as well as resource nodes. A beacon that is off screen or behind fog
shows an arrow at the screen edge while it lasts. Kai's hints and "I need…"
use them. Rejected for now: a minimap, which adds HUD weight. Revisit after
the classroom trial if students get lost.

### Saves

The save goes to `si.save.v2`. A valid v1 save is migrated: it maps 1:1 to
Day 1, and the new fields get defaults. A v1 save with Day 1 complete
resumes at Day 1 night with Sleep open. Anything else that does not validate
is still discarded whole.

### Still deferred

Classroom mode (Phase 3) will tune the counts and the clock speed.
Everything that takes those numbers keeps them in one place
(recipes, step goals, clock constants). Wild fruit and the forest animal wait
for Phase 4 (events and ambience). The cave, the clifftop, the torch, metal
and the signal fire wait for Phase 3.

## 2026-10-14 — Phase 2 decisions made while building (world, Days 1–2)

- **The cave mouth sits in a level notch** cut into the northern climb
  (`groundY`), so the ramp never rises in front of the opening, and the hill
  resumes behind the rock face. **The far hills stay north of the walkable
  area**: placed any closer, they poked through the forest floor.
- **Night falls during the Day 1 celebration.** The clock jumps to night when
  the fire is lit (as the Phase 1 light did), so "It's late. Let's sleep."
  is true when Kai says it. On later days the evening comes from the clock.
- **One id space for everything the game points at** (`flow/places.ts`):
  nodes, the fallen palm, the bridge, water and fishing spots, signs and
  buildings. Beacons, focus labels, edge arrows and the test hook all use it.
  The bridge is marked at its forest-side end, where it is built from.
- **"I need…" never lights something you cannot reach.** If every source is
  behind a closed gate, the gate is lit instead (the fallen palm for anything
  in the forest; for water, the palm and then the bridge). This generalises
  the design's "I need leaves." rule.
- **Edge arrows:** a beacon off screen gets an arrow at the screen edge,
  inside a margin that keeps clear of the hint and the bag. A beacon on screen
  but more than 60 m away (in the fog) gets a marker over it, pointing down.
  The arrow is a block arrow with a shaft. A bare triangle was tried and read
  the wrong way at some angles. Only the arrow turns, so the button's shadow
  stays below it.
- **A built shelter always says "Sleep in the shelter"**; by day it answers
  "It's not night yet!". A lit fire offers sleep only at sleep time and only
  while there is no built shelter, so the camp does not nag by day.
- **"NEW" on the day card only means something next to old sentences.** On
  Day 1 everything is new, so no badges are shown; from Day 2 on, the day's
  first-ever sentences are marked.
- **Waking up:** the player wakes lying beside the shelter (or the fire), and
  Kai stands beside the camp, so the morning talk is framed there. Kai's
  position is not saved; from Day 2 on, resuming puts him at the camp.
- **Kai's evening line waits for a free moment.** It never cuts into an open
  prompt or a conversation.
- **The building preview cannot be placed before its first check.** A stale
  "fits" from the previous placement could put a building at an old position.
- **F eats the first food in the bag** (hotbar order). Water is drunk, not
  eaten (Day 3).
- **Kai's repeatable "What do you need?" offers leaves instead of food** once
  leaves matter (the forest is open or the shelter recipe is known).
- **The line-of-sight fade is a cone, not a cylinder.** It is narrow near the
  camera (a fifth of the width) and full width at the player, with a soft
  edge. The 1.55 m cylinder cut a wide tunnel with a speckled rim through
  every canopy between the camera and the player, which read in the forest
  as a strange transparent aura around the player. The cone keeps the
  opening on screen about the player's size.

## 2026-10-15 — Phase 2 story slice B decisions

- **Fishing has no reaction test.** Saying or tapping “Catch a fish.” starts
  a cast, a short wait, a dipping bobber and a jumping fish automatically.
  Each spot then rests for 15 seconds of live play. Its remaining rest time
  uses the existing saved resource timer map, so resuming does not refresh
  a spot early. An active cast is transient; fish enter the saved bag only
  when the catch completes.
- **The bobber lands where the player is looking, not at the spot.** The
  cast goes from wherever the player stands, straight toward the middle of
  the pond, and lands 2.4 m from the middle, past the end of the dock. The
  player turns to face it. The first version cast a fixed 2.1 m from the
  spot toward the middle, which put the bobber on the dock's planks, with
  the line running across the player's head.
- **Water can be drunk even with a full Food meter.** It also restores
  stamina, and a full stomach must not block the first drinking objective.
  F follows hotbar food order; tapping the water always selects drinking.
- **The fish-first morning keeps both bridge and unopened crate beacons.**
  The final bridge instruction must not erase the earlier rope hint. Both
  choices teach both recipes, in the student's chosen order.
- **The Day 3 card is the last story card.** Keep playing starts Day 4 with
  the existing generic morning greeting. Later free-day sleeps wake directly
  into the next day title, without another card or required conversation.
- **Automation observes fishing rather than guessing its timing.** The
  read-only test state exposes cast phase, spot rest timers, action animation
  and free-play status alongside the existing quest, clock and sleep state.

