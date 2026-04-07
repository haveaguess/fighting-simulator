import { Ragdoll } from './Ragdoll.js';
import { CharacterController } from './CharacterController.js';
import { applyCostume } from './Costumes.js';
import { VoiceManager } from '../audio/VoiceManager.js';

export class Player {
  constructor(game, inputManager, playerIndex, position, color, audio, scale = 1.0) {
    this.game = game;
    this.inputManager = inputManager;
    this.playerIndex = playerIndex;
    this.alive = true;
    this.roundWins = 0;
    this.color = color;
    this.costumeKey = null;
    this.audio = audio;
    this.scale = scale;

    this.ragdoll = new Ragdoll(game, position, color, scale);
    this.controller = new CharacterController(this.ragdoll, game, audio);

    this._updateCallback = game.onUpdate((dt) => this.update(dt));
  }

  update(dt) {
    if (!this.alive) return;
    const actions = this.inputManager.getActions(this.playerIndex);
    this.controller.update(dt, actions);

    // Check ring-out — die faster when clearly off the platform
    const pos = this.ragdoll.getPosition();
    if (pos.y < -5 || Math.abs(pos.x) > 20 || Math.abs(pos.z) > 20) {
      this.alive = false;
      this.ragdoll.voiceManager?.playDeath();
      if (this.audio) this.audio.playEliminated();
      if (window.__daddyMode && this.game._audio) {
        this._playSillyCry(this.game._audio);
      }
    }
  }

  reset(position) {
    this.ragdoll.destroy();
    this.ragdoll = new Ragdoll(this.game, position, this.color, this.scale);
    this.controller = new CharacterController(this.ragdoll, this.game, this.audio);
    if (this.costumeKey) {
      applyCostume(this.ragdoll, this.costumeKey);
      this.ragdoll.voiceManager = new VoiceManager(this.costumeKey);
    }
    if (this.damageSystem) this.damageSystem.register(this.ragdoll);
    this.alive = true;
  }

  _playSillyCry(audio) {
    const cries = [
      // Descending wail
      () => {
        audio.playTone(0.15, 800, 'sine', -200, 0.2);
        setTimeout(() => audio.playTone(0.2, 500, 'sine', -300, 0.2), 150);
        setTimeout(() => audio.playTone(0.3, 300, 'sine', -200, 0.15), 350);
      },
      // Squeaky "nooo"
      () => {
        for (let i = 0; i < 4; i++) {
          setTimeout(() => audio.playTone(0.08, 600 - i * 80, 'square', -50, 0.15), i * 100);
        }
      },
      // Slide whistle down
      () => {
        audio.playTone(0.5, 1200, 'sine', -1000, 0.2);
      },
      // Wobbly whimper
      () => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => audio.playTone(0.06, 400 + (i % 2) * 100, 'triangle', -50, 0.12), i * 70);
        }
      },
      // Comedy tuba
      () => {
        audio.playTone(0.2, 120, 'sawtooth', 0, 0.2);
        setTimeout(() => audio.playTone(0.2, 100, 'sawtooth', 0, 0.2), 250);
        setTimeout(() => audio.playTone(0.4, 70, 'sawtooth', -20, 0.25), 500);
      },
    ];
    cries[Math.floor(Math.random() * cries.length)]();
  }

  destroy() {
    if (this._updateCallback) {
      this.game.removeOnUpdate(this._updateCallback);
      this._updateCallback = null;
    }
    this.ragdoll.destroy();
  }
}
