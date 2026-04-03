import * as CANNON from 'cannon-es';

export class BalanceSystem {
  constructor(ragdoll) {
    this.ragdoll = ragdoll;
    this.damage = 0;          // 0 to 100
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
    const damageMultiplier = 1 - (this.damage / 100) * 0.8;

    // --- FORCE UPRIGHT ---
    // Directly set the torso quaternion toward upright, preserving only yaw
    const currentQuat = torso.quaternion;

    // Extract yaw from current orientation
    const forward = new CANNON.Vec3(0, 0, 1);
    currentQuat.vmult(forward, forward);
    forward.y = 0;
    if (forward.length() > 0.01) {
      forward.normalize();
    } else {
      forward.set(0, 0, 1);
    }
    const yaw = Math.atan2(forward.x, forward.z);

    // Target: standing upright, facing current yaw
    const targetQuat = new CANNON.Quaternion();
    targetQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);

    // Aggressive slerp — basically snap upright
    const slerpStrength = Math.min(0.4 * damageMultiplier, 1);
    currentQuat.slerp(targetQuat, slerpStrength, currentQuat);

    // --- KILL TUMBLE ---
    // Heavily damp pitch and roll angular velocity
    torso.angularVelocity.x *= 0.8;
    torso.angularVelocity.z *= 0.8;

    // --- STAND UP FORCE ---
    // Check how upright we are
    const currentUp = new CANNON.Vec3(0, 1, 0);
    currentQuat.vmult(currentUp, currentUp);
    const uprightness = currentUp.y;

    // If not upright, apply strong upward force to get off the ground
    if (uprightness < 0.9) {
      const liftForce = (1 - uprightness) * 150 * damageMultiplier;
      torso.applyForce(new CANNON.Vec3(0, liftForce, 0));
    }

    // --- KEEP FEET DOWN ---
    // Push legs downward to encourage standing pose
    const leftLeg = this.ragdoll.bodies.leftLowerLeg;
    const rightLeg = this.ragdoll.bodies.rightLowerLeg;
    if (leftLeg) leftLeg.applyForce(new CANNON.Vec3(0, -8 * damageMultiplier, 0));
    if (rightLeg) rightLeg.applyForce(new CANNON.Vec3(0, -8 * damageMultiplier, 0));
  }
}
