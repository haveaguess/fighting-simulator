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
import { PauseMenu } from './core/PauseMenu.js';
import { applyCostume } from './character/Costumes.js';
import { Rooftop } from './arenas/Rooftop.js';

export function startBrawlMode() {
  const game = new Game();
  const input = new InputManager();
  const audio = new AudioManager();

  input.registerKeyboardPlayer(0, PLAYER_1_KEYS);
  input.registerKeyboardPlayer(1, PLAYER_2_KEYS);

  // Pause menu with settings access
  const pause = new PauseMenu(game, input);

  // Load rooftop arena
  const arena = new Rooftop(game);
  game.onUpdate((dt) => arena.update(dt));

  // P1 (astronaut) vs P2 (chicken)
  const p1 = new Player(game, input, 0, { x: -4, y: 1.5, z: 0 }, 0x44ff44, audio);
  applyCostume(p1.ragdoll, 'astronaut');
  p1.costumeKey = 'astronaut';

  // Chicken audio — wraps the normal audio with chicken sounds
  const chickenAudio = {
    playPunch() { audio.playCluck(); },
    playKick() { audio.playCluck(); },
    playHeadbutt() { audio.playCluckHit(); },
    playHit() { audio.playCluckHit(); },
    playJump() { audio.playCluckJump(); },
    playEliminated() { audio.playCluckDeath(); },
    playCountdown() { audio.playCountdown(); },
    playFight() { audio.playFight(); },
    playWin() { audio.playWin(); },
  };

  const p2 = new Player(game, input, 1, { x: 4, y: 1.5, z: 0 }, 0xffffff, chickenAudio);
  applyCostume(p2.ragdoll, 'chicken');
  p2.costumeKey = 'chicken';

  const players = [p1, p2];
  game._allPlayers = players;

  // HUD
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
      // Winner celebrates!
      if (data.winner?.ragdoll) data.winner.ragdoll.startCelebration();
      setTimeout(() => location.reload(), 5000);
    }
  };
  match.startMatch();

  // Persistent controls display — top left so it doesn't cover settings
  const controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = `
    position: fixed; top: 60px; left: 10px;
    background: rgba(0,0,0,0.75); color: #ddd;
    font-family: 'Arial', sans-serif; font-size: 11px;
    padding: 8px 12px; border-radius: 8px;
    z-index: 1000; pointer-events: none; text-align: left;
    line-height: 1.5;
  `;
  controlsDiv.innerHTML = `
    <div style="display:flex; gap: 40px; justify-content: center;">
      <div>
        <div style="color: #4f4; font-weight: bold; margin-bottom: 4px;">Player 1</div>
        <div>Move: <b>WASD</b></div>
        <div>Jump: <b>Space</b> &nbsp; Punch: <b>F</b> &nbsp; Kick: <b>G</b></div>
        <div>Headbutt: <b>T</b> &nbsp; Grab: <b>R</b></div>
      </div>
      <div>
        <div style="color: #f44; font-weight: bold; margin-bottom: 4px;">Player 2</div>
        <div>Move: <b>Arrows</b></div>
        <div>Jump: <b>/</b> &nbsp; Punch: <b>.</b> &nbsp; Kick: <b>,</b></div>
        <div>Headbutt: <b>;</b> &nbsp; Grab: <b>M</b></div>
      </div>
    </div>
    <div style="margin-top: 6px; color: #888; font-size: 11px;">ESC to pause &amp; change controls</div>
  `;
  document.body.appendChild(controlsDiv);

  game.start();
}
