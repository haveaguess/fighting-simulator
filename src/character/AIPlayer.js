import { Ragdoll } from './Ragdoll.js';
import { CharacterController } from './CharacterController.js';
import { AIController as AI } from '../ai/AIController.js';
import { applyCostume } from './Costumes.js';
import { VoiceManager } from '../audio/VoiceManager.js';

export class AIPlayer {
  constructor(game, allPlayers, position, color, audio, scale = 1.0) {
    this.game = game;
    this.allPlayers = allPlayers;
    this.alive = true;
    this.roundWins = 0;
    this.isAI = true;
    this.color = color;
    this.costumeKey = null;
    this.audio = audio;
    this.scale = scale;

    this.ragdoll = new Ragdoll(game, position, color, scale);
    this.controller = new CharacterController(this.ragdoll, game, audio);
    this.ai = new AI();

    this._updateCallback = game.onUpdate((dt) => this.update(dt));
  }

  update(dt) {
    if (!this.alive) return;
    const actions = this.ai.update(dt, this.ragdoll, this.allPlayers);
    this.controller.update(dt, actions);

    const pos = this.ragdoll.getPosition();
    if (pos.y < -5 || Math.abs(pos.x) > 20 || Math.abs(pos.z) > 20) {
      this.alive = false;
      this.ragdoll.voiceManager?.playDeath();
      if (window.__daddyMode && this.game._audio) {
        const audio = this.game._audio;
        const r = Math.random();
        if (r < 0.33) audio.playTone(0.5, 1200, 'sine', -1000, 0.2);
        else if (r < 0.66) {
          audio.playTone(0.2, 120, 'sawtooth', 0, 0.2);
          setTimeout(() => audio.playTone(0.4, 70, 'sawtooth', -20, 0.25), 300);
        } else {
          for (let i = 0; i < 4; i++)
            setTimeout(() => audio.playTone(0.08, 600 - i * 80, 'square', -50, 0.15), i * 100);
        }
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

  destroy() {
    if (this._updateCallback) {
      this.game.removeOnUpdate(this._updateCallback);
      this._updateCallback = null;
    }
    this.ragdoll.destroy();
  }
}
