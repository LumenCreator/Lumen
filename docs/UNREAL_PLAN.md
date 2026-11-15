# Hollow Deep: Unreal Engine build plan

The goal is one small, good-looking slice: the Bright Field, its dark copy the Underside,
and the Listening Coil fight. Graphics first, bought or free assets only, mechanics after.

Work through the steps in order. Each step ends with something you can look at.

---

## Step 0. Install and open the project (half a day)

1. Install the **Epic Games Launcher**, then **Unreal Engine 5.8**.
2. Install **Visual Studio 2022 Community** with the "Game development with C++" workload
   (tick the Unreal Engine installer option). The project has C++ code, so this is required.
3. Install **Git** and **Git LFS**, then run `git lfs install` once. Unreal assets are large binary
   files and this repository is set up to store them through LFS.
4. Clone this repository, right-click `HollowDeep.uproject` and choose
   **Generate Visual Studio project files**, then double-click the `.uproject`.
   Say yes when it offers to build the `HollowDeep` module.
5. If the build fails, copy the errors from Visual Studio's Output window into Claude Code.
   The code was written without an engine to compile against, so a first round of fixes is expected.

GitHub's free LFS allowance is small (about 1 GB). `.gitignore` already keeps bought packs
out of the repository; only commit what you make under `Content/HollowDeep/`.

## Step 1. Project settings

Already set in `Config/DefaultEngine.ini`, nothing to click:

| Setting | Value | Why |
| --- | --- | --- |
| Global illumination and reflections | Lumen | Bounce light from the sky and flowers, lantern glow in the Underside |
| Nanite | On | Photo-scanned rocks, ruins and castle with no manual LODs |
| Shadows | Virtual Shadow Maps | Sharp shadows on dense grass |
| Static lighting | Off | Everything is dynamic because the sun moves |
| RHI | DirectX 12, SM6 | Required by Nanite and Lumen |
| Anti-aliasing | TSR | Lets you render below native resolution and upscale |
| Hardware ray tracing | Off | Software Lumen is the safe choice for an 8 GB card |
| Plugins | Water, Landmass, PCG | Lake, terrain shaping, flower scattering |

For an 8 GB card, the things that decide the frame rate are, in order: foliage density,
volumetric cloud and fog quality, and screen percentage. Start with TSR at 67% screen percentage
at 1440p. 5.8 also adds a cheaper "Lumen Lite" mode; keep it as a fallback if the meadow is too heavy.
Once the graphics card is known, set a real target (for example 60 fps at 1440p) and tune to it.

## Step 2. Assets to get

All from **Fab** (fab.com), added to the project through the Fab plugin inside the editor.
Prices and free status change, so check each listing; the "free" ones below are free for Unreal projects
at the time of writing as far as I know.

| Need | Recommended | Cost | Notes |
| --- | --- | --- | --- |
| Player character and movement animation | **Game Animation Sample Project** (Epic) | Free | 500+ motion-matched animations: walk, sprint, crouch, turn, jump. The best free locomotion there is |
| Hero look | **Paragon** characters (Epic), for example Greystone or Kwang | Free, Unreal only | Realistic knights with sword attack animations. Good stand-in until custom armour exists |
| Rocks, cliffs, ground textures, small plants | **Quixel Megascans** on Fab | Mostly paid per asset or pack; some free | Search "meadow", "wildflower", "nordic cliff", "mossy rock" |
| Flower meadow | **Megascans Meadow / wildflower plant packs**, or **Project Nature**-style meadow packs | Paid | You need 6 to 8 flower species in purple, white, yellow, pink plus 3 grass types, all with wind |
| Trees | **Megascans Trees: European** (black alder, hornbeam, beech) | Free sample set, more paid | Use Nanite foliage versions |
| Castle and ruins | **Infinity Blade: Castle / Grass Lands** (Epic, free, older) for blocking out; a modular medieval castle kit (paid) for the final look | Free / paid | Pale stone with blue roofs is a material tweak on most kits |
| Stall and props | Megascans medieval props, **Medieval Village**-type kits | Mixed | Herbalist's stall, lanterns, fences |
| Sky | Built-in Sky Atmosphere and Volumetric Clouds; optionally **Ultra Dynamic Sky** | Built-in free / paid | Ultra Dynamic Sky gives stars, moon phases and weather out of the box. Worth it for a solo project |
| Water | Built-in **Water** plugin | Free | Lake and river with shoreline blending |
| Butterflies, fireflies, ash | Built-in **Niagara**; a "nature VFX" pack if you would rather not author them | Free / paid | Simple sprite emitters, a good first Niagara exercise |
| Reference scene | **Electric Dreams Environment** (Epic) | Free | Open it to see how Epic sets up PCG scattering, fog and lighting |

