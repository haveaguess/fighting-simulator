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

    // === TORSO: FORCE UPRIGHT ===
    // Extract yaw, discard pitch/roll
    const forward = new CANNON.Vec3(0, 0, 1);
    torso.quaternion.vmult(forward, forward);
    forward.y = 0;
    if (forward.lengthSquared() < 0.001) forward.set(0, 0, 1);
    forward.normalize();
    const yaw = Math.atan2(forward.x, forward.z);

    // Set quaternion to upright with current yaw
    const targetQuat = new CANNON.Quaternion();
    targetQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);

    const strength = damageMultiplier;
    torso.quaternion.x = torso.quaternion.x * (1 - strength) + targetQuat.x * strength;
    torso.quaternion.y = torso.quaternion.y * (1 - strength) + targetQuat.y * strength;
    torso.quaternion.z = torso.quaternion.z * (1 - strength) + targetQuat.z * strength;
    torso.quaternion.w = torso.quaternion.w * (1 - strength) + targetQuat.w * strength;
    torso.quaternion.normalize();

    // Kill pitch/roll spin
    torso.angularVelocity.x *= 0.5;
    torso.angularVelocity.z *= 0.5;

    // === LEGS: PULL UNDER TORSO ===
    // Each leg should be roughly below the torso hip position
    const tx = torso.position.x;
    const tz = torso.position.z;

    const legParts = [
      { upper: 'leftUpperLeg', lower: 'leftLowerLeg', offsetX: -0.18 },
      { upper: 'rightUpperLeg', lower: 'rightLowerLeg', offsetX: 0.18 },
    ];

    for (const leg of legParts) {
      const upper = this.ragdoll.bodies[leg.upper];
      const lower = this.ragdoll.bodies[leg.lower];
      if (!upper || !lower) continue;

      // Pull upper leg toward position below hip
      const targetX = tx + leg.offsetX;
      const targetZ = tz;
      const pullStrength = 15 * damageMultiplier;

      const dxU = targetX - upper.position.x;
      const dzU = targetZ - upper.position.z;
      upper.applyForce(new CANNON.Vec3(dxU * pullStrength, 0, dzU * pullStrength));

      // Pull lower leg toward position below upper leg
      const dxL = upper.position.x - lower.position.x;
      const dzL = upper.position.z - lower.position.z;
      lower.applyForce(new CANNON.Vec3(dxL * pullStrength, -5, dzL * pullStrength));
    }

    // === ARMS: SLIGHT PULL TOWARD SIDES ===
    const armParts = [
      { upper: 'leftUpperArm', lower: 'leftLowerArm', offsetX: -0.4 },
      { upper: 'rightUpperArm', lower: 'rightLowerArm', offsetX: 0.4 },
    ];

    for (const arm of armParts) {
      const upper = this.ragdoll.bodies[arm.upper];
      if (!upper) continue;

      const targetX = tx + arm.offsetX;
      const targetZ = tz;
      const pullStrength = 5 * damageMultiplier;

      const dx = targetX - upper.position.x;
      const dz = targetZ - upper.position.z;
      upper.applyForce(new CANNON.Vec3(dx * pullStrength, 0, dz * pullStrength));
    }
  }
}
