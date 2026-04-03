import { Ragdoll } from './Ragdoll.js';
import { CharacterController } from './CharacterController.js';
import { AIController as AI } from '../ai/AIController.js';

export class AIPlayer {
  constructor(game, allPlayers, position, color) {
    this.game = game;
    this.allPlayers = allPlayers;
    this.alive = true;
    this.roundWins = 0;
    this.isAI = true;
    this.color = color;

    this.ragdoll = new Ragdoll(game, position, color);
    this.controller = new CharacterController(this.ragdoll, game);
    this.ai = new AI();

    game.onUpdate((dt) => this.update(dt));
  }

  update(dt) {
    if (!this.alive) return;
    const actions = this.ai.update(dt, this.ragdoll, this.allPlayers);
    this.controller.update(dt, actions);

    if (this.ragdoll.getPosition().y < -10) {
      this.alive = false;
    }
  }

  reset(position) {
    this.ragdoll.destroy();
    this.ragdoll = new Ragdoll(this.game, position, this.color);
    this.controller = new CharacterController(this.ragdoll, this.game);
    this.alive = true;
  }

  destroy() {
    this.ragdoll.destroy();
  }
}
