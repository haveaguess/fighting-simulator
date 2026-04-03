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

    this.moveForce = 80;
    this.jumpImpulse = 14;
    this.punchImpulse = 20;
    this.kickImpulse = 18;
    this.headbuttImpulse = 15;
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

    // Jump (only when close to ground)
    if (actions[Actions.JUMP] && this.isGrounded()) {
      torso.applyImpulse(new CANNON.Vec3(0, this.jumpImpulse, 0));
    }

    // Punch
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
      this.punchCooldown = 0.4;
      const arm = this.ragdoll.bodies.rightLowerArm;
      const dir = this.getFacingDirection();
      arm.applyImpulse(new CANNON.Vec3(dir.x * this.punchImpulse, 2, dir.z * this.punchImpulse));
    }

    // Kick
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    if (actions[Actions.KICK] && this.kickCooldown <= 0) {
      this.kickCooldown = 0.5;
      const leg = this.ragdoll.bodies.rightLowerLeg;
      const dir = this.getFacingDirection();
      leg.applyImpulse(new CANNON.Vec3(dir.x * this.kickImpulse, 1, dir.z * this.kickImpulse));
    }

    // Headbutt
    this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
    if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
      this.headbuttCooldown = 0.6;
      const head = this.ragdoll.getHead();
      const dir = this.getFacingDirection();
      head.applyImpulse(new CANNON.Vec3(dir.x * this.headbuttImpulse, 0, dir.z * this.headbuttImpulse));
    }

    // Grab
    if (actions[Actions.GRAB]) {
      this.tryGrab();
    } else {
      this.releaseGrab();
    }
  }

  getFacingDirection() {
    const torso = this.ragdoll.getTorso();
    const forward = new CANNON.Vec3(0, 0, -1);
    torso.quaternion.vmult(forward, forward);
    forward.y = 0;
    forward.normalize();
    if (forward.length() < 0.01) {
      forward.set(0, 0, -1);
    }
    return forward;
  }

  isGrounded() {
    // Check if any lower leg or torso is near the ground
    const torso = this.ragdoll.getTorso();
    const leftFoot = this.ragdoll.bodies.leftLowerLeg;
    const rightFoot = this.ragdoll.bodies.rightLowerLeg;
    const lowestY = Math.min(
      torso.position.y,
      leftFoot ? leftFoot.position.y : torso.position.y,
      rightFoot ? rightFoot.position.y : torso.position.y
    );
    return lowestY < 1.5;
  }

  tryGrab() {
    if (this.grabConstraint) return;

    const hand = this.ragdoll.bodies.leftLowerArm;
    const handPos = hand.position;

    for (const pair of this.game.syncPairs) {
      const body = pair.body;
      if (Object.values(this.ragdoll.bodies).includes(body)) continue;
      const dist = handPos.distanceTo(body.position);
      if (dist < 1.0 && body.mass > 0) {
        this.grabConstraint = new CANNON.DistanceConstraint(hand, body, dist);
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
