import { Actions } from '../input/InputManager.js';

export class AIController {
  constructor() {
    this.attackTimer = 0;
    this.thinkTimer = 0;
    this.currentDecision = {};
    this.targetTeam = null; // if set, only attack players on this team
  }

  update(dt, myRagdoll, allPlayers) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.thinkTimer -= dt;

    if (this.thinkTimer > 0) return this.currentDecision;

    this.thinkTimer = 0.3;
    const actions = {};
    const myPos = myRagdoll.getPosition();

    let nearest = null;
    let nearestDist = Infinity;
    for (const p of allPlayers) {
      if (p.ragdoll === myRagdoll || !p.alive) continue;
      // Only target specific team if set (for waves mode)
      if (this.targetTeam !== null && p.team !== this.targetTeam) continue;
      const pos = p.ragdoll.getPosition();
      const dx = pos.x - myPos.x;
      const dz = pos.z - myPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { pos, dist: nearestDist, dx, dz };
      }
    }

    if (!nearest) {
      this.currentDecision = actions;
      return actions;
    }

    if (nearest.dx < -0.5) actions[Actions.MOVE_LEFT] = true;
    if (nearest.dx > 0.5) actions[Actions.MOVE_RIGHT] = true;
    if (nearest.dz < -0.5) actions[Actions.MOVE_FORWARD] = true;
    if (nearest.dz > 0.5) actions[Actions.MOVE_BACKWARD] = true;

    if (nearest.dist < 2.5 && this.attackTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.35) actions[Actions.PUNCH] = true;
      else if (roll < 0.55) actions[Actions.KICK] = true;
      else if (roll < 0.70) actions[Actions.HEADBUTT] = true;
      else if (roll < 0.85) actions[Actions.GRAB] = true;
      else actions[Actions.JUMP] = true;
      this.attackTimer = 0.4 + Math.random() * 0.4;
    }

    if (nearest.dist > 5 && Math.random() < 0.02) {
      actions[Actions.JUMP] = true;
    }

    this.currentDecision = actions;
    return actions;
  }
}
