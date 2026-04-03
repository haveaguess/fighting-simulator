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

    // Grab state
    this.grabConstraint = null;
    this.grabbedPlayer = null;

    this.moveForce = 120;
    this.horizontalDamping = 0.92;
    this.jumpImpulse = 18;
    this.jumpHoldForce = 50;
    this.jumpHoldMax = 0.2;
    this.jumpHoldTimer = 0;
    this.jumpedThisPress = false;
    this.punchImpulse = 30;
    this.kickImpulse = 25;
    this.headbuttImpulse = 35;
    this.throwImpulse = 40;
    this.attackRange = 0.9;
    this.grabRange = 1.2;
    this.team = null; // set to skip friendly fire
  }

  update(dt, actions) {
    if (this.ragdoll.balance.isRagdolling()) {
      this.releaseGrab();
      return;
    }

    const torso = this.ragdoll.getTorso();
    const isGrabbing = this.grabbedPlayer !== null;

    // Movement (slower when grabbing)
    const moveMult = isGrabbing ? 0.5 : 1;
    const force = new CANNON.Vec3(0, 0, 0);
    if (actions[Actions.MOVE_LEFT]) force.x -= this.moveForce * moveMult;
    if (actions[Actions.MOVE_RIGHT]) force.x += this.moveForce * moveMult;
    if (actions[Actions.MOVE_FORWARD]) force.z -= this.moveForce * moveMult;
    if (actions[Actions.MOVE_BACKWARD]) force.z += this.moveForce * moveMult;
    torso.applyForce(force);

    // Variable jump
    if (actions[Actions.JUMP]) {
      if (this.isGrounded() && !this.jumpedThisPress) {
        torso.applyImpulse(new CANNON.Vec3(0, this.jumpImpulse, 0));
        this.jumpedThisPress = true;
        if (this.audio) this.audio.playJump();
        this.jumpHoldTimer = 0;
      }
      if (this.jumpedThisPress && this.jumpHoldTimer < this.jumpHoldMax) {
        this.jumpHoldTimer += dt;
        torso.applyForce(new CANNON.Vec3(0, this.jumpHoldForce, 0));
      }
    } else {
      if (this.isGrounded()) this.jumpedThisPress = false;
      this.jumpHoldTimer = this.jumpHoldMax;
    }

    // === GRAB + COMBO ATTACKS ===
    if (isGrabbing) {
      // Check if grabbed player is still alive and constraint exists
      if (!this.grabbedPlayer.alive || !this.grabConstraint) {
        this.releaseGrab();
      } else {
        // Tell ragdoll to show grab arm
        this.ragdoll.grabTarget = this.grabbedPlayer.ragdoll.getPosition();

        // PUNCH while grabbing — guaranteed hit on held player
        this.punchCooldown = Math.max(0, this.punchCooldown - dt);
        if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
          this.punchCooldown = 0.35;
          this.ragdoll.triggerPunch();
          if (this.audio) this.audio.playPunch();
          this._hitGrabbed(this.punchImpulse * 0.7, 20);
        }

        // HEADBUTT while grabbing — lean in and bonk
        this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
        if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
          this.headbuttCooldown = 0.5;
          this.ragdoll.triggerHeadbutt();
          if (this.audio) this.audio.playHeadbutt();
          this._hitGrabbed(this.headbuttImpulse * 0.5, 25);
        }

        // KICK while grabbing — THROW! Release + launch upward and away
        this.kickCooldown = Math.max(0, this.kickCooldown - dt);
        if (actions[Actions.KICK] && this.kickCooldown <= 0) {
          this.kickCooldown = 0.6;
          this.ragdoll.triggerKick();
          if (this.audio) this.audio.playKick();
          this._throwGrabbed();
        }

        // Release grab if grab button released
        if (!actions[Actions.GRAB]) {
          this.releaseGrab();
        }
      }
    } else {
      // Not grabbing — normal attacks
      this.ragdoll.grabTarget = null;

      this.punchCooldown = Math.max(0, this.punchCooldown - dt);
      if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
        this.punchCooldown = 0.4;
        this.ragdoll.triggerPunch();
        if (this.audio) this.audio.playPunch();
        this._hitNearby(this.punchImpulse, 20);
      }

      this.kickCooldown = Math.max(0, this.kickCooldown - dt);
      if (actions[Actions.KICK] && this.kickCooldown <= 0) {
        this.kickCooldown = 0.5;
        this.ragdoll.triggerKick();
        if (this.audio) this.audio.playKick();
        this._hitNearby(this.kickImpulse, 15);
      }

      this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
      if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
        this.headbuttCooldown = 0.6;
        this.ragdoll.triggerHeadbutt();
        if (this.audio) this.audio.playHeadbutt();
        this._hitNearby(this.headbuttImpulse, 25);
      }

      // Try to grab — show reaching arm while button held
      if (actions[Actions.GRAB]) {
        this.ragdoll.grabReaching = true;
        this.tryGrab();
      } else {
        this.ragdoll.grabReaching = false;
      }
    }

    // Horizontal damping
    torso.velocity.x *= this.horizontalDamping;
    torso.velocity.z *= this.horizontalDamping;
  }

  _hitGrabbed(impulse, damage) {
    if (!this.grabbedPlayer) return;
    const theirBody = this.grabbedPlayer.ragdoll.bodies.torso;
    if (!theirBody) return;

    const myPos = this.ragdoll.getTorso().position;
    const knockDir = new CANNON.Vec3(
      theirBody.position.x - myPos.x,
      0.2,
      theirBody.position.z - myPos.z
    );
    if (knockDir.length() > 0.01) knockDir.normalize();
    else knockDir.set(1, 0.2, 0);

    const knockMult = this.grabbedPlayer.ragdoll.balance.getKnockbackMultiplier();
    // Reduced knockback while held (they're constrained)
    theirBody.applyImpulse(new CANNON.Vec3(
      knockDir.x * impulse * knockMult * 0.3,
      knockDir.y * impulse * knockMult * 0.3,
      knockDir.z * impulse * knockMult * 0.3
    ));

    this.grabbedPlayer.ragdoll.balance.takeDamage(damage);
    if (this.audio) this.audio.playHit();
  }

  _throwGrabbed() {
    if (!this.grabbedPlayer) return;
    const theirBody = this.grabbedPlayer.ragdoll.bodies.torso;
    if (!theirBody) return;

    const myPos = this.ragdoll.getTorso().position;
    const throwDir = new CANNON.Vec3(
      theirBody.position.x - myPos.x,
      0.8, // strong upward component
      theirBody.position.z - myPos.z
    );
    if (throwDir.length() > 0.01) throwDir.normalize();
    else throwDir.set(0, 1, 0);

    const knockMult = this.grabbedPlayer.ragdoll.balance.getKnockbackMultiplier();
    theirBody.applyImpulse(new CANNON.Vec3(
      throwDir.x * this.throwImpulse * knockMult,
      throwDir.y * this.throwImpulse * knockMult,
      throwDir.z * this.throwImpulse * knockMult
    ));

    this.grabbedPlayer.ragdoll.balance.takeDamage(15);
    if (this.audio) this.audio.playKick();

    // Release after throw
    this.releaseGrab();
  }

  _hitNearby(impulse, damageAmount) {
    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.ragdoll || !p.alive) continue;
      const theirBody = p.ragdoll.bodies.torso;
      if (!theirBody || theirBody === myBody) continue;
      // Skip teammates
      if (this.team !== null && p.team === this.team) continue;

      const dist = myPos.distanceTo(theirBody.position);
      if (dist < this.attackRange) {
        const knockDir = new CANNON.Vec3(
          theirBody.position.x - myPos.x,
          0.3,
          theirBody.position.z - myPos.z
        );
        if (knockDir.length() > 0.01) knockDir.normalize();
        else knockDir.set(1, 0.3, 0);

        const knockMult = p.ragdoll.balance.getKnockbackMultiplier();
        const totalImpulse = impulse * knockMult;
        theirBody.applyImpulse(new CANNON.Vec3(
          knockDir.x * totalImpulse,
          knockDir.y * totalImpulse,
          knockDir.z * totalImpulse
        ));

        p.ragdoll.balance.takeDamage(damageAmount);
        if (this.audio) this.audio.playHit();
      }
    }
  }

  isGrounded() {
    const torso = this.ragdoll.getTorso();
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
      if (this.team !== null && p.team === this.team) continue;

      const dist = myPos.distanceTo(theirBody.position);
      if (dist < this.grabRange) {
        // Lock them close
        this.grabConstraint = new CANNON.DistanceConstraint(myBody, theirBody, 0.8);
        this.game.world.addConstraint(this.grabConstraint);
        this.grabbedPlayer = p;
        return;
      }
    }
  }

  releaseGrab() {
    if (this.grabConstraint) {
      this.game.world.removeConstraint(this.grabConstraint);
      this.grabConstraint = null;
    }
    this.grabbedPlayer = null;
    this.ragdoll.grabTarget = null;
  }
}
