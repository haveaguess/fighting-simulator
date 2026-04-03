import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class Rooftop extends Arena {
  constructor(game) {
    super(game);

    // Main platform
    this.addStaticBox({ x: 20, y: 1, z: 20 }, { x: 0, y: -0.5, z: 0 }, 0x888888);

    // Breakable ledges (4 edges) — raised slightly to act as bumpers
    this.ledges = [];
    const ledgePositions = [
      { pos: { x: 0, y: 0.25, z: -10.25 }, size: { x: 20, y: 0.5, z: 0.5 } },
      { pos: { x: 0, y: 0.25, z: 10.25 }, size: { x: 20, y: 0.5, z: 0.5 } },
      { pos: { x: -10.25, y: 0.25, z: 0 }, size: { x: 0.5, y: 0.5, z: 20 } },
      { pos: { x: 10.25, y: 0.25, z: 0 }, size: { x: 0.5, y: 0.5, z: 20 } },
    ];
    for (const l of ledgePositions) {
      const result = this.addStaticBox(l.size, l.pos, 0xaa9966);
      result.health = 100;
      result.broken = false;
      this.ledges.push(result);
    }

    // Spinning satellite dish — uses velocity for proper collision response
    this.dishAngle = 0;
    this.dishSpeed = 1.5;

    this.dishBody = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(new CANNON.Vec3(5, 0.4, 0.4)),
    });
    this.dishBody.position.set(0, 0.8, 0);
    game.world.addBody(this.dishBody);

    this.dishMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
    );
    this.dishMesh.castShadow = true;
    game.scene.add(this.dishMesh);

    // Dish base
    const baseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    );
    baseMesh.position.set(0, 0.4, 0);
    baseMesh.castShadow = true;
    game.scene.add(baseMesh);
    this.meshes.push(baseMesh);

    // Skyline — visual only, pushed far back so characters can't reach
    this.createSkyline(game);

    this.bodies.push(this.dishBody);
    this.meshes.push(this.dishMesh);
  }

  createSkyline(game) {
    game.scene.background = new THREE.Color(0x1a1a3e);
    const buildingCount = 30;
    for (let i = 0; i < buildingCount; i++) {
      const w = 4 + Math.random() * 6;
      const h = 8 + Math.random() * 25;
      const d = 4 + Math.random() * 6;
      // Spread buildings in a wide arc behind the arena — far enough they can't be reached
      const angle = (i / buildingCount) * Math.PI * 2;
      const radius = 40 + Math.random() * 15;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.6, 0.1, 0.1 + Math.random() * 0.15)
        })
      );
      mesh.position.set(x, h / 2 - 15, z);
      game.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  update(dt) {
    super.update(dt);

    // Spin the dish — set angular velocity so physics engine generates proper collision impulses
    this.dishAngle += this.dishSpeed * dt;
    const cos = Math.cos(this.dishAngle);
    const sin = Math.sin(this.dishAngle);

    // Calculate the tip velocity for the kinematic body
    // Set position
    this.dishBody.position.set(0, 0.8, 0);
    this.dishBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.dishAngle);

    // Set velocity so the physics engine knows the dish is moving
    // Tip of dish is at radius 5, angular velocity = dishSpeed
    // Tangential velocity = r * omega
    const tipSpeed = 5 * this.dishSpeed;
    this.dishBody.velocity.set(-sin * tipSpeed, 0, cos * tipSpeed);
    this.dishBody.angularVelocity.set(0, this.dishSpeed, 0);

    this.dishMesh.position.copy(this.dishBody.position);
    this.dishMesh.quaternion.copy(this.dishBody.quaternion);
  }
}
