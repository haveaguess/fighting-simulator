import * as THREE from 'three';
import { Game } from './core/Game.js';
import { MatchManager } from './core/MatchManager.js';
import { WavesManager } from './core/WavesManager.js';
import { Player } from './character/Player.js';
import { AIPlayer } from './character/AIPlayer.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS, PLAYER_2_KEYS } from './input/KeyboardBindings.js';
import { DamageSystem } from './character/DamageSystem.js';
import { applyCostume, COSTUME_KEYS } from './character/Costumes.js';
import { VoiceManager } from './audio/VoiceManager.js';
import { HUD } from './ui/HUD.js';
import { TitleScreen } from './ui/screens/TitleScreen.js';
import { PlayerJoinScreen } from './ui/screens/PlayerJoinScreen.js';
import { ModeSelectScreen } from './ui/screens/ModeSelectScreen.js';
import { CostumeSelectScreen } from './ui/screens/CostumeSelectScreen.js';
import { ArenaSelectScreen } from './ui/screens/ArenaSelectScreen.js';
import { CameraController } from './core/CameraController.js';
import { ReplaySystem } from './core/ReplaySystem.js';
import { AudioManager } from './audio/AudioManager.js';
import { PauseMenu } from './core/PauseMenu.js';
import { TouchControls } from './input/TouchControls.js';
import { Rooftop } from './arenas/Rooftop.js';
import { Factory } from './arenas/Factory.js';
import { WrestlingRing } from './arenas/WrestlingRing.js';
import { Landslide } from './arenas/Landslide.js';
import { LandslideChaos } from './arenas/LandslideChaos.js';

const PLAYER_COLORS = [
  0xff4444, 0x4444ff, 0x44ff44, 0xffff44,
  0xff44ff, 0x44ffff, 0xff8844, 0x8844ff,
];

const ARENA_MAP = {
  rooftop: Rooftop,
  factory: Factory,
  wrestlingRing: WrestlingRing,
  landslide: Landslide,
  landslideChaos: LandslideChaos,
};

export class GameApp {
  constructor() {
    this.game = new Game();
    this.input = new InputManager();
    this.ui = document.getElementById('ui-overlay');
    this.players = [];
    this.arena = null;
    this.hud = null;
    this.match = null;
    this.wavesManager = null;
    this.damageSystem = null;
    this.audio = new AudioManager();
    this.game._audio = this.audio;
    this.cameraController = null;
    this.pause = new PauseMenu(this.game, this.input);
    this.touchControls = null;
    this.gameMode = 'melee';
  }

