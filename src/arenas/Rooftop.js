import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class Rooftop extends Arena {
  constructor(game) {
    super(game);

    // Main platform
    this.addStaticBox({ x: 20, y: 1, z: 20 }, { x: 0, y: -0.5, z: 0 }, 0x888888);

    // Breakable ledges (4 edges)
    this.ledges = [];
    const ledgePositions = [
      { pos: { x: 0, y: 0, z: -10.5 }, size: { x: 20, y: 0.5, z: 1 } },
      { pos: { x: 0, y: 0, z: 10.5 }, size: { x: 20, y: 0.5, z: 1 } },
      { pos: { x: -10.5, y: 0, z: 0 }, size: { x: 1, y: 0.5, z: 20 } },
      { pos: { x: 10.5, y: 0, z: 0 }, size: { x: 1, y: 0.5, z: 20 } },
    ];
    for (const l of ledgePositions) {
      const result = this.addStaticBox(l.size, l.pos, 0xaa9966);
      result.health = 100;
      result.broken = false;
      this.ledges.push(result);
    }

    // Spinning satellite dish
    this.dishAngle = 0;
    this.dishSpeed = 1.2;

    this.dishBody = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(new CANNON.Vec3(5, 0.3, 0.3)),
    });
    this.dishBody.position.set(0, 1.5, 0);
    game.world.addBody(this.dishBody);

    this.dishMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
    );
    this.dishMesh.castShadow = true;
    game.scene.add(this.dishMesh);

    // Dish base
    const baseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    );
    baseMesh.position.set(0, 0.75, 0);
    baseMesh.castShadow = true;
    game.scene.add(baseMesh);
    this.meshes.push(baseMesh);

    // Skyline
    this.createSkyline(game);

    this.bodies.push(this.dishBody);
    this.meshes.push(this.dishMesh);
  }

  createSkyline(game) {
    game.scene.background = new THREE.Color(0x1a1a3e);
    const buildingCount = 20;
    for (let i = 0; i < buildingCount; i++) {
      const w = 3 + Math.random() * 4;
      const h = 5 + Math.random() * 20;
      const d = 3 + Math.random() * 4;
      const x = (i - buildingCount / 2) * 5;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.6, 0.1, 0.1 + Math.random() * 0.15)
        })
      );
      mesh.position.set(x, h / 2 - 10, -30);
      game.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  update(dt) {
    super.update(dt);
    this.dishAngle += this.dishSpeed * dt;
    this.dishBody.position.set(0, 1.5, 0);
    this.dishBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.dishAngle);
    this.dishMesh.position.copy(this.dishBody.position);
    this.dishMesh.quaternion.copy(this.dishBody.quaternion);
  }
}
