# Design Decisions

## 2026-10-27 — Targeted polish pass

- Standing/lying changes use the single screen overlay through `flow/transition.ts`.
  The flow waits for its actual CSS opacity and renders the completed pose under
  black before revealing it. The shipwreck opening, bedtime, mornings, migrated
  mornings and faint/recovery retain their lying shots and dialogue. A small
  procedural knee/ankle rig plants pickup feet on each sampled walking surface;
  movement can resume during recovery. No animation dependency was added.
- Player-facing names are **tent / テント** and **cup / カップ**. Existing `shelter`,
  `container`, phrase, quest, building and save IDs remain unchanged. Speech uses
  conservative variants of the new nouns. Day-complete and Rescue cards have
  one continuation button; Title remains available in Settings.
- Bridge walking has its own surface, shared by the visible deck and low bank
  approaches. Terrain `groundY` is unchanged, preserving placements and saves.
  Walkability fits the actual plank width. The approaches join the existing
  rail mesh; both use an opaque ground material rather than the occlusion fade.
- The cave's floor is split from the existing wall mesh and uses the opaque
  ground material. Isolated rendered tests showed that wall occlusion was
  discarding floor fragments below the player; hiding blob shadows did not
  remove the artifact. Walls retain their camera fade/collision behavior.
  The exit covers the illuminated corridor mouth, with the entry safely inland.
- The wreck stays one merged procedural mesh: tapered open hull, broken ribs,
  planks, mast, rails and torn sail. The tent roof stays one merged mesh with
  sealed slopes, overlapping leaf bands and ridge bindings. Both retain their
  existing world placement and construction/preview behavior. No downloaded
  assets, extra textures or dependencies were introduced.

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

## 2026-10-15 — Phase 3 (Full Story) design

Phase 3 adds the brief's Day 4 (Discover: torch, cave, signal device) and
Day 5 (Escape: clifftop, signal fire, rescue), the rescue ending and
classroom mode. These decisions were frozen before implementation started,
and the workers build against them. The user chose two of them: classroom
mode fits the whole story into one lesson, and the rescue is a helicopter at
the clifftop.

### Story

`LAST_STORY_DAY` becomes 5. The Day 3 card loses "To be continued..." and
gets a normal "Day 4" button. Day 4 ends with Sleep, like Days 1–3. Day 5
ends with the rescue instead of Sleep.

- **The signal device is an old radio** (ラジオ, a word Japanese children
  already know). It works with the signal fire: the smoke shows where you
  are, and the radio says what you need. Rejected: a flare gun or signal
  mirror, which are hard words that do nothing for the English.
