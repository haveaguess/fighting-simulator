import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BalanceSystem } from './BalanceSystem.js';

export class Ragdoll {
  constructor(game, position, color, scale = 1.0) {
    this.game = game;
    this.bodies = {};
    this.meshes = {};
    this.constraints = [];
    this.color = color;
    this.scale = scale;

    const s = scale;
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
      mass: 5 * s * s,
      linearDamping: 0.05, // Low overall damping — horizontal damping done manually in controller
      angularDamping: 0.99,
      fixedRotation: true,
      material: characterMaterial,
    });
    // Two spheres stacked to approximate a capsule shape
    mainBody.addShape(new CANNON.Sphere(0.35 * s), new CANNON.Vec3(0, 0.2 * s, 0));
    mainBody.addShape(new CANNON.Sphere(0.35 * s), new CANNON.Vec3(0, -0.2 * s, 0));
    mainBody.position.set(px, py, pz);
    game.world.addBody(mainBody);
    this.bodies.torso = mainBody;

    // === VISUAL MESHES (no physics, just follow the main body) ===
    // Torso mesh
    const torsoMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3 * s, 0.5 * s, 8, 16),
      mat.clone()
    );
    torsoMesh.castShadow = true;
    game.scene.add(torsoMesh);
    this.meshes.torso = torsoMesh;

    // Head mesh — with eyes as children
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 * s, 16, 16),
      mat.clone()
    );
    headMesh.castShadow = true;

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06 * s, 8, 8);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.035 * s, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEye.position.set(-0.1 * s, 0.08 * s, 0.24 * s);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0, 0, 0.03 * s);
    leftEye.add(leftPupil);
    headMesh.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEye.position.set(0.1 * s, 0.08 * s, 0.24 * s);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0, 0, 0.03 * s);
    rightEye.add(rightPupil);
    headMesh.add(rightEye);

    game.scene.add(headMesh);
    this.meshes.head = headMesh;

    // Facing direction (smoothed)
    this.facingAngle = 0;
    this.grabTarget = null; // set by controller when grabbing
    this.grabReaching = false; // true when grab button held but not connected yet

    // Arms
    const armMat = mat.clone();
    const handGeo = new THREE.SphereGeometry(0.09 * s, 8, 8);

    this.meshes.leftUpperArm = this._addMesh(new THREE.CapsuleGeometry(0.09 * s, 0.2 * s, 4, 8), armMat);
    this.meshes.rightUpperArm = this._addMesh(new THREE.CapsuleGeometry(0.09 * s, 0.2 * s, 4, 8), armMat);
    this.meshes.leftLowerArm = this._addMesh(handGeo, armMat);
    this.meshes.rightLowerArm = this._addMesh(handGeo, armMat);

    // Legs
    const legMat = mat.clone();
    this.meshes.leftUpperLeg = this._addMesh(new THREE.CapsuleGeometry(0.1 * s, 0.22 * s, 4, 8), legMat);
    this.meshes.rightUpperLeg = this._addMesh(new THREE.CapsuleGeometry(0.1 * s, 0.22 * s, 4, 8), legMat);
    this.meshes.leftLowerLeg = this._addMesh(new THREE.CapsuleGeometry(0.09 * s, 0.2 * s, 4, 8), legMat);
    this.meshes.rightLowerLeg = this._addMesh(new THREE.CapsuleGeometry(0.09 * s, 0.2 * s, 4, 8), legMat);

    // Add torso to sync pairs for physics sync
    game.addSyncPair(mainBody, torsoMesh);

    // Animation state
    this.walkPhase = 0;
    this.punchTimer = 0; // >0 means punching
    this.kickTimer = 0;
    this.headbuttTimer = 0;

    // Floating health bar above head
    this.healthBarGroup = new THREE.Group();
    const barWidth = 0.6;
    const barHeight = 0.07;
    // Background (dark)
    const bgGeo = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.healthBarGroup.add(bgMesh);
    // Fill (green → red based on damage)
    const fillGeo = new THREE.PlaneGeometry(barWidth, barHeight);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide });
    this.healthBarFill = new THREE.Mesh(fillGeo, fillMat);
    this.healthBarGroup.add(this.healthBarFill);
    game.scene.add(this.healthBarGroup);
    this.meshes._healthBar = this.healthBarGroup;

    // Mount timer bar (above health bar, only visible when riding someone's back)
    this.mountBarGroup = new THREE.Group();
    const mountBarWidth = 0.6;
    const mountBarHeight = 0.06;
    const mountBgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mountBarWidth, mountBarHeight),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    this.mountBarGroup.add(mountBgMesh);
    this.mountBarFill = new THREE.Mesh(
      new THREE.PlaneGeometry(mountBarWidth, mountBarHeight),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide })
    );
    this.mountBarGroup.add(this.mountBarFill);
    this.mountBarGroup.visible = false;
    game.scene.add(this.mountBarGroup);
    this.meshes._mountBar = this.mountBarGroup;

    // Mount state (set by CharacterController)
    this.mountProgress = 0; // 0 = just mounted, 1 = about to be thrown off

    // Name label above health bar (daddy mode only)
    this.nameSprite = null;
    this.playerName = null;
    if (window.__daddyMode) {
      const names = [
        'Teri', 'Andy', 'Andrew', 'Quynh', 'Ben', 'Alan', 'Kerem', 'Kaius',
        'Deborah', 'Vuong', 'Charlotte', 'Jan', 'Billy', 'William', 'Rose',
        'Abey', 'Emmeline', 'Gabriel',
      ];
      this.playerName = names[Math.floor(Math.random() * names.length)];
      this.nameSprite = this._createNameSprite(this.playerName);
      game.scene.add(this.nameSprite);
      this.meshes._nameSprite = this.nameSprite;
    }

    // Celebration state
    this.celebrating = false;
    this.celebrateTimer = 0;

    // Smile mesh (hidden until celebrating) — a curved line on the face
    const smileShape = new THREE.Shape();
    smileShape.absarc(0, 0, 0.1 * s, Math.PI * 1.15, Math.PI * 1.85, false);
    smileShape.absarc(0, 0, 0.07 * s, Math.PI * 1.85, Math.PI * 1.15, true);
    const smileGeo = new THREE.ShapeGeometry(smileShape);
    const smileMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    this.smileMesh = new THREE.Mesh(smileGeo, smileMat);
    this.smileMesh.position.set(0, -0.05 * s, 0.29 * s);
    this.smileMesh.visible = false;
    headMesh.add(this.smileMesh);

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

  _createNameSprite(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 8;
    ctx.strokeText(name, 256, 64);
    ctx.fillText(name, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.0, 0.5, 1);
    return sprite;
  }

  onHit() {
    this.voiceManager?.playHit();
    // Randomly fart or laugh when hit (daddy mode only)
    if (!window.__daddyMode) return;
    const audio = this.game._audio;
    if (!audio) return;
    const roll = Math.random();
    if (roll < 0.3) {
      // Fart
      audio.playTone(0.15, 80, 'sawtooth', -30, 0.2);
      audio.playNoise(0.1, 100, 40, 0.15);
    } else if (roll < 0.5) {
      // Laugh — quick ascending chirps
      for (let i = 0; i < 3; i++) {
        setTimeout(() => audio.playTone(0.06, 400 + i * 100 + Math.random() * 100, 'sine', 200, 0.12), i * 80);
      }
    }
  }

  _animateLimbs(dt) {
    const body = this.bodies.torso;
    if (!body) return;
    const s = this.scale;

    const x = body.position.x;
    const y = body.position.y;
    const z = body.position.z;

    // Update voice panning based on world position
    if (this.voiceManager) this.voiceManager.setPan(x);

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

    // Celebration bounce
    let celebBounce = 0;
    if (this.celebrating) {
      this.celebrateTimer += dt;
      celebBounce = Math.abs(Math.sin(this.celebrateTimer * 6)) * 0.3;
      // Small hop via physics
      if (body.position.y < 0.8 * s && Math.sin(this.celebrateTimer * 6) > 0.95) {
        body.velocity.y = 3;
      }
    }

    // Torso (synced by Game via syncPair, but we add a slight bob)
    this.meshes.torso.position.set(x, y + Math.abs(walk) * 0.03 * s + celebBounce * 0.05 * s, z);

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
    this.meshes.head.position.set(x, y + 0.65 * s + Math.abs(walk) * 0.02 * s, z);
    this.meshes.head.rotation.y = this.facingAngle;

    // Headbutt animation — lunge toward enemy (using facing direction)
    if (this.headbuttTimer > 0) {
      this.headbuttTimer -= dt;
      const t = Math.max(0, this.headbuttTimer / 0.3);
      const extend = (t > 0.5 ? (1 - t) : t);
      this.meshes.head.position.x += sin * extend * 0.4 * s;
      this.meshes.head.position.z += cos * extend * 0.4 * s;
      this.meshes.head.position.y -= extend * 0.15 * s;
    }

    // Arms — positioned relative to facing direction
    const armSwing = walk * 0.15 * s;
    const armY = y + 0.15 * s;

    // Side direction (perpendicular to facing)
    const sideX = cos;
    const sideZ = -sin;

    // Left arm (left side of character) — extends to grab target when holding
    let laX = x - sideX * 0.38 * s;
    let laZ = z - sideZ * 0.38 * s;
    let laHandX = laX;
    let laHandZ = laZ;
    let laHandY = armY - 0.3 * s;

    if (this.grabTarget) {
      // Extend left arm toward grabbed enemy
      const gx = this.grabTarget.x;
      const gz = this.grabTarget.z;
      const gdx = gx - x;
      const gdz = gz - z;
      const gLen = Math.sqrt(gdx * gdx + gdz * gdz);
      if (gLen > 0.01) {
        const gnx = gdx / gLen;
        const gnz = gdz / gLen;
        laX = x + gnx * 0.3 * s;
        laZ = z + gnz * 0.3 * s;
        laHandX = x + gnx * 0.55 * s;
        laHandZ = z + gnz * 0.55 * s;
        laHandY = armY - 0.05 * s;
      }
    } else if (this.grabReaching) {
      // Reaching out to grab — extend left arm forward (toward facing direction)
      laX = x + sin * 0.35 * s;
      laZ = z + cos * 0.35 * s;
      laHandX = x + sin * 0.6 * s;
      laHandZ = z + cos * 0.6 * s;
      laHandY = armY - 0.05 * s;
    }

    // Right arm (right side)
    let raX = x + sideX * 0.38 * s;
    let raZ = z + sideZ * 0.38 * s;
    let raHandX = raX;
    let raHandZ = raZ;
    let raHandY = armY - 0.3 * s;

    // Celebration override — both arms up, waving
    if (this.celebrating) {
      const wave = Math.sin(this.celebrateTimer * 8) * 0.15 * s;
      // Left arm up
      laX = x - sideX * 0.35 * s;
      laZ = z - sideZ * 0.35 * s;
      laHandX = x - sideX * 0.4 * s + wave;
      laHandZ = z - sideZ * 0.4 * s;
      laHandY = armY + 0.6 * s + Math.abs(wave);
      // Right arm up
      raX = x + sideX * 0.35 * s;
      raZ = z + sideZ * 0.35 * s;
      raHandX = x + sideX * 0.4 * s - wave;
      raHandZ = z + sideZ * 0.4 * s;
      raHandY = armY + 0.6 * s + Math.abs(wave);
    }

    // Punch animation — extends right arm toward enemy
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      const t = Math.max(0, this.punchTimer / 0.3);
      const extend = (t > 0.5 ? (1 - t) : t) * 2;
      raX += sin * extend * 0.5 * s;
      raZ += cos * extend * 0.5 * s;
      raHandX = raX + sin * extend * 0.3 * s;
      raHandZ = raZ + cos * extend * 0.3 * s;
      raHandY = armY - 0.1 * s;
    }

    this.meshes.leftUpperArm.position.set(laX, this.celebrating ? armY + 0.35 * s : armY, laZ);
    this.meshes.rightUpperArm.position.set(raX, this.celebrating ? armY + 0.35 * s : armY, raZ);
    this.meshes.leftLowerArm.position.set(laHandX, laHandY, laHandZ);
    this.meshes.rightLowerArm.position.set(raHandX, raHandY, raHandZ);

    // Legs — walk cycle relative to facing
    const legY = y - 0.25 * s;
    const legSwing = walk * 0.2 * s;

    // Left leg
    const llX = x - sideX * 0.14 * s;
    const llZ = z - sideZ * 0.14 * s;
    let llFootX = llX - sin * legSwing;
    let llFootZ2 = llZ - cos * legSwing;
    let llFootY = legY - 0.2 * s;

    // Right leg
    const rlX = x + sideX * 0.14 * s;
    const rlZ = z + sideZ * 0.14 * s;
    let rlFootX = rlX + sin * legSwing;
    let rlFootZ2 = rlZ + cos * legSwing;
    let rlFootY = legY - 0.2 * s;

    // Kick animation — right leg extends forward
    if (this.kickTimer > 0) {
      this.kickTimer -= dt;
      const t = Math.max(0, this.kickTimer / 0.3);
      const extend = (t > 0.5 ? (1 - t) : t) * 2;
      rlFootX += sin * extend * 0.5 * s;
      rlFootZ2 += cos * extend * 0.5 * s;
      rlFootY += extend * 0.2 * s;
    }

    this.meshes.leftUpperLeg.position.set(llX, legY, llZ);
    this.meshes.rightUpperLeg.position.set(rlX, legY, rlZ);
    this.meshes.leftLowerLeg.position.set(llFootX, llFootY, llFootZ2);
    this.meshes.rightLowerLeg.position.set(rlFootX, rlFootY, rlFootZ2);

    // Health bar — float above head, always face camera
    if (this.healthBarGroup) {
      this.healthBarGroup.position.set(x, y + 1.0 * s, z);
      // Name above health bar
      if (this.nameSprite) {
        this.nameSprite.position.set(x, y + 1.3 * s, z);
      }
      // Billboard — face camera
      const cam = this.game.camera;
      if (cam) {
        this.healthBarGroup.quaternion.copy(cam.quaternion);
      }
      // Scale fill by health (1 = full, 0 = empty)
      const hp = 1 - this.balance.getDamagePercent();
      this.healthBarFill.scale.x = Math.max(hp, 0.01);
      // Offset fill so it shrinks from right
      this.healthBarFill.position.x = -(1 - hp) * 0.3;
      // Color: green → yellow → red
      if (hp > 0.5) {
        this.healthBarFill.material.color.setHex(0x44ff44);
      } else if (hp > 0.25) {
        this.healthBarFill.material.color.setHex(0xffaa00);
      } else {
        this.healthBarFill.material.color.setHex(0xff2222);
      }
    }

    // Mount timer bar — above health bar, visible when riding
    if (this.mountBarGroup) {
      if (this.mountProgress > 0 && this.mountProgress < 1) {
        this.mountBarGroup.visible = true;
        this.mountBarGroup.position.set(x, y + 1.15 * s, z);
        if (cam) this.mountBarGroup.quaternion.copy(cam.quaternion);
        const remaining = 1 - this.mountProgress;
        this.mountBarFill.scale.x = Math.max(remaining, 0.01);
        this.mountBarFill.position.x = -(1 - remaining) * 0.3;
        // Orange → red as time runs out
        if (remaining > 0.4) {
          this.mountBarFill.material.color.setHex(0xffaa00);
        } else {
          this.mountBarFill.material.color.setHex(0xff3300);
        }
      } else {
        this.mountBarGroup.visible = false;
      }
    }
  }

  triggerPunch() { this.punchTimer = 0.3; }
  triggerKick() { this.kickTimer = 0.3; }
  triggerHeadbutt() { this.headbuttTimer = 0.3; }

  startCelebration() {
    this.celebrating = true;
    this.celebrateTimer = 0;
    this.smileMesh.visible = true;
    this.voiceManager?.playVictory();
  }

  stopCelebration() {
    this.celebrating = false;
    this.smileMesh.visible = false;
  }

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
