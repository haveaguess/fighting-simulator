# Wobbly Brawler

A Gang Beasts-inspired 3D physics brawler you can play in your browser. Built with Three.js and cannon-es.

## Play Now

**[https://haveaguess.github.io/fighting-simulator/](https://haveaguess.github.io/fighting-simulator/)**

### Quick Links

| Mode | URL | Description |
|------|-----|-------------|
| Full Game | [Play](https://haveaguess.github.io/fighting-simulator/) | Title screen, player join, costume select, arena select |
| Instant Brawl | [Play](https://haveaguess.github.io/fighting-simulator/?brawl) | 2-player melee, skip all menus |
| Instant Waves | [Play](https://haveaguess.github.io/fighting-simulator/?waves) | 2-player co-op survival, skip all menus |
| Test Arena | [Play](https://haveaguess.github.io/fighting-simulator/?test) | Solo debug arena with physics HUD |

## Game Modes

### Melee
Free-for-all brawl. Up to 8 players (keyboard + gamepad). Last one standing wins. First to 3 rounds takes the match.

### Waves (Co-op)
Team up against waves of AI enemies. Enemies spawn through doors one at a time. Knock them all off the platform to advance. Waves get harder (more enemies each round, up to 8). One free continue per run. Progress saves between refreshes.

## Controls

### Player 1
| Action | Key |
|--------|-----|
| Move | WASD |
| Jump | Space (hold for higher) |
| Punch | F |
| Kick | G |
| Headbutt | T |
| Grab | R (hold) |

### Player 2
| Action | Key |
|--------|-----|
| Move | Arrow Keys |
| Jump | / (hold for higher) |
| Punch | . |
| Kick | , |
| Headbutt | ; |
| Grab | M (hold) |

### While Grabbing
- **Punch/Headbutt** hits the held player
- **Kick** throws them (launches upward and away)
- **Release grab button** to let go

Press **ESC** to pause and open Settings to rebind any key.

## Features

- 3D physics-based combat with knockback scaling (more damage = fly further)
- 8 costumes: Wrestler, Chicken, Dinosaur, Astronaut, Pirate, Robot, Ninja, Luchador
- 3 arenas: Rooftop (spinning dish), Factory (conveyors + crushers), Wrestling Ring (electric ropes)
- Grab combo system: hold, punch, headbutt, or throw
- Variable jump height (tap vs hold)
- Floating health bars above every character
- Victory celebrations (arms up, jumping, smiling)
- Procedural sound effects and background music
- Chicken sounds for Player 2 in quick modes
- Spawn doors with warning lights in Waves mode
- Wave progress saved to localStorage
- Gamepad support (Players 3-8)

## Arenas

### Rooftop
City rooftop with a spinning satellite dish hazard and breakable ledges. Skyline backdrop.

### Factory
Multi-level platforms with conveyor belts that push you toward edges and hydraulic crushers that slam down periodically.

### Wrestling Ring
Bouncy ropes on all sides that periodically electrify, dealing damage and stunning anyone touching them.

## Run Locally

```bash
git clone https://github.com/haveaguess/fighting-simulator.git
cd fighting-simulator
npm install
npx vite
```

Open http://localhost:3000

## Tech Stack

- [Three.js](https://threejs.org/) - 3D rendering
- [cannon-es](https://pmndrs.github.io/cannon-es/) - Physics
- [Vite](https://vitejs.dev/) - Build tool
- Vanilla JavaScript - No framework

## License

MIT
