# Survival Island — Expansion Plan

This file holds the long-term expansion direction supplied on 2026-11-23
(Part B, verbatim) and Claude's review of it with the technical roadmap for
Milestones 0–3 (Part A).

**What is built and what is proposed.** Milestones 1–3 are implemented as
**Chapter 2: A Better Camp** (Days 6–8). Everything in Part B from Milestone 4
on is proposed direction only. What is actually built and verified is listed in
`CURRENT_STATE.md`, and the decisions behind it are in `DESIGN_DECISIONS.md`
("2026-11-23 — Chapter 2 (Milestones 1–3) design").

---

# Part A — Review and roadmap (2026-11-23)

## A1. Verdict

The plan was accepted as the product direction: the central loop, the regions,
the six narrative stages, the three construction systems, the ESL principles
and the development rules. The changes below came from reading the existing
design decisions and code.

### Modified

1. **Where Milestones 1–3 live: Chapter 2, Days 6–8, after the rescue.** For
   now the rescue stays at Day 5, as the plan requires. Classroom mode has a
   frozen target: the whole Day 1–5 story in one 45-minute lesson, ending with
   the rescue. Putting the new missions inside Days 1–5 would break that
   lesson, and optional side quests inside those tightly tested days would put
   a second objective track beside the checklist. Instead, the Rescue card's
   button now leads into Chapter 2 (Days 6–8), and Day 9 onward is free play.
   This also matches the existing design, which reserved post-story free play
   for "camp expansion". The Chapter 2 days check their own world facts, not
   the day number. When the rescue moves to Stage 6, the chapter can move
   before the cave and radio days by changing only its unlock.
   *Cost:* until then, the story says "Rescued!" and then keeps playing on the
   island. Kai's Chapter 2 morning simply looks forward ("Let's make our camp
   better!").
2. **"Pick it up." became "Carry the box."** An existing decision keeps "pick
   up" out of the target vocabulary, and "carry" is on the plan's own list of
   construction verbs. Speech still accepts "pick up".
3. **Cooperative carrying needs no pathfinding.** "It's too heavy." → "Can you
   help me?" → Kai takes the other end and follows the path the player has
   already walked, so he always stays on walkable ground. An earlier decision
   rejected Kai following the player around; that is still rejected for
   ordinary play. Survivors who walk around the village (Milestones 6 and 9)
   will need a real waypoint navigation graph first. That is a prerequisite
   for later milestones, not part of this work.
4. **Structural snapping is socket based.** A structure's footprint is placed
   with the existing building preview (walk to move it, R to turn it). Each
   part then goes into the glowing socket nearest the player: you walk around
   the frame to choose a side. Nothing needs freehand 3D movement, so it works
   the same with a keyboard, a touchpad or touch.
5. **"Selecting pole lengths" became a judgement, not a menu.** All bamboo poles
   are long. Where a short piece is needed, the long pole is shown sticking out
   past the frame and the student says "It's too long." Then it is cut, and one
   long pole makes two short ones. Where a short piece cannot reach,
   "It's too short." is the sentence. The English describes something the
   student can see.
6. **Water flow is a deterministic model, not a fluid simulation.** The rain
   catcher has four corner posts, and each can be set low, middle or high. Rain
   runs to the lowest corner or corners. If every corner is level, the water
   stays on the canvas. Each stream is caught only if the barrel stands under it
   and the corner is above the barrel's rim. All of this is pure functions with
   unit tests, drawn as droplets running down the canvas and streams falling
   from the low corners.

### Added

1. **Safe water across the whole game.** Day 3 used to teach drinking pond
   water as it is, which conflicts with the plan's rule against unsafe
   drinking-water practice. Now all collected water (pond or rain) is "water"
   until it is boiled at a lit campfire ("Boil the water."), and only "boiled
   water" can be drunk. Day 3 gains one step. Older saves keep the water they
   already had as boiled water.