Buy as little as possible at first. Block out with free assets, then replace the two or three
things that look weakest.

## Step 3. Build the Bright Field (1 to 2 weeks)

Save everything under `Content/HollowDeep/`. Map name: `L_BrightField`.

1. **New level** from the *Open World* template. It comes with a landscape, sky, sun, fog and
   World Partition already set up.
2. **Sculpt the terrain** (Landscape mode). Target about 2 km by 2 km of playable area.
   - A gently rolling meadow in the middle.
   - A hill at one edge for the castle.
   - A basin for the lake.
   - Mountains ringing the far side. Do not sculpt these by hand at full detail: place large
     Megascans cliff meshes as a backdrop, they look better and cost less.
   5.8 also has an experimental Mesh Terrain system. Stay on the classic Landscape for now; it is
   what every tutorial and foliage tool assumes.
3. **Landscape material** with four layers: grass, dirt path, rock, lake shore. Use Megascans surfaces.
   Auto-blend rock onto steep slopes; paint the looping dirt footpath by hand.
4. **Lake**: add a Water Body Lake from the Water plugin and fit its spline to the basin.
5. **Flowers and grass.** Two tools, use both:
   - *Landscape Grass Types* for the base grass, tied to the grass layer so it appears automatically
     and disappears from the path.
   - *PCG* (or the Foliage paint tool if PCG is too much at first) for flowers in drifts of one
     colour at a time. Real meadows are patchy; even scattering looks fake.
   - Turn on wind in the foliage materials, and add a simple "player position" material parameter
     so grass bends around the character.
6. **Landmarks**: castle on the hill, herbalist's stall beside the path, a few trees and rocks to
   frame views. Put floating islands far away as large simple meshes; nobody walks on them in the slice.
7. **Footpath spline**: place an `HDSightseeingPath` actor and lay its spline along the dirt path.
   Tick *Closed Loop*. Sightseeing mode (V) walks this.
8. **Life**: Niagara emitters for butterflies and bees by day, fireflies at night.

### Lighting the Bright Field

The Open World template already contains every actor needed. Adjust them:

| Actor | Settings |
| --- | --- |
| Directional Light (sun) | Movable. Warm tint for golden hour. Source angle about 1.5 for soft shadow edges |
| Second Directional Light (moon) | Movable, pale blue, about 0.3 lux. Tick "Atmosphere Sun Light", index 1 |
| Sky Atmosphere | Default is close. Raise Mie scattering slightly for haze over the mountains |
| Sky Light | Movable, Real Time Capture on, so sky colour follows the time of day |
| Volumetric Cloud | Large cumulus: raise layer height and coverage until the clouds read as big shapes |
| Exponential Height Fog | Volumetric Fog on. Low density, warm inscattering colour, so light shafts show at sunset |
| Post Process Volume (unbound) | Slight warm grade, mild bloom, exposure min and max clamped so night stays readable |

Then place an **`HDDayCycleDirector`** actor and assign the sun and moon to it. It turns the
sun through an 8 hour day, 2 hour sunset and 6 hour night. Set **Time Scale to 960** while
working so a full day takes one minute, and check that sunset and night look as good as noon.
For night: add stars (a sky sphere with a star texture, or Ultra Dynamic Sky) and keep a little
blue moonlight so the meadow is never black.

## Step 4. Build the Underside (3 to 5 days)

The Underside is the same map, so do not rebuild it.

1. **Duplicate** `L_BrightField` as `L_Underside`. Do this only once the surface layout is final,
   because later changes will need doing twice.
2. **Mirror it**: flip the landscape and landmarks on one axis so players recognise it but it feels wrong.
3. **Drain the colour**:
   - Make *material instances* of the grass and flower materials with desaturated grey-violet tints,
     and turn wind down. Swap wilted or dead variants in where the pack has them.
   - Replace trees with dead or bare trees.
   - Lake water: black, no waves, high reflectivity.
4. **Lighting**, the opposite recipe from the surface:

| Actor | Settings |
| --- | --- |
| Directional Light | Very dim, cold violet, or remove it entirely |
| Sky Light | Low intensity, fixed purple colour instead of real-time capture |
| Volumetric Cloud | Delete |
| Exponential Height Fog | Dense, purple, volumetric, start distance near zero. This sets the short view distance |
| Blue lanterns | Point lights along the path, every 15 to 20 m. With MegaLights on (production-ready in 5.8) you can afford many shadow-casting ones |
| Red castle beam | A tall emissive cylinder plus a red spot light pointing up through the fog. The only warm colour |
| Post Process Volume | Strong vignette, desaturation, crushed blacks, lower exposure |
| Niagara | Slow drifting ash across the whole play area |

