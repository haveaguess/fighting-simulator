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
    }

    // Gradually recover damage over time
    if (this.damage > 0 && this.ragdollTimer <= 0) {
      this.damage = Math.max(0, this.damage - dt * 2);
    }
  }
}
