import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BalanceSystem } from './BalanceSystem.js';

export class Ragdoll {
  constructor(game, position, color) {
    this.game = game;
    this.bodies = [];
    this.meshes = [];
    this.constraints = [];

    const mat = new THREE.MeshStandardMaterial({ color });
    const px = position.x;
    const py = position.y;
    const pz = position.z;
    const damping = 0.4;

    // Helper to create a body+mesh pair
    const createPart = (shape, geo, mass, x, y, z) => {
      const body = new CANNON.Body({ mass, shape, linearDamping: damping, angularDamping: damping });
      body.position.set(x, y, z);
      game.world.addBody(body);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      game.scene.add(mesh);
      game.addSyncPair(body, mesh);

      this.bodies.push(body);
      this.meshes.push(mesh);
      return body;
    };

    // --- Torso (core, index 0) ---
    const torsoHW = [0.4, 0.6, 0.25]; // half-extents
    this.torso = createPart(
      new CANNON.Box(new CANNON.Vec3(...torsoHW)),
      new THREE.BoxGeometry(0.8, 1.2, 0.5),
      5, px, py, pz
    );

    // --- Head (index 1) ---
    this.head = createPart(
      new CANNON.Sphere(0.3),
      new THREE.SphereGeometry(0.3, 16, 16),
      1, px, py + 0.9, pz
    );

    // Neck constraint — ConeTwist, PI/6 swing
    const neckConstraint = new CANNON.ConeTwistConstraint(this.torso, this.head, {
      pivotA: new CANNON.Vec3(0, 0.6, 0),
      pivotB: new CANNON.Vec3(0, -0.3, 0),
      axisA: new CANNON.Vec3(0, 1, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 6,
      twistAngle: Math.PI / 6,
    });
    game.world.addConstraint(neckConstraint);
    this.constraints.push(neckConstraint);

    // --- Upper Arms ---
    const upperArmHW = [0.12, 0.3, 0.12];
    const upperArmGeo = new THREE.BoxGeometry(0.24, 0.6, 0.24);

    // Left upper arm
    this.leftUpperArm = createPart(
      new CANNON.Box(new CANNON.Vec3(...upperArmHW)),
      upperArmGeo, 1, px - 0.52, py + 0.3, pz
    );

    const leftShoulderConstraint = new CANNON.ConeTwistConstraint(this.torso, this.leftUpperArm, {
      pivotA: new CANNON.Vec3(-0.4, 0.6, 0),
      pivotB: new CANNON.Vec3(0, 0.3, 0),
      axisA: new CANNON.Vec3(-1, 0, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 3,
      twistAngle: Math.PI / 3,
    });
    game.world.addConstraint(leftShoulderConstraint);
    this.constraints.push(leftShoulderConstraint);

    // Right upper arm
    this.rightUpperArm = createPart(
      new CANNON.Box(new CANNON.Vec3(...upperArmHW)),
      upperArmGeo, 1, px + 0.52, py + 0.3, pz
    );

    const rightShoulderConstraint = new CANNON.ConeTwistConstraint(this.torso, this.rightUpperArm, {
      pivotA: new CANNON.Vec3(0.4, 0.6, 0),
      pivotB: new CANNON.Vec3(0, 0.3, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 3,
      twistAngle: Math.PI / 3,
    });
    game.world.addConstraint(rightShoulderConstraint);
    this.constraints.push(rightShoulderConstraint);

    // --- Lower Arms ---
    const lowerArmHW = [0.1, 0.28, 0.1];
    const lowerArmGeo = new THREE.BoxGeometry(0.2, 0.56, 0.2);

    // Left lower arm
    this.leftLowerArm = createPart(
      new CANNON.Box(new CANNON.Vec3(...lowerArmHW)),
      lowerArmGeo, 0.8, px - 0.52, py - 0.3, pz
    );

    const leftElbowConstraint = new CANNON.HingeConstraint(this.leftUpperArm, this.leftLowerArm, {
      pivotA: new CANNON.Vec3(0, -0.3, 0),
      pivotB: new CANNON.Vec3(0, 0.28, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    leftElbowConstraint.setMotorMaxForce(0);
    game.world.addConstraint(leftElbowConstraint);
    this.constraints.push(leftElbowConstraint);
    // Elbow range: 0 to PI*0.7
    leftElbowConstraint.equations[0].minForce = -1e6;
    leftElbowConstraint.equations[0].maxForce = 1e6;

    // Right lower arm
    this.rightLowerArm = createPart(
      new CANNON.Box(new CANNON.Vec3(...lowerArmHW)),
      lowerArmGeo, 0.8, px + 0.52, py - 0.3, pz
    );

    const rightElbowConstraint = new CANNON.HingeConstraint(this.rightUpperArm, this.rightLowerArm, {
      pivotA: new CANNON.Vec3(0, -0.3, 0),
      pivotB: new CANNON.Vec3(0, 0.28, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    rightElbowConstraint.setMotorMaxForce(0);
    game.world.addConstraint(rightElbowConstraint);
    this.constraints.push(rightElbowConstraint);

    // --- Upper Legs ---
    const upperLegHW = [0.14, 0.3, 0.14];
    const upperLegGeo = new THREE.BoxGeometry(0.28, 0.6, 0.28);

    // Left upper leg
    this.leftUpperLeg = createPart(
      new CANNON.Box(new CANNON.Vec3(...upperLegHW)),
      upperLegGeo, 1.5, px - 0.2, py - 0.9, pz
    );

    const leftHipConstraint = new CANNON.ConeTwistConstraint(this.torso, this.leftUpperLeg, {
      pivotA: new CANNON.Vec3(-0.2, -0.6, 0),
      pivotB: new CANNON.Vec3(0, 0.3, 0),
      axisA: new CANNON.Vec3(0, -1, 0),
      axisB: new CANNON.Vec3(0, -1, 0),
      angle: Math.PI / 4,
      twistAngle: Math.PI / 4,
    });
    game.world.addConstraint(leftHipConstraint);
    this.constraints.push(leftHipConstraint);

    // Right upper leg
    this.rightUpperLeg = createPart(
      new CANNON.Box(new CANNON.Vec3(...upperLegHW)),
      upperLegGeo, 1.5, px + 0.2, py - 0.9, pz
    );

    const rightHipConstraint = new CANNON.ConeTwistConstraint(this.torso, this.rightUpperLeg, {
      pivotA: new CANNON.Vec3(0.2, -0.6, 0),
      pivotB: new CANNON.Vec3(0, 0.3, 0),
      axisA: new CANNON.Vec3(0, -1, 0),
      axisB: new CANNON.Vec3(0, -1, 0),
      angle: Math.PI / 4,
      twistAngle: Math.PI / 4,
    });
    game.world.addConstraint(rightHipConstraint);
    this.constraints.push(rightHipConstraint);

    // --- Lower Legs ---
    const lowerLegHW = [0.12, 0.3, 0.12];
    const lowerLegGeo = new THREE.BoxGeometry(0.24, 0.6, 0.24);

    // Left lower leg
    this.leftLowerLeg = createPart(
      new CANNON.Box(new CANNON.Vec3(...lowerLegHW)),
      lowerLegGeo, 1, px - 0.2, py - 1.5, pz
    );

    const leftKneeConstraint = new CANNON.HingeConstraint(this.leftUpperLeg, this.leftLowerLeg, {
      pivotA: new CANNON.Vec3(0, -0.3, 0),
      pivotB: new CANNON.Vec3(0, 0.3, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    leftKneeConstraint.setMotorMaxForce(0);
    game.world.addConstraint(leftKneeConstraint);
    this.constraints.push(leftKneeConstraint);

    // Right lower leg
    this.rightLowerLeg = createPart(
      new CANNON.Box(new CANNON.Vec3(...lowerLegHW)),
      lowerLegGeo, 1, px + 0.2, py - 1.5, pz
    );

    const rightKneeConstraint = new CANNON.HingeConstraint(this.rightUpperLeg, this.rightLowerLeg, {
      pivotA: new CANNON.Vec3(0, -0.3, 0),
      pivotB: new CANNON.Vec3(0, 0.3, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    rightKneeConstraint.setMotorMaxForce(0);
    game.world.addConstraint(rightKneeConstraint);
    this.constraints.push(rightKneeConstraint);

    this.balance = new BalanceSystem(this);
    game.onUpdate((dt) => this.balance.update(dt));
  }

  getTorso() {
    return this.torso;
  }

  getHead() {
    return this.head;
  }

  getPosition() {
    const p = this.torso.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  destroy() {
    // Remove constraints
    for (const constraint of this.constraints) {
      this.game.world.removeConstraint(constraint);
    }
    this.constraints.length = 0;

    // Remove bodies, sync pairs, and meshes
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      const mesh = this.meshes[i];
      this.game.removeSyncPair(body);
      this.game.world.removeBody(body);
      this.game.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    }
    this.bodies.length = 0;
    this.meshes.length = 0;
  }
}
