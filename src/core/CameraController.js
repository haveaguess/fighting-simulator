import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 2, 0);
    this.offset = new THREE.Vector3(0, 12, 25);
    this.smoothness = 3;
    this.minZoom = 12;
    this.maxZoom = 28;
  }

  update(dt, players) {
    const onPlatform = (p) => {
      if (!p.alive) return false;
      const pos = p.ragdoll.getPosition();
      return pos.y > -3 && Math.abs(pos.x) < 25 && Math.abs(pos.z) < 25;
    };

    // Separate humans from AI
    const humans = players.filter(p => !p.isAI && onPlatform(p));
    const ais = players.filter(p => p.isAI && onPlatform(p));

    // Always prioritize human players
    if (humans.length === 0 && ais.length === 0) return;

    // Start with human positions as the anchor
    let anchors = humans.map(p => p.ragdoll.getPosition());

    // If no humans alive, fall back to AI
    if (anchors.length === 0) {
      anchors = ais.map(p => p.ragdoll.getPosition());
    } else {
      // Include AI players only if they're close to a human (within 8 units)
      // This keeps nearby fights in frame without zooming out for distant AI
      for (const ai of ais) {
        const aiPos = ai.ragdoll.getPosition();
        for (const hPos of anchors) {
          const dx = aiPos.x - hPos.x;
          const dz = aiPos.z - hPos.z;
          if (Math.sqrt(dx * dx + dz * dz) < 8) {
            anchors.push(aiPos);
            break;
          }
        }
      }
    }

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let avgY = 0;

    for (const pos of anchors) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
      avgY += pos.y;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    avgY /= anchors.length;

    const spread = Math.max(maxX - minX, maxZ - minZ, 4);
    const zoom = THREE.MathUtils.clamp(spread * 1.2 + 8, this.minZoom, this.maxZoom);

    const targetPos = new THREE.Vector3(centerX, Math.max(avgY, 1.5), centerZ);
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
