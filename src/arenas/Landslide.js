import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class Landslide extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x1a0a00);

    // === MAIN PLATFORM — volcanic rock floor ===
    this.addStaticBox({ x: 24, y: 1, z: 20 }, { x: 0, y: -0.5, z: 0 }, 0x3a3a3a);

    // Lava glow underneath the edges (visual only)
    const lavaGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 26),
      new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.3 })
    );
    lavaGlow.rotation.x = -Math.PI / 2;
    lavaGlow.position.set(0, -1.5, 0);
    game.scene.add(lavaGlow);
    this.meshes.push(lavaGlow);

    // === VOLCANO in the back ===
    // Main cone
    const volcanoGeo = new THREE.ConeGeometry(6, 10, 12);
    const volcanoMat = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a,
      roughness: 0.95,
    });
    const volcanoMesh = new THREE.Mesh(volcanoGeo, volcanoMat);
    volcanoMesh.position.set(0, 4, -16);
    volcanoMesh.castShadow = true;
    game.scene.add(volcanoMesh);
    this.meshes.push(volcanoMesh);

    // Volcano crater (dark hole at top)
    const craterGeo = new THREE.CylinderGeometry(2, 2.5, 1, 12);
    const craterMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00 });
    const craterMesh = new THREE.Mesh(craterGeo, craterMat);
    craterMesh.position.set(0, 9.2, -16);
    game.scene.add(craterMesh);
    this.meshes.push(craterMesh);

    // Lava glow in crater
    this.craterGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2, 16),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 })
    );
    this.craterGlow.rotation.x = -Math.PI / 2;
    this.craterGlow.position.set(0, 9.7, -16);
    game.scene.add(this.craterGlow);
    this.meshes.push(this.craterGlow);

    // Volcano physics (can't walk through it)
    const volcanoBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Cylinder(0.5, 6, 10, 8),
    });
    volcanoBody.position.set(0, 4, -16);
    game.world.addBody(volcanoBody);
    this.bodies.push(volcanoBody);

    // === STEPPED PLATFORM to pressure plate ===
    this.addStaticBox({ x: 4, y: 0.5, z: 3 }, { x: 0, y: 0.25, z: -7 }, 0x555555);
    this.addStaticBox({ x: 3, y: 0.5, z: 2.5 }, { x: 0, y: 0.75, z: -7.5 }, 0x555555);
    this.addStaticBox({ x: 2.5, y: 0.5, z: 2 }, { x: 0, y: 1.25, z: -8 }, 0x555555);

    // === PRESSURE PLATE ===
    const plateMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.15, 16),
      new THREE.MeshStandardMaterial({
        color: 0xff6600,
        metalness: 0.6,
        emissive: 0xff2200,
        emissiveIntensity: 0.5,
      })
    );
    plateMesh.position.set(0, 1.58, -8);
    plateMesh.castShadow = true;
    game.scene.add(plateMesh);
    this.meshes.push(plateMesh);
    this.plateMesh = plateMesh;
    this.platePosition = { x: 0, y: 1.58, z: -8 };
    this.plateRadius = 1.0;
    this.plateTriggered = false;
    this.plateResetTimer = 0;

    // Glowing ring
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.9, 24),
      new THREE.MeshBasicMaterial({ color: 0xff6600, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 1.56, -8);
    game.scene.add(ringMesh);
    this.meshes.push(ringMesh);
    this.ringMesh = ringMesh;

    // === LAVA ROCKS — glowing orange/red projectiles ===
    this.rocks = [];
    this.rockMeshes = [];
    this.eruptionActive = false;
    this.eruptionTimer = 0;
    this.rockBurnCooldowns = new Map(); // track per-player burn cooldown

    const lavaColors = [0xff4400, 0xff6600, 0xff2200, 0xcc3300, 0xff5500];
    const rockShape = new CANNON.Sphere(0.3);

    for (let i = 0; i < 60; i++) {
      const body = new CANNON.Body({
        mass: 3,
        shape: rockShape,
        linearDamping: 0.05,
      });
      body.position.set(0, 100 + i, 0);
      body.sleep();
      game.world.addBody(body);

      const size = 0.25 + Math.random() * 0.2;
      const color = lavaColors[i % lavaColors.length];
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 1),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.5,
          roughness: 0.3,
        })
      );
      mesh.castShadow = true;
      mesh.visible = false;
      game.scene.add(mesh);

      // Add a point light to some rocks for glow effect
      if (i % 5 === 0) {
        const light = new THREE.PointLight(0xff4400, 0.5, 5);
        mesh.add(light);
      }

      this.rocks.push(body);
      this.rockMeshes.push(mesh);
      this.bodies.push(body);
      this.meshes.push(mesh);
    }

    this.rockDropIndex = 0;
    this.rockDropTimer = 0;

    // === AMBIENT LIGHTING — warm volcanic ===
    const lavaLight = new THREE.PointLight(0xff4400, 1, 30);
    lavaLight.position.set(0, 10, -16);
    game.scene.add(lavaLight);
    this.meshes.push(lavaLight);
    this.lavaLight = lavaLight;

    // Orange fog effect
    game.scene.fog = new THREE.FogExp2(0x1a0800, 0.015);
  }

  triggerEruption() {
    if (this.eruptionActive) return;
    this.eruptionActive = true;
    this.eruptionTimer = 0;
    this.rockDropIndex = 0;
    this.rockDropTimer = 0;

    // Flash plate and crater
    this.plateMesh.material.emissiveIntensity = 3;
    this.craterGlow.material.opacity = 1;
    this.lavaLight.intensity = 3;

    this._rumbleTimer = 1.5;
  }

  resetPlate() {
    this.plateTriggered = false;
    this.plateMesh.material.emissiveIntensity = 0.5;
    this.ringMesh.material.color.setHex(0xff6600);
  }

  update(dt) {
    super.update(dt);

    // === Crater glow pulse ===
    this.craterGlow.material.opacity = 0.6 + Math.sin(performance.now() * 0.003) * 0.2;

    // === CHECK PRESSURE PLATE ===
    if (!this.plateTriggered) {
      const allPlayers = this.game._allPlayers || [];
      for (const p of allPlayers) {
        if (!p.alive) continue;
        const pos = p.ragdoll.getPosition();
        const dx = pos.x - this.platePosition.x;
        const dz = pos.z - this.platePosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < this.plateRadius && pos.y > 1.0 && pos.y < 3.0) {
          this.plateTriggered = true;
          this.triggerEruption();
          break;
        }
      }

      // Pulse ring
      const pulse = 0.5 + Math.sin(performance.now() * 0.005) * 0.5;
      this.ringMesh.material.opacity = pulse;
    }

    // === ERUPTION — launch lava rocks from volcano crater ===
    if (this.eruptionActive) {
      this.eruptionTimer += dt;
      this.rockDropTimer += dt;

      const dropInterval = 0.08;
      while (this.rockDropTimer >= dropInterval && this.rockDropIndex < this.rocks.length) {
        const rock = this.rocks[this.rockDropIndex];
        const mesh = this.rockMeshes[this.rockDropIndex];

        // Launch from volcano crater
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.random() * 1;
        rock.position.set(
          Math.cos(angle) * spread,
          9 + Math.random() * 1,
          -16 + Math.sin(angle) * spread
        );

        // Target: land on the platform, away from the pressure plate
        // Platform center at origin, plate at z=-8
        // Aim for z: -4 to +8, x: -6 to +6
        const landX = (Math.random() - 0.5) * 12;
        const landZ = -4 + Math.random() * 12;

        // Simple arc: low upward velocity, forward toward target
        const flightTime = 1.2 + Math.random() * 0.4;
        rock.velocity.set(
          landX / flightTime,
          4 + Math.random() * 2,
          (landZ + 16) / flightTime
        );
        rock.angularVelocity.set(
          Math.random() * 8, Math.random() * 8, Math.random() * 8
        );
        rock.wakeUp();
        mesh.visible = true;

        this.rockDropIndex++;
        this.rockDropTimer -= dropInterval;
      }

      // Sync rock meshes
      for (let i = 0; i < this.rockDropIndex; i++) {
        const rock = this.rocks[i];
        const mesh = this.rockMeshes[i];
        mesh.position.copy(rock.position);
        mesh.quaternion.copy(rock.quaternion);
      }

      // === BURN CHECK — lava rocks damage players on contact ===
      this._checkBurns(dt);

      // Fade lava light back down
      if (this.eruptionTimer > 2) {
        this.lavaLight.intensity = Math.max(1, 3 - (this.eruptionTimer - 2) * 0.5);
      }

      // End eruption after rocks settle
      if (this.rockDropIndex >= this.rocks.length && this.eruptionTimer > 10) {
        this.eruptionActive = false;
        this.plateResetTimer = 4;

        // Clean up fallen rocks
        for (let i = 0; i < this.rocks.length; i++) {
          const rock = this.rocks[i];
          const mesh = this.rockMeshes[i];
          if (rock.position.y < -5) {
            rock.position.set(0, 100 + i, 0);
            rock.velocity.set(0, 0, 0);
            rock.sleep();
            mesh.visible = false;
          }
        }
        this.lavaLight.intensity = 1;
      }
    } else {
      // Sync visible rocks still on platform
      for (let i = 0; i < this.rocks.length; i++) {
        const mesh = this.rockMeshes[i];
        if (mesh.visible) {
          const rock = this.rocks[i];
          mesh.position.copy(rock.position);
          mesh.quaternion.copy(rock.quaternion);
          if (rock.position.y < -10) {
            rock.position.set(0, 100 + i, 0);
            rock.velocity.set(0, 0, 0);
            rock.sleep();
            mesh.visible = false;
          }
        }
      }
      // Still check burns for rocks sitting on the platform
      this._checkBurns(dt);
    }

    // === PLATE RESET ===
    if (this.plateResetTimer > 0) {
      this.plateResetTimer -= dt;
      if (this.plateResetTimer <= 0) {
        this.resetPlate();
      }
    }

    // === CAMERA RUMBLE ===
    if (this._rumbleTimer > 0) {
      this._rumbleTimer -= dt;
      const intensity = Math.min(this._rumbleTimer, 0.5);
      const cam = this.game.camera;
      cam.position.x += (Math.random() - 0.5) * intensity * 0.3;
      cam.position.y += (Math.random() - 0.5) * intensity * 0.15;
    }
  }

  _checkBurns(dt) {
    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.alive || !p.ragdoll) continue;
      const pPos = p.ragdoll.getTorso().position;

      // Cooldown per player — can only burn once per second
      const lastBurn = this.rockBurnCooldowns.get(p) || 0;
      if (performance.now() - lastBurn < 1000) continue;

      for (let i = 0; i < this.rocks.length; i++) {
        const mesh = this.rockMeshes[i];
        if (!mesh.visible) continue;
        const rock = this.rocks[i];

        const dx = pPos.x - rock.position.x;
        const dy = pPos.y - rock.position.y;
        const dz = pPos.z - rock.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 1.0) {
          // BURN! 30% damage
          p.ragdoll.balance.takeDamage(30);
          this.rockBurnCooldowns.set(p, performance.now());

          // Knockback away from rock
          const knockDir = new CANNON.Vec3(dx, 0.5, dz);
          if (knockDir.length() > 0.01) knockDir.normalize();
          const knockMult = p.ragdoll.balance.getKnockbackMultiplier();
          p.ragdoll.getTorso().applyImpulse(new CANNON.Vec3(
            knockDir.x * 15 * knockMult,
            knockDir.y * 10 * knockMult,
            knockDir.z * 15 * knockMult
          ));

          break; // Only one burn per frame per player
        }
      }
    }
  }
}
