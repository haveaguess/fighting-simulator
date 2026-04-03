import { Game } from './core/Game.js';
import { WavesManager } from './core/WavesManager.js';
import { Player } from './character/Player.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS, PLAYER_2_KEYS } from './input/KeyboardBindings.js';
import { DamageSystem } from './character/DamageSystem.js';
import { applyCostume } from './character/Costumes.js';
import { HUD } from './ui/HUD.js';
import { CameraController } from './core/CameraController.js';
import { AudioManager } from './audio/AudioManager.js';
import { PauseMenu } from './core/PauseMenu.js';
import { Rooftop } from './arenas/Rooftop.js';

export function startWavesQuick() {
  const game = new Game();
  const input = new InputManager();
  const audio = new AudioManager();

  input.registerKeyboardPlayer(0, PLAYER_1_KEYS);
  input.registerKeyboardPlayer(1, PLAYER_2_KEYS);

  const pause = new PauseMenu(game, input);

  // Arena
  const arena = new Rooftop(game);
  game.onUpdate((dt) => arena.update(dt));

  // Damage system
  const damageSystem = new DamageSystem(game);

  // P1 astronaut, P2 chicken
  const p1 = new Player(game, input, 0, { x: -1, y: 1.5, z: 5 }, 0x44ff44, audio);
  applyCostume(p1.ragdoll, 'astronaut');
  p1.costumeKey = 'astronaut';
  p1.damageSystem = damageSystem;
  damageSystem.register(p1.ragdoll);

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

  const p2 = new Player(game, input, 1, { x: 1, y: 1.5, z: 5 }, 0xffffff, chickenAudio);
  applyCostume(p2.ragdoll, 'chicken');
  p2.costumeKey = 'chicken';
  p2.damageSystem = damageSystem;
  damageSystem.register(p2.ragdoll);

  const players = [p1, p2];
  game._allPlayers = players;

  // HUD
  const hud = new HUD(players);
  game.onUpdate(() => hud.update());

  // Camera
  const cam = new CameraController(game.camera);
  game.onUpdate((dt) => cam.update(dt, [...players, ...(wavesManager?.enemies || [])]));

  // Waves manager
  const wavesManager = new WavesManager(game, players, arena, damageSystem, hud, audio);
  let usedContinue = false;

  wavesManager.onStateChange = (state, data) => {
    if (state === 'waveStart') {
      hud.showCenter(`WAVE ${data.wave}`, 2);
      audio.playCountdown();
    }
    if (state === 'fight') {
      hud.showCenter('FIGHT!', 1.5);
      audio.playFight();
      audio.startMusic();
    }
    if (state === 'waveComplete') {
      hud.showCenter(`WAVE ${data.wave} CLEARED!`, 2.5);
      audio.playWin();
    }
    if (state === 'gameOver') {
      audio.playEliminated();
      audio.stopMusic();

      if (!usedContinue) {
        hud.showCenter(`GAME OVER - Wave ${data.wave}\nENTER = Continue  ESC = Restart`);
      } else {
        hud.showCenter(`GAME OVER - Wave ${data.wave}\nENTER = Restart from Wave 1`);
      }

      const handler = (e) => {
        if (e.code === 'Enter') {
          window.removeEventListener('keydown', handler);
          hud.hideCenter();
          if (!usedContinue) {
            usedContinue = true;
            wavesManager.nextWave();
          } else {
            usedContinue = false;
            wavesManager.wave = 0;
            wavesManager.nextWave();
          }
          audio.startMusic();
        }
        if (e.code === 'Escape') {
          window.removeEventListener('keydown', handler);
          location.reload();
        }
      };
      window.addEventListener('keydown', handler);
    }
  };

  wavesManager.startWaves();

  // Controls display
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
    <div style="display:flex; gap: 30px;">
      <div>
        <div style="color: #4f4; font-weight: bold;">P1 Astronaut</div>
        <div>WASD Space F G T R</div>
      </div>
      <div>
        <div style="color: #ff4; font-weight: bold;">P2 Chicken</div>
        <div>Arrows / . , ; M</div>
      </div>
    </div>
    <div style="color: #888; font-size: 10px; margin-top: 4px;">ESC = pause/settings</div>
  `;
  document.body.appendChild(controlsDiv);

  game.start();
}
