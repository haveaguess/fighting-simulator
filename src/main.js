import { Game } from './core/Game.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const game = new Game();

// Test ground
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Box(new CANNON.Vec3(10, 0.5, 10)),
});
groundBody.position.set(0, -0.5, 0);
game.world.addBody(groundBody);

const groundMesh = new THREE.Mesh(
  new THREE.BoxGeometry(20, 1, 20),
  new THREE.MeshStandardMaterial({ color: 0x555555 })
);
groundMesh.receiveShadow = true;
game.scene.add(groundMesh);
game.addSyncPair(groundBody, groundMesh);

// Test sphere
const sphereBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(0.5),
  position: new CANNON.Vec3(0, 5, 0),
});
game.world.addBody(sphereBody);

const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.5),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
sphereMesh.castShadow = true;
game.scene.add(sphereMesh);
game.addSyncPair(sphereBody, sphereMesh);

game.start();