- **Day 4: Discover.** Morning talk: "Good morning! Look at the cave." /
  "The cave is dark." / Kai asks **"Can you make a torch?"**. Yes → "Show
  me!"; No → he gives one leaves. Either way the torch recipe unlocks (1 wood
  + 1 leaves, already in `RECIPES`; it shares ingredients with the shelter,
  in different amounts). Steps:
  1. Make a torch.
  2. Go in the cave: at the cave mouth, with the torch, **"Go in the
     cave."**. This is the first use of "go" from the brief's verb list. The
     torch lights by itself as you enter. Without a torch, the mouth says
     "It's dark! I need a torch." (a self line), and the cave stays shut.
  3. Get metal (2). Old ship parts glint in the torchlight: **"Get the
     metal."**, +1 each, quick after the first, like every resource.
  4. Find the radio. An old box at the back of the cave: **"Open the box."**
     (the Day 1 sentence again, on purpose) → "A radio! It's old, but it
     works!".
  5. Show Kai. Back at camp, Kai asks **"What do you have?"** → **"I have a
     radio."** or **"I have metal."**. This is the first use of the brief's
     "I have ___" pattern. Both are right and get different replies (radio →
     "A radio! We can call for help!"; metal → "Metal! Good for a signal
     fire. ... And a radio? Wow!"). Both end with the plan for tomorrow and
     unlock the signal fire recipe.
  6. Sleep.
- **Day 5: Escape.** Morning: "Today we go home!" / "Let's go to the
  clifftop. But rocks are on the path." / "I'll meet you there." Kai then
  walks to the rockfall (see Kai below). Steps:
  1. Clear the path: at the rockfall, with Kai there, the student asks
     **"Can you help me?"**. Kai: "Yes, I can! One, two, three!" and the
     rocks roll aside. Until now only Kai has asked "Can you ___?"; this
     turns the pattern around. "Help" is in the verb list. Rejected: moving
     the rocks with the axe, which teaches nothing new.
  2. Make a signal fire (4 wood + 3 leaves + 2 metal, already in
     `RECIPES`): "I want to make a signal fire." It can be made anywhere, as
     every recipe can. Wood and leaves are counted steps (like Day 2); metal
     comes from Day 4.
  3. Go to the clifftop: done when the player first steps onto the
     clifftop plateau.
  4. Light the signal fire: at the stone fire pad beside the tower, with
     the signal fire in the bag, **"Make a fire."** puts it down and lights
     it in one action. It is the Day 1 sentence, which makes the climax an
     easy win. A tall smoke column rises. No placement preview: the pad is
     the only place it goes.
  5. Call for help: the radio crackles. A voice: "Hello? Hello? What do you
     need?" (Kai's Day 1 question, on purpose). The student says **"I need
     help."** (mic-free distractors: "I need water." / "I want to sleep.").
     Voice: "We see your smoke! We're coming!".
  6. The rescue follows automatically (see Ending).
- **World facts stay sticky and the world gates actions**, as in Phase 2.
  The cave mouth needs a torch in the bag (no flag). `cliffOpen` is set by
  "Can you help me?" and opens the path. Metal and the radio exist only in
  the cave, so Day 4 cannot be skipped.

### Kai on Days 4–5

- On Day 4 Kai stays at camp. "Show Kai" needs the radio in the bag; his
  repeatable hint before that points at the cave.
- On Day 5, after the morning talk, Kai walks a fixed waypoint route from
  camp to the rockfall (camp → forest gap → forest centre → the foot of the
  cliff path) at walking speed. No pathfinding: the route is authored, and
  Kai ignores collisions on it. If the player reaches the rockfall first,
  the prompt waits with "Kai is coming!" until he arrives. After "Can you
  help me?" he walks up the path ahead of the player and waits at the top
  beside the pad. His hints there point at the pad, then at the radio.
- Rejected: Kai following the player all day. It needs real pathfinding and
  gets in the way.

### The cave is its own small place

- **Going in fades to a separate interior**, built away from the island (off
  the map, out of sight), and going out fades back to the mouth. Rejected:
  a tunnel cut into the hill terrain. The follow camera would fight the
  ceiling and the walls, and the dither fade cannot clear a roof.
- **Layout:** an entrance lit from outside, a short bend, then one chamber
  about 12 × 16 m. Metal: 3 nodes (old ship parts: a bent plate, a pipe, a
  wheel rim) that respawn like other nodes. The old box with the radio is at
  the back and opens once. Leaving is just walking back into the entrance
  light (no English). Saving inside the cave resumes at the cave mouth.
- **Torchlight, never horror.** Inside, the island light rig is replaced by
  a dim, warm cave rig: low ambient, never black, with the shared point
  light carried by the torch. A few soft blue glowing crystals help the
  student find the way. No bats, no sudden sounds, no darkness that hides
  the floor. The day clock pauses inside the cave.
- The player holds the lit torch only inside the cave.

### Clifftop

- **A real walkable path, not a fade.** Reaching the top is the exploration
  payoff, with the whole island in view. The cliff path climbs from the
  rockfall (about (7, −42)) to a plateau around the tower (26, 25, −78) as
  one more walkable region, gated by `cliffOpen`. It switchbacks once if
  the slope needs it, and it is gentle enough to walk without a stamina
  cost. The world worker records the final coordinates here.
- **The plateau** is flat and roughly 14 m across. It has the existing tower,
  the stone fire pad (a ring of stones, place id `signalPad`), and a clear
  landing area for the helicopter. Low rocks line the edge, so nobody walks
  off the cliff.
- The rockfall is a pile of boulders. When the path is cleared they roll
  aside and stay aside (saved).

### Ending

- After "I need help." the voice line plays, then a helicopter flies in from
  the sea, circles once and lands on the plateau. The camera frames the
  landing (an authored shot), Kai cheers ("We did it! We're going home!"),
  and the rescue music plays (the brief's "rescue celebration music").
- **The Rescue card** replaces the day card: "Rescued!", all five days'
  English with the usual NEW badges, and two buttons: **"Keep exploring"**
  (back on the island next morning as free play, as Day 4+ free play works
  now; the helicopter is gone and Kai is at camp) and **"Title"**. Free
  Survival mode itself (camp expansion, optional challenges) stays in
  Phase 4.
- The day clock holds at golden hour on Day 5 (the sun waits as usual), so
  the rescue happens in warm evening light.

### English added in Phase 3

New sentences: "Go in the cave.", "Get the metal.", "I have a radio.", "I
have metal.", "Can you help me?", "I need help.", "I need metal." (the "I
need…" choice: it lights the metal in the cave, or the cave mouth from
outside), and Kai's questions "Can you make a torch?" and "What do you
have?". "Open the box.", "Make a fire.", "Yes, I can." and "No, I can't."
come back on purpose. The existing torch and signal-fire craft sentences
become reachable.

- Key words: go (go, goes, going, went, goal, gold), cave (cave, caves,
  cape, cafe, kev), metal (metal, metals, medal, middle, meadow, iron),
  have (have, has, had, half), radio (radio, radios, rajio, video), help
  (help, helps, helped, health, hell), plus the existing need/get/yes/no
  tables. Each prompt judges only its own choices, so "Can you help me?"
  and "I need help." never compete.
- The rules from Phases 1–2 hold: the first success makes an action quick,
  mic-free shows a picture and 3 sentences, and Kai's questions (and the
  radio voice's) have no wrong answer among the offered choices.

### Classroom mode

- **A teacher setting** on the title screen and in Settings, beside mic-free.
  It is stored with the other device settings, not in the save, and can be
  switched at any time; the counts take effect at once.
- **Target: the whole story (Days 1–5) in about 30–35 minutes of play**, so
  one 45-minute lesson ends with the rescue. It is the same story with the
  same English. Only these numbers change, all from one `pace` table:
  - Recipes: campfire 2 wood + 1 stone; axe 1 wood + 1 stone; shelter 2 wood
    + 2 leaves; container 1 coconut + 1 leaves; rod 1 wood + 1 rope; torch 1
    wood + 1 leaves; signal fire 2 wood + 2 leaves + 1 metal; bridge 2 wood;
    the Day 4 metal goal 1. Counted steps read their goals from the active
    recipe, so they follow automatically.
  - Day clock: daylight 240 s (not 420), evening 15 s (not 30).
  - Food drains at 0.6×.
  - **Automatic hints:** if no step has ticked for 20 s and nothing is open
    (no prompt, conversation or menu), the current step's target lights up
    with beacons and edge arrows, as "I need…" or Kai's hint would. They
    repeat at most every 20 s. Normal mode has no automatic hints.
- Rejected: skipping Kai's lines or days in classroom mode. That would be a
  different game.

### Saves

The save moves to `si.save.v3`. New saved facts: `cliffOpen`, the opened cave
box, `signalLit`, `rescued`, and Kai's Day 5 stage (camp / rockfall /
clifftop). The torch and radio are bag items (`radio` is a new `tool` item).
A valid v2 save migrates. A v2 save in free play (day ≥ 4, made before
Phase 3) resumes at the **Day 4 morning** with everything it had. Anything
that does not validate is still discarded whole.

