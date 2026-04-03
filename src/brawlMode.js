import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Game } from './core/Game.js';
import { Player } from './character/Player.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS, PLAYER_2_KEYS } from './input/KeyboardBindings.js';
import { CameraController } from './core/CameraController.js';
import { AudioManager } from './audio/AudioManager.js';
import { HUD } from './ui/HUD.js';
import { MatchManager } from './core/MatchManager.js';
import { applyCostume } from './character/Costumes.js';
import { Rooftop } from './arenas/Rooftop.js';

export function startBrawlMode() {
  const game = new Game();
  const input = new InputManager();
  const audio = new AudioManager();

  input.registerKeyboardPlayer(0, PLAYER_1_KEYS);
  input.registerKeyboardPlayer(1, PLAYER_2_KEYS);

  // Load rooftop arena
  const arena = new Rooftop(game);
  game.onUpdate((dt) => arena.update(dt));

  // P1 (green wrestler) vs P2 (red luchador)
  const p1 = new Player(game, input, 0, { x: -4, y: 1.5, z: 0 }, 0x44ff44, audio);
  applyCostume(p1.ragdoll, 'wrestler');
  p1.costumeKey = 'wrestler';

  const p2 = new Player(game, input, 1, { x: 4, y: 1.5, z: 0 }, 0xff4444, audio);
  applyCostume(p2.ragdoll, 'luchador');
  p2.costumeKey = 'luchador';

  const players = [p1, p2];
  game._allPlayers = players;

  // HUD
  const ui = document.getElementById('ui-overlay');
  const hud = new HUD(players);
  game.onUpdate(() => hud.update());

  // Camera
  const cam = new CameraController(game.camera);
  game.onUpdate((dt) => cam.update(dt, players));

  // Match manager — first to 3 rounds
  const match = new MatchManager(game, players);
  match.onStateChange = (state, data) => {
    if (state === 'countdown') {
      hud.showCenter(Math.ceil(data.countdown).toString(), 1);
      audio.playCountdown();
    }
    if (state === 'playing') {
      hud.showCenter('FIGHT!', 1.5);
      audio.playFight();
      audio.startMusic();
      audio.startDishWhir();
    }
    if (state === 'roundEnd') {
      const idx = players.indexOf(data.winner);
      hud.showCenter(data.winner ? `P${idx + 1} wins!` : 'Draw!', 2.5);
      if (data.winner) audio.playWin();
    }
    if (state === 'matchEnd') {
      const idx = players.indexOf(data.winner);
      hud.showCenter(`P${idx + 1} WINS THE MATCH!`);
      audio.playWin();
      audio.stopMusic();
      audio.stopDishWhir();
      setTimeout(() => location.reload(), 4000);
    }
  };
  match.startMatch();

  // Controls reminder
  const helpDiv = document.createElement('div');
  helpDiv.style.cssText = `
    position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.7); color: #ccc;
    font-family: monospace; font-size: 12px;
    padding: 8px 16px; border-radius: 8px;
    z-index: 1000; pointer-events: none; text-align: center;
  `;
  helpDiv.innerHTML = 'P1: WASD + Space/F/G/R/T &nbsp;&nbsp;&nbsp; P2: Arrows + / . , M ;';
  document.body.appendChild(helpDiv);
  setTimeout(() => helpDiv.remove(), 8000);

  game.start();
}
