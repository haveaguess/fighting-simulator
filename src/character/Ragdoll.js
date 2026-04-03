import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BalanceSystem } from './BalanceSystem.js';

export class Ragdoll {
  constructor(game, position, color) {
    this.game = game;
    this.bodies = {};
    this.meshes = {};
    this.constraints = [];

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const px = position.x;
    const py = position.y;
    const pz = position.z;
    const damping = 0.4;

    // Helper to create a body+mesh pair
    const createPart = (name, shape, geo, mass, x, y, z) => {
      const body = new CANNON.Body({ mass, shape, linearDamping: damping, angularDamping: damping });
      body.position.set(x, y, z);
      game.world.addBody(body);

      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.castShadow = true;
      game.scene.add(mesh);
      game.addSyncPair(body, mesh);

      this.bodies[name] = body;
      this.meshes[name] = mesh;
      return body;
    };

    // --- Torso (chunky pill shape like Gang Beasts) ---
    createPart('torso',
      new CANNON.Box(new CANNON.Vec3(0.35, 0.5, 0.25)),
      new THREE.CapsuleGeometry(0.35, 0.5, 8, 16), // radius 0.35, length 0.5
      5, px, py, pz
    );

    // --- Head (big round sphere — Gang Beasts signature) ---
    createPart('head',
      new CANNON.Sphere(0.32),
      new THREE.SphereGeometry(0.32, 16, 16),
      1, px, py + 0.85, pz
    );

    // Neck constraint
    const neckConstraint = new CANNON.ConeTwistConstraint(this.bodies.torso, this.bodies.head, {
      pivotA: new CANNON.Vec3(0, 0.5, 0),
      pivotB: new CANNON.Vec3(0, -0.32, 0),
      axisA: new CANNON.Vec3(0, 1, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 6,
      twistAngle: Math.PI / 6,
    });
    game.world.addConstraint(neckConstraint);
    this.constraints.push(neckConstraint);

    // --- Upper Arms (stubby tubes) ---
    // Left upper arm
    createPart('leftUpperArm',
      new CANNON.Cylinder(0.1, 0.1, 0.5, 8),
      new THREE.CapsuleGeometry(0.1, 0.3, 4, 8),
      1, px - 0.5, py + 0.25, pz
    );

    const leftShoulderConstraint = new CANNON.ConeTwistConstraint(this.bodies.torso, this.bodies.leftUpperArm, {
      pivotA: new CANNON.Vec3(-0.35, 0.4, 0),
      pivotB: new CANNON.Vec3(0, 0.25, 0),
      axisA: new CANNON.Vec3(-1, 0, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 3,
      twistAngle: Math.PI / 3,
    });
    game.world.addConstraint(leftShoulderConstraint);
    this.constraints.push(leftShoulderConstraint);

    // Right upper arm
    createPart('rightUpperArm',
      new CANNON.Cylinder(0.1, 0.1, 0.5, 8),
      new THREE.CapsuleGeometry(0.1, 0.3, 4, 8),
      1, px + 0.5, py + 0.25, pz
    );

    const rightShoulderConstraint = new CANNON.ConeTwistConstraint(this.bodies.torso, this.bodies.rightUpperArm, {
      pivotA: new CANNON.Vec3(0.35, 0.4, 0),
      pivotB: new CANNON.Vec3(0, 0.25, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 3,
      twistAngle: Math.PI / 3,
    });
    game.world.addConstraint(rightShoulderConstraint);
    this.constraints.push(rightShoulderConstraint);

    // --- Lower Arms (stubby tubes with round fist ends) ---
    // Left lower arm
    createPart('leftLowerArm',
      new CANNON.Sphere(0.12),
      new THREE.CapsuleGeometry(0.1, 0.25, 4, 8),
      0.8, px - 0.5, py - 0.15, pz
    );

    const leftElbowConstraint = new CANNON.HingeConstraint(this.bodies.leftUpperArm, this.bodies.leftLowerArm, {
      pivotA: new CANNON.Vec3(0, -0.25, 0),
      pivotB: new CANNON.Vec3(0, 0.2, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    leftElbowConstraint.setMotorMaxForce(0);
    game.world.addConstraint(leftElbowConstraint);
    this.constraints.push(leftElbowConstraint);

    // Right lower arm
    createPart('rightLowerArm',
      new CANNON.Sphere(0.12),
      new THREE.CapsuleGeometry(0.1, 0.25, 4, 8),
      0.8, px + 0.5, py - 0.15, pz
    );

    const rightElbowConstraint = new CANNON.HingeConstraint(this.bodies.rightUpperArm, this.bodies.rightLowerArm, {
      pivotA: new CANNON.Vec3(0, -0.25, 0),
      pivotB: new CANNON.Vec3(0, 0.2, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    rightElbowConstraint.setMotorMaxForce(0);
    game.world.addConstraint(rightElbowConstraint);
    this.constraints.push(rightElbowConstraint);

    // --- Upper Legs (chunky tubes) ---
    // Left upper leg
    createPart('leftUpperLeg',
      new CANNON.Cylinder(0.12, 0.12, 0.5, 8),
      new THREE.CapsuleGeometry(0.12, 0.3, 4, 8),
      1.5, px - 0.18, py - 0.8, pz
    );

    const leftHipConstraint = new CANNON.ConeTwistConstraint(this.bodies.torso, this.bodies.leftUpperLeg, {
      pivotA: new CANNON.Vec3(-0.18, -0.5, 0),
      pivotB: new CANNON.Vec3(0, 0.25, 0),
      axisA: new CANNON.Vec3(0, -1, 0),
      axisB: new CANNON.Vec3(0, -1, 0),
      angle: Math.PI / 4,
      twistAngle: Math.PI / 4,
    });
    game.world.addConstraint(leftHipConstraint);
    this.constraints.push(leftHipConstraint);

    // Right upper leg
    createPart('rightUpperLeg',
      new CANNON.Cylinder(0.12, 0.12, 0.5, 8),
      new THREE.CapsuleGeometry(0.12, 0.3, 4, 8),
      1.5, px + 0.18, py - 0.8, pz
    );

    const rightHipConstraint = new CANNON.ConeTwistConstraint(this.bodies.torso, this.bodies.rightUpperLeg, {
      pivotA: new CANNON.Vec3(0.18, -0.5, 0),
      pivotB: new CANNON.Vec3(0, 0.25, 0),
      axisA: new CANNON.Vec3(0, -1, 0),
      axisB: new CANNON.Vec3(0, -1, 0),
      angle: Math.PI / 4,
      twistAngle: Math.PI / 4,
    });
    game.world.addConstraint(rightHipConstraint);
    this.constraints.push(rightHipConstraint);

    // --- Lower Legs (stubby tubes with round feet) ---
    // Left lower leg
    createPart('leftLowerLeg',
      new CANNON.Sphere(0.13),
      new THREE.CapsuleGeometry(0.11, 0.25, 4, 8),
      1, px - 0.18, py - 1.35, pz
    );

    const leftKneeConstraint = new CANNON.HingeConstraint(this.bodies.leftUpperLeg, this.bodies.leftLowerLeg, {
      pivotA: new CANNON.Vec3(0, -0.25, 0),
      pivotB: new CANNON.Vec3(0, 0.2, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    leftKneeConstraint.setMotorMaxForce(0);
    game.world.addConstraint(leftKneeConstraint);
    this.constraints.push(leftKneeConstraint);

    // Right lower leg
    createPart('rightLowerLeg',
      new CANNON.Sphere(0.13),
      new THREE.CapsuleGeometry(0.11, 0.25, 4, 8),
      1, px + 0.18, py - 1.35, pz
    );

    const rightKneeConstraint = new CANNON.HingeConstraint(this.bodies.rightUpperLeg, this.bodies.rightLowerLeg, {
      pivotA: new CANNON.Vec3(0, -0.25, 0),
      pivotB: new CANNON.Vec3(0, 0.2, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    rightKneeConstraint.setMotorMaxForce(0);
    game.world.addConstraint(rightKneeConstraint);
    this.constraints.push(rightKneeConstraint);

    this.balance = new BalanceSystem(this);
    this._balanceCallback = game.onUpdate((dt) => this.balance.update(dt));
  }

  getTorso() {
    return this.bodies.torso;
  }

  getHead() {
    return this.bodies.head;
  }

  getPosition() {
    const p = this.bodies.torso.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  destroy() {
    // Remove balance update callback
    if (this._balanceCallback) {
      this.game.removeOnUpdate(this._balanceCallback);
      this._balanceCallback = null;
    }

    // Remove constraints
    for (const constraint of this.constraints) {
      this.game.world.removeConstraint(constraint);
    }
    this.constraints.length = 0;

    // Remove bodies, sync pairs, and meshes
    for (const name of Object.keys(this.bodies)) {
      const body = this.bodies[name];
      const mesh = this.meshes[name];
      this.game.removeSyncPair(body);
      this.game.world.removeBody(body);
      this.game.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    }
    this.bodies = {};
    this.meshes = {};
  }
}