### Build plan (for the workers)

Three slices, in the Phase 2 pattern. World and logic run in parallel; story
follows when both are accepted.

1. **Logic:** Days 4–5 data and facts, `LAST_STORY_DAY = 5`, the new phrases
   and key words, the `radio` item, the `pace` table (normal and classroom)
   with the recipe, bridge and goal counts and the clock and food rates read
   through it, save v3 with v2 migration, unit tests.
2. **World:** the cave interior, the enter/exit fades and the cave light rig,
   the torch prop and its light, metal nodes and the old box, the cliff path
   region and the rockfall (closed/cleared), the clifftop plateau and pad,
   the signal fire model with a cheap smoke column, the helicopter model and
   its landing animation, Kai's Day 5 waypoint routes, and new places in
   `flow/places.ts` (`caveMouth`, `caveBox`, `caveExit`, `rockfall`,
   `signalPad`, `clifftop`). Same Chromebook budget as Phase 2, including
   the view from the clifftop.
3. **Story:** the Day 4 and Day 5 flow, Kai's talks, the radio call, the
   ending and Rescue card, "I need metal.", classroom mode's setting and
   automatic hints, e2e for Days 4–5 and classroom mode, and the shots
   script.

## 2026-10-15 - Phase 3 world slice decisions

Final coordinates (x, z; heights in metres):

