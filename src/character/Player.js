import { Ragdoll } from './Ragdoll.js';
import { CharacterController } from './CharacterController.js';
import { applyCostume } from './Costumes.js';

export class Player {
  constructor(game, inputManager, playerIndex, position, color) {
    this.game = game;
    this.inputManager = inputManager;
    this.playerIndex = playerIndex;
    this.alive = true;
    this.roundWins = 0;
    this.color = color;
    this.costumeKey = null;

    this.ragdoll = new Ragdoll(game, position, color);
    this.controller = new CharacterController(this.ragdoll, game);

    this._updateCallback = game.onUpdate((dt) => this.update(dt));
  }

  update(dt) {
    if (!this.alive) return;
    const actions = this.inputManager.getActions(this.playerIndex);
    this.controller.update(dt, actions);

    // Check ring-out
    if (this.ragdoll.getPosition().y < -10) {
      this.alive = false;
    }
  }

  reset(position) {
    this.ragdoll.destroy();
    this.ragdoll = new Ragdoll(this.game, position, this.color);
    this.controller = new CharacterController(this.ragdoll, this.game);
    if (this.costumeKey) applyCostume(this.ragdoll, this.costumeKey);
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
