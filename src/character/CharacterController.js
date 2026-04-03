import * as CANNON from 'cannon-es';
import { Actions } from '../input/InputManager.js';

export class CharacterController {
  constructor(ragdoll, game) {
    this.ragdoll = ragdoll;
    this.game = game;

    this.punchCooldown = 0;
    this.kickCooldown = 0;
    this.headbuttCooldown = 0;
    this.grabConstraint = null;

    this.moveForce = 60;
    this.jumpImpulse = 10;
    this.punchImpulse = 20;
    this.kickImpulse = 18;
    this.headbuttImpulse = 15;
    this.attackRange = 2.0;
  }

  update(dt, actions) {
    if (this.ragdoll.balance.isRagdolling()) return;

    const torso = this.ragdoll.getTorso();

    // Movement — apply force to main body
    const force = new CANNON.Vec3(0, 0, 0);
    if (actions[Actions.MOVE_LEFT]) force.x -= this.moveForce;
    if (actions[Actions.MOVE_RIGHT]) force.x += this.moveForce;
    if (actions[Actions.MOVE_FORWARD]) force.z -= this.moveForce;
    if (actions[Actions.MOVE_BACKWARD]) force.z += this.moveForce;
    torso.applyForce(force);

    // Jump
    if (actions[Actions.JUMP] && this.isGrounded()) {
      torso.applyImpulse(new CANNON.Vec3(0, this.jumpImpulse, 0));
    }

    // Punch
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
      this.punchCooldown = 0.4;
      this.ragdoll.triggerPunch();
      this._hitNearby(this.punchImpulse, 3);
    }

    // Kick
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    if (actions[Actions.KICK] && this.kickCooldown <= 0) {
      this.kickCooldown = 0.5;
      this.ragdoll.triggerKick();
      this._hitNearby(this.kickImpulse, 2);
    }

    // Headbutt
    this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
    if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
      this.headbuttCooldown = 0.6;
      this.ragdoll.triggerHeadbutt();
      this._hitNearby(this.headbuttImpulse, 4);
    }

    // Grab
    if (actions[Actions.GRAB]) {
      this.tryGrab();
    } else {
      this.releaseGrab();
    }
  }

  _hitNearby(impulse, damageAmount) {
    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    // Find facing direction from velocity, or default forward
    let dx = myBody.velocity.x;
    let dz = myBody.velocity.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0.3) {
      dx /= len;
      dz /= len;
    } else {
      dx = 0;
      dz = -1;
    }

    // Check all other physics bodies in range
    for (const pair of this.game.syncPairs) {
      const body = pair.body;
      if (body === myBody || body.mass === 0) continue;

      const dist = myPos.distanceTo(body.position);
      if (dist < this.attackRange) {
        // Apply knockback impulse away from attacker
        const knockDir = new CANNON.Vec3(
          body.position.x - myPos.x,
          0.5,
          body.position.z - myPos.z
        );
        knockDir.normalize();
        body.applyImpulse(new CANNON.Vec3(
          knockDir.x * impulse,
          knockDir.y * impulse * 0.5,
          knockDir.z * impulse
        ));

        // Apply damage if the target has a balance system
        // Find the ragdoll that owns this body
        for (const p of (this.game._allPlayers || [])) {
          if (p.ragdoll && p.ragdoll.bodies.torso === body) {
            p.ragdoll.balance.takeDamage(damageAmount);
            break;
          }
        }
      }
    }
  }

  isGrounded() {
    const torso = this.ragdoll.getTorso();
    return torso.position.y < 1.2;
  }

  tryGrab() {
    if (this.grabConstraint) return;

    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    for (const pair of this.game.syncPairs) {
      const body = pair.body;
      if (body === myBody || body.mass === 0) continue;
      const dist = myPos.distanceTo(body.position);
      if (dist < 1.5) {
        this.grabConstraint = new CANNON.DistanceConstraint(myBody, body, dist);
        this.game.world.addConstraint(this.grabConstraint);
        return;
      }
    }
  }

  releaseGrab() {
    if (this.grabConstraint) {
      this.game.world.removeConstraint(this.grabConstraint);
      this.grabConstraint = null;
    }
  }
}