  // === URL PARAM STATE MANAGEMENT ===
  _updateURL(params) {
    const url = new URL(window.location);
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, val);
      }
    }
    window.history.replaceState({}, '', url);
  }

  _clearGameURL() {
    const url = new URL(window.location);
    const keep = ['daddy']; // preserve non-game params
    const keysToRemove = [];
    for (const key of url.searchParams.keys()) {
      if (!keep.includes(key)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) url.searchParams.delete(key);
    window.history.replaceState({}, '', url);
  }

  _getURLParams() {
    const url = new URL(window.location);
    const p = url.searchParams;
    if (!p.has('mode') || !p.has('arena')) return null;
    return {
      mode: p.get('mode'),
      arena: p.get('arena'),
      players: p.get('players')?.split(',').map(Number) || [0],
      costumes: JSON.parse(p.get('costumes') || '{}'),
      sizes: JSON.parse(p.get('sizes') || '{}'),
    };
  }

  start() {
    this.game.start();

    // Check URL for saved game state (hot reload recovery)
    const saved = this._getURLParams();
    if (saved && ARENA_MAP[saved.arena]) {
      // Restore directly into the game, skip menus
      const joinedPlayers = new Set(saved.players);
      const costumeChoices = {};
      const sizeChoices = {};
      for (const [k, v] of Object.entries(saved.costumes)) costumeChoices[k] = v;
      for (const [k, v] of Object.entries(saved.sizes)) sizeChoices[k] = parseFloat(v);
      this.gameMode = saved.mode;

      const humanCount = joinedPlayers.size;
      const totalPlayers = saved.mode === 'waves' ? humanCount : Math.max(humanCount, 2);
      if (saved.mode === 'waves') {
        this.startWavesGame(joinedPlayers, costumeChoices, sizeChoices, saved.arena);
      } else {
        this.startMeleeGame(joinedPlayers, costumeChoices, sizeChoices, saved.arena, totalPlayers);
      }
      return;
    }

    this.showTitle();
  }

  showTitle() {
    this._clearGameURL();
    this.titleScreen = new TitleScreen(this.ui);
    this.titleScreen.onStart = () => this.showPlayerJoin();
    this.titleScreen.show();
  }

  _stopMenuMusic() {
    if (this.titleScreen) {
      this.titleScreen.stopMusic();
      this.titleScreen = null;
    }
  }

  showPlayerJoin() {
    const screen = new PlayerJoinScreen(this.ui);
    screen.onReady = (joinedSet) => this.showModeSelect(joinedSet);
    screen.show();
  }

  showModeSelect(joinedPlayers) {
    const screen = new ModeSelectScreen(this.ui);
    screen.onReady = (mode) => {
      this.gameMode = mode;
      this._updateURL({ mode });
      this.showCostumeSelect(joinedPlayers);
    };
    screen.show();
  }

  showCostumeSelect(joinedPlayers) {
    const humanCount = joinedPlayers.size;
    const totalPlayers = this.gameMode === 'waves' ? humanCount : Math.max(humanCount, 2);
    const screen = new CostumeSelectScreen(this.ui, humanCount);
    screen.onReady = (costumeChoices, sizeChoices) => {
      this._updateURL({
        costumes: JSON.stringify(costumeChoices),
        sizes: JSON.stringify(sizeChoices),
      });
      this.showArenaSelect(joinedPlayers, costumeChoices, sizeChoices, totalPlayers);
    };
    screen.show();
  }

  showArenaSelect(joinedPlayers, costumeChoices, sizeChoices, totalPlayers) {
    const screen = new ArenaSelectScreen(this.ui);
    screen.onReady = (arenaKey) => {
      // Save full game state to URL
      this._updateURL({
        arena: arenaKey,
        players: [...joinedPlayers].join(','),
      });
      if (this.gameMode === 'waves') {
        this.startWavesGame(joinedPlayers, costumeChoices, sizeChoices, arenaKey);
      } else {
        this.startMeleeGame(joinedPlayers, costumeChoices, sizeChoices, arenaKey, totalPlayers);
      }
    };
    screen.show();
  }

  // === MELEE MODE ===
  startMeleeGame(joinedPlayers, costumeChoices, sizeChoices, arenaKey, totalPlayers) {
    this._gameCallbacks = [];

    // Load arena
    const ArenaClass = ARENA_MAP[arenaKey];
    this.arena = new ArenaClass(this.game);
    this._gameCallbacks.push(this.game.onUpdate((dt) => this.arena.update(dt)));

    // Damage system
    this.damageSystem = new DamageSystem(this.game);

    // Create players
    this.players = [];
    const spawnPoints = this.getSpawnPoints(totalPlayers);
    let humanIndex = 0;
    const joinedArray = [...joinedPlayers];

    this._registerInputs(joinedArray);

    // Human players
    for (const idx of joinedArray) {
      const color = PLAYER_COLORS[this.players.length];
      const scale = (sizeChoices && sizeChoices[humanIndex]) || 1.0;
      const p = new Player(this.game, this.input, idx, spawnPoints[this.players.length], color, this.audio, scale);
      const costumeKey = costumeChoices[humanIndex] || COSTUME_KEYS[0];
      p.costumeKey = costumeKey;
      p.damageSystem = this.damageSystem;
      applyCostume(p.ragdoll, costumeKey);
      p.ragdoll.voiceManager = new VoiceManager(costumeKey);
      this.damageSystem.register(p.ragdoll);
      this.players.push(p);
      humanIndex++;
    }

    // Fill with AI
    while (this.players.length < totalPlayers) {
      const color = PLAYER_COLORS[this.players.length];
      const ai = new AIPlayer(this.game, this.players, spawnPoints[this.players.length], color, this.audio);
      ai.isAI = true;
      const randomCostume = COSTUME_KEYS[Math.floor(Math.random() * COSTUME_KEYS.length)];
      ai.costumeKey = randomCostume;
      ai.damageSystem = this.damageSystem;
      applyCostume(ai.ragdoll, randomCostume);
      ai.ragdoll.voiceManager = new VoiceManager(randomCostume);
      this.damageSystem.register(ai.ragdoll);
      this.players.push(ai);
    }

    this.game._allPlayers = this.players;
    for (const p of this.players) {
      if (p.isAI) p.allPlayers = this.players;
    }

    // HUD + Camera
    this.hud = new HUD(this.players);
    this._gameCallbacks.push(this.game.onUpdate(() => this.hud.update()));
    this.cameraController = new CameraController(this.game.camera);
    this._gameCallbacks.push(this.game.onUpdate((dt) => this.cameraController.update(dt, this.players)));

    // Replay system
    this.replaySystem = new ReplaySystem(this.game);
    this.replaySystem.onPlayerDeath = () => {
      this.replaySystem.playCornerReplay(3);
    };
    this.replaySystem.startRecording();

    // Match manager
    this.match = new MatchManager(this.game, this.players);
    this.match.onStateChange = (state, data) => {
      if (state === 'countdown') {
        this.hud.showCenter(Math.ceil(data.countdown).toString(), 1);
        this.audio.playCountdown();
      }
      if (state === 'playing') {
        this._stopMenuMusic();
        this.hud.showCenter('FIGHT!', 1.5);
        this.audio.playFight();
        this.audio.startMusic();
        this.audio.startDishWhir();
      }
      if (state === 'roundEnd') {
        const winnerIdx = this.players.indexOf(data.winner);
        this.hud.showCenter(data.winner ? `P${winnerIdx + 1} wins the round!` : 'Draw!', 2.5);
        if (data.winner) this.audio.playWin();
        this.replaySystem.playCornerReplay(3);
      }
      if (state === 'matchEnd') {
        const winnerIdx = this.players.indexOf(data.winner);
        this.hud.showCenter(`P${winnerIdx + 1} WINS THE MATCH!`);
        this.audio.playWin();
        if (data.winner?.ragdoll) data.winner.ragdoll.startCelebration();
        this.replaySystem.playFullReplay(7, () => {
          this.cleanup();
          this.showTitle();
        });
      }
    };
    this.match.startMatch();
  }

  // === WAVES MODE ===
  startWavesGame(joinedPlayers, costumeChoices, sizeChoices, arenaKey) {
    this._gameCallbacks = [];

    // Load arena
    const ArenaClass = ARENA_MAP[arenaKey];
    this.arena = new ArenaClass(this.game);
    this._gameCallbacks.push(this.game.onUpdate((dt) => this.arena.update(dt)));

    // Damage system
    this.damageSystem = new DamageSystem(this.game);

    // Create human players only
    this.players = [];
    const joinedArray = [...joinedPlayers];
    this._registerInputs(joinedArray);

    let humanIndex = 0;
    const spawnPoints = this.getSpawnPoints(joinedArray.length);

    for (const idx of joinedArray) {
      const color = PLAYER_COLORS[this.players.length];
      const scale = (sizeChoices && sizeChoices[humanIndex]) || 1.0;
      const p = new Player(this.game, this.input, idx, spawnPoints[this.players.length], color, this.audio, scale);
      const costumeKey = costumeChoices[humanIndex] || COSTUME_KEYS[0];
      p.costumeKey = costumeKey;
      p.damageSystem = this.damageSystem;
      applyCostume(p.ragdoll, costumeKey);
      p.ragdoll.voiceManager = new VoiceManager(costumeKey);
      this.damageSystem.register(p.ragdoll);
      this.players.push(p);
      humanIndex++;
    }

    this.game._allPlayers = this.players;

    // HUD (just human players initially — enemies get added by WavesManager)
    this.hud = new HUD(this.players);
    this._gameCallbacks.push(this.game.onUpdate(() => this.hud.update()));

    // Camera
    this.cameraController = new CameraController(this.game.camera);
    this._gameCallbacks.push(this.game.onUpdate((dt) => {
      // Track all alive entities (humans + enemies)
      const all = this.wavesManager ? [...this.players, ...this.wavesManager.enemies] : this.players;
      this.cameraController.update(dt, all);
    }));

    // Replay system
    this.replaySystem = new ReplaySystem(this.game);
    this.replaySystem.onPlayerDeath = () => {
      this.replaySystem.playCornerReplay(3);
    };
    this.replaySystem.startRecording();

    // Waves manager — restore saved progress
    this.wavesManager = new WavesManager(
      this.game, this.players, this.arena, this.damageSystem, this.hud, this.audio
    );

    const savedWaves = JSON.parse(localStorage.getItem('wavesProgress') || 'null');
    if (savedWaves?.wave > 0) {
      this.wavesManager.wave = savedWaves.wave - 1;
      this._wavesUsedContinue = savedWaves.usedContinue || false;
    }

    this.wavesManager.onStateChange = (state, data) => {
      if (state === 'waveStart') {
        this.hud.showCenter(`WAVE ${data.wave}`, 2);
        this.audio.playCountdown();
        localStorage.setItem('wavesProgress', JSON.stringify({ wave: data.wave, usedContinue: this._wavesUsedContinue || false }));
      }
      if (state === 'fight') {
        this._stopMenuMusic();
        this.hud.showCenter('FIGHT!', 1.5);
        this.audio.playFight();
        this.audio.startMusic();
        this.audio.startDishWhir();
      }
      if (state === 'waveComplete') {
        this.hud.showCenter(`WAVE ${data.wave} CLEARED!`, 2.5);
        this.audio.playWin();
        this.replaySystem.playCornerReplay(3);
        for (const p of this.players) {
          if (p.alive && p.ragdoll) p.ragdoll.startCelebration();
        }
        setTimeout(() => {
          for (const p of this.players) {
            if (p.ragdoll) p.ragdoll.stopCelebration();
          }
        }, 2500);
      }
      if (state === 'gameOver') {
        this.audio.playEliminated();
        this.audio.stopMusic();
        // Show game over with continue option
        const wave = data.wave;
        const usedContinue = this._wavesUsedContinue || false;
        let msg = `GAME OVER - Wave ${wave}`;
        if (!usedContinue) {
          msg += '\nPress ENTER to continue, ESC to quit';
        } else {
          msg += '\nPress ENTER to restart from Wave 1';
        }
        this.hud.showCenter(msg);

        const handler = (e) => {
          if (e.code === 'Enter') {
            window.removeEventListener('keydown', handler);
            this.hud.hideCenter();
            if (!usedContinue) {
              // Continue from current wave
              this._wavesUsedContinue = true;
              this.wavesManager.nextWave();
              this.audio.startMusic();
            } else {
              // Restart from wave 1
              this._wavesUsedContinue = false;
              this.wavesManager.wave = 0;
              this.wavesManager.nextWave();
              this.audio.startMusic();
            }
          }
          if (e.code === 'Escape') {
            window.removeEventListener('keydown', handler);
            localStorage.removeItem('wavesProgress');
            this.cleanup();
            this.showTitle();
          }
        };
        window.addEventListener('keydown', handler);
      }
    };

    this.wavesManager.startWaves();
  }

  _registerInputs(joinedArray) {
    if (joinedArray.includes(0)) {
      this.input.registerKeyboardPlayer(0, PLAYER_1_KEYS);
    }
    if (joinedArray.includes(1)) {
      this.input.registerKeyboardPlayer(1, PLAYER_2_KEYS);
    }
    // Mobile touch controls for player 0
    if (this.touchControls) this.touchControls.destroy();
    this.touchControls = new TouchControls(this.input, joinedArray[0] || 0);
    for (const idx of joinedArray) {
      if (idx >= 2) {
        this.input.registerGamepadPlayer(idx, idx - 2);
      }
    }
  }

  getSpawnPoints(count) {
    const radius = 5;
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        y: 1.5,
        z: Math.sin(angle) * radius,
      });
    }
    return points;
  }

  cleanup() {
    this._clearGameURL();
    if (this._gameCallbacks) {
      for (const cb of this._gameCallbacks) {
        this.game.removeOnUpdate(cb);
      }
      this._gameCallbacks = [];
    }

    // Clean up replay
    if (this.replaySystem) {
      this.replaySystem.destroy();
      this.replaySystem = null;
    }

    // Clean up waves
    if (this.wavesManager) {
      this.wavesManager.destroy();
      this.wavesManager = null;
    }
    this._wavesUsedContinue = false;

    // Clean up touch controls
    if (this.touchControls) {
      this.touchControls.destroy();
      this.touchControls = null;
    }

    this.audio.stopMusic();
    this.audio.stopDishWhir();

    for (const p of this.players) p.destroy();
    this.players = [];
    if (this.arena) this.arena.destroy();
    this.arena = null;
    if (this.hud) this.hud.destroy();
    this.hud = null;
    if (this.match?._updateCallback) {
      this.game.removeOnUpdate(this.match._updateCallback);
    }
    this.match = null;
    this.game._allPlayers = [];
    this.game.scene.background = new THREE.Color(0x87ceeb);
  }
}
