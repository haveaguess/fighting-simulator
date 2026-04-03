import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class WrestlingRing extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x111122);

    // Ring floor
    this.addStaticBox({ x: 16, y: 1, z: 16 }, { x: 0, y: -0.5, z: 0 }, 0x336633);

    // Ring apron
    this.addStaticBox({ x: 18, y: 0.6, z: 1 }, { x: 0, y: -0.3, z: -8.5 }, 0x222222);
    this.addStaticBox({ x: 18, y: 0.6, z: 1 }, { x: 0, y: -0.3, z: 8.5 }, 0x222222);
    this.addStaticBox({ x: 1, y: 0.6, z: 18 }, { x: -8.5, y: -0.3, z: 0 }, 0x222222);
    this.addStaticBox({ x: 1, y: 0.6, z: 18 }, { x: 8.5, y: -0.3, z: 0 }, 0x222222);

    // Turnbuckle posts
    const corners = [
      { x: -8, z: -8 }, { x: 8, z: -8 },
      { x: -8, z: 8 }, { x: 8, z: 8 },
    ];
    for (const c of corners) {
      this.addStaticBox({ x: 0.4, y: 4, z: 0.4 }, { x: c.x, y: 2, z: c.z }, 0xcccc00);
    }

    // Ropes
    this.ropes = [];
    this.ropeElectrifyTimer = 0;
    this.ropesElectrified = false;
    this.electrifyDuration = 2;
    this.electrifyCooldown = 8;

    const ropeHeight = 2;
    const ropeSegments = [
      { from: { x: -8, z: -8 }, to: { x: 8, z: -8 } },
      { from: { x: -8, z: 8 }, to: { x: 8, z: 8 } },
      { from: { x: -8, z: -8 }, to: { x: -8, z: 8 } },
      { from: { x: 8, z: -8 }, to: { x: 8, z: 8 } },
    ];

    for (const seg of ropeSegments) {
      const cx = (seg.from.x + seg.to.x) / 2;
      const cz = (seg.from.z + seg.to.z) / 2;
      const dx = seg.to.x - seg.from.x;
      const dz = seg.to.z - seg.from.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const isX = Math.abs(dx) > Math.abs(dz);

      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(
          isX ? len / 2 : 0.15,
          0.15,
          isX ? 0.15 : len / 2
        )),
      });
      body.position.set(cx, ropeHeight, cz);
      const ropeMaterial = new CANNON.Material('rope');
      ropeMaterial.restitution = 1.5;
      body.material = ropeMaterial;
      game.world.addBody(body);

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(isX ? len : 0.3, 0.3, isX ? 0.3 : len),
        new THREE.MeshStandardMaterial({ color: 0xff2222 })
      );
      mesh.position.copy(body.position);
      game.scene.add(mesh);

      this.ropes.push({ body, mesh, baseMaterial: mesh.material });
      this.bodies.push(body);
      this.meshes.push(mesh);
    }

    // Contact material for bounce
    const ropeMat = new CANNON.Material('rope');
    const defaultMat = new CANNON.Material('default');
    const ropeContact = new CANNON.ContactMaterial(ropeMat, defaultMat, {
      restitution: 1.5,
      friction: 0.1,
    });
    game.world.addContactMaterial(ropeContact);

    // Spotlight
    const spot = new THREE.SpotLight(0xffffff, 2, 50, Math.PI / 4);
    spot.position.set(0, 20, 0);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    game.scene.add(spot);
    game.scene.add(spot.target);
    this.meshes.push(spot);
  }

  update(dt) {
    super.update(dt);

    this.ropeElectrifyTimer += dt;

    if (!this.ropesElectrified && this.ropeElectrifyTimer >= this.electrifyCooldown) {
      this.ropesElectrified = true;
      this.ropeElectrifyTimer = 0;
      for (const r of this.ropes) {
        r.mesh.material = new THREE.MeshStandardMaterial({
          color: 0x44ffff, emissive: 0x00aaff, emissiveIntensity: 2,
        });
      }
    }

    if (this.ropesElectrified && this.ropeElectrifyTimer >= this.electrifyDuration) {
      this.ropesElectrified = false;
      this.ropeElectrifyTimer = 0;
      for (const r of this.ropes) {
        r.mesh.material = r.baseMaterial;
      }
    }
  }

  isElectrified() {
    return this.ropesElectrified;
  }
}