2. **A Chapter 2 start on the title screen** (teacher-facing). It begins Day 6
   with Chapter 1 already complete, so a second lesson, a lost save, or a
   teacher's own testing does not have to replay Days 1–5.
3. **Free-play rain.** After Day 8 a short, scripted shower falls every
   afternoon. It fills the barrel and puts out any campfire standing in the
   open, which is the reason for the plan's later sheltered cooking area.
   Showers are never random and never block anything, as the brief requires.

### Rejected or deferred

- The plan's own Immediate Deliverable 6, "Do not modify gameplay code yet": the
  user asked for Milestones 1–3 to be implemented and deployed in the same
  request.
- Tides as a timed mechanic are deferred to the Tidal Cave. Here the tide is
  only the gate: in Chapter 1 the sea floods the passage to the cove, and in
  Chapter 2 it is low tide.
- Unrestricted physics, free-form pole placement and length menus are rejected
  (see Modified 4–6).

## A2. Conflicts with existing design decisions

| Existing decision | Conflict | Resolution |
| --- | --- | --- |
| Classroom mode fits Days 1–5 into one lesson | New missions inside Days 1–5 break it | Chapter 2 is Days 6–8, the second lesson |
| The rescue ends the story at Day 5 | The plan moves the rescue to the end eventually | Kept at Day 5 for now; Chapter 2 follows it |
| "Pick up" is not target vocabulary | The plan lists "Pick it up." | "Carry the box." |
| Kai never follows the player (no pathfinding) | Survivors who walk, work and carry | Carrying uses the player's own path; navigation is a later prerequisite |
| Day 3 lets you drink pond water as it is | Safe-water rule | Boil before drinking, everywhere |
| Random events are rejected | Weather | Rain is scripted: Day 8, and fixed free-play showers |
| Draw-call/triangle budget 120 / 200k | Two new areas | Both areas join the 40 m tiles; measured views are in CURRENT_STATE |

## A3. Milestone 0 — technical findings

- **Story** is data (`logic/quest.ts`): sticky steps, world facts, per-day
  checklists ending in Sleep. Chapter 2 is three more `DayDef`s.
  `LAST_STORY_DAY` becomes 8.
- **World** is a union of walkable regions with gates (`world/collision.ts`).
  The cove and the grove are new regions behind two new gates, `coveOpen` and
  `groveOpen`. Ground heights come from one `groundY`. The cove reshapes only
  land east of the old beach bounds, which nothing could ever stand on, so saved
  placements cannot move.
- **Placement** already does the snapped preview, rotation and validity checks
  (`world/placement.ts`). The storage box, the rack, the rain catcher and the
  barrel are new building types with optional saved fields (parts, corner
  heights, water, drying fish).
- **Saves** go to `si.save.v4`. Valid v3, v2 and v1 saves migrate. A v3 save
  in free play (Day 6 or later, from before Chapter 2) resumes at the Day 6
  morning, following the earlier v2→v3 precedent.
- **Rendering**: new static scenery joins the 40 m tiles. Rain is one
  camera-following line batch. Water streams are a few instanced droplets.
- **Tests**: pure logic (structures, flow, weather, saves, walkability) gets
  unit tests. Days 6–8 get a tapping playthrough e2e spec, and the world
  screenshot script gains the new views.

## A4. Roadmap (as built)

1. **Foundation.** Items, phrases, quest Days 3/6/7/8, save v4, the
   structure, flow and weather logic, unit tests.
2. **Milestone 1: Shipwreck Cove, Day 6.** The cove east of the beach, through
   a tidal passage in the east headland. Kai walks there; "What is this?";
   the cove crate; canvas, rope, metal and driftwood salvage; the sea chest
   carried with Kai; the chest becomes the camp's storage box (the bag holds 20
   of each thing instead of 10).
3. **Milestone 2: Bamboo Grove, Day 7.** A new branch east of the forest,
   behind a bamboo thicket the student cuts. Bamboo stalks fall when cut and
   give poles. "Let's build a rack." The socket frame: legs, top bars, braces.
   It wobbles until it is braced in both directions. Fish dry on it into dried
   fish.
