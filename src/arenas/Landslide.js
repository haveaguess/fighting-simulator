import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class Landslide extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x3a2a1a);

    // === MAIN PLATFORM — wide canyon floor ===
    this.addStaticBox({ x: 24, y: 1, z: 20 }, { x: 0, y: -0.5, z: 0 }, 0x8B7355);

    // === CLIFF WALLS on sides (canyon feel) ===
    // Left cliff
    this.addStaticBox({ x: 2, y: 8, z: 20 }, { x: -13, y: 3, z: 0 }, 0x6B5B45);
    // Right cliff
    this.addStaticBox({ x: 2, y: 8, z: 20 }, { x: 13, y: 3, z: 0 }, 0x6B5B45);

    // === STEPPED PLATFORM leading up to pressure plate ===
    // Step 1
    this.addStaticBox({ x: 4, y: 0.5, z: 4 }, { x: 0, y: 0.25, z: -7 }, 0x7A6A52);
    // Step 2
    this.addStaticBox({ x: 3.5, y: 0.5, z: 3.5 }, { x: 0, y: 0.75, z: -7 }, 0x7A6A52);
    // Step 3 (top) — pressure plate sits here
    this.addStaticBox({ x: 3, y: 0.5, z: 3 }, { x: 0, y: 1.25, z: -7 }, 0x7A6A52);

    // === PRESSURE PLATE on top of steps ===
    const plateMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.15, 16),
      new THREE.MeshStandardMaterial({ color: 0xdd4444, metalness: 0.6, emissive: 0x441111 })
    );
    plateMesh.position.set(0, 1.58, -7);
    plateMesh.castShadow = true;
    game.scene.add(plateMesh);
    this.meshes.push(plateMesh);
    this.plateMesh = plateMesh;
    this.platePosition = { x: 0, y: 1.58, z: -7 };
    this.plateRadius = 1.0;
    this.plateTriggered = false;
    this.plateResetTimer = 0;

    // Glowing ring around plate
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.9, 24),
      new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 1.56, -7);
    game.scene.add(ringMesh);
    this.meshes.push(ringMesh);
    this.ringMesh = ringMesh;

    // === LANDSLIDE ROCKS — pre-created, hidden above the cliffs ===
    this.rocks = [];
    this.rockMeshes = [];
    this.landslideActive = false;
    this.landslideTimer = 0;

    const rockColors = [0x8B7355, 0x6B5B45, 0x9B8B6B, 0x7A6A52, 0x5C4E3C];
    const rockShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3));
    const smallRockShape = new CANNON.Sphere(0.25);

    // Create a pool of 80 rocks, stored high up and sleeping
    for (let i = 0; i < 80; i++) {
      const useBox = Math.random() > 0.4;
      const shape = useBox ? rockShape : smallRockShape;
      const size = 0.3 + Math.random() * 0.3;

      const body = new CANNON.Body({
        mass: 2 + Math.random() * 3,
        shape,
        linearDamping: 0.1,
      });
      // Park them way above, out of sight
      body.position.set(0, 100 + i, 0);
      body.sleep();
      game.world.addBody(body);

      const geo = useBox
        ? new THREE.BoxGeometry(size, size, size)
        : new THREE.SphereGeometry(size * 0.8, 6, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: rockColors[i % rockColors.length],
        roughness: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      game.scene.add(mesh);

      this.rocks.push(body);
      this.rockMeshes.push(mesh);
      this.bodies.push(body);
      this.meshes.push(mesh);
    }

    // Track how many rocks have been dropped
    this.rockDropIndex = 0;
    this.rockDropTimer = 0;

    // === AMBIENT: scattered boulders for decoration ===
    for (let i = 0; i < 10; i++) {
      const bx = (Math.random() - 0.5) * 20;
      const bz = (Math.random() - 0.5) * 16;
      const bs = 0.4 + Math.random() * 0.6;
      const bMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(bs, 0),
        new THREE.MeshStandardMaterial({
          color: rockColors[i % rockColors.length],
          roughness: 0.95,
        })
      );
      bMesh.position.set(bx, bs * 0.5, bz);
      bMesh.rotation.set(Math.random(), Math.random(), Math.random());
      bMesh.castShadow = true;
      game.scene.add(bMesh);
      this.meshes.push(bMesh);
    }

    // === Warning sign near plate ===
    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    signMesh.position.set(-2.5, 1.5, -7);
    signMesh.rotation.y = 0.3;
    game.scene.add(signMesh);
    this.meshes.push(signMesh);

    // Sign post
    const postMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.5, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x554433 })
    );
    postMesh.position.set(-2.5, 0.75, -7);
    game.scene.add(postMesh);
    this.meshes.push(postMesh);
  }

  triggerLandslide() {
    if (this.landslideActive) return;
    this.landslideActive = true;
    this.landslideTimer = 0;
    this.rockDropIndex = 0;
    this.rockDropTimer = 0;

    // Flash the plate
    this.plateMesh.material.emissive.setHex(0xff2222);
    this.plateMesh.material.emissiveIntensity = 2;

    // Rumble effect — shake camera slightly (handled by game loop)
    this._rumbleTimer = 0.5;
  }

  resetPlate() {
    this.plateTriggered = false;
    this.plateMesh.material.emissive.setHex(0x441111);
    this.plateMesh.material.emissiveIntensity = 1;
    this.ringMesh.material.color.setHex(0xff4444);
  }

  update(dt) {
    super.update(dt);

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
          this.triggerLandslide();
          break;
        }
      }

      // Pulse the ring when not triggered
      const pulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.3;
      this.ringMesh.material.opacity = pulse;
    }

    // === LANDSLIDE — drop rocks from both cliff sides ===
    if (this.landslideActive) {
      this.landslideTimer += dt;
      this.rockDropTimer += dt;

      // Drop rocks one/two at a time over ~4 seconds
      const dropInterval = 0.05; // very fast drops
      while (this.rockDropTimer >= dropInterval && this.rockDropIndex < this.rocks.length) {
        const rock = this.rocks[this.rockDropIndex];
        const mesh = this.rockMeshes[this.rockDropIndex];

        // Alternate from left and right cliff sides
        const fromLeft = this.rockDropIndex % 2 === 0;
        const x = fromLeft
          ? -11 + Math.random() * 4
          : 7 + Math.random() * 4;
        const y = 8 + Math.random() * 5;
        const z = (Math.random() - 0.5) * 16;

        rock.position.set(x, y, z);
        rock.velocity.set(
          fromLeft ? 3 + Math.random() * 4 : -3 - Math.random() * 4,
          -2 - Math.random() * 3,
          (Math.random() - 0.5) * 3
        );
        rock.angularVelocity.set(
          Math.random() * 5, Math.random() * 5, Math.random() * 5
        );
        rock.wakeUp();
        mesh.visible = true;

        this.rockDropIndex++;
        this.rockDropTimer -= dropInterval;
      }

      // Sync rock meshes to physics
      for (let i = 0; i < this.rockDropIndex; i++) {
        const rock = this.rocks[i];
        const mesh = this.rockMeshes[i];
        mesh.position.copy(rock.position);
        mesh.quaternion.copy(rock.quaternion);
      }

      // After all rocks dropped and settled, allow re-trigger
      if (this.rockDropIndex >= this.rocks.length && this.landslideTimer > 8) {
        this.landslideActive = false;
        this.plateResetTimer = 3;

        // Put rocks to sleep and hide them
        for (let i = 0; i < this.rocks.length; i++) {
          const rock = this.rocks[i];
          const mesh = this.rockMeshes[i];
          // Only hide rocks that fell off the platform
          if (rock.position.y < -5) {
            rock.position.set(0, 100 + i, 0);
            rock.velocity.set(0, 0, 0);
            rock.sleep();
            mesh.visible = false;
          }
        }
      }
    } else {
      // Still sync visible rocks that are on the platform
      for (let i = 0; i < this.rocks.length; i++) {
        const mesh = this.rockMeshes[i];
        if (mesh.visible) {
          const rock = this.rocks[i];
          mesh.position.copy(rock.position);
          mesh.quaternion.copy(rock.quaternion);
          // Clean up rocks that fell off
          if (rock.position.y < -10) {
            rock.position.set(0, 100 + i, 0);
            rock.velocity.set(0, 0, 0);
            rock.sleep();
            mesh.visible = false;
          }
        }
      }
    }

    // === PLATE RESET TIMER ===
    if (this.plateResetTimer > 0) {
      this.plateResetTimer -= dt;
      if (this.plateResetTimer <= 0) {
        this.resetPlate();
      }
    }

    // === CAMERA RUMBLE ===
    if (this._rumbleTimer > 0) {
      this._rumbleTimer -= dt;
      const cam = this.game.camera;
      cam.position.x += (Math.random() - 0.5) * 0.1;
      cam.position.y += (Math.random() - 0.5) * 0.05;
    }
  }
}
