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

    // === MAIN BODY: Sphere physics body ===
    // Sphere slides much better on ground than cylinder (no flat contact patch)
    const characterMaterial = new CANNON.Material('character');
    characterMaterial.friction = 0.0;
    characterMaterial.restitution = 0.0;
    const mainBody = new CANNON.Body({
      mass: 5,
      linearDamping: 0.05, // Low overall damping — horizontal damping done manually in controller
      angularDamping: 0.99,
      fixedRotation: true,
      material: characterMaterial,
    });
    // Two spheres stacked to approximate a capsule shape
    mainBody.addShape(new CANNON.Sphere(0.35), new CANNON.Vec3(0, 0.2, 0));
    mainBody.addShape(new CANNON.Sphere(0.35), new CANNON.Vec3(0, -0.2, 0));
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

    // Head mesh — with eyes as children
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      mat.clone()
    );
    headMesh.castShadow = true;

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEye.position.set(-0.1, 0.08, -0.24);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0, 0, -0.03);
    leftEye.add(leftPupil);
    headMesh.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEye.position.set(0.1, 0.08, -0.24);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0, 0, -0.03);
    rightEye.add(rightPupil);
    headMesh.add(rightEye);

    game.scene.add(headMesh);
    this.meshes.head = headMesh;

    // Facing direction (smoothed)
    this.facingAngle = 0;

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

    // Face toward nearest enemy
    const allPlayers = this.game._allPlayers || [];
    let nearestDist = Infinity;
    let targetX = x;
    let targetZ = z - 1; // default: face forward (negative Z)
    for (const p of allPlayers) {
      if (!p.ragdoll || p.ragdoll === this || !p.alive) continue;
      const ePos = p.ragdoll.getPosition();
      const dx = ePos.x - x;
      const dz = ePos.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist && dist > 0.1) {
        nearestDist = dist;
        targetX = ePos.x;
        targetZ = ePos.z;
      }
    }

    const targetAngle = Math.atan2(targetX - x, targetZ - z);
    // Smooth rotation
    let angleDiff = targetAngle - this.facingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.facingAngle += angleDiff * 0.1;

    const cos = Math.cos(this.facingAngle);
    const sin = Math.sin(this.facingAngle);

    // Head — bobs slightly, rotates to face enemy
    this.meshes.head.position.set(x, y + 0.65 + Math.abs(walk) * 0.02, z);
    this.meshes.head.rotation.y = this.facingAngle;

    // Headbutt animation
    if (this.headbuttTimer > 0) {
      this.headbuttTimer -= dt;
      const t = Math.max(0, this.headbuttTimer / 0.3);
      this.meshes.head.position.z += (t > 0.5 ? (1 - t) : t) * -0.4;
      this.meshes.head.position.y -= (t > 0.5 ? (1 - t) : t) * 0.15;
    }

    // Arms — positioned relative to facing direction
    const armSwing = walk * 0.15;
    const armY = y + 0.15;

    // Side direction (perpendicular to facing)
    const sideX = cos;  // perpendicular to facing
    const sideZ = -sin;

    // Left arm (left side of character)
    let laX = x - sideX * 0.38;
    let laZ = z - sideZ * 0.38;
    let laHandX = laX;
    let laHandZ = laZ;
    let laHandY = armY - 0.3;

    // Right arm (right side)
    let raX = x + sideX * 0.38;
    let raZ = z + sideZ * 0.38;
    let raHandX = raX;
    let raHandZ = raZ;
    let raHandY = armY - 0.3;

    // Punch animation — extends right arm toward enemy
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      const t = Math.max(0, this.punchTimer / 0.3);
      const extend = (t > 0.5 ? (1 - t) : t) * 2;
      raX += sin * extend * 0.5;
      raZ += cos * extend * 0.5;
      raHandX = raX + sin * extend * 0.3;
      raHandZ = raZ + cos * extend * 0.3;
      raHandY = armY - 0.1;
    }

    this.meshes.leftUpperArm.position.set(laX, armY, laZ);
    this.meshes.rightUpperArm.position.set(raX, armY, raZ);
    this.meshes.leftLowerArm.position.set(laHandX, laHandY, laHandZ);
    this.meshes.rightLowerArm.position.set(raHandX, raHandY, raHandZ);

    // Legs — walk cycle relative to facing
    const legY = y - 0.45;
    const legSwing = walk * 0.2;

    // Left leg
    const llX = x - sideX * 0.14;
    const llZ = z - sideZ * 0.14;
    let llFootX = llX - sin * legSwing;
    let llFootZ2 = llZ - cos * legSwing;
    let llFootY = legY - 0.3;

    // Right leg
    const rlX = x + sideX * 0.14;
    const rlZ = z + sideZ * 0.14;
    let rlFootX = rlX + sin * legSwing;
    let rlFootZ2 = rlZ + cos * legSwing;
    let rlFootY = legY - 0.3;

    // Kick animation — right leg extends forward
    if (this.kickTimer > 0) {
      this.kickTimer -= dt;
      const t = Math.max(0, this.kickTimer / 0.3);
      const extend = (t > 0.5 ? (1 - t) : t) * 2;
      rlFootX += sin * extend * 0.5;
      rlFootZ2 += cos * extend * 0.5;
      rlFootY += extend * 0.2;
    }

    this.meshes.leftUpperLeg.position.set(llX, legY, llZ);
    this.meshes.rightUpperLeg.position.set(rlX, legY, rlZ);
    this.meshes.leftLowerLeg.position.set(llFootX, llFootY, llFootZ2);
    this.meshes.rightLowerLeg.position.set(rlFootX, rlFootY, rlFootZ2);
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