4. **Milestone 3: Rain, Day 8.** Rain at dawn puts out the open campfire. The
   barrel is carried from the cove. The rain catcher: four posts, canvas, corner
   heights, barrel position, tests ("It doesn't work." / "Let's try again." /
   "The water is flowing."). The rain stops once it works. Boil, then drink.
   Free-play showers keep filling the barrel.
5. **Entry points.** The Rescue card's "Chapter 2 →" button and the title
   screen's Chapter 2 start.

## A5. Risks carried forward

- Real Chromebook GPU cost of rain and the two new areas is unmeasured.
  Measurements are SwiftShader only.
- Kai following the player's path can look odd on sharp reversals. He is
  pushed back to keep the box's length, never through rocks.
- The post-rescue framing of Chapter 2 is temporary (see A1, Modified 1).

---

# Part B — The master plan (verbatim, as supplied 2026-11-23)

# Survival Island — Expansion Master Plan

## Purpose

Review the existing GitHub repository `nolancasama/survival-island`, especially `README.md`, `CURRENT_STATE.md`, `DESIGN_DECISIONS.md`, and the current game systems.

Save this expansion plan to the repository as `EXPANSION_PLAN.md`. Do not begin implementation until the plan has been saved and the existing architecture has been reviewed.

This document establishes the long-term creative and gameplay direction. It is not a rigid specification for every future feature.

## 1. Overall Vision

Expand Survival Island from a five-day ESL survival adventure into a longer, evolving Robinson Crusoe-inspired island settlement game.

The player begins as a shipwreck survivor with limited tools and resources. Over time, they:

- Explore increasingly remote areas of the island.
- Face realistic survival challenges.
- Discover and rescue additional survivors.
- Improve their original campsite into a permanent home.
- Develop a growing settlement with specialized facilities.
- Invent and construct useful mechanical contraptions.
- Build water distribution, food production and transportation systems.
- Work cooperatively with survivors.
- Eventually establish rescue communications and complete the story.

The settlement should visibly evolve from a primitive camp into an attractive, ingenious village filled with functional mechanical devices.

The game's central loop is:

**Explore → Discover problems and resources → Gather materials → Design and construct → Test and improve → Benefit the settlement → Discover new opportunities.**

The player should feel increasingly capable as the settlement develops.

## 2. Preserve Existing Gameplay

Keep the existing five-day survival gameplay as the foundation, including the current locations, crafting, survival statistics, inventory, Kai, speech recognition, tapping fallback and saves.

The early survival experience should remain recognizable.

However, the current Day 5 rescue sequence will eventually be moved to a later stage of the expanded narrative.

Do not remove the existing rescue content. Preserve its implementation and adapt its timing when the new storyline is ready.

Maintain compatibility with existing saves where practical.

Retain the educational objective: English should be how the player communicates, makes decisions and performs meaningful activities.

## 3. Expanded Island

Introduce new areas gradually. Each new region should have a distinct visual identity, natural resources, gameplay mechanics, educational vocabulary and survival challenges.

### Planned locations

**Shipwreck Cove**
- Salvaged wood, rope, metal, canvas, containers and equipment.
- Salvage exploration, tides, transporting objects and repairing devices.
- English: objects, materials, quantities and location descriptions.

**Bamboo Grove**
- Bamboo poles, flexible fibers and construction materials.
- Cutting, measuring, carrying, joining and assembling structures.
- English: verbs, numbers, dimensions and construction instructions.

**Upper Stream and Waterfall**
- Flowing water, elevation differences and rocky terrain.
- Water collection, storage, gravity-fed channels and water-powered machinery.
- English: prepositions, direction, water vocabulary and problem solving.

**Mangrove Lagoon**
- Shallow tidal water, fish, crabs and difficult terrain.
- Fish traps, raised walkways, tidal exploration and resource collection.
- English: animal vocabulary, quantities, movement and environmental descriptions.

