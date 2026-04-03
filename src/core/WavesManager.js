import { AIPlayer } from '../character/AIPlayer.js';
import { applyCostume, COSTUME_KEYS } from '../character/Costumes.js';

const ENEMY_COLORS = [
  0xaa0000, 0x880000, 0x660000, 0xcc2200,
  0x990000, 0xbb1100, 0x771100, 0xdd3300,
];

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
    this.allEntities = [...humanPlayers]; // humans + current enemies
    this.state = 'waiting'; // waiting, countdown, fighting, waveComplete, gameOver
    this.timer = 0;
    this.onStateChange = null;

    this._updateCallback = game.onUpdate((dt) => this.update(dt));
  }

  startWaves() {
    this.wave = 0;
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    this.state = 'countdown';
    this.timer = 3;

    // Reset human players
    const spawnPoints = this.getHumanSpawns();
    for (let i = 0; i < this.humanPlayers.length; i++) {
      this.humanPlayers[i].reset(spawnPoints[i]);
    }

    // Clean up old enemies
    this.clearEnemies();

    if (this.onStateChange) this.onStateChange('waveStart', { wave: this.wave });
  }

  spawnEnemies() {
    const count = Math.min(this.wave + 1, 8); // wave 1 = 2 enemies, wave 2 = 3, up to 8
    const spawnPoints = this.getEnemySpawns(count);

    for (let i = 0; i < count; i++) {
      const color = ENEMY_COLORS[i % ENEMY_COLORS.length];
      const ai = new AIPlayer(this.game, this.allEntities, spawnPoints[i], color);
      ai.isAI = true;
      const costume = COSTUME_KEYS[Math.floor(Math.random() * COSTUME_KEYS.length)];
      ai.costumeKey = costume;
      ai.damageSystem = this.damageSystem;
      applyCostume(ai.ragdoll, costume);
      this.damageSystem.register(ai.ragdoll);
      this.enemies.push(ai);
      this.allEntities.push(ai);
    }

    // Update all AI references
    this.game._allPlayers = this.allEntities;
    for (const e of this.enemies) {
      e.allPlayers = this.allEntities;
    }
  }

  clearEnemies() {
    for (const e of this.enemies) {
      e.destroy();
    }
    this.enemies = [];
    this.allEntities = [...this.humanPlayers];
    this.game._allPlayers = this.allEntities;
  }

  getHumanSpawns() {
    const count = this.humanPlayers.length;
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push({
        x: (i - (count - 1) / 2) * 2,
        y: 1.5,
        z: 3,
      });
    }
    return points;
  }

  getEnemySpawns(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI;
      points.push({
        x: Math.cos(angle) * 7,
        y: 1.5,
        z: Math.sin(angle) * -5,
      });
    }
    return points;
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'fighting';
        this.spawnEnemies();
        if (this.onStateChange) this.onStateChange('fight', { wave: this.wave });
      }
      return;
    }

    if (this.state === 'fighting') {
      // Check if all enemies are eliminated (fell off)
      const aliveEnemies = this.enemies.filter(e => e.alive);
      const aliveHumans = this.humanPlayers.filter(p => p.alive);

      if (aliveEnemies.length === 0) {
        this.state = 'waveComplete';
        this.timer = 3;
        if (this.onStateChange) this.onStateChange('waveComplete', { wave: this.wave });
        return;
      }

      if (aliveHumans.length === 0) {
        this.state = 'gameOver';
        if (this.onStateChange) this.onStateChange('gameOver', { wave: this.wave });
        return;
      }
    }

    if (this.state === 'waveComplete') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.nextWave();
      }
    }
  }
}
