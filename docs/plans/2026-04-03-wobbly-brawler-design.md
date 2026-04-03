# Wobbly Brawler — Game Design Document

A Gang Beasts-inspired 3D physics-based party brawler for the web browser.

## Tech Stack

- **Three.js** — 3D rendering
- **cannon-es** — Physics (ragdoll joints, collisions, gravity)
- **Vanilla JavaScript** — No framework overhead
- **Gamepad API** — Controller support for players 3-8

## Core Gameplay

- Up to 8 players (local multiplayer + AI filling empty slots)
- Ring-out win condition — knock opponents off the platform
- First to 3 round wins takes the match

## Characters & Ragdoll Physics

Each character is built from 8 physics bodies connected by hinge/cone constraints:

- **Head** — Sphere, loosely attached to torso
- **Torso** — Box, the core body
- **Upper arms (2)** — Attached at shoulders with cone constraints
- **Lower arms (2)** — Attached at elbows with hinge constraints
- **Upper legs (2)** — Attached at hips with cone constraints
- **Lower legs (2)** — Attached at knees with hinge constraints

### Moves

| Move     | Mechanic                                                                 |
|----------|--------------------------------------------------------------------------|
| Walk     | Horizontal force applied to torso; legs flail from physics               |
| Jump     | Upward impulse to torso, only when grounded                              |
| Punch    | Strong forward impulse to one lower arm                                  |
| Grab     | On hand collision, create temporary constraint locking characters together |
| Kick     | Forward impulse to one lower leg                                         |
| Headbutt | Forward impulse to the head body                                         |

### Wobbly Balance System

- Characters are always slightly off-balance
- A balance system applies small corrective forces to keep the torso roughly vertical, but never perfectly stable
- As damage accumulates, balance correction weakens — characters get wobblier
- At high damage, characters ragdoll completely for a few seconds

## Costumes

Purely cosmetic, swapped onto ragdoll body parts as simple Three.js geometries.

**Base:** Simple colored humanoid shape (distinct color per player)

**Full costume presets:**
- Wrestler
- Chicken suit
- Dinosaur
- Astronaut
- Pirate
- Robot
- Ninja
- Luchador

Players pick costumes on a character select screen. AI opponents get random costumes.

## Arenas

### 1. Rooftop

- Flat building rooftop with short breakable ledges on edges
- Ledges break from impact, shrinking safe area over time
- **Hazard:** Spinning satellite dish sweeps players toward edges
- Skyline backdrop with building silhouettes

### 2. Factory

- Multi-level platform layout with conveyor belts
- **Hazards:** Conveyor belts push toward edges, hydraulic crushers slam on marked zones, grinder pits on sides
- Industrial look — metal textures, warning stripes, steam particles

### 3. Wrestling Ring

- Bouncy ropes on all four sides
- **Hazards:** Ropes periodically electrify (damage + stun), climbable turnbuckle corners for aerial attacks
- Crowd noise audio, spotlight lighting

### Shared Arena Mechanics

- Kill zone below all arenas — falling off = elimination
- Hazards deal damage, increasing wobbliness
- Roughly same playable size across arenas

## Match Flow

1. **Title screen** — Logo, "Press Start"
2. **Player join** — Press assigned key to join (up to 8), unfilled slots set to AI or empty
3. **Costume select** — Each player picks a costume
4. **Arena select** — Vote or random
5. **Countdown** — 3, 2, 1, FIGHT!
6. **Round** — Last player standing wins
7. **Match end** — First to 3 round wins, victory celebration
8. **Rematch or menu**

## HUD

- Player name/number + costume icon (top of screen)
- Damage meter per player
- Round wins as dots/pips
- "ELIMINATED" text on ring out
- Slow-mo on final ring out + winner announcement

## Controls

- **Player 1:** WASD + nearby keys
- **Player 2:** Arrow keys + nearby keys
- **Players 3-8:** Gamepad API controllers
- **Pause:** ESC

## Architecture

- Main game loop at 60fps syncing physics and rendering
- `World` — Manages arena, players, match state
- `Character` — Ragdoll physics body + Three.js mesh + costume
- `InputManager` — Maps keyboard/gamepad inputs to player actions
- `AIController` — Reads game state, issues same actions as human players
- `MatchManager` — Rounds, ring-out detection, win conditions