- Cave chamber centre (1000, 980), floor y=0, 12 × 16 m; entrance bend x=992…998, z=984…1000. Entry (994, 995), facing north; exit (994, 998), radius 0.9; old box (1002, 974); metal nodes (996, 981), (1003, 984), (999, 976).
- Existing cave mouth (22, -43.1) stays fixed; outside arrival (22, -41.7), facing south. Its small walkable notch ends at z=-43.5.
- Rockfall interaction (7, -41). Cliff path waypoints (x, z, y): (7, -41, 3), (7, -49, 7), (3, -54, 10), (18, -63, 16), (24, -71, 25), (26, -74, 25); walkable radius 2.2 m.
- Plateau centre and existing tower (26, -78), y=25, radius 7 m; signal pad (22, -79), radius 1.3 m; helicopter landing (30, -75), y=25. Rescue shot position (43, 34, -56), target (26, 28, -77); flight lasts 12 s.
- Kai approaches via (-12, 3), (-9, 0), (-9, -5), (-5, -15), (1, -29), (5.5, -40.5), then follows the cliff path and waits at (23, -77) beside the pad.

The cave is a disconnected walkable set beyond the island's far plane. Target reachability also checks `inCave`, so beacons cannot point to the other place. The south cave walls stay low and the ceiling is raised to 13.5 m; the north and side walls preserve the chamber silhouette. The follow camera shortens its distance before crossing a cave wall. Crystals use emissive materials without extra lights. While inside, fixed warm ambient/hemisphere values override the island rig and the shared point light follows the torch; `rt.light` and `rt.lightTarget` remain owned by the clock/story.

The cliff path is a union of overlapping capsules, joined to a circular plateau, open only with both `pathCleared` and `cliffOpen`. Smooth terrain blends carry its authored climb into the old hillside, beginning strictly north of z=-42 and away from the unchanged cave notch. Plateau walkability is inset behind its low edge rocks. The cave notch is the only new island walkability without the cliff gate; the rock face behind it stays closed.