**Sheltered Valley**
- Fertile ground and suitable space for crops.
- Gardening, food production, irrigation and settlement expansion.
- English: growing, harvesting, food, seasons and quantities.

**Remote Beach**
- Additional wreckage, survivors and useful materials.
- Rescue missions, salvage transport and constructing improved buildings.
- English: needs, abilities, cooperation and descriptions.

**Forest Highlands**
- Elevated terrain and tall trees.
- Treehouses, rope bridges, lifts and gravity-powered transportation.
- English: high/low, up/down, above/below, near/far and directions.

**Windy Ridge**
- A high lookout linked to the existing clifftop area.
- Signal equipment, rescue preparation and transporting heavy materials uphill.
- English: weather, navigation, visibility and communication.

**Tidal Cave**
- A coastal passage affected by the tide.
- Timed exploration, navigation and discovering alternate routes.
- English: time, warnings, directions and safe decision-making.

Do not construct every new area simultaneously.

Prioritize a connected, explorable world with meaningful backtracking and shortcuts.

Previously visited areas should gain new uses as tools and knowledge improve.

## 4. Survival Challenges

Introduce practical problems inspired by real-world survival.

Potential challenges include:

- Rainwater collection and safe water treatment.
- Improving shelters and protecting supplies from rain.
- Food shortages, fishing and food preservation.
- Basic wound care using appropriate recovered supplies.
- Weather events and storm preparation.
- Fire management and dry fuel storage.
- Sanitation and cleanliness.
- Navigation and route marking.
- Safe food identification.
- Equipment damage and repair.
- Resource transportation.
- Food theft by animals.
- Growing food.
- Maintaining equipment and structures.
- Rescue signaling and communication.

Challenges should affect other gameplay systems rather than exist as disconnected checklists.

For example, rain might extinguish an exposed fire, motivating the player to build a sheltered cooking area.

Permanent upgrades should reduce repeated chores.

Use factually appropriate survival principles. Avoid teaching unsafe practices, especially for drinking water, wild food identification, injuries and fire.

## 5. Evolving Settlement

The original camp should become the center of a growing village.

Progression:

1. Primitive campsite.
2. Improved personal shelter and storage.
3. Workshop, cooking area and reliable water supply.
4. Accommodation for additional survivors.
5. Gardens and shared settlement facilities.
6. Mechanical infrastructure and transportation.
7. An interconnected, functioning village.

Preserve the player's ability to choose the arrangement of buildings.

The village must feel inhabited, with survivors walking, working, resting and using its facilities.

## 6. Additional Survivors

Introduce survivors gradually through exploration and rescue events.

Potential character specialties include:

- Engineering and mechanical construction.
- Gardening and food production.
- Carpentry and larger structures.
- Navigation and rescue communications.

These are proposed roles, not finalized characters.

Survivors should have personalities, needs and useful abilities.

They should be able to perform meaningful tasks rather than function only as dialogue NPCs.

Develop interactions such as:

- "Can you help me?"
- "Please get some wood."
- "Let's build a house."
- "Where do you want to go?"
- "What do you need?"
- "Put it next to the tent."

Eventually, survivors should independently perform assigned tasks and use constructed infrastructure.

## 7. Crafting and Engineering Philosophy

Move beyond crafting exclusively through recipe selection.

Introduce three complementary construction systems.

**Simple Crafting**

Small tools and basic items use quick, guided crafting. Do not make routine actions unnecessarily repetitive.

**Structure Construction**

Players place and connect floors, walls, supports, poles, roofs, platforms and other components.

Use snapping and clear building previews. Allow customization of layout, orientation and dimensions within practical limits.

**Mechanical Construction**

Players design functioning contraptions by connecting modular components.

Possible components:

- Poles and structural frames.
- Rope and pulleys.
- Wheels, axles and gears.
- Levers and counterweights.
- Platforms and containers.
- Ramps and chutes.
- Bamboo pipes and water channels.
- Valves and gates.
- Waterwheels and mechanical transmissions.

