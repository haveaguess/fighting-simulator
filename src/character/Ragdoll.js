import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BalanceSystem } from './BalanceSystem.js';

export class Ragdoll {
  constructor(game, position, color) {
    this.game = game;
    this.bodies = {};
    this.meshes = {};
    this.constraints = [];
    this.color = color;

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const px = position.x;
    const py = position.y;
    const pz = position.z;

    // === MAIN BODY: Single capsule-shaped physics body ===
    // This is the only real physics body — everything else is visual
    const torsoShape = new CANNON.Cylinder(0.35, 0.35, 1.4, 8);
    const mainBody = new CANNON.Body({
      mass: 8,
      linearDamping: 0.4,
      angularDamping: 0.99, // Very high — resist rotation
      fixedRotation: true,  // Don't rotate at all from physics
    });
    mainBody.addShape(torsoShape);
    mainBody.position.set(px, py, pz);
    game.world.addBody(mainBody);
    this.bodies.torso = mainBody;

    // === VISUAL MESHES (no physics, just follow the main body) ===
    // Torso mesh
    const torsoMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.5, 8, 16),
      mat.clone()
    );
    torsoMesh.castShadow = true;
    game.scene.add(torsoMesh);
    this.meshes.torso = torsoMesh;

    // Head mesh
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      mat.clone()
    );
    headMesh.castShadow = true;
    game.scene.add(headMesh);
    this.meshes.head = headMesh;

    // Arms
    const armMat = mat.clone();
    const armGeo = new THREE.CapsuleGeometry(0.08, 0.25, 4, 8);
    const handGeo = new THREE.SphereGeometry(0.09, 8, 8);

    this.meshes.leftUpperArm = this._addMesh(new THREE.CapsuleGeometry(0.09, 0.2, 4, 8), armMat);
    this.meshes.rightUpperArm = this._addMesh(new THREE.CapsuleGeometry(0.09, 0.2, 4, 8), armMat);
    this.meshes.leftLowerArm = this._addMesh(handGeo, armMat);
    this.meshes.rightLowerArm = this._addMesh(handGeo, armMat);

    // Legs
    const legMat = mat.clone();
    this.meshes.leftUpperLeg = this._addMesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), legMat);
    this.meshes.rightUpperLeg = this._addMesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), legMat);
    this.meshes.leftLowerLeg = this._addMesh(new THREE.CapsuleGeometry(0.09, 0.2, 4, 8), legMat);
    this.meshes.rightLowerLeg = this._addMesh(new THREE.CapsuleGeometry(0.09, 0.2, 4, 8), legMat);

    // Add torso to sync pairs for physics sync
    game.addSyncPair(mainBody, torsoMesh);

    // Animation state
    this.walkPhase = 0;
    this.punchTimer = 0; // >0 means punching
    this.kickTimer = 0;
    this.headbuttTimer = 0;

    // Balance
    this.balance = new BalanceSystem(this);
    this._balanceCallback = game.onUpdate((dt) => {
      this.balance.update(dt);
      this._animateLimbs(dt);
    });
  }

  _addMesh(geo, mat) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.castShadow = true;
    this.game.scene.add(mesh);
    return mesh;
  }

  _animateLimbs(dt) {
    const body = this.bodies.torso;
    if (!body) return;

    const x = body.position.x;
    const y = body.position.y;
    const z = body.position.z;

    // Check if moving
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
    if (speed > 0.5) {
      this.walkPhase += dt * speed * 3;
    } else {
      // Return to idle
      this.walkPhase *= 0.9;
    }

    const walk = Math.sin(this.walkPhase);
    const walkAbs = Math.abs(walk);

    // Torso (synced by Game via syncPair, but we add a slight bob)
    this.meshes.torso.position.set(x, y + Math.abs(walk) * 0.03, z);

    // Head — bobs slightly
    this.meshes.head.position.set(x, y + 0.65 + Math.abs(walk) * 0.02, z);

    // Headbutt animation
    if (this.headbuttTimer > 0) {
      this.headbuttTimer -= dt;
      const t = Math.max(0, this.headbuttTimer / 0.3);
      this.meshes.head.position.z += (t > 0.5 ? (1 - t) : t) * -0.4;
      this.meshes.head.position.y -= (t > 0.5 ? (1 - t) : t) * 0.15;
    }

    // Arms — swing with walk, or idle hang
    const armSwing = walk * 0.15;
    const armY = y + 0.15;

    // Left arm
    let laX = x - 0.38;
    let laZ = z + armSwing;
    let laHandZ = z + armSwing * 1.5;
    let laHandY = armY - 0.3;

    // Right arm
    let raX = x + 0.38;
    let raZ = z - armSwing;
    let raHandZ = z - armSwing * 1.5;
    let raHandY = armY - 0.3;

    // Punch animation (right arm extends forward)
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      const t = Math.max(0, this.punchTimer / 0.3);
      const extend = (t > 0.5 ? (1 - t) : t) * 2;
      // Get facing direction
      const vx = body.velocity.x;
      const vz = body.velocity.z;
      const len = Math.sqrt(vx * vx + vz * vz);
      const dx = len > 0.1 ? vx / len : 0;
      const dz = len > 0.1 ? vz / len : -1;
      raX += dx * extend * 0.5;
      raZ += dz * extend * 0.5;
      raHandZ += dz * extend * 0.7;
      raHandY = armY - 0.1;
    }

    this.meshes.leftUpperArm.position.set(laX, armY, laZ);
    this.meshes.rightUpperArm.position.set(raX, armY, raZ);
    this.meshes.leftLowerArm.position.set(laX, laHandY, laHandZ);
    this.meshes.rightLowerArm.position.set(raX, raHandY, raHandZ);

    // Legs — walk cycle
    const legY = y - 0.45;
    const legSwing = walk * 0.2;

    let llFootY = legY - 0.3;
    let rlFootY = legY - 0.3;
    let llFootZ = z - legSwing;
    let rlFootZ = z + legSwing;

    // Kick animation (right leg extends)
    if (this.kickTimer > 0) {
      this.kickTimer -= dt;
      const t = Math.max(0, this.kickTimer / 0.3);
      const extend = (t > 0.5 ? (1 - t) : t) * 2;
      rlFootZ += -extend * 0.5;
      rlFootY += extend * 0.2;
    }

    this.meshes.leftUpperLeg.position.set(x - 0.14, legY, z - legSwing * 0.5);
    this.meshes.rightUpperLeg.position.set(x + 0.14, legY, z + legSwing * 0.5);
    this.meshes.leftLowerLeg.position.set(x - 0.14, llFootY, llFootZ);
    this.meshes.rightLowerLeg.position.set(x + 0.14, rlFootY, rlFootZ);
  }

  triggerPunch() { this.punchTimer = 0.3; }
  triggerKick() { this.kickTimer = 0.3; }
  triggerHeadbutt() { this.headbuttTimer = 0.3; }

  getTorso() {
    return this.bodies.torso;
  }

  getHead() {
    return this.bodies.torso; // Head is visual only, use torso for physics
  }

  getPosition() {
    const p = this.bodies.torso.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  destroy() {
    if (this._balanceCallback) {
      this.game.removeOnUpdate(this._balanceCallback);
      this._balanceCallback = null;
    }

    // Remove physics body
    if (this.bodies.torso) {
      this.game.removeSyncPair(this.bodies.torso);
      this.game.world.removeBody(this.bodies.torso);
    }

    // Remove all meshes
    for (const name of Object.keys(this.meshes)) {
      const mesh = this.meshes[name];
      this.game.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    }

    this.bodies = {};
    this.meshes = {};
    this.constraints = [];
  }
}
