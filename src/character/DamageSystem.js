export class DamageSystem {
  constructor(game) {
    this.game = game;
    this.ragdolls = [];
  }

  register(ragdoll) {
    this.ragdolls.push(ragdoll);
    // With single-body characters, damage is handled by CharacterController._hitNearby
    // This class now just tracks ragdolls for the system
  }

  findOwner(body) {
    for (const ragdoll of this.ragdolls) {
      if (ragdoll.bodies.torso === body) {
        return ragdoll;
      }
    }
    return null;
  }
}