Possible inventions:

- Gravity-fed water distribution.
- Water-powered workshop equipment.
- Cargo elevators.
- Rope transportation systems.
- Irrigation networks.
- Mechanical gates.
- Moving baskets and conveyors.
- Rube Goldberg-style devices.

Where feasible, support multiple valid solutions rather than requiring one predefined arrangement.

Players should be able to design, place, operate, test and modify contraptions.

Use simplified, deterministic mechanical simulation suited to Chromebook hardware rather than attempting unrestricted physical simulation.

Mechanical failures should be understandable and visually demonstrated.

## 8. Realistic Construction Gameplay

Different projects should involve different kinds of interaction.

Examples:

- Cutting bamboo to length.
- Placing and bracing structural frames.
- Weaving fish traps.
- Routing water channels.
- Connecting pulleys and ropes.
- Operating levers.
- Balancing loads.
- Repairing damaged equipment.
- Testing water flow.
- Troubleshooting an unpowered mechanism.

Construction should be visually satisfying and permanently affect the world.

Introduce heavier resources that require carrying, carts, cooperative lifting or mechanical transport.

Make infrastructure valuable by reducing travel time or repetitive work.

## 9. ESL Design Principles

Retain Japanese elementary-school EFL accessibility, with Grade 5 as the primary design target and room for Grade 6 extension.

Integrate English directly into exploration, crafting, communication and problem solving.

Important language categories:

- Materials: wood, stone, bamboo, rope, metal.
- Tools: axe, hammer, saw, rope, wheel.
- Survival: hungry, thirsty, wet, dry, safe, dangerous.
- Construction: cut, build, put, move, pull, push, carry, turn, fix.
- Position: in, on, under, above, below, next to, between.
- Directions: left, right, straight, up, down.
- Quantity and measurement: one, two, three, long, short, heavy, light.
- Needs: "I need…" and "We need…"
- Wants: "I want to…"
- Abilities: "I can…" and "Can you…?"
- Cooperation: "Let's…" and requests for help.
- Descriptions: "It's too high." / "It's broken."
- Location questions: "Where is…?"
- Planning: "What do you want to make?"
- Problem solving: "It doesn't work." / "Let's try again."

English must be linked to real actions and observable consequences.

Preserve speech recognition and meaningful reading-based tapping alternatives.

Avoid introducing excessive reading or long compulsory dialogue.

## 10. Narrative Direction

The original five-day adventure becomes the beginning of a longer story.

Broad narrative stages:

**Stage 1: Survive**
The player and Kai establish basic survival.

**Stage 2: Build a Home**
The pair explore new areas and construct reliable shelter, food and water facilities.

**Stage 3: Discover Other Survivors**
More castaways are found and brought into the growing settlement.

**Stage 4: Establish a Village**
The community develops shared facilities and infrastructure.

**Stage 5: The Ingenious Settlement**
The player designs increasingly complex machines to solve practical problems.

**Stage 6: Rescue**
The settlement restores communication, prepares rescue signals and eventually contacts rescuers.

The eventual rescue should feel earned.

Allow continued settlement play after the story is completed.

Do not finalize the full day-by-day narrative yet. Preserve flexibility to adapt pacing to actual gameplay.

---

# Part II — First Implementation Milestones

The following milestones should be developed before adding additional survivors or advanced machinery.

## Milestone 0 — Technical Preparation

Before making changes:

1. Inspect the current gameplay architecture and scene generation.
2. Identify reusable systems for crafting, placement, inventory, collision and saved world state.
3. Determine how additional explorable areas can be introduced without breaking the existing story.
4. Review Chromebook rendering budgets and automated tests.
5. Determine how modular construction components should be represented.
6. Plan a versioned save migration for any new persistent features.
7. Preserve and validate the existing complete five-day story.

Prepare an implementation sequence and identify risks before coding.

## Milestone 1 — Shipwreck Cove

### Objective

