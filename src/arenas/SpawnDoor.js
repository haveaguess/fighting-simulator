import * as THREE from 'three';

export class SpawnDoor {
  constructor(game, position, facingAngle = 0) {
    this.game = game;
    this.meshes = [];
    this.openAmount = 0; // 0 = closed, 1 = fully open
    this.targetOpen = 0;
    this.doorSpeed = 3;

    const x = position.x;
    const y = position.y || 0;
    const z = position.z;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x883333, metalness: 0.3 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 });

    // Door frame — archway
    // Left pillar
    const leftPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 2.5, 0.6),
      frameMat
    );
    leftPillar.position.set(x - 1.2, y + 1.25, z);
    leftPillar.castShadow = true;
    game.scene.add(leftPillar);
    this.meshes.push(leftPillar);

    // Right pillar
    const rightPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 2.5, 0.6),
      frameMat
    );
    rightPillar.position.set(x + 1.2, y + 1.25, z);
    rightPillar.castShadow = true;
    game.scene.add(rightPillar);
    this.meshes.push(rightPillar);

    // Top beam
    const topBeam = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.4, 0.6),
      frameMat
    );
    topBeam.position.set(x, y + 2.7, z);
    topBeam.castShadow = true;
    game.scene.add(topBeam);
    this.meshes.push(topBeam);

    // Warning light on top (red sphere)
    const lightMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 })
    );
    lightMesh.position.set(x, y + 3.0, z);
    game.scene.add(lightMesh);
    this.meshes.push(lightMesh);
    this.lightMesh = lightMesh;

    // Back wall (behind the door)
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.5, 0.2),
      wallMat
    );
    backWall.position.set(x, y + 1.25, z + 0.4);
    game.scene.add(backWall);
    this.meshes.push(backWall);

    // Left door panel
    this.leftDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.3, 0.15),
      doorMat.clone()
    );
    this.leftDoor.position.set(x - 0.5, y + 1.15, z);
    this.leftDoor.castShadow = true;
    game.scene.add(this.leftDoor);
    this.meshes.push(this.leftDoor);

    // Right door panel
    this.rightDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.3, 0.15),
      doorMat.clone()
    );
    this.rightDoor.position.set(x + 0.5, y + 1.15, z);
    this.rightDoor.castShadow = true;
    game.scene.add(this.rightDoor);
    this.meshes.push(this.rightDoor);

    // Store base positions for animation
    this.baseX = x;
    this.baseY = y;
    this.baseZ = z;

    // Rotate entire structure to face the right direction
    if (facingAngle !== 0) {
      for (const mesh of this.meshes) {
        const dx = mesh.position.x - x;
        const dz = mesh.position.z - z;
        const cos = Math.cos(facingAngle);
        const sin = Math.sin(facingAngle);
        mesh.position.x = x + dx * cos - dz * sin;
        mesh.position.z = z + dx * sin + dz * cos;
        mesh.rotation.y = facingAngle;
      }
    }
  }

  // Returns the position where enemies should spawn (just in front of the door)
  getSpawnPosition() {
    return { x: this.baseX, y: 1.5, z: this.baseZ - 1.5 };
  }

  open() {
    this.targetOpen = 1;
    // Flash the warning light
    this.lightMesh.material.emissiveIntensity = 2;
  }

  close() {
    this.targetOpen = 0;
    this.lightMesh.material.emissiveIntensity = 0.3;
  }

  update(dt) {
    // Animate door opening/closing
    if (this.openAmount < this.targetOpen) {
      this.openAmount = Math.min(this.openAmount + dt * this.doorSpeed, 1);
    } else if (this.openAmount > this.targetOpen) {
      this.openAmount = Math.max(this.openAmount - dt * this.doorSpeed, 0);
    }

    // Slide door panels apart
    const slide = this.openAmount * 1.0;
    this.leftDoor.position.x = this.baseX - 0.5 - slide;
    this.rightDoor.position.x = this.baseX + 0.5 + slide;

    // Pulsing light when open
    if (this.targetOpen > 0) {
      this.lightMesh.material.emissiveIntensity = 1 + Math.sin(performance.now() * 0.005) * 0.8;
    }
  }

  destroy() {
    for (const mesh of this.meshes) {
      this.game.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    }
    this.meshes = [];
  }
}