5. No day cycle here. Place an `HDRealmMarker` set to *Underside* (and one set to *Bright Field*
   on the surface) so the game knows which realm it is in.
6. **The sinkhole**: on the surface, hide an `HDSinkhole` trigger in a flower drift and set its
   *Destination Level* to `L_Underside`. Add a short fall through a dark shaft for the transition.
7. **The Coil's arena**: a wide, flat, open floor in the Underside, at least 60 m across.
   The Coil moves on a flat plane, so keep the arena level.

## Step 5. Wire up the mechanics (about 1 week)

The systems from the three.js prototype are already written in C++ (see the table in `README.md`).
In the editor they need only a little hookup:

1. Make **`BP_HDCharacter`**, a Blueprint child of `HDCharacter`. Assign the skeletal mesh and
   animation blueprint from the Game Animation Sample (or a Paragon hero).
2. Make **`BP_HDGameMode`**, a child of `HDGameMode`, set its Default Pawn to `BP_HDCharacter`,
   and select it in Project Settings > Maps & Modes.
3. Place three **`HDPickup`** actors (item `Sunpetal`) in the meadow and an **`HDHerbalist`** at the stall.
   Three sunpetals plus E at the stall gives one Coldblood Tonic. Q drinks it.
4. Place **`HDListeningCoil`** in the arena. It works immediately as a chain of grey spheres.
5. Play. The placeholder HUD shows health, stamina, the Coil's state and the vibration meter.
6. Then dress it, all in Blueprint using the events the code exposes:
   - `VibrationSubsystem.OnVibration` -> spawn a Niagara ground ripple at the location, sized by strength.
   - Coil `OnStateChanged` -> the low hum while Listening, roar on Lunge, weak-point glow.
   - Coil `OnDefeated` -> break the arena floor open.
   - Character `OnSightseeingChanged` -> fade the HUD.
   - Character `OnStrike`, `OnStamp`, `OnDied` -> animation montages and sound.

Still to port after that: sword versus hammer (drag sparks and ground scars with Niagara and decals),
throwing a rock as bait, the full death-drop rule, save games.

## Step 6. Sightseeing mode polish

Works in code already (V key): autowalk on the path spline, camera pulls back, HUD hides.
To make it feel like an Assassin's Creed viewpoint, add a slow camera orbit and a slightly
wider field of view while it is active, both a few Blueprint nodes on `OnSightseeingChanged`.

---

## What needs a human artist or animator

| Thing | Why assets will not cover it | Cheapest route |
| --- | --- | --- |
| **The Listening Coil model and rig** | Hundreds of feet long, eyeless, split bony jaw, back spines. Nothing on a marketplace matches | Commission a creature artist for the head and one tiling body segment. The body can be a spline mesh driven by the segment chain the code already simulates, so only the head needs a real rig |
| **Coil animation** | Jaw to the ground, lunge, buried and struggling, coil-and-crush | The body is procedural. Only the head needs about five hand-made animations |
| **Weighty combat animation** | Free packs are light and generic; Elden Ring weight comes from timing, hit-stop and camera | Start with Paragon attack animations plus hit-stop and camera shake in code. Hire an animator or buy a premium melee pack later |
| **Player character and adjustable armour** | Horns that grow, materials that change shape and stats: this needs a custom modular character with morph targets | Out of scope for the slice. Use a Paragon hero now |
| **Sound** | Not mentioned in the brief, but the Coil fight depends on it: the hum, heartbeat, breathing | Marketplace sound packs cover most; the Coil's voice wants a sound designer |

What you can do alone with bought assets: the whole landscape, both lighting setups, foliage,
castle and ruins dressing, sky, water, all Niagara effects, the HUD.

## Scope: what this slice leaves out

The slice is single-player. "Online" is the largest cost in the whole design: Unreal's networking
means every system is written to run on a server, and persistent real-time days, housing and
proximity voice need hosted servers. Prove the slice is fun and beautiful first, then decide.
Team baiting on the Coil can be tested later with two players in a listen-server session
without building any of the persistent world.

Also deferred: levelling, lessons, standing, crafting, housing, realm defection, the High Lord,
layers 1 to 5.

## Open questions that affect the build

- **Graphics card and RAM**: decides Lumen quality, hardware ray tracing and foliage density.
- **Is the Underside lived in or visited briefly?** Decides how much of it needs to be as
  detailed as the surface.
- **Can others loot your drop on death?** Only matters once multiplayer starts.