Introduce the first new explorable location, focused on salvage and basic transportation.

### Environment

Create a visually distinct rocky coastal cove connected naturally to the existing starting beach.

Include:

- Large pieces of broken wreckage.
- Partially buried crates.
- Driftwood.
- Salvageable rope and canvas.
- Metal parts.
- A narrow passage through coastal rocks.
- A clearly recognizable route back to the original beach.

Use the existing island aesthetic and procedural low-poly modeling.

### Gameplay

Add a salvage mission where Kai suggests investigating the cove for materials needed to improve the camp.

Players should:

1. Discover the path to Shipwreck Cove.
2. Explore the wreckage.
3. Identify useful salvage.
4. Open or clear an accessible crate.
5. Recover rope, canvas or a useful container.
6. Transport at least one larger item toward camp.
7. Use the materials for a practical improvement.

Introduce a simple carry mechanic for oversized objects.

A carried object should be visible in the 3D world and affect movement appropriately.

Do not yet implement a complicated weight or physics system.

### ESL

Focus on:

- "What is this?"
- "I found a rope."
- "I need a box."
- "Pick it up."
- "Can you help me?"
- "Let's go back."
- "It's too heavy."

### Acceptance

- The new area is accessible without disrupting the existing story.
- Navigation is clear.
- Salvage can be collected and persists correctly.
- Oversized objects can be carried and placed down.
- The player can return to camp without losing progress.
- Speech and tapping interactions work.
- Performance remains suitable for the existing Chromebook target.

## Milestone 2 — Bamboo Grove

### Objective

Introduce a second location and the foundation of modular structure construction.

### Environment

Add a distinct bamboo forest accessible through a new branch of the existing jungle.

Include harvestable bamboo, fallen poles, natural clearings and a recognizable pathway.

### Gameplay

Players need poles to improve their camp.

Introduce:

1. Cutting selected bamboo stalks.
2. Visible falling or cutting animations.
3. Gathering bamboo poles.
4. Selecting different pole lengths.
5. Carrying long poles.
6. Returning materials to camp.
7. Assembling a simple bamboo frame.

The first project should be a practical **raised storage or drying rack**.

### Construction Mechanics

Develop a reusable snapping system for structural components.

For the first version:

- Show a translucent preview.
- Allow placement and orientation.
- Snap compatible pole ends to joints.
- Add diagonal supports.
- Distinguish stable and unstable assemblies through simple structural rules.
- Provide visual feedback when the frame is complete.
- Save the finished structure's actual configuration.

Keep the interaction touchpad-friendly.

Do not require precise freehand movement or advanced 3D manipulation.

### ESL

Focus on:

- "Cut the bamboo."
- "Get three poles."
- "This is too long."
- "Put it here."
- "Move it left."
- "It's too short."
- "Let's build a rack."

### Acceptance

- Bamboo harvesting and transport work correctly.
- The rack is assembled from visible components.
- Players can choose placement and orientation.
- Basic structural arrangements affect the result.
- Construction can be interrupted and resumed.
- The rack becomes a persistent, useful settlement object.

## Milestone 3 — Rainwater Collection and Water Engineering

### Objective

Introduce the first functional engineering system using materials from multiple locations.

This should be the first example of a player-built contraption that actually solves a survival problem.

### Narrative

Rain reveals weaknesses in the existing camp. The player and Kai decide to build a rainwater collection system.

This creates a reason to revisit Shipwreck Cove and Bamboo Grove.

### Gameplay

1. Collect suitable waterproof material from the cove.
2. Obtain structural poles from the grove.
3. Return to camp.
4. Choose the collector location.
5. Assemble the support frame.
6. Place the collection surface.
7. Adjust the slope.
8. Position a suitable container.
9. Test water flow.
10. Improve the design if water misses the container.

Players should see water physically travel along the surface toward the container.

The collector should operate during later rain events and accumulate water based on a simplified capacity model.

Collected water should be treated appropriately before drinking.

### Engineering Mechanics

Introduce an initial simplified water simulation.