- The cliff trail is a continuous dirt ribbon coloured into the groundY terrain, with grass-blended edges and inset stone treads only on the steep final ascent; sharing vertices prevents floating steps and switchback seams.
- The hillside uses forest greens with sparse instanced bushes, small broadleaf trees and grey rock clusters outside the route and plateau; the low edge rocks and open island vista remain the summit payoff.
- Outdoor haze thins progressively with climb height so the island and sea remain clear below the summit, while the story still controls daylight and night colours.
- Cave background and fog use warm near-black (#130e0a), enclosing the cutaway chamber without changing its torchlight or crystals.

## 2026-10-15 - Phase 3 story slice A decisions

- **Automatic hints count live play, not time spent reading or in menus.** A checklist tick resets the idle interval; placement can accrue live time but suppresses the hint until exploration resumes. A ready recipe pulses Craft, and an inventory action selects its bag item or pulses the food help, since those actions have no world location to beacon. Physical targets use the existing beacons and edge arrows.
- **The cave clock also ignores checklist pushes.** Gathering metal or finding the radio cannot move the sun while inside. Survival stats and resource respawns still use live play, as outside.
- **Needs in the cave point at the way out when the resource is outdoors.** Metal help outside points at the cave mouth (or the forest gate first if closed); inside it points at reachable metal. This keeps guidance within the player's current place.
- **An interrupted Day 4 introduction resumes at camp with its title and torch lesson.** The same path handles migrated v2 free-play saves without advancing beyond Day 4. The introduction is complete only once Kai's answer and the torch recipe are both present, so saving during the reply cannot strand the recipe.
- **Acceptance observes semantic state.** The read-only test state adds the classroom setting, cave entry/box facts, live idle seconds, automatic-hint count and open-menu flags alongside the existing quest, Kai memory, mode and cave state. Screenshot and browser acceptance execution remains with the executor.

## 2026-10-15 - Phase 3 story slice B decisions

- **An interrupted Escape morning replays at camp; a completed morning resumes Kai at his destination.** The optional saved `kai.escapeMorning` flag distinguishes reading the introduction from walking to the rockfall while `kaiStage` still says camp. Arrival updates the stage; an interrupted walk settles at the rockfall before the path opens, or at the clifftop afterwards. Existing saves remain valid without this flag.
- **Lighting and the radio call are separate save boundaries.** The pad consumes the bag item and saves `signalLit` before the smoke line and radio question. Resuming that state reopens the radio question without another fire command or another signal fire. Once the radio reply completes, `rescued` is saved before the flight; resuming any rescued Day 5 save starts the next morning as Day 6 free play.
- **The landing shot follows animation time.** Normal play holds the authored camera for the full twelve seconds of runtime flight, even when rendering is slow. The existing fast test mode may skip the wait and settles the helicopter at its landed state. The Rescue card reuses the existing day-end screen with all adventure sentences and Day 5's first-use badges.

- **The Rescue card bounds its sentence list (controller, on review).** The whole adventure's English (about 35 sentences) pushed the Keep exploring and Title buttons below a 768 px Chromebook screen, where students would not think to scroll. The Rescue card is wider (760 px) and its list scrolls inside a tinted box capped at about a third of the screen height, so the buttons always stay visible. Rejected: showing only Day 5's sentences, which loses the five-day summary.

## 2026-10-22 — Tiled, frustum-culled scenery

- **Problem:** almost the whole island was drawn every frame. Profiling the live
  scene showed the two terrain meshes (hillside 34.6k triangles, lowland ground
  17.4k) were each one island-sized piece, so frustum culling never skipped them,
  and the 139 jungle trees were one instanced batch with culling switched off.
  Every outdoor view drew 87–106k triangles wherever the camera looked.
- **Decision:** static scenery is cut into square XZ tiles (`scene/tiles.ts`).
  Terrain is split by triangle centroid, copying vertices exactly, so tiles
  meet without seams and the flat-shaded look is unchanged. Zero-area triangles
  are dropped: the lowland's northern rows, collapsed onto the hillside join,
  were drawn for nothing. The lowland ground and hillside share `flatMat`, so they
  are merged first and tiled together. Jungle trees are bucketed into per-tile
  instanced batches; each keeps its original index for its tint.
- **Tile size 40 m, measured.** 32 m tiles with separate ground/hill sets cut
  more triangles but raised the clifftop view, which sees everything, from 98 to
  134 draw calls. Merged terrain with 40 m tiles (exactly four columns across the
  160 m terrain) keeps the worst view at 116 calls.
- **Left as is:** the 21 bushes (~1.3k triangles; culling switched on, not tiled),
  node/resource batches (small and updated at runtime), the animated sea, sky,
  rockfall, flames and smoke.
- **Result (`npm run shots:world`, SwiftShader 1024×768), triangles before → after:**
  bridge 87.5k → 37.8k, pond 87.0k → 37.0k, signal fire 91.3k → 38.4k, halfway up
  the cliff path 90.9k → 48.5k, rockfall 91.6k → 68.8k, forest centre 92.2k → 70.4k,
  beach spawn 96.0k → 85.6k, camp at night 101.9k → 95.1k, clifftop 106.0k → 98.1k.
  Draw calls rise by 3–18 per view; the worst is the clifftop at 116 (was 98).
  Screenshot pixel diffs against the baseline stay within animation noise
  (water, fish, follow-camera timing); no seams or missing scenery.
- **Rejected:** `BatchedMesh` (per-object culling in one draw call), which would
  have meant rewriting the instanced batches and the line-of-sight material path
  for a modest extra gain, and distance LOD. Neither helps much until the scenery
  is heavier; the clifftop, which sees the whole island, is what LOD would target.

## 2026-10-22 — Vegetation overhaul

- **What and why:** replace the segmented palm fronds and repeated foliage blobs
  with a shared tropical family: warm tapered trunks, visible primary branches,
  full domed crowns, cooler green undersides and yellow-green upper
  highlights. A shared vegetation palette keeps jungle trees, palms, decorative
  bushes and harvestable plants consistent. Flat shading remains the art style;
  silhouette and vertex colour supply the detail without textures or extra materials.
- **Frozen rendering architecture:** `bucketByTile` groups jungle trees, palms
  and decorative bushes together in 40 m tiles. Each tile is one static merged
  `BufferGeometry` mesh using the existing `occluderMat`, with frustum culling.
  Spot transforms and the original indexed tint formula are baked into its
  world-space vertices and colours. This replaces the separate palm meshes,
  tiled jungle instances and separate bush batch; runtime resource batches and
  CliffDressing keep their existing draw-call structure. Geometry is generated
  once, and temporary/prototype geometry is disposed after merging.
- **Variation and placement:** a small library supplies five jungle archetypes
  (tall broad, asymmetric spreading, dense rounded, slender branching and wide
  tiered), seeded variants, four palm silhouettes (tall elegant, short full,
  leaning beach and windswept), and layered decorative bush variants.
  Deterministic index hashes choose variants and mild non-uniform stretches.
  No extra values are drawn from `makeRng(42)`; a spot-list regression test locks
  existing positions, scale, rotation and tint. Placement, collision, harvesting,
  chop/stump/regrow logic and the line-of-sight fade remain unchanged.
- **Generator parameters and budgets:** five jungle archetypes × three variants
  use three to five 48-triangle volumetric lobes with three to five primary
  branches ending inside the foliage. Lobe tops rise one height parameter above
  the centre; rounded undersides descend 0.68 of it, with shoulder rings at
  +0.65, 0 and -0.5. Heights are 0.72–1.38 m and radii 0.7–1.5 m, giving full,
  overlapping domes rather than horizontal plates. The tall emergent has five
  high broad lobes; the asymmetric crown leans left with five offset lobes;
  the low round tree overlaps five lobes into a dense mass; the slender tree
  carries three small separated crowns up its trunk; the wide tiered tree has
  three lower lobes and two upper lobes separated vertically. Foliage stays
  above 1.8 m and within 2.53 m radial clearance after the mild baked stretch.
  Prototypes use 270–406 triangles (library average 362.8), below the existing
  placed-average limit of 450. Index hashes still stretch X/Z by 0.96–1.04 and
  Y by 0.97–1.04. Forest tops are yellow-green, sides mid green and undersides
  cool green (#4c8c64), with ±0.0125 hue variation per clump.
  Four reusable palm crowns have ten or eleven fronds, eight thicker rachis
  strips and nine leaflet pairs at 0.10 intervals. Leaflets are about 2.5 times
  wider, with fuller mid-length spreads and light green reverse faces; reversed
  winding produces opposite back normals. Ten trunk rings × eight sides follow
  the unchanged `palmAt` curve; the largest coconut palm uses 1,384 triangles,
  within the existing 1,400 cap. The choppable tree uses 342 triangles, a straight
  .28 m base-radius trunk and a cohesive round crown centred at y=3.4, with
  lighter greens (#80bf60 through #c4e88a) than the forest.
  Harvestable leaf bushes use thirteen overlapping broad pointed oval blades
  (1.0–1.08 m maximum width), fanning up/out from a low centre, about 1 m radius
  and 1.1 m tall. Their palette is #7dcc52 / #8fd45a / #b5e66a, including lighter
  reverse faces with opposite normals; no wood or dark inner piece. They use
  208 triangles, under the existing 400 cap. Three darker decorative bush
  variants retain their shallow profiles and use 212 triangles each.
- **Evidence and ownership:** seven close-up views are appended to
  `scripts/shots-world.mjs`, each followed by `perfAt`: beach palms at eye level,
  a palm crown from below, the forest edge from the beach, inside the forest,
  a choppable tree, a leaf bush and the pond-clearing rim. Their staging restores
  outdoor daylight, gates and resource availability using semantic preconditions.
  Each detail camera requires at least 2.2 m horizontal player clearance; the
  forest camera sits behind the player, and the leaf/pond views also stand back.
  Measured with `npm run shots:world`: the clifftop went from 116 draw calls /
  98k triangles to 107 / 154k; every view lost draw calls, and triangles rose
  45–60k in the busiest views, within the 200k budget. Draw-call headroom is now
  13 at the worst view.
- **First pass rejected on review (controller):** the first crowns were thin
  horizontal plates, so every archetype read as a savanna parasol and the jungle
  lost its mass from the clifftop; palm leaflets were wiry and black from below;
  the leaf bush went olive. Hence the volumetric lobes, wider leaflets with
  flipped back normals, and the bright leaf-bush floor (nothing darker than
  about #6cbf4a).
- **Rejected:** per-archetype instanced batches per tile, because they multiply
  draw calls across tiles; distance LOD, already rejected in the tiled-culling
  decision; a smooth-shaded material, which would require a second material and
  bypass the fade; hand-modelled/baked GLB palms, about 3k triangles each (see
  revert `bf34c1f`).
