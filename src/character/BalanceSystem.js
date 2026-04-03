import * as CANNON from 'cannon-es';

export class BalanceSystem {
  constructor(ragdoll) {
    this.ragdoll = ragdoll;
    this.damage = 0;          // 0 to 100
    this.ragdollTimer = 0;    // seconds remaining in full ragdoll
    this.ragdollDuration = 3; // seconds of full ragdoll at max damage

    // Upright target quaternion (standing straight)
    this.uprightQuat = new CANNON.Quaternion();
    this.uprightQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), 0);
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
    const damageMultiplier = 1 - (this.damage / 100) * 0.8;

    // --- ROTATION CORRECTION ---
    // Slerp the torso quaternion toward upright (keep yaw, fix pitch/roll)
    // Extract just the yaw from current quaternion, combine with upright pitch/roll
    const currentQuat = torso.quaternion;

    // Get the current forward direction on the XZ plane (preserve yaw)
    const forward = new CANNON.Vec3(0, 0, 1);
    currentQuat.vmult(forward, forward);
    const yaw = Math.atan2(forward.x, forward.z);

    // Build target quaternion: upright with current yaw
    const targetQuat = new CANNON.Quaternion();
    targetQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);

    // Slerp toward target — strong correction
    const slerpStrength = 0.15 * damageMultiplier;
    currentQuat.slerp(targetQuat, slerpStrength, currentQuat);

    // --- ANGULAR VELOCITY DAMPING ---
    // Damp angular velocity to prevent wild spinning
    const angDamp = 0.92 * damageMultiplier;
    torso.angularVelocity.x *= angDamp;
    torso.angularVelocity.z *= angDamp;

    // --- UPRIGHT LIFT ---
    // Apply a small upward force to help the character stay on its feet
    // Only when torso is tilted significantly
    const currentUp = new CANNON.Vec3(0, 1, 0);
    currentQuat.vmult(currentUp, currentUp);
    const uprightness = currentUp.y; // 1 = perfectly upright, 0 = on side, -1 = upside down

    if (uprightness < 0.8) {
      // Lift force to help right itself
      const liftForce = (1 - uprightness) * 30 * damageMultiplier;
      torso.applyForce(new CANNON.Vec3(0, liftForce, 0));
    }
  }
}
