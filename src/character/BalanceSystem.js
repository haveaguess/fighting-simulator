import * as CANNON from 'cannon-es';

export class BalanceSystem {
  constructor(ragdoll) {
    this.ragdoll = ragdoll;
    this.damage = 0;
    this.ragdollTimer = 0;
    this.ragdollDuration = 3;
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
    if (!torso) return;

    const damageMultiplier = 1 - (this.damage / 100) * 0.8;

    // --- FORCE UPRIGHT QUATERNION ---
    // Extract current yaw only, discard pitch and roll entirely
    const forward = new CANNON.Vec3(0, 0, 1);
    torso.quaternion.vmult(forward, forward);
    forward.y = 0;
    if (forward.lengthSquared() < 0.001) forward.set(0, 0, 1);
    forward.normalize();
    const yaw = Math.atan2(forward.x, forward.z);

    // Directly set quaternion to upright with current yaw
    // At 0 damage: fully forced upright
    // At high damage: partially forced (wobbly)
    const targetQuat = new CANNON.Quaternion();
    targetQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);

    // Blend: at 0 damage, 100% forced upright. At 100 damage, only 20% forced.
    const strength = damageMultiplier;
    torso.quaternion.x = torso.quaternion.x * (1 - strength) + targetQuat.x * strength;
    torso.quaternion.y = torso.quaternion.y * (1 - strength) + targetQuat.y * strength;
    torso.quaternion.z = torso.quaternion.z * (1 - strength) + targetQuat.z * strength;
    torso.quaternion.w = torso.quaternion.w * (1 - strength) + targetQuat.w * strength;
    torso.quaternion.normalize();

    // Kill pitch/roll angular velocity completely
    torso.angularVelocity.x *= 0.5;
    torso.angularVelocity.z *= 0.5;

    // --- MINIMUM HEIGHT ---
    // Ensure torso doesn't sink below standing height
    // The torso center should be about 0.75 above the ground (y=0)
    const minY = 0.75;
    if (torso.position.y < minY) {
      torso.position.y = minY;
      if (torso.velocity.y < 0) torso.velocity.y = 0;
    }
  }
}
