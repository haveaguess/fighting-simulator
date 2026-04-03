import { Game } from './core/Game.js';
import { Ragdoll } from './character/Ragdoll.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const game = new Game();

// Ground
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

// Spawn ragdoll
const ragdoll = new Ragdoll(game, { x: 0, y: 5, z: 0 }, 0xff4444);

game.start();
