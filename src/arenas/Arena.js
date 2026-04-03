import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Arena {
  constructor(game) {
    this.game = game;
    this.bodies = [];
    this.meshes = [];
    this.hazards = [];
  }

  addStaticBox(size, position, color, receiveShadow = true) {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
    });
    body.position.set(position.x, position.y, position.z);
    this.game.world.addBody(body);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color })
    );
    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = true;
    mesh.position.copy(position);
    this.game.scene.add(mesh);

    this.bodies.push(body);
    this.meshes.push(mesh);
    return { body, mesh };
  }

  update(dt) {
    for (const hazard of this.hazards) {
      hazard.update(dt);
    }
  }

  destroy() {
    for (const body of this.bodies) {
      this.game.world.removeBody(body);
    }
    for (const mesh of this.meshes) {
      this.game.scene.remove(mesh);
    }
    for (const hazard of this.hazards) {
      if (hazard.destroy) hazard.destroy();
    }
  }
}
