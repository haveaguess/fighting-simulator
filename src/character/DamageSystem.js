export class DamageSystem {
  constructor(game) {
    this.game = game;
    this.ragdolls = [];
  }

  register(ragdoll) {
    this.ragdolls.push(ragdoll);
    this.setupCollisionListeners(ragdoll);
  }

  setupCollisionListeners(ragdoll) {
    for (const [name, body] of Object.entries(ragdoll.bodies)) {
      body.addEventListener('collide', (event) => {
        const otherBody = event.body;
        const impactVelocity = event.contact.getImpactVelocityAlongNormal();

        if (otherBody.mass === 0) return; // static bodies

        const attackerRagdoll = this.findOwner(otherBody);
        if (!attackerRagdoll || attackerRagdoll === ragdoll) return;

        const damage = Math.abs(impactVelocity) * 2;
        if (damage > 1) {
          ragdoll.balance.takeDamage(damage);
        }
      });
    }
  }

  findOwner(body) {
    for (const ragdoll of this.ragdolls) {
      if (Object.values(ragdoll.bodies).includes(body)) {
        return ragdoll;
      }
    }
    return null;
  }
}
