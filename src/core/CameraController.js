import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 2, 0);
    this.offset = new THREE.Vector3(0, 12, 25);
    this.smoothness = 3;
    this.minZoom = 15;
    this.maxZoom = 40;
  }

  update(dt, players) {
    const alive = players.filter(p => p.alive);
    if (alive.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let avgY = 0;

    for (const p of alive) {
      const pos = p.ragdoll.getPosition();
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
      avgY += pos.y;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    avgY /= alive.length;

    const spread = Math.max(maxX - minX, maxZ - minZ, 5);
    const zoom = THREE.MathUtils.clamp(spread * 1.5 + 10, this.minZoom, this.maxZoom);

    const targetPos = new THREE.Vector3(centerX, Math.max(avgY, 2), centerZ);
    const lerpFactor = Math.min(dt * this.smoothness, 1);
    this.target.lerp(targetPos, lerpFactor);

    const desiredPos = new THREE.Vector3(
      this.target.x + this.offset.x,
      this.offset.y * (zoom / 25),
      this.target.z + zoom
    );

    this.camera.position.lerp(desiredPos, lerpFactor);
    this.camera.lookAt(this.target);
  }
}
