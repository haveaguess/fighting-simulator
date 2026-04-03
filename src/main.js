import { Game } from './core/Game.js';
import { Player } from './character/Player.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS, PLAYER_2_KEYS } from './input/KeyboardBindings.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const game = new Game();
const input = new InputManager();

// Register keyboard players
input.registerKeyboardPlayer(0, PLAYER_1_KEYS);
input.registerKeyboardPlayer(1, PLAYER_2_KEYS);

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

// Spawn players
const player1 = new Player(game, input, 0, { x: -3, y: 3, z: 0 }, 0xff4444);
const player2 = new Player(game, input, 1, { x: 3, y: 3, z: 0 }, 0x4444ff);

game.start();
