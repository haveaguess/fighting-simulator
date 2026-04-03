import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class Factory extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x2a2a2a);

    // Main floor
    this.addStaticBox({ x: 24, y: 1, z: 16 }, { x: 0, y: -0.5, z: 0 }, 0x555555);

    // Upper platforms
    this.addStaticBox({ x: 6, y: 0.5, z: 6 }, { x: -6, y: 3, z: 0 }, 0x666655);
    this.addStaticBox({ x: 6, y: 0.5, z: 6 }, { x: 6, y: 3, z: 0 }, 0x666655);

    // Ramps
    this.addRamp(game, { x: -3, y: 1.5, z: 0 }, Math.PI * 0.12);
    this.addRamp(game, { x: 3, y: 1.5, z: 0 }, -Math.PI * 0.12);

    // Conveyor belts (force zones)
    this.conveyors = [
      { min: { x: -12, z: -2 }, max: { x: -4, z: 2 }, force: { x: -3, z: 0 } },
      { min: { x: 4, z: -2 }, max: { x: 12, z: 2 }, force: { x: 3, z: 0 } },
    ];

    // Conveyor visuals
    for (const c of this.conveyors) {
      const cx = (c.min.x + c.max.x) / 2;
      const cz = (c.min.z + c.max.z) / 2;
      const w = c.max.x - c.min.x;
      const d = c.max.z - c.min.z;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.1, d),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
      mesh.position.set(cx, 0.05, cz);
      game.scene.add(mesh);
      this.meshes.push(mesh);
    }

    // Crushers
    this.crushers = [];
    this.createCrusher(game, { x: 0, y: 8, z: -4 });
    this.createCrusher(game, { x: 0, y: 8, z: 4 });

    // Warning stripes
    for (const pos of [{ x: 0, z: -4 }, { x: 0, z: 4 }]) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3),
        new THREE.MeshStandardMaterial({ color: 0xffff00, transparent: true, opacity: 0.3 })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, 0.02, pos.z);
      game.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  addRamp(game, position, angle) {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(2, 0.15, 2)),
    });
    body.position.set(position.x, position.y, position.z);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
    game.world.addBody(body);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.3, 4),
      new THREE.MeshStandardMaterial({ color: 0x777766 })
    );
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    game.scene.add(mesh);
    this.bodies.push(body);
    this.meshes.push(mesh);
  }

  createCrusher(game, position) {
    const body = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(new CANNON.Vec3(1.5, 1, 1.5)),
    });
    body.position.set(position.x, position.y, position.z);
    game.world.addBody(body);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 3),
      new THREE.MeshStandardMaterial({ color: 0x994444, metalness: 0.6 })
    );
    mesh.castShadow = true;
    game.scene.add(mesh);

    const crusher = {
      body, mesh,
      baseY: position.y, lowY: 1.0,
      timer: Math.random() * 4,
      period: 4, slamDuration: 0.2,
      state: 'waiting',
      update(dt) {
        this.timer += dt;
        if (this.state === 'waiting' && this.timer >= this.period) {
          this.state = 'slamming'; this.timer = 0;
        }
        if (this.state === 'slamming') {
          const t = this.timer / this.slamDuration;
          this.body.position.y = this.baseY + (this.lowY - this.baseY) * Math.min(t, 1);
          if (t >= 1) { this.state = 'returning'; this.timer = 0; }
        }
        if (this.state === 'returning') {
          const t = this.timer / 1.5;
          this.body.position.y = this.lowY + (this.baseY - this.lowY) * Math.min(t, 1);
          if (t >= 1) { this.state = 'waiting'; this.timer = 0; }
        }
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
      },
    };

    this.crushers.push(crusher);
    this.hazards.push(crusher);
    this.bodies.push(body);
    this.meshes.push(mesh);
  }

  update(dt) {
    super.update(dt);

    for (const c of this.conveyors) {
      for (const pair of this.game.syncPairs) {
        const b = pair.body;
        if (b.mass === 0) continue;
        const p = b.position;
        if (p.x >= c.min.x && p.x <= c.max.x &&
            p.z >= c.min.z && p.z <= c.max.z && p.y < 2) {
          b.applyForce(new CANNON.Vec3(c.force.x, 0, c.force.z));
        }
      }
    }
  }
}
