import { Game } from './core/Game.js';
import { MatchManager } from './core/MatchManager.js';
import { Player } from './character/Player.js';
import { AIPlayer } from './character/AIPlayer.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS, PLAYER_2_KEYS } from './input/KeyboardBindings.js';
import { DamageSystem } from './character/DamageSystem.js';
import { applyCostume, COSTUME_KEYS } from './character/Costumes.js';
import { HUD } from './ui/HUD.js';
import { TitleScreen } from './ui/screens/TitleScreen.js';
import { PlayerJoinScreen } from './ui/screens/PlayerJoinScreen.js';
import { CostumeSelectScreen } from './ui/screens/CostumeSelectScreen.js';
import { ArenaSelectScreen } from './ui/screens/ArenaSelectScreen.js';
import { CameraController } from './core/CameraController.js';
import { AudioManager } from './audio/AudioManager.js';
import { PauseMenu } from './core/PauseMenu.js';
import { Rooftop } from './arenas/Rooftop.js';
import { Factory } from './arenas/Factory.js';
import { WrestlingRing } from './arenas/WrestlingRing.js';

const PLAYER_COLORS = [
  0xff4444, 0x4444ff, 0x44ff44, 0xffff44,
  0xff44ff, 0x44ffff, 0xff8844, 0x8844ff,
];

const ARENA_MAP = {
  rooftop: Rooftop,
  factory: Factory,
  wrestlingRing: WrestlingRing,
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
    this.damageSystem = null;
    this.audio = new AudioManager();
    this.cameraController = null;
    this.pause = new PauseMenu(this.game, this.input);
  }

  start() {
    this.game.start();
    this.showTitle();
  }

  showTitle() {
    const screen = new TitleScreen(this.ui);
    screen.onStart = () => this.showPlayerJoin();
    screen.show();
  }

  showPlayerJoin() {
    const screen = new PlayerJoinScreen(this.ui);
    screen.onReady = (joinedSet) => this.showCostumeSelect(joinedSet);
    screen.show();
  }

  showCostumeSelect(joinedPlayers) {
    const humanCount = joinedPlayers.size;
    const totalPlayers = Math.max(humanCount, 2);
    const screen = new CostumeSelectScreen(this.ui, humanCount);
    screen.onReady = (costumeChoices) => {
      this.showArenaSelect(joinedPlayers, costumeChoices, totalPlayers);
    };
    screen.show();
  }

  showArenaSelect(joinedPlayers, costumeChoices, totalPlayers) {
    const screen = new ArenaSelectScreen(this.ui);
    screen.onReady = (arenaKey) => {
      this.startGame(joinedPlayers, costumeChoices, arenaKey, totalPlayers);
    };
    screen.show();
  }

  startGame(joinedPlayers, costumeChoices, arenaKey, totalPlayers) {
    // Load arena
    const ArenaClass = ARENA_MAP[arenaKey];
    this.arena = new ArenaClass(this.game);
    this.game.onUpdate((dt) => this.arena.update(dt));

    // Create damage system
    this.damageSystem = new DamageSystem(this.game);

    // Create players
    this.players = [];
    const spawnPoints = this.getSpawnPoints(totalPlayers);
    let humanIndex = 0;

    const joinedArray = [...joinedPlayers];

    // Register keyboard players
    if (joinedArray.includes(0)) {
      this.input.registerKeyboardPlayer(0, PLAYER_1_KEYS);
    }
    if (joinedArray.includes(1)) {
      this.input.registerKeyboardPlayer(1, PLAYER_2_KEYS);
    }

    // Register gamepad players
    for (const idx of joinedArray) {
      if (idx >= 2) {
        this.input.registerGamepadPlayer(idx, idx - 2);
      }
    }

    // Create human players
    for (const idx of joinedArray) {
      const color = PLAYER_COLORS[this.players.length];
      const p = new Player(this.game, this.input, idx, spawnPoints[this.players.length], color);
      const costumeKey = costumeChoices[humanIndex] || COSTUME_KEYS[0];
      p.costumeKey = costumeKey;
      applyCostume(p.ragdoll, costumeKey);
      this.damageSystem.register(p.ragdoll);
      this.players.push(p);
      humanIndex++;
    }

    // Fill remaining with AI
    while (this.players.length < totalPlayers) {
      const color = PLAYER_COLORS[this.players.length];
      const ai = new AIPlayer(this.game, this.players, spawnPoints[this.players.length], color);
      ai.isAI = true;
      const randomCostume = COSTUME_KEYS[Math.floor(Math.random() * COSTUME_KEYS.length)];
      ai.costumeKey = randomCostume;
      applyCostume(ai.ragdoll, randomCostume);
      this.damageSystem.register(ai.ragdoll);
      this.players.push(ai);
    }

    // Ensure AI players have reference to all players
    for (const p of this.players) {
      if (p.isAI) {
        p.allPlayers = this.players;
      }
    }

    // HUD
    this.hud = new HUD(this.players);
    this.game.onUpdate(() => this.hud.update());

    // Camera controller
    this.cameraController = new CameraController(this.game.camera);
    this.game.onUpdate((dt) => this.cameraController.update(dt, this.players));

    // Match manager
    this.match = new MatchManager(this.game, this.players);
    this.match.onStateChange = (state, data) => {
      if (state === 'countdown') {
        this.hud.showCenter(Math.ceil(data.countdown).toString(), 1);
        this.audio.playCountdown();
      }
      if (state === 'playing') {
        this.hud.showCenter('FIGHT!', 1.5);
        this.audio.playFight();
      }
      if (state === 'roundEnd') {
        const winnerIdx = this.players.indexOf(data.winner);
        this.hud.showCenter(data.winner ? `P${winnerIdx + 1} wins the round!` : 'Draw!', 2.5);
        if (data.winner) this.audio.playWin();
      }
      if (state === 'matchEnd') {
        const winnerIdx = this.players.indexOf(data.winner);
        this.hud.showCenter(`P${winnerIdx + 1} WINS THE MATCH!`);
        this.audio.playWin();
        setTimeout(() => {
          this.cleanup();
          this.showTitle();
        }, 5000);
      }
    };
    this.match.startMatch();
  }

  getSpawnPoints(count) {
    const radius = 5;
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        y: 3,
        z: Math.sin(angle) * radius,
      });
    }
    return points;
  }

  cleanup() {
    for (const p of this.players) p.destroy();
    this.players = [];
    if (this.arena) this.arena.destroy();
    this.arena = null;
    if (this.hud) this.hud.destroy();
    this.hud = null;
    this.match = null;
  }
}
