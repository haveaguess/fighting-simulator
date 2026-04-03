export class BalanceSystem {
  constructor(ragdoll) {
    this.ragdoll = ragdoll;
    this.damage = 0;
    this.ragdollTimer = 0;
    this.ragdollDuration = 2;
  }

  takeDamage(amount) {
    this.damage = Math.min(100, this.damage + amount);
    if (this.damage >= 80) {
      this.ragdollTimer = this.ragdollDuration;
    }
  }

  // Higher damage = more knockback multiplier (like Smash Bros)
  getKnockbackMultiplier() {
    return 1 + (this.damage / 50);  // 1x at 0%, 3x at 100%
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
        this.damage = Math.max(0, this.damage - 10); // small recovery after ragdoll
      }
    }

    // Slow recovery over time
    if (this.damage > 0 && this.ragdollTimer <= 0) {
      this.damage = Math.max(0, this.damage - dt * 1);
    }
  }
}
