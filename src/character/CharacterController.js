import * as CANNON from 'cannon-es';
import { Actions } from '../input/InputManager.js';

export class CharacterController {
  constructor(ragdoll, game, audio) {
    this.ragdoll = ragdoll;
    this.game = game;
    this.audio = audio;

    this.punchCooldown = 0;
    this.kickCooldown = 0;
    this.headbuttCooldown = 0;
    this.grabConstraint = null;

    this.moveForce = 120;
    this.horizontalDamping = 0.92; // applied per frame to X/Z velocity
    this.jumpImpulse = 18;      // initial kick — enough for a visible short hop
    this.jumpHoldForce = 50;    // additional force while held
    this.jumpHoldMax = 0.2;     // max seconds of hold boost
    this.jumpHoldTimer = 0;
    this.jumpedThisPress = false;
    this.punchImpulse = 20;
    this.kickImpulse = 18;
    this.headbuttImpulse = 15;
    this.attackRange = 3.0;
  }

  update(dt, actions) {
    if (this.ragdoll.balance.isRagdolling()) return;

    const torso = this.ragdoll.getTorso();

    // Movement
    const force = new CANNON.Vec3(0, 0, 0);
    if (actions[Actions.MOVE_LEFT]) force.x -= this.moveForce;
    if (actions[Actions.MOVE_RIGHT]) force.x += this.moveForce;
    if (actions[Actions.MOVE_FORWARD]) force.z -= this.moveForce;
    if (actions[Actions.MOVE_BACKWARD]) force.z += this.moveForce;
    torso.applyForce(force);

    // Variable jump — tap for short hop, hold for full jump
    if (actions[Actions.JUMP]) {
      if (this.isGrounded() && !this.jumpedThisPress) {
        // Initial jump impulse
        torso.applyImpulse(new CANNON.Vec3(0, this.jumpImpulse, 0));
        this.jumpedThisPress = true;
        if (this.audio) this.audio.playJump();
        this.jumpHoldTimer = 0;
      }
      // Continue applying upward force while held (up to max time)
      if (this.jumpedThisPress && this.jumpHoldTimer < this.jumpHoldMax) {
        this.jumpHoldTimer += dt;
        torso.applyForce(new CANNON.Vec3(0, this.jumpHoldForce, 0));
      }
    } else {
      // Released — allow jumping again when grounded
      if (this.isGrounded()) {
        this.jumpedThisPress = false;
      }
      this.jumpHoldTimer = this.jumpHoldMax; // stop any residual hold force
    }

    // Punch
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
      this.punchCooldown = 0.4;
      this.ragdoll.triggerPunch();
      if (this.audio) this.audio.playPunch();
      this._hitNearby(this.punchImpulse, 3);
    }

    // Kick
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    if (actions[Actions.KICK] && this.kickCooldown <= 0) {
      this.kickCooldown = 0.5;
      this.ragdoll.triggerKick();
      if (this.audio) this.audio.playKick();
      this._hitNearby(this.kickImpulse, 2);
    }

    // Headbutt
    this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
    if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
      this.headbuttCooldown = 0.6;
      this.ragdoll.triggerHeadbutt();
      if (this.audio) this.audio.playHeadbutt();
      this._hitNearby(this.headbuttImpulse, 4);
    }

    // Grab
    if (actions[Actions.GRAB]) {
      this.tryGrab();
    } else {
      this.releaseGrab();
    }

    // Horizontal damping — slow down X/Z without affecting Y (jump/fall)
    torso.velocity.x *= this.horizontalDamping;
    torso.velocity.z *= this.horizontalDamping;
  }

  _hitNearby(impulse, damageAmount) {
    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    // Use all players list directly — more reliable than syncPairs
    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.ragdoll || !p.alive) continue;
      const theirBody = p.ragdoll.bodies.torso;
      if (!theirBody || theirBody === myBody) continue;

      const dist = myPos.distanceTo(theirBody.position);
      if (dist < this.attackRange) {
        // Knockback direction: away from attacker
        const knockDir = new CANNON.Vec3(
          theirBody.position.x - myPos.x,
          0.3,
          theirBody.position.z - myPos.z
        );
        if (knockDir.length() > 0.01) knockDir.normalize();
        else knockDir.set(1, 0.3, 0); // default direction if overlapping

        theirBody.applyImpulse(new CANNON.Vec3(
          knockDir.x * impulse,
          knockDir.y * impulse,
          knockDir.z * impulse
        ));

        p.ragdoll.balance.takeDamage(damageAmount);
        if (this.audio) this.audio.playHit();
      }
    }
  }

  isGrounded() {
    const torso = this.ragdoll.getTorso();
    // Sphere bottom is at y - 0.55 (radius 0.35 + offset 0.2)
    // Ground is at y = 0, so grounded when torso.y < ~0.8
    return torso.position.y < 0.9;
  }

  tryGrab() {
    if (this.grabConstraint) return;

    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.ragdoll || !p.alive) continue;
      const theirBody = p.ragdoll.bodies.torso;
      if (!theirBody || theirBody === myBody) continue;

      const dist = myPos.distanceTo(theirBody.position);
      if (dist < 2.0) {
        this.grabConstraint = new CANNON.DistanceConstraint(myBody, theirBody, dist);
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
