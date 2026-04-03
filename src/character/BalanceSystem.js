import * as CANNON from 'cannon-es';

export class BalanceSystem {
  constructor(ragdoll) {
    this.ragdoll = ragdoll;
    this.damage = 0;          // 0 to 100
    this.maxForce = 200;      // corrective force strength
    this.ragdollTimer = 0;    // seconds remaining in full ragdoll
    this.ragdollDuration = 3; // seconds of full ragdoll at max damage
  }

  takeDamage(amount) {
    this.damage = Math.min(100, this.damage + amount);
    if (this.damage >= 80) {
      this.ragdollTimer = this.ragdollDuration;
    }
  }

  getDamagePercent() {
    return this.damage / 100;
  }

  isRagdolling() {
    return this.ragdollTimer > 0;
  }

  update(dt) {
    if (this.ragdollTimer > 0) {
      this.ragdollTimer -= dt;
      if (this.ragdollTimer <= 0) {
        this.ragdollTimer = 0;
        this.damage = Math.max(0, this.damage - 30);
      }
      return;
    }

    const torso = this.ragdoll.getTorso();
    const currentUp = new CANNON.Vec3(0, 1, 0);
    torso.quaternion.vmult(currentUp, currentUp);
    const targetUp = new CANNON.Vec3(0, 1, 0);
    const cross = new CANNON.Vec3();
    currentUp.cross(targetUp, cross);

    const damageMultiplier = 1 - (this.damage / 100) * 0.7;
    const force = this.maxForce * damageMultiplier;

    torso.torque.x += cross.x * force;
    torso.torque.y += cross.y * force * 0.3;
    torso.torque.z += cross.z * force;
  }
}