The system should recognize:

- Collection surfaces.
- Height and slope.
- Water outlets.
- Connected containers.
- Storage capacity.
- Basic water flow.
- Overflow.

Avoid an expensive full fluid simulation.

Design these components so they can later support bamboo channels, elevated tanks, valves and irrigation.

### ESL

Focus on:

- "It's raining."
- "We need water."
- "Put the container here."
- "Make it higher."
- "It's too low."
- "The water is flowing."
- "It doesn't work."
- "Let's try again."

### Acceptance

- Materials from both new areas are meaningfully required.
- The player assembles a functioning collector.
- Different configurations produce observable results.
- Water reaches the container only when the setup is suitable.
- The collected amount persists.
- Rain events provide a continuing benefit.
- The construction can be modified rather than rebuilt entirely.

---

# Part III — Future Milestones (Outline Only)

The following are planned directions, not implementation-ready specifications.

**Milestone 4 — Upper Stream and Water Distribution**

Explore the waterfall and upstream area. Introduce bamboo channels, elevation differences and a simple gravity-fed water network.

**Milestone 5 — Better Housing**

Allow players to build a customizable permanent hut with floors, walls, roof sections, raised platforms and furniture.

**Milestone 6 — First Additional Survivor**

Introduce a stranded survivor through a new exploration mission. Construct accommodation and introduce a simple system of needs and task assignments.

**Milestone 7 — Food Infrastructure**

Expand fishing, introduce traps, food storage and gardening in the Sheltered Valley.

**Milestone 8 — Basic Mechanical Devices**

Introduce pulleys, levers, counterweights and cargo lifting.

**Milestone 9 — Settlement Growth**

Find additional survivors and develop shared facilities, routines and cooperative tasks.

**Milestone 10 — Water-Powered Machinery**

Construct a waterwheel and connect it to useful workshop equipment.

**Milestone 11 — Advanced Player-Designed Contraptions**

Support modular devices combining mechanical motion, water flow, cargo transport and simple automation.

**Milestone 12 — Expanded Rescue Story**

Restore the radio, establish rescue signals and develop the final rescue sequence while allowing continued settlement play.

The order may change based on implementation difficulty and gameplay testing.

---

# Part IV — Important Development Rules

1. Preserve existing gameplay, saves and tests wherever possible.
2. Expand incrementally, with each milestone producing a playable improvement.
3. Do not introduce large new systems without first reviewing the existing architecture.
4. Avoid building elaborate scenery without meaningful gameplay.
5. Make crafting physical, visual and interactive where it adds value.
6. Let players modify and improve constructions.
7. Provide useful consequences for successful engineering.
8. Avoid excessive grind and repetitive material gathering.
9. Reuse existing locations by giving them additional purposes.
10. Keep survivors active, useful and responsive.
11. Maintain Chromebook performance and low-poly consistency.
12. Support keyboard, touchpad and touch controls.
13. Preserve speech and reading-based fallback interactions.
14. Keep English meaningful and accessible for elementary EFL learners.
15. Use automated tests to protect existing and new gameplay.
16. Separate proposed features from already implemented features in project documentation.
17. Do not treat the entire expansion plan as authorization to implement everything immediately.

## Immediate Deliverables

For this request:

1. Read and understand the current repository.
2. Save this master plan as `EXPANSION_PLAN.md`.
3. Cross-reference it from the README or relevant project documentation.
4. Identify any significant conflicts with existing design decisions.
5. Prepare a concise technical implementation roadmap for Milestones 0–3.
6. Do not modify gameplay code yet.

The next implementation should begin with **Milestone 1: Shipwreck Cove**, once the initial technical preparation is complete.

## Long-Term Design Principle

**Survival Island should be a world that the player transforms through exploration, English communication, cooperation, construction and invention.**

The player should begin with almost nothing and eventually look over a lively, functioning settlement filled with homes, gardens, running water, workshops and ingenious mechanical contraptions—all created through their own decisions.
