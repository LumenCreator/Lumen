# Hollow Deep

Online action RPG with two mirrored realms: the Bright Field above, the Underside below.
This repository is the Unreal Engine 5.8 project for the first vertical slice:
one flower meadow in two versions, and one boss, the Listening Coil.

- **[docs/UNREAL_PLAN.md](docs/UNREAL_PLAN.md)** - the step-by-step build plan: setup, assets, landscape, lighting for both realms, and what needs a human artist.
- `HollowDeep.uproject`, `Config/` - project file and render settings (Lumen, Nanite, Virtual Shadow Maps, DX12).
- `Source/HollowDeep/` - the gameplay systems in C++, ported from the three.js prototype's behaviour.
- `Content/` - empty. Maps, Blueprints and materials are made in the editor and saved here.

## What the code already does

| System | Class |
| --- | --- |
| Walk, sprint, crouch, strike, stamp, tonic, sightseeing | `AHDCharacter` |
| Stamina and exhaustion | `UHDStaminaComponent` |
| Ground vibration from footsteps, strikes and heavy breathing | `UHDVibrationSubsystem` |
| The Listening Coil: Rising, Listening, Lunging, Stuck, phase two, death | `AHDListeningCoil` |
| Heartbeat touch minigame and constriction | `UHDHeartbeatComponent` |
| 16-hour real-time day (8 day, 2 sunset, 6 night) and day counter | `AHDDayCycleDirector` |
| Realms, sinkhole, herbalist, sunpetal pickups, footpath spline | `HDWorldActors.h`, `UHDRealmSubsystem` |
| Magic colour by build percentage, Holy at half damage in the Underside | `FHDMagicBuild` |
| Placeholder on-screen bars and prompts | `AHDDebugHUD` |

Controls: WASD move, mouse look, Shift sprint, Ctrl or C crouch, left mouse strike, F stamp,
Q drink tonic, E interact or calm heartbeat, Space jump or calm heartbeat, V sightseeing.

## Status

The C++ was written without access to Unreal Engine, so **it has not been compiled yet**.
Expect to fix a few compile errors on first build; paste them into Claude Code and they can be fixed here.

Not ported yet: sword versus hammer with ground scars, rock throwing, the full death-drop rule,
saving, multiplayer.
