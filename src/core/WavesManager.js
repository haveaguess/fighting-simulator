import { AIPlayer } from '../character/AIPlayer.js';
import { applyCostume, COSTUME_KEYS } from '../character/Costumes.js';
import { SpawnDoor } from '../arenas/SpawnDoor.js';

const ENEMY_COLORS = [
  0xaa0000, 0x880000, 0x660000, 0xcc2200,
  0x990000, 0xbb1100, 0x771100, 0xdd3300,
];

const ENEMY_COSTUMES = ['ninja', 'robot', 'pirate', 'dinosaur'];

export class WavesManager {
  constructor(game, humanPlayers, arena, damageSystem, hud, audio) {
    this.game = game;
    this.humanPlayers = humanPlayers;
    this.arena = arena;
    this.damageSystem = damageSystem;
    this.hud = hud;
    this.audio = audio;

    this.wave = 0;
    this.enemies = [];
    this.allEntities = [...humanPlayers];
    this.state = 'waiting';
    this.timer = 0;
    this.onStateChange = null;

    // Spawn queue for staggered enemy spawning through doors
    this.spawnQueue = [];
    this.spawnInterval = 0.6; // seconds between each enemy spawn
    this.spawnTimer = 0;

    // Set human players to team 'human'
    for (const p of humanPlayers) {
      p.team = 'human';
      p.controller.team = 'human';
    }

    // Create spawn doors on the far side of the arena
    this.doors = [];
    this._createDoors();

    this._updateCallback = game.onUpdate((dt) => this.update(dt));
  }

  _createDoors() {
    // Place doors at the back edge of the arena
    const doorPositions = [
      { x: -5, y: 0, z: -9.5 },
      { x: 0, y: 0, z: -9.5 },
      { x: 5, y: 0, z: -9.5 },
    ];

    for (const pos of doorPositions) {
      const door = new SpawnDoor(this.game, pos);
      this.doors.push(door);
    }

    // Register door updates
    this._doorCallback = this.game.onUpdate((dt) => {
      for (const door of this.doors) {
        door.update(dt);
      }
    });
  }

  startWaves() {
    this.wave = 0;
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    this.state = 'countdown';
    this.timer = 3;

    const spawnPoints = this.getHumanSpawns();
    for (let i = 0; i < this.humanPlayers.length; i++) {
      this.humanPlayers[i].reset(spawnPoints[i]);
      this.humanPlayers[i].team = 'human';
      this.humanPlayers[i].controller.team = 'human';
    }

    this.clearEnemies();

    if (this.onStateChange) this.onStateChange('waveStart', { wave: this.wave });
  }

  startSpawning() {
    const count = Math.min(this.wave + 1, 8);

    // Open doors
    for (const door of this.doors) {
      door.open();
    }

    // Queue enemies to spawn one at a time through doors
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      this.spawnQueue.push({
        doorIndex: i % this.doors.length,
        costumeIndex: i,
        colorIndex: i,
      });
    }
    this.spawnTimer = 0;
  }

  _spawnOneEnemy(config) {
    const door = this.doors[config.doorIndex];
    const spawnPos = door.getSpawnPosition();
    const color = ENEMY_COLORS[config.colorIndex % ENEMY_COLORS.length];

    const ai = new AIPlayer(this.game, this.allEntities, spawnPos, color, this.audio);
    ai.isAI = true;
    ai.team = 'enemy';
    ai.controller.team = 'enemy';
    ai.ai.targetTeam = 'human';

    const costume = ENEMY_COSTUMES[config.costumeIndex % ENEMY_COSTUMES.length];
    ai.costumeKey = costume;
    ai.damageSystem = this.damageSystem;
    applyCostume(ai.ragdoll, costume);
    this.damageSystem.register(ai.ragdoll);
    this.enemies.push(ai);
    this.allEntities.push(ai);

    this.game._allPlayers = this.allEntities;
    for (const e of this.enemies) {
      e.allPlayers = this.allEntities;
    }

    // Play a sound
    if (this.audio) this.audio.playCountdown();
  }

  clearEnemies() {
    for (const e of this.enemies) {
      e.destroy();
    }
    this.enemies = [];
    this.allEntities = [...this.humanPlayers];
    this.game._allPlayers = this.allEntities;

    // Close doors
    for (const door of this.doors) {
      door.close();
    }
  }

  getHumanSpawns() {
    const count = this.humanPlayers.length;
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push({
        x: (i - (count - 1) / 2) * 2,
        y: 1.5,
        z: 5,
      });
    }
    return points;
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'spawning';
        this.startSpawning();
        if (this.onStateChange) this.onStateChange('fight', { wave: this.wave });
      }
      return;
    }

    if (this.state === 'spawning') {
      // Spawn enemies one at a time through doors
      this.spawnTimer += dt;
      if (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this._spawnOneEnemy(this.spawnQueue.shift());
      }
      if (this.spawnQueue.length === 0) {
        this.state = 'fighting';
        // Close doors after all enemies have spawned
        setTimeout(() => {
          for (const door of this.doors) {
            door.close();
          }
        }, 1000);
      }
      // Also check for deaths during spawning
      this._checkFightStatus();
      return;
    }

    if (this.state === 'fighting') {
      this._checkFightStatus();
    }

    if (this.state === 'waveComplete') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.nextWave();
      }
    }
  }

  _checkFightStatus() {
    const aliveEnemies = this.enemies.filter(e => e.alive);
    const aliveHumans = this.humanPlayers.filter(p => p.alive);

    if (aliveEnemies.length === 0 && this.spawnQueue.length === 0) {
      this.state = 'waveComplete';
      this.timer = 3;
      if (this.onStateChange) this.onStateChange('waveComplete', { wave: this.wave });
      return;
    }

    if (aliveHumans.length === 0) {
      this.state = 'gameOver';
      if (this.onStateChange) this.onStateChange('gameOver', { wave: this.wave });
    }
  }

  destroy() {
    this.clearEnemies();
    for (const door of this.doors) {
      door.destroy();
    }
    this.doors = [];
    if (this._updateCallback) {
      this.game.removeOnUpdate(this._updateCallback);
    }
    if (this._doorCallback) {
      this.game.removeOnUpdate(this._doorCallback);
    }
  }
}
