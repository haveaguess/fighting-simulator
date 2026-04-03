# Wobbly Brawler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Gang Beasts-inspired 3D physics brawler playable in a web browser with up to 8 players.

**Architecture:** Vanilla JS modules served by Vite dev server. Three.js for rendering, cannon-es for physics. Game loop ticks physics world and syncs mesh positions each frame. All game objects (characters, arenas, hazards) are composed of paired physics bodies + Three.js meshes.

**Tech Stack:** Three.js, cannon-es, Vite, vanilla JavaScript (ES modules), Gamepad API

---

### Task 1: Project Scaffold & Dev Server

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.js`
- Create: `vite.config.js`

**Step 1: Initialize npm project and install dependencies**

Run:
```bash
npm init -y
npm install three cannon-es
npm install -D vite
```

**Step 2: Create vite.config.js**

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: { port: 3000 },
});
```

**Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wobbly Brawler</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**Step 4: Create src/main.js with basic Three.js + cannon-es scene**

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 20);
camera.lookAt(0, 0, 0);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(10, 20, 10);
directional.castShadow = true;
scene.add(directional);

// Physics world
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

// Ground (test)
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Box(new CANNON.Vec3(10, 0.5, 10)),
});
groundBody.position.set(0, -0.5, 0);
world.addBody(groundBody);

const groundMesh = new THREE.Mesh(
  new THREE.BoxGeometry(20, 1, 20),
  new THREE.MeshStandardMaterial({ color: 0x555555 })
);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Test sphere (will become ragdoll later)
const sphereBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(0.5),
  position: new CANNON.Vec3(0, 5, 0),
});
world.addBody(sphereBody);

const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.5),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
sphereMesh.castShadow = true;
scene.add(sphereMesh);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game loop
const timeStep = 1 / 60;
function animate() {
  requestAnimationFrame(animate);
  world.step(timeStep);

  // Sync mesh to physics
  sphereMesh.position.copy(sphereBody.position);
  sphereMesh.quaternion.copy(sphereBody.quaternion);
  groundMesh.position.copy(groundBody.position);

  renderer.render(scene, camera);
}
animate();
```

**Step 5: Verify it works**

Run: `npx vite --open`
Expected: Browser opens showing a red sphere falling onto a grey platform.

**Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/main.js
git commit -m "feat: project scaffold with Three.js + cannon-es hello world"
```

---

### Task 2: Game Loop & Core Architecture

**Files:**
- Create: `src/core/Game.js`
- Create: `src/core/PhysicsSync.js`
- Modify: `src/main.js`

**Step 1: Create src/core/Game.js**

The central game class that owns scene, camera, renderer, physics world, and the game loop.

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Game {
  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 12, 25);
    this.camera.lookAt(0, 2, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 20, 10);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    this.scene.add(directional);

    // Physics
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Tracked objects for physics sync
    this.syncPairs = []; // { body, mesh }

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Timing
    this.clock = new THREE.Clock();
    this.fixedTimeStep = 1 / 60;
    this.maxSubSteps = 3;

    // Update callbacks
    this.updateCallbacks = [];
  }

  addSyncPair(body, mesh) {
    this.syncPairs.push({ body, mesh });
  }

  removeSyncPair(body) {
    this.syncPairs = this.syncPairs.filter(p => p.body !== body);
  }

  onUpdate(callback) {
    this.updateCallbacks.push(callback);
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = this.clock.getDelta();

      // Step physics
      this.world.step(this.fixedTimeStep, dt, this.maxSubSteps);

      // Sync meshes to physics bodies
      for (const { body, mesh } of this.syncPairs) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }

      // Custom updates
      for (const cb of this.updateCallbacks) {
        cb(dt);
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
```

**Step 2: Simplify src/main.js to use Game class**

```js
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
```

**Step 3: Verify it works**

Run: `npx vite`
Expected: Same red sphere on grey platform, but now powered by Game class.

**Step 4: Commit**

```bash
git add src/core/Game.js src/main.js
git commit -m "feat: extract Game class with physics sync loop"
```

---

### Task 3: Ragdoll Character

**Files:**
- Create: `src/character/Ragdoll.js`
- Modify: `src/main.js`

**Step 1: Create src/character/Ragdoll.js**

Builds the 10-body ragdoll (head, torso, 2 upper arms, 2 lower arms, 2 upper legs, 2 lower legs) with constraints.

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const BODY_PARTS = {
  TORSO: 'torso',
  HEAD: 'head',
  LEFT_UPPER_ARM: 'leftUpperArm',
  LEFT_LOWER_ARM: 'leftLowerArm',
  RIGHT_UPPER_ARM: 'rightUpperArm',
  RIGHT_LOWER_ARM: 'rightLowerArm',
  LEFT_UPPER_LEG: 'leftUpperLeg',
  LEFT_LOWER_LEG: 'leftLowerLeg',
  RIGHT_UPPER_LEG: 'rightUpperLeg',
  RIGHT_LOWER_LEG: 'rightLowerLeg',
};

export class Ragdoll {
  constructor(game, position = { x: 0, y: 3, z: 0 }, color = 0xff0000) {
    this.game = game;
    this.bodies = {};
    this.meshes = {};
    this.constraints = [];

    const material = new THREE.MeshStandardMaterial({ color });

    // Helper: create a body part (physics body + mesh)
    const createPart = (name, shape, meshGeo, mass, pos) => {
      const body = new CANNON.Body({ mass, shape });
      body.position.set(position.x + pos.x, position.y + pos.y, position.z + pos.z);
      body.linearDamping = 0.4;
      body.angularDamping = 0.4;
      game.world.addBody(body);

      const mesh = new THREE.Mesh(meshGeo, material.clone());
      mesh.castShadow = true;
      game.scene.add(mesh);
      game.addSyncPair(body, mesh);

      this.bodies[name] = body;
      this.meshes[name] = mesh;
      return body;
    };

    // Torso (core)
    createPart(BODY_PARTS.TORSO,
      new CANNON.Box(new CANNON.Vec3(0.4, 0.6, 0.25)),
      new THREE.BoxGeometry(0.8, 1.2, 0.5),
      5, { x: 0, y: 0, z: 0 }
    );

    // Head
    createPart(BODY_PARTS.HEAD,
      new CANNON.Sphere(0.3),
      new THREE.SphereGeometry(0.3),
      1, { x: 0, y: 1.0, z: 0 }
    );

    // Upper arms
    createPart(BODY_PARTS.LEFT_UPPER_ARM,
      new CANNON.Box(new CANNON.Vec3(0.12, 0.3, 0.12)),
      new THREE.BoxGeometry(0.24, 0.6, 0.24),
      1, { x: -0.65, y: 0.3, z: 0 }
    );

    createPart(BODY_PARTS.RIGHT_UPPER_ARM,
      new CANNON.Box(new CANNON.Vec3(0.12, 0.3, 0.12)),
      new THREE.BoxGeometry(0.24, 0.6, 0.24),
      1, { x: 0.65, y: 0.3, z: 0 }
    );

    // Lower arms
    createPart(BODY_PARTS.LEFT_LOWER_ARM,
      new CANNON.Box(new CANNON.Vec3(0.1, 0.28, 0.1)),
      new THREE.BoxGeometry(0.2, 0.56, 0.2),
      0.8, { x: -0.65, y: -0.35, z: 0 }
    );

    createPart(BODY_PARTS.RIGHT_LOWER_ARM,
      new CANNON.Box(new CANNON.Vec3(0.1, 0.28, 0.1)),
      new THREE.BoxGeometry(0.2, 0.56, 0.2),
      0.8, { x: 0.65, y: -0.35, z: 0 }
    );

    // Upper legs
    createPart(BODY_PARTS.LEFT_UPPER_LEG,
      new CANNON.Box(new CANNON.Vec3(0.14, 0.3, 0.14)),
      new THREE.BoxGeometry(0.28, 0.6, 0.28),
      1.5, { x: -0.22, y: -1.0, z: 0 }
    );

    createPart(BODY_PARTS.RIGHT_UPPER_LEG,
      new CANNON.Box(new CANNON.Vec3(0.14, 0.3, 0.14)),
      new THREE.BoxGeometry(0.28, 0.6, 0.28),
      1.5, { x: 0.22, y: -1.0, z: 0 }
    );

    // Lower legs
    createPart(BODY_PARTS.LEFT_LOWER_LEG,
      new CANNON.Box(new CANNON.Vec3(0.12, 0.3, 0.12)),
      new THREE.BoxGeometry(0.24, 0.6, 0.24),
      1, { x: -0.22, y: -1.65, z: 0 }
    );

    createPart(BODY_PARTS.RIGHT_LOWER_LEG,
      new CANNON.Box(new CANNON.Vec3(0.12, 0.3, 0.12)),
      new THREE.BoxGeometry(0.24, 0.6, 0.24),
      1, { x: 0.22, y: -1.65, z: 0 }
    );

    // --- Constraints ---

    // Neck: head to torso (cone twist)
    this.addConeTwist(BODY_PARTS.TORSO, BODY_PARTS.HEAD,
      { x: 0, y: 0.6, z: 0 }, { x: 0, y: -0.3, z: 0 },
      Math.PI / 6
    );

    // Shoulders
    this.addConeTwist(BODY_PARTS.TORSO, BODY_PARTS.LEFT_UPPER_ARM,
      { x: -0.4, y: 0.5, z: 0 }, { x: 0, y: 0.3, z: 0 },
      Math.PI / 3
    );
    this.addConeTwist(BODY_PARTS.TORSO, BODY_PARTS.RIGHT_UPPER_ARM,
      { x: 0.4, y: 0.5, z: 0 }, { x: 0, y: 0.3, z: 0 },
      Math.PI / 3
    );

    // Elbows (hinge - only bend one way)
    this.addHinge(BODY_PARTS.LEFT_UPPER_ARM, BODY_PARTS.LEFT_LOWER_ARM,
      { x: 0, y: -0.3, z: 0 }, { x: 0, y: 0.28, z: 0 },
      { x: 1, y: 0, z: 0 },
      0, Math.PI * 0.7
    );
    this.addHinge(BODY_PARTS.RIGHT_UPPER_ARM, BODY_PARTS.RIGHT_LOWER_ARM,
      { x: 0, y: -0.3, z: 0 }, { x: 0, y: 0.28, z: 0 },
      { x: 1, y: 0, z: 0 },
      0, Math.PI * 0.7
    );

    // Hips
    this.addConeTwist(BODY_PARTS.TORSO, BODY_PARTS.LEFT_UPPER_LEG,
      { x: -0.22, y: -0.6, z: 0 }, { x: 0, y: 0.3, z: 0 },
      Math.PI / 4
    );
    this.addConeTwist(BODY_PARTS.TORSO, BODY_PARTS.RIGHT_UPPER_LEG,
      { x: 0.22, y: -0.6, z: 0 }, { x: 0, y: 0.3, z: 0 },
      Math.PI / 4
    );

    // Knees (hinge)
    this.addHinge(BODY_PARTS.LEFT_UPPER_LEG, BODY_PARTS.LEFT_LOWER_LEG,
      { x: 0, y: -0.3, z: 0 }, { x: 0, y: 0.3, z: 0 },
      { x: 1, y: 0, z: 0 },
      -Math.PI * 0.7, 0
    );
    this.addHinge(BODY_PARTS.RIGHT_UPPER_LEG, BODY_PARTS.RIGHT_LOWER_LEG,
      { x: 0, y: -0.3, z: 0 }, { x: 0, y: 0.3, z: 0 },
      { x: 1, y: 0, z: 0 },
      -Math.PI * 0.7, 0
    );
  }

  addConeTwist(partA, partB, pivotA, pivotB, angle) {
    const bodyA = this.bodies[partA];
    const bodyB = this.bodies[partB];
    const c = new CANNON.ConeTwistConstraint(bodyA, bodyB, {
      pivotA: new CANNON.Vec3(pivotA.x, pivotA.y, pivotA.z),
      pivotB: new CANNON.Vec3(pivotB.x, pivotB.y, pivotB.z),
      angle,
    });
    this.game.world.addConstraint(c);
    this.constraints.push(c);
  }

  addHinge(partA, partB, pivotA, pivotB, axis, low, high) {
    const bodyA = this.bodies[partA];
    const bodyB = this.bodies[partB];
    const axisVec = new CANNON.Vec3(axis.x, axis.y, axis.z);
    const c = new CANNON.HingeConstraint(bodyA, bodyB, {
      pivotA: new CANNON.Vec3(pivotA.x, pivotA.y, pivotA.z),
      pivotB: new CANNON.Vec3(pivotB.x, pivotB.y, pivotB.z),
      axisA: axisVec,
      axisB: axisVec,
    });
    // cannon-es hinge limits are set via motor or equations
    // We'll clamp via the constraint equations
    c.setMotorSpeed(0);
    c.setMotorMaxForce(0);
    this.game.world.addConstraint(c);
    this.constraints.push(c);
  }

  getTorso() {
    return this.bodies[BODY_PARTS.TORSO];
  }

  getHead() {
    return this.bodies[BODY_PARTS.HEAD];
  }

  getPosition() {
    const torso = this.getTorso();
    return { x: torso.position.x, y: torso.position.y, z: torso.position.z };
  }

  destroy() {
    for (const c of this.constraints) {
      this.game.world.removeConstraint(c);
    }
    for (const name of Object.keys(this.bodies)) {
      this.game.world.removeBody(this.bodies[name]);
      this.game.removeSyncPair(this.bodies[name]);
      this.game.scene.remove(this.meshes[name]);
    }
    this.bodies = {};
    this.meshes = {};
    this.constraints = [];
  }
}
```

**Step 2: Update src/main.js to spawn a ragdoll**

```js
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
```

**Step 3: Verify**

Run: `npx vite`
Expected: A multi-part ragdoll body falls onto the platform and wobbles/settles.

**Step 4: Commit**

```bash
git add src/character/Ragdoll.js src/main.js
git commit -m "feat: ragdoll character with 10 body parts and constraints"
```

---

### Task 4: Balance System

**Files:**
- Create: `src/character/BalanceSystem.js`
- Modify: `src/character/Ragdoll.js`

**Step 1: Create src/character/BalanceSystem.js**

Applies corrective torque to keep the torso upright. Weakens as damage increases.

```js
import * as CANNON from 'cannon-es';

export class BalanceSystem {
  constructor(ragdoll) {
    this.ragdoll = ragdoll;
    this.damage = 0;          // 0 to 100
    this.maxForce = 80;       // corrective force strength
    this.ragdollTimer = 0;    // seconds remaining in full ragdoll
    this.ragdollDuration = 3; // seconds of full ragdoll at max damage
  }

  takeDamage(amount) {
    this.damage = Math.min(100, this.damage + amount);
    if (this.damage >= 80) {
      this.ragdollTimer = this.ragdollDuration;
    }
  }

  getDamagePercent() {
    return this.damage / 100;
  }

  isRagdolling() {
    return this.ragdollTimer > 0;
  }

  update(dt) {
    // Count down ragdoll timer
    if (this.ragdollTimer > 0) {
      this.ragdollTimer -= dt;
      if (this.ragdollTimer <= 0) {
        this.ragdollTimer = 0;
        this.damage = Math.max(0, this.damage - 30); // recover some after ragdoll
      }
      return; // No balance correction while ragdolling
    }

    const torso = this.ragdoll.getTorso();

    // Get current up direction of the torso
    const currentUp = new CANNON.Vec3(0, 1, 0);
    torso.quaternion.vmult(currentUp, currentUp);

    // Target up is world Y
    const targetUp = new CANNON.Vec3(0, 1, 0);

    // Cross product gives rotation axis
    const cross = new CANNON.Vec3();
    currentUp.cross(targetUp, cross);

    // Scale force by how tilted + reduce by damage
    const damageMultiplier = 1 - (this.damage / 100) * 0.7;
    const force = this.maxForce * damageMultiplier;

    // Apply corrective torque
    torso.torque.x += cross.x * force;
    torso.torque.y += cross.y * force * 0.3; // Less yaw correction
    torso.torque.z += cross.z * force;
  }
}
```

**Step 2: Integrate balance into Ragdoll**

Add to the end of the `Ragdoll` constructor:

```js
// At end of constructor:
this.balance = new BalanceSystem(this);

// Register update
game.onUpdate((dt) => this.balance.update(dt));
```

Add import at top of Ragdoll.js:
```js
import { BalanceSystem } from './BalanceSystem.js';
```

**Step 3: Verify**

Run: `npx vite`
Expected: Ragdoll falls but attempts to stay upright. It wobbles but doesn't fully topple.

**Step 4: Commit**

```bash
git add src/character/BalanceSystem.js src/character/Ragdoll.js
git commit -m "feat: balance system with damage-based wobble degradation"
```

---

### Task 5: Input Manager

**Files:**
- Create: `src/input/InputManager.js`
- Create: `src/input/KeyboardBindings.js`
- Create: `src/input/GamepadBindings.js`

**Step 1: Create src/input/InputManager.js**

```js
export const Actions = {
  MOVE_LEFT: 'moveLeft',
  MOVE_RIGHT: 'moveRight',
  MOVE_FORWARD: 'moveForward',
  MOVE_BACKWARD: 'moveBackward',
  JUMP: 'jump',
  PUNCH: 'punch',
  KICK: 'kick',
  GRAB: 'grab',
  HEADBUTT: 'headbutt',
};

export class InputManager {
  constructor() {
    this.players = new Map(); // playerIndex -> { source, bindings }
    this.keyStates = {};

    window.addEventListener('keydown', (e) => { this.keyStates[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keyStates[e.code] = false; });
  }

  registerKeyboardPlayer(playerIndex, bindings) {
    this.players.set(playerIndex, { source: 'keyboard', bindings });
  }

  registerGamepadPlayer(playerIndex, gamepadIndex) {
    this.players.set(playerIndex, { source: 'gamepad', gamepadIndex });
  }

  getActions(playerIndex) {
    const player = this.players.get(playerIndex);
    if (!player) return {};

    if (player.source === 'keyboard') {
      return this.getKeyboardActions(player.bindings);
    } else {
      return this.getGamepadActions(player.gamepadIndex);
    }
  }

  getKeyboardActions(bindings) {
    const actions = {};
    for (const [action, key] of Object.entries(bindings)) {
      actions[action] = !!this.keyStates[key];
    }
    return actions;
  }

  getGamepadActions(gamepadIndex) {
    const actions = {};
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return actions;

    const deadzone = 0.2;
    actions[Actions.MOVE_LEFT] = gp.axes[0] < -deadzone;
    actions[Actions.MOVE_RIGHT] = gp.axes[0] > deadzone;
    actions[Actions.MOVE_FORWARD] = gp.axes[1] < -deadzone;
    actions[Actions.MOVE_BACKWARD] = gp.axes[1] > deadzone;
    actions[Actions.JUMP] = gp.buttons[0]?.pressed;
    actions[Actions.PUNCH] = gp.buttons[2]?.pressed;
    actions[Actions.KICK] = gp.buttons[3]?.pressed;
    actions[Actions.GRAB] = gp.buttons[1]?.pressed;
    actions[Actions.HEADBUTT] = gp.buttons[5]?.pressed;

    return actions;
  }
}
```

**Step 2: Create src/input/KeyboardBindings.js**

```js
import { Actions } from './InputManager.js';

export const PLAYER_1_KEYS = {
  [Actions.MOVE_LEFT]: 'KeyA',
  [Actions.MOVE_RIGHT]: 'KeyD',
  [Actions.MOVE_FORWARD]: 'KeyW',
  [Actions.MOVE_BACKWARD]: 'KeyS',
  [Actions.JUMP]: 'Space',
  [Actions.PUNCH]: 'KeyF',
  [Actions.KICK]: 'KeyG',
  [Actions.GRAB]: 'KeyR',
  [Actions.HEADBUTT]: 'KeyT',
};

export const PLAYER_2_KEYS = {
  [Actions.MOVE_LEFT]: 'ArrowLeft',
  [Actions.MOVE_RIGHT]: 'ArrowRight',
  [Actions.MOVE_FORWARD]: 'ArrowUp',
  [Actions.MOVE_BACKWARD]: 'ArrowDown',
  [Actions.JUMP]: 'Numpad0',
  [Actions.PUNCH]: 'Numpad1',
  [Actions.KICK]: 'Numpad2',
  [Actions.GRAB]: 'Numpad3',
  [Actions.HEADBUTT]: 'Numpad4',
};
```

**Step 3: Commit**

```bash
git add src/input/
git commit -m "feat: input manager with keyboard and gamepad support"
```

---

### Task 6: Character Controller (Moves)

**Files:**
- Create: `src/character/CharacterController.js`

**Step 1: Create src/character/CharacterController.js**

Reads input actions and applies forces to the ragdoll.

```js
import * as CANNON from 'cannon-es';
import { Actions } from '../input/InputManager.js';

export class CharacterController {
  constructor(ragdoll, game) {
    this.ragdoll = ragdoll;
    this.game = game;

    // Cooldowns (seconds)
    this.punchCooldown = 0;
    this.kickCooldown = 0;
    this.headbuttCooldown = 0;
    this.grabConstraint = null;

    // Tuning
    this.moveForce = 25;
    this.jumpImpulse = 8;
    this.punchImpulse = 15;
    this.kickImpulse = 12;
    this.headbuttImpulse = 10;
  }

  update(dt, actions) {
    if (this.ragdoll.balance.isRagdolling()) return;

    const torso = this.ragdoll.getTorso();

    // Movement
    const force = new CANNON.Vec3(0, 0, 0);
    if (actions[Actions.MOVE_LEFT]) force.x -= this.moveForce;
    if (actions[Actions.MOVE_RIGHT]) force.x += this.moveForce;
    if (actions[Actions.MOVE_FORWARD]) force.z -= this.moveForce;
    if (actions[Actions.MOVE_BACKWARD]) force.z += this.moveForce;
    torso.applyForce(force);

    // Jump (only when close to ground)
    if (actions[Actions.JUMP] && this.isGrounded()) {
      torso.applyImpulse(new CANNON.Vec3(0, this.jumpImpulse, 0));
    }

    // Punch
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
      this.punchCooldown = 0.4;
      const arm = this.ragdoll.bodies.rightLowerArm;
      const dir = this.getFacingDirection();
      arm.applyImpulse(new CANNON.Vec3(dir.x * this.punchImpulse, 2, dir.z * this.punchImpulse));
    }

    // Kick
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    if (actions[Actions.KICK] && this.kickCooldown <= 0) {
      this.kickCooldown = 0.5;
      const leg = this.ragdoll.bodies.rightLowerLeg;
      const dir = this.getFacingDirection();
      leg.applyImpulse(new CANNON.Vec3(dir.x * this.kickImpulse, 1, dir.z * this.kickImpulse));
    }

    // Headbutt
    this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
    if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
      this.headbuttCooldown = 0.6;
      const head = this.ragdoll.getHead();
      const dir = this.getFacingDirection();
      head.applyImpulse(new CANNON.Vec3(dir.x * this.headbuttImpulse, 0, dir.z * this.headbuttImpulse));
    }

    // Grab
    if (actions[Actions.GRAB]) {
      this.tryGrab();
    } else {
      this.releaseGrab();
    }
  }

  getFacingDirection() {
    const torso = this.ragdoll.getTorso();
    const forward = new CANNON.Vec3(0, 0, -1);
    torso.quaternion.vmult(forward, forward);
    forward.y = 0;
    forward.normalize();
    // Default to forward if zero
    if (forward.length() < 0.01) {
      forward.set(0, 0, -1);
    }
    return forward;
  }

  isGrounded() {
    const torso = this.ragdoll.getTorso();
    return torso.position.y < 2.0; // Simple height check for now
  }

  tryGrab() {
    if (this.grabConstraint) return;

    const hand = this.ragdoll.bodies.leftLowerArm;
    const handPos = hand.position;

    // Check all other ragdolls in the world for nearby body parts
    for (const pair of this.game.syncPairs) {
      const body = pair.body;
      // Skip own parts
      if (Object.values(this.ragdoll.bodies).includes(body)) continue;
      // Check distance
      const dist = handPos.distanceTo(body.position);
      if (dist < 1.0 && body.mass > 0) {
        this.grabConstraint = new CANNON.DistanceConstraint(hand, body, dist);
        this.game.world.addConstraint(this.grabConstraint);
        return;
      }
    }
  }

  releaseGrab() {
    if (this.grabConstraint) {
      this.game.world.removeConstraint(this.grabConstraint);
      this.grabConstraint = null;
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/character/CharacterController.js
git commit -m "feat: character controller with all 6 moves"
```

---

### Task 7: Player Class (Ties Ragdoll + Controller + Input)

**Files:**
- Create: `src/character/Player.js`
- Modify: `src/main.js`

**Step 1: Create src/character/Player.js**

```js
import { Ragdoll } from './Ragdoll.js';
import { CharacterController } from './CharacterController.js';

export class Player {
  constructor(game, inputManager, playerIndex, position, color) {
    this.game = game;
    this.inputManager = inputManager;
    this.playerIndex = playerIndex;
    this.alive = true;
    this.roundWins = 0;

    this.ragdoll = new Ragdoll(game, position, color);
    this.controller = new CharacterController(this.ragdoll, game);

    game.onUpdate((dt) => this.update(dt));
  }

  update(dt) {
    if (!this.alive) return;
    const actions = this.inputManager.getActions(this.playerIndex);
    this.controller.update(dt, actions);

    // Check ring-out
    if (this.ragdoll.getPosition().y < -10) {
      this.alive = false;
    }
  }

  reset(position) {
    this.ragdoll.destroy();
    this.ragdoll = new Ragdoll(this.game, position, this.ragdoll.meshes?.torso?.material?.color?.getHex() || 0xff0000);
    this.controller = new CharacterController(this.ragdoll, this.game);
    this.alive = true;
  }

  destroy() {
    this.ragdoll.destroy();
  }
}
```

**Step 2: Update src/main.js to create two players**

```js
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
```

**Step 3: Verify**

Run: `npx vite`
Expected: Two ragdolls (red and blue) spawn. Player 1 moves with WASD, Player 2 with arrow keys. Punching/kicking applies forces.

**Step 4: Commit**

```bash
git add src/character/Player.js src/main.js
git commit -m "feat: player class with two keyboard players fighting"
```

---

### Task 8: Collision Damage System

**Files:**
- Create: `src/character/DamageSystem.js`
- Modify: `src/character/Ragdoll.js`

**Step 1: Create src/character/DamageSystem.js**

Listens for collisions between ragdoll parts and applies damage based on impact velocity.

```js
export class DamageSystem {
  constructor(game) {
    this.game = game;
    this.ragdolls = []; // All ragdolls in the game
  }

  register(ragdoll) {
    this.ragdolls.push(ragdoll);
    this.setupCollisionListeners(ragdoll);
  }

  setupCollisionListeners(ragdoll) {
    // Listen on all body parts for collisions
    for (const [name, body] of Object.entries(ragdoll.bodies)) {
      body.addEventListener('collide', (event) => {
        const otherBody = event.body;
        const impactVelocity = event.contact.getImpactVelocityAlongNormal();

        // Only apply damage from other ragdoll parts, not the ground
        if (otherBody.mass === 0) return; // static bodies

        // Find which ragdoll the other body belongs to
        const attackerRagdoll = this.findOwner(otherBody);
        if (!attackerRagdoll || attackerRagdoll === ragdoll) return;

        // Damage scales with impact velocity
        const damage = Math.abs(impactVelocity) * 2;
        if (damage > 1) {
          ragdoll.balance.takeDamage(damage);
        }
      });
    }
  }

  findOwner(body) {
    for (const ragdoll of this.ragdolls) {
      if (Object.values(ragdoll.bodies).includes(body)) {
        return ragdoll;
      }
    }
    return null;
  }
}
```

**Step 2: Wire into main.js (after player creation)**

Add to main.js:
```js
import { DamageSystem } from './character/DamageSystem.js';

const damageSystem = new DamageSystem(game);
damageSystem.register(player1.ragdoll);
damageSystem.register(player2.ragdoll);
```

**Step 3: Commit**

```bash
git add src/character/DamageSystem.js src/main.js
git commit -m "feat: collision-based damage system affecting balance"
```

---

### Task 9: AI Controller

**Files:**
- Create: `src/ai/AIController.js`
- Create: `src/character/AIPlayer.js`

**Step 1: Create src/ai/AIController.js**

Simple AI that moves toward nearest opponent and attacks when close.

```js
import { Actions } from '../input/InputManager.js';

export class AIController {
  constructor() {
    this.attackTimer = 0;
    this.thinkTimer = 0;
    this.currentDecision = {};
  }

  update(dt, myRagdoll, allPlayers) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.thinkTimer -= dt;

    // Re-evaluate every 0.3s (prevents jitter)
    if (this.thinkTimer > 0) return this.currentDecision;

    this.thinkTimer = 0.3;
    const actions = {};
    const myPos = myRagdoll.getPosition();

    // Find nearest alive opponent
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of allPlayers) {
      if (p.ragdoll === myRagdoll || !p.alive) continue;
      const pos = p.ragdoll.getPosition();
      const dx = pos.x - myPos.x;
      const dz = pos.z - myPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { pos, dist: nearestDist, dx, dz };
      }
    }

    if (!nearest) {
      this.currentDecision = actions;
      return actions;
    }

    // Move toward opponent
    if (nearest.dx < -0.5) actions[Actions.MOVE_LEFT] = true;
    if (nearest.dx > 0.5) actions[Actions.MOVE_RIGHT] = true;
    if (nearest.dz < -0.5) actions[Actions.MOVE_FORWARD] = true;
    if (nearest.dz > 0.5) actions[Actions.MOVE_BACKWARD] = true;

    // Attack when close
    if (nearest.dist < 2.5 && this.attackTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.35) {
        actions[Actions.PUNCH] = true;
      } else if (roll < 0.55) {
        actions[Actions.KICK] = true;
      } else if (roll < 0.70) {
        actions[Actions.HEADBUTT] = true;
      } else if (roll < 0.85) {
        actions[Actions.GRAB] = true;
      } else {
        actions[Actions.JUMP] = true;
      }
      this.attackTimer = 0.4 + Math.random() * 0.4;
    }

    // Random jumps when far
    if (nearest.dist > 5 && Math.random() < 0.02) {
      actions[Actions.JUMP] = true;
    }

    this.currentDecision = actions;
    return actions;
  }
}
```

**Step 2: Create src/character/AIPlayer.js**

```js
import { Ragdoll } from './Ragdoll.js';
import { CharacterController } from './CharacterController.js';
import { AIController as AI } from '../ai/AIController.js';

export class AIPlayer {
  constructor(game, allPlayers, position, color) {
    this.game = game;
    this.allPlayers = allPlayers;
    this.alive = true;
    this.roundWins = 0;
    this.isAI = true;

    this.ragdoll = new Ragdoll(game, position, color);
    this.controller = new CharacterController(this.ragdoll, game);
    this.ai = new AI();

    game.onUpdate((dt) => this.update(dt));
  }

  update(dt) {
    if (!this.alive) return;
    const actions = this.ai.update(dt, this.ragdoll, this.allPlayers);
    this.controller.update(dt, actions);

    if (this.ragdoll.getPosition().y < -10) {
      this.alive = false;
    }
  }

  reset(position) {
    this.ragdoll.destroy();
    this.ragdoll = new Ragdoll(this.game, position, 0x44ff44);
    this.controller = new CharacterController(this.ragdoll, this.game);
    this.alive = true;
  }

  destroy() {
    this.ragdoll.destroy();
  }
}
```

**Step 3: Commit**

```bash
git add src/ai/ src/character/AIPlayer.js
git commit -m "feat: AI controller that chases and attacks nearest opponent"
```

---

### Task 10: Match Manager

**Files:**
- Create: `src/core/MatchManager.js`

**Step 1: Create src/core/MatchManager.js**

Handles rounds, ring-out detection, win tracking, and match flow.

```js
export class MatchManager {
  constructor(game, players) {
    this.game = game;
    this.players = players;
    this.roundsToWin = 3;
    this.state = 'waiting'; // waiting, countdown, playing, roundEnd, matchEnd
    this.countdownTimer = 0;
    this.roundEndTimer = 0;
    this.roundWinner = null;
    this.matchWinner = null;
    this.onStateChange = null; // callback

    game.onUpdate((dt) => this.update(dt));
  }

  startMatch() {
    for (const p of this.players) {
      p.roundWins = 0;
    }
    this.startRound();
  }

  startRound() {
    this.state = 'countdown';
    this.countdownTimer = 3;
    this.roundWinner = null;

    // Reset players to spawn positions
    const spawnPoints = this.getSpawnPoints();
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].reset(spawnPoints[i % spawnPoints.length]);
    }

    if (this.onStateChange) this.onStateChange(this.state, { countdown: 3 });
  }

  getSpawnPoints() {
    const count = this.players.length;
    const radius = 5;
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        y: 3,
        z: Math.sin(angle) * radius,
      });
    }
    return points;
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.state = 'playing';
        if (this.onStateChange) this.onStateChange(this.state);
      }
      return;
    }

    if (this.state === 'playing') {
      // Check for ring-outs
      const alivePlayers = this.players.filter(p => p.alive);
      if (alivePlayers.length <= 1) {
        this.roundWinner = alivePlayers[0] || null;
        if (this.roundWinner) {
          this.roundWinner.roundWins++;
          if (this.roundWinner.roundWins >= this.roundsToWin) {
            this.state = 'matchEnd';
            this.matchWinner = this.roundWinner;
            if (this.onStateChange) this.onStateChange(this.state, { winner: this.matchWinner });
            return;
          }
        }
        this.state = 'roundEnd';
        this.roundEndTimer = 3;
        if (this.onStateChange) this.onStateChange(this.state, { winner: this.roundWinner });
      }
      return;
    }

    if (this.state === 'roundEnd') {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        this.startRound();
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/core/MatchManager.js
git commit -m "feat: match manager with rounds, ring-outs, and win tracking"
```

---

### Task 11: HUD / UI Overlay

**Files:**
- Create: `src/ui/HUD.js`
- Create: `src/ui/screens/TitleScreen.js`
- Create: `src/ui/screens/PlayerJoinScreen.js`
- Modify: `index.html`

**Step 1: Add UI container to index.html**

Add before the script tag:
```html
<div id="ui-overlay"></div>
```

Add to the style block:
```css
#ui-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 10;
  font-family: 'Arial Black', Arial, sans-serif;
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
}
#ui-overlay * { pointer-events: auto; }
```

**Step 2: Create src/ui/HUD.js**

```js
export class HUD {
  constructor(players) {
    this.players = players;
    this.container = document.getElementById('ui-overlay');
    this.elements = {};
    this.init();
  }

  init() {
    // Player status bar at top
    this.statusBar = document.createElement('div');
    this.statusBar.style.cssText = `
      display: flex; justify-content: center; gap: 20px;
      padding: 10px; position: absolute; top: 0; width: 100%;
    `;
    this.container.appendChild(this.statusBar);

    for (let i = 0; i < this.players.length; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        background: rgba(0,0,0,0.5); padding: 8px 16px;
        border-radius: 8px; text-align: center; min-width: 120px;
      `;
      el.innerHTML = `
        <div style="font-size: 14px;">P${i + 1}${this.players[i].isAI ? ' (AI)' : ''}</div>
        <div class="damage-bar" style="
          width: 100%; height: 8px; background: #333;
          border-radius: 4px; margin: 4px 0; overflow: hidden;
        ">
          <div class="damage-fill" style="
            width: 0%; height: 100%; background: linear-gradient(to right, #4f4, #f44);
            transition: width 0.2s;
          "></div>
        </div>
        <div class="wins" style="font-size: 12px;"></div>
        <div class="status" style="font-size: 12px;"></div>
      `;
      this.statusBar.appendChild(el);
      this.elements[i] = el;
    }

    // Center message (countdown, winner, etc.)
    this.centerMsg = document.createElement('div');
    this.centerMsg.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 72px; font-weight: bold;
      display: none;
    `;
    this.container.appendChild(this.centerMsg);
  }

  update() {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const el = this.elements[i];
      if (!el) continue;

      const damagePct = p.ragdoll?.balance?.getDamagePercent() || 0;
      el.querySelector('.damage-fill').style.width = `${damagePct * 100}%`;

      const dots = Array(3).fill(0).map((_, j) =>
        j < p.roundWins ? '●' : '○'
      ).join(' ');
      el.querySelector('.wins').textContent = dots;

      el.querySelector('.status').textContent = p.alive ? '' : 'ELIMINATED';
      el.style.opacity = p.alive ? '1' : '0.5';
    }
  }

  showCenter(text, duration = 0) {
    this.centerMsg.textContent = text;
    this.centerMsg.style.display = 'block';
    if (duration > 0) {
      setTimeout(() => { this.centerMsg.style.display = 'none'; }, duration * 1000);
    }
  }

  hideCenter() {
    this.centerMsg.style.display = 'none';
  }

  destroy() {
    this.statusBar.remove();
    this.centerMsg.remove();
  }
}
```

**Step 3: Create src/ui/screens/TitleScreen.js**

```js
export class TitleScreen {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.onStart = null;
  }

  show() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
    `;
    this.element.innerHTML = `
      <h1 style="font-size: 80px; margin-bottom: 10px; color: #ff6644;">WOBBLY BRAWLER</h1>
      <p style="font-size: 24px; animation: blink 1s infinite;">Press ENTER to Start</p>
      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      </style>
    `;
    this.container.appendChild(this.element);

    this.handler = (e) => {
      if (e.code === 'Enter') {
        this.hide();
        if (this.onStart) this.onStart();
      }
    };
    window.addEventListener('keydown', this.handler);
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    if (this.element) this.element.remove();
  }
}
```

**Step 4: Create src/ui/screens/PlayerJoinScreen.js**

```js
export class PlayerJoinScreen {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.joined = new Set();
    this.maxPlayers = 8;
    this.onReady = null;
  }

  show() {
    this.joined.clear();
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
    `;
    this.updateDisplay();
    this.container.appendChild(this.element);

    this.handler = (e) => {
      if (e.code === 'KeyW' || e.code === 'KeyA') {
        this.joined.add(0);
        this.updateDisplay();
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
        this.joined.add(1);
        this.updateDisplay();
      }
      if (e.code === 'Enter' && this.joined.size >= 1) {
        this.hide();
        if (this.onReady) this.onReady(this.joined);
      }
    };
    window.addEventListener('keydown', this.handler);

    // Check for gamepads
    this.gamepadInterval = setInterval(() => {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]?.buttons[0]?.pressed) {
          this.joined.add(i + 2); // gamepad players start at index 2
          this.updateDisplay();
        }
      }
    }, 100);
  }

  updateDisplay() {
    if (!this.element) return;
    const slots = [];
    for (let i = 0; i < this.maxPlayers; i++) {
      const joined = this.joined.has(i);
      const label = i < 2 ? `P${i+1} (Keyboard)` : `P${i+1} (Gamepad)`;
      slots.push(`
        <div style="
          padding: 12px 24px; margin: 4px;
          background: ${joined ? 'rgba(68,255,68,0.3)' : 'rgba(255,255,255,0.1)'};
          border: 2px solid ${joined ? '#4f4' : '#555'};
          border-radius: 8px; min-width: 200px; text-align: center;
        ">
          ${label}: ${joined ? 'JOINED' : i < 2 ? 'Press movement key' : 'Press A button'}
        </div>
      `);
    }
    this.element.innerHTML = `
      <h2 style="font-size: 48px; margin-bottom: 20px;">PLAYER JOIN</h2>
      <div style="display: flex; flex-wrap: wrap; justify-content: center; max-width: 600px;">
        ${slots.join('')}
      </div>
      <p style="margin-top: 20px; font-size: 18px;">
        Empty slots will be filled with AI. Press ENTER when ready.
      </p>
    `;
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    clearInterval(this.gamepadInterval);
    if (this.element) this.element.remove();
  }
}
```

**Step 5: Commit**

```bash
git add src/ui/ index.html
git commit -m "feat: HUD with damage bars, round pips, and title/join screens"
```

---

### Task 12: Arena — Rooftop

**Files:**
- Create: `src/arenas/Arena.js`
- Create: `src/arenas/Rooftop.js`

**Step 1: Create src/arenas/Arena.js (base class)**

```js
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
```

**Step 2: Create src/arenas/Rooftop.js**

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class Rooftop extends Arena {
  constructor(game) {
    super(game);

    // Main platform
    this.addStaticBox(
      { x: 20, y: 1, z: 20 },
      { x: 0, y: -0.5, z: 0 },
      0x888888
    );

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

    // Spinning satellite dish hazard
    this.dishAngle = 0;
    this.dishSpeed = 1.2;

    // Dish arm (kinematic body for collisions)
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

    // Skyline backdrop
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

    // Spin the dish
    this.dishAngle += this.dishSpeed * dt;
    this.dishBody.position.set(0, 1.5, 0);
    this.dishBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.dishAngle);

    this.dishMesh.position.copy(this.dishBody.position);
    this.dishMesh.quaternion.copy(this.dishBody.quaternion);
  }
}
```

**Step 3: Commit**

```bash
git add src/arenas/
git commit -m "feat: rooftop arena with spinning dish hazard and breakable ledges"
```

---

### Task 13: Arena — Factory

**Files:**
- Create: `src/arenas/Factory.js`

**Step 1: Create src/arenas/Factory.js**

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class Factory extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x2a2a2a);

    // Main floor
    this.addStaticBox(
      { x: 24, y: 1, z: 16 },
      { x: 0, y: -0.5, z: 0 },
      0x555555
    );

    // Upper platforms
    this.addStaticBox(
      { x: 6, y: 0.5, z: 6 },
      { x: -6, y: 3, z: 0 },
      0x666655
    );
    this.addStaticBox(
      { x: 6, y: 0.5, z: 6 },
      { x: 6, y: 3, z: 0 },
      0x666655
    );

    // Ramps to upper platforms
    this.addRamp(game, { x: -3, y: 1.5, z: 0 }, Math.PI * 0.12);
    this.addRamp(game, { x: 3, y: 1.5, z: 0 }, -Math.PI * 0.12);

    // Conveyor belts (visual + force zones)
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

    // Warning stripes on crusher zones
    for (const pos of [{ x: 0, z: -4 }, { x: 0, z: 4 }]) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3),
        new THREE.MeshStandardMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.3,
        })
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
      body,
      mesh,
      baseY: position.y,
      lowY: 1.0,
      timer: Math.random() * 4, // offset so they don't sync
      period: 4,
      slamDuration: 0.2,
      state: 'waiting',
      update(dt) {
        this.timer += dt;
        if (this.state === 'waiting' && this.timer >= this.period) {
          this.state = 'slamming';
          this.timer = 0;
        }
        if (this.state === 'slamming') {
          const t = this.timer / this.slamDuration;
          this.body.position.y = this.baseY + (this.lowY - this.baseY) * Math.min(t, 1);
          if (t >= 1) {
            this.state = 'returning';
            this.timer = 0;
          }
        }
        if (this.state === 'returning') {
          const t = this.timer / 1.5;
          this.body.position.y = this.lowY + (this.baseY - this.lowY) * Math.min(t, 1);
          if (t >= 1) {
            this.state = 'waiting';
            this.timer = 0;
          }
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

    // Apply conveyor forces to all dynamic bodies on the belt
    for (const c of this.conveyors) {
      for (const pair of this.game.syncPairs) {
        const b = pair.body;
        if (b.mass === 0) continue;
        const p = b.position;
        if (p.x >= c.min.x && p.x <= c.max.x &&
            p.z >= c.min.z && p.z <= c.max.z &&
            p.y < 2) {
          b.applyForce(new CANNON.Vec3(c.force.x, 0, c.force.z));
        }
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/arenas/Factory.js
git commit -m "feat: factory arena with conveyors, crushers, and multi-level platforms"
```

---

### Task 14: Arena — Wrestling Ring

**Files:**
- Create: `src/arenas/WrestlingRing.js`

**Step 1: Create src/arenas/WrestlingRing.js**

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

export class WrestlingRing extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x111122);

    // Ring floor (slightly elevated)
    this.addStaticBox(
      { x: 16, y: 1, z: 16 },
      { x: 0, y: -0.5, z: 0 },
      0x336633
    );

    // Ring apron (lower border)
    this.addStaticBox({ x: 18, y: 0.6, z: 1 }, { x: 0, y: -0.3, z: -8.5 }, 0x222222);
    this.addStaticBox({ x: 18, y: 0.6, z: 1 }, { x: 0, y: -0.3, z: 8.5 }, 0x222222);
    this.addStaticBox({ x: 1, y: 0.6, z: 18 }, { x: -8.5, y: -0.3, z: 0 }, 0x222222);
    this.addStaticBox({ x: 1, y: 0.6, z: 18 }, { x: 8.5, y: -0.3, z: 0 }, 0x222222);

    // Turnbuckle posts (corners)
    const corners = [
      { x: -8, z: -8 }, { x: 8, z: -8 },
      { x: -8, z: 8 }, { x: 8, z: 8 },
    ];
    for (const c of corners) {
      this.addStaticBox(
        { x: 0.4, y: 4, z: 0.4 },
        { x: c.x, y: 2, z: c.z },
        0xcccc00
      );
    }

    // Ropes (bouncy kinematic bodies between posts)
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
      // Make rope bouncy
      const ropeMaterial = new CANNON.Material('rope');
      ropeMaterial.restitution = 1.5;
      body.material = ropeMaterial;
      game.world.addBody(body);

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          isX ? len : 0.3,
          0.3,
          isX ? 0.3 : len
        ),
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

    // Electrify timer
    this.ropeElectrifyTimer += dt;

    if (!this.ropesElectrified && this.ropeElectrifyTimer >= this.electrifyCooldown) {
      this.ropesElectrified = true;
      this.ropeElectrifyTimer = 0;
      for (const r of this.ropes) {
        r.mesh.material = new THREE.MeshStandardMaterial({
          color: 0x44ffff,
          emissive: 0x00aaff,
          emissiveIntensity: 2,
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
```

**Step 2: Commit**

```bash
git add src/arenas/WrestlingRing.js
git commit -m "feat: wrestling ring arena with bouncy ropes and electrify hazard"
```

---

### Task 15: Costumes

**Files:**
- Create: `src/character/Costumes.js`
- Modify: `src/character/Ragdoll.js`

**Step 1: Create src/character/Costumes.js**

Each costume defines geometry/material overrides per body part.

```js
import * as THREE from 'three';

export const COSTUMES = {
  wrestler: {
    name: 'Wrestler',
    head: { color: 0xffccaa },
    torso: { color: 0xff0000, scaleX: 1.2, scaleZ: 1.2 },
    arms: { color: 0xffccaa },
    legs: { color: 0x0000ff },
    hat: null,
  },
  chicken: {
    name: 'Chicken Suit',
    head: { color: 0xffffff, hat: 'comb' },
    torso: { color: 0xffffff, scaleX: 1.3, scaleZ: 1.3 },
    arms: { color: 0xffff44 },
    legs: { color: 0xff8800 },
  },
  dinosaur: {
    name: 'Dinosaur',
    head: { color: 0x44aa44, hat: 'horns' },
    torso: { color: 0x44aa44, scaleX: 1.2, scaleZ: 1.1 },
    arms: { color: 0x338833 },
    legs: { color: 0x338833 },
  },
  astronaut: {
    name: 'Astronaut',
    head: { color: 0xcccccc, hat: 'helmet' },
    torso: { color: 0xffffff, scaleX: 1.3, scaleZ: 1.3 },
    arms: { color: 0xdddddd },
    legs: { color: 0xdddddd },
  },
  pirate: {
    name: 'Pirate',
    head: { color: 0xffccaa, hat: 'pirateHat' },
    torso: { color: 0x663300 },
    arms: { color: 0xffccaa },
    legs: { color: 0x222222 },
  },
  robot: {
    name: 'Robot',
    head: { color: 0x888888, metalness: 0.9, hat: 'antenna' },
    torso: { color: 0x666666, metalness: 0.9 },
    arms: { color: 0x777777, metalness: 0.9 },
    legs: { color: 0x555555, metalness: 0.9 },
  },
  ninja: {
    name: 'Ninja',
    head: { color: 0x222222 },
    torso: { color: 0x111111 },
    arms: { color: 0x111111 },
    legs: { color: 0x111111 },
  },
  luchador: {
    name: 'Luchador',
    head: { color: 0xff00ff, hat: 'mask' },
    torso: { color: 0xff00ff },
    arms: { color: 0xffccaa },
    legs: { color: 0xffff00 },
  },
};

export const COSTUME_KEYS = Object.keys(COSTUMES);

export function applyCostume(ragdoll, costumeKey) {
  const costume = COSTUMES[costumeKey];
  if (!costume) return;

  // Apply colors and scaling to meshes
  const applyPart = (meshName, config) => {
    const mesh = ragdoll.meshes[meshName];
    if (!mesh || !config) return;
    mesh.material.color.setHex(config.color);
    if (config.metalness !== undefined) mesh.material.metalness = config.metalness;
    if (config.scaleX) mesh.scale.x = config.scaleX;
    if (config.scaleZ) mesh.scale.z = config.scaleZ;
  };

  applyPart('torso', costume.torso);
  applyPart('head', costume.head);
  applyPart('leftUpperArm', costume.arms);
  applyPart('rightUpperArm', costume.arms);
  applyPart('leftLowerArm', costume.arms);
  applyPart('rightLowerArm', costume.arms);
  applyPart('leftUpperLeg', costume.legs);
  applyPart('rightUpperLeg', costume.legs);
  applyPart('leftLowerLeg', costume.legs);
  applyPart('rightLowerLeg', costume.legs);

  // Add hat/accessory
  if (costume.head?.hat) {
    addHatAccessory(ragdoll, costume.head.hat, costume.head.color);
  }
}

function addHatAccessory(ragdoll, type, color) {
  const head = ragdoll.meshes.head;
  if (!head) return;

  let hat;
  switch (type) {
    case 'comb':
      hat = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      hat.position.y = 0.35;
      break;
    case 'horns':
      hat = new THREE.Group();
      const horn1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.25, 6),
        new THREE.MeshStandardMaterial({ color: 0x886633 })
      );
      horn1.position.set(-0.15, 0.3, 0);
      const horn2 = horn1.clone();
      horn2.position.x = 0.15;
      hat.add(horn1, horn2);
      break;
    case 'helmet':
      hat = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
      );
      break;
    case 'pirateHat':
      hat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.2, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      hat.position.y = 0.3;
      break;
    case 'antenna':
      hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      hat.position.y = 0.4;
      break;
    case 'mask':
      hat = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xff00ff })
      );
      break;
    default:
      return;
  }

  head.add(hat);
}
```

**Step 2: Commit**

```bash
git add src/character/Costumes.js
git commit -m "feat: 8 costume presets with hat accessories"
```

---

### Task 16: Costume Select Screen

**Files:**
- Create: `src/ui/screens/CostumeSelectScreen.js`

**Step 1: Create src/ui/screens/CostumeSelectScreen.js**

```js
import { COSTUMES, COSTUME_KEYS } from '../../character/Costumes.js';

export class CostumeSelectScreen {
  constructor(container, playerCount) {
    this.container = container;
    this.playerCount = playerCount;
    this.selections = {};
    this.confirmed = new Set();
    this.onReady = null;
    this.element = null;

    for (let i = 0; i < playerCount; i++) {
      this.selections[i] = 0; // index into COSTUME_KEYS
    }
  }

  show() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.8);
    `;
    this.container.appendChild(this.element);
    this.updateDisplay();

    this.handler = (e) => {
      // Player 1 navigation
      if (e.code === 'KeyA') this.navigate(0, -1);
      if (e.code === 'KeyD') this.navigate(0, 1);
      if (e.code === 'KeyW') this.confirm(0);

      // Player 2 navigation
      if (e.code === 'ArrowLeft') this.navigate(1, -1);
      if (e.code === 'ArrowRight') this.navigate(1, 1);
      if (e.code === 'ArrowUp') this.confirm(1);

      if (e.code === 'Enter' && this.confirmed.size >= this.playerCount) {
        this.hide();
        const result = {};
        for (let i = 0; i < this.playerCount; i++) {
          result[i] = COSTUME_KEYS[this.selections[i]];
        }
        if (this.onReady) this.onReady(result);
      }
    };
    window.addEventListener('keydown', this.handler);
  }

  navigate(player, dir) {
    if (this.confirmed.has(player)) return;
    const len = COSTUME_KEYS.length;
    this.selections[player] = (this.selections[player] + dir + len) % len;
    this.updateDisplay();
  }

  confirm(player) {
    this.confirmed.add(player);
    this.updateDisplay();
  }

  updateDisplay() {
    if (!this.element) return;
    const cards = [];
    for (let i = 0; i < this.playerCount; i++) {
      const key = COSTUME_KEYS[this.selections[i]];
      const costume = COSTUMES[key];
      const confirmed = this.confirmed.has(i);
      cards.push(`
        <div style="
          padding: 20px; margin: 10px;
          background: ${confirmed ? 'rgba(68,255,68,0.2)' : 'rgba(255,255,255,0.1)'};
          border: 2px solid ${confirmed ? '#4f4' : '#888'};
          border-radius: 12px; text-align: center; min-width: 160px;
        ">
          <div style="font-size: 20px; margin-bottom: 8px;">P${i + 1}</div>
          <div style="font-size: 32px; margin: 10px 0;">
            <div style="width:60px;height:60px;border-radius:50%;margin:0 auto;background:#${costume.torso.color.toString(16).padStart(6,'0')};"></div>
          </div>
          <div style="font-size: 18px;">${costume.name}</div>
          <div style="font-size: 12px; margin-top: 6px;">
            ${confirmed ? 'READY!' : '← → to browse, ↑/W to confirm'}
          </div>
        </div>
      `);
    }
    this.element.innerHTML = `
      <h2 style="font-size: 48px; margin-bottom: 20px;">CHOOSE COSTUME</h2>
      <div style="display: flex; flex-wrap: wrap; justify-content: center;">
        ${cards.join('')}
      </div>
      <p style="margin-top: 20px; font-size: 16px;">
        ${this.confirmed.size >= this.playerCount ? 'Press ENTER to start!' : ''}
      </p>
    `;
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    if (this.element) this.element.remove();
  }
}
```

**Step 2: Commit**

```bash
git add src/ui/screens/CostumeSelectScreen.js
git commit -m "feat: costume selection screen for all players"
```

---

### Task 17: Arena Select Screen

**Files:**
- Create: `src/ui/screens/ArenaSelectScreen.js`

**Step 1: Create src/ui/screens/ArenaSelectScreen.js**

```js
const ARENAS = [
  { key: 'rooftop', name: 'Rooftop', description: 'Spinning dish + breakable ledges', color: '#888888' },
  { key: 'factory', name: 'Factory', description: 'Conveyors + crushers', color: '#555555' },
  { key: 'wrestlingRing', name: 'Wrestling Ring', description: 'Bouncy ropes + electrify', color: '#336633' },
];

export class ArenaSelectScreen {
  constructor(container) {
    this.container = container;
    this.selected = 0;
    this.onReady = null;
    this.element = null;
  }

  show() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.8);
    `;
    this.container.appendChild(this.element);
    this.updateDisplay();

    this.handler = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.selected = (this.selected - 1 + ARENAS.length) % ARENAS.length;
        this.updateDisplay();
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.selected = (this.selected + 1) % ARENAS.length;
        this.updateDisplay();
      }
      if (e.code === 'Enter') {
        this.hide();
        if (this.onReady) this.onReady(ARENAS[this.selected].key);
      }
      if (e.code === 'KeyR') {
        this.selected = Math.floor(Math.random() * ARENAS.length);
        this.hide();
        if (this.onReady) this.onReady(ARENAS[this.selected].key);
      }
    };
    window.addEventListener('keydown', this.handler);
  }

  updateDisplay() {
    if (!this.element) return;
    const cards = ARENAS.map((a, i) => `
      <div style="
        padding: 24px; margin: 10px;
        background: ${i === this.selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'};
        border: 3px solid ${i === this.selected ? '#fff' : '#444'};
        border-radius: 12px; text-align: center; min-width: 180px;
        transform: ${i === this.selected ? 'scale(1.1)' : 'scale(1)'};
        transition: all 0.2s;
      ">
        <div style="width:100px;height:60px;margin:0 auto 10px;background:${a.color};border-radius:8px;"></div>
        <div style="font-size: 24px; font-weight: bold;">${a.name}</div>
        <div style="font-size: 14px; margin-top: 6px; opacity: 0.7;">${a.description}</div>
      </div>
    `).join('');

    this.element.innerHTML = `
      <h2 style="font-size: 48px; margin-bottom: 30px;">SELECT ARENA</h2>
      <div style="display: flex; justify-content: center;">${cards}</div>
      <p style="margin-top: 20px; font-size: 16px;">
        ← → to browse, ENTER to select, R for random
      </p>
    `;
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    if (this.element) this.element.remove();
  }
}
```

**Step 2: Commit**

```bash
git add src/ui/screens/ArenaSelectScreen.js
git commit -m "feat: arena selection screen with preview cards"
```

---

### Task 18: Full Game Integration

**Files:**
- Create: `src/GameApp.js`
- Modify: `src/main.js`

**Step 1: Create src/GameApp.js**

Wires together all screens, arena loading, player creation, match management, and HUD into a complete game flow.

```js
import { Game } from './core/Game.js';
import { MatchManager } from './core/MatchManager.js';
import { Player } from './character/Player.js';
import { AIPlayer } from './character/AIPlayer.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS, PLAYER_2_KEYS } from './input/KeyboardBindings.js';
import { DamageSystem } from './character/DamageSystem.js';
import { applyCostume, COSTUME_KEYS } from './character/Costumes.js';
import { HUD } from './ui/HUD.js';
import { TitleScreen } from './ui/screens/TitleScreen.js';
import { PlayerJoinScreen } from './ui/screens/PlayerJoinScreen.js';
import { CostumeSelectScreen } from './ui/screens/CostumeSelectScreen.js';
import { ArenaSelectScreen } from './ui/screens/ArenaSelectScreen.js';
import { Rooftop } from './arenas/Rooftop.js';
import { Factory } from './arenas/Factory.js';
import { WrestlingRing } from './arenas/WrestlingRing.js';

const PLAYER_COLORS = [
  0xff4444, 0x4444ff, 0x44ff44, 0xffff44,
  0xff44ff, 0x44ffff, 0xff8844, 0x8844ff,
];

const ARENA_MAP = {
  rooftop: Rooftop,
  factory: Factory,
  wrestlingRing: WrestlingRing,
};

export class GameApp {
  constructor() {
    this.game = new Game();
    this.input = new InputManager();
    this.ui = document.getElementById('ui-overlay');
    this.players = [];
    this.arena = null;
    this.hud = null;
    this.match = null;
    this.damageSystem = null;
  }

  start() {
    this.game.start();
    this.showTitle();
  }

  showTitle() {
    const screen = new TitleScreen(this.ui);
    screen.onStart = () => this.showPlayerJoin();
    screen.show();
  }

  showPlayerJoin() {
    const screen = new PlayerJoinScreen(this.ui);
    screen.onReady = (joinedSet) => this.showCostumeSelect(joinedSet);
    screen.show();
  }

  showCostumeSelect(joinedPlayers) {
    const humanCount = joinedPlayers.size;
    const totalPlayers = Math.max(humanCount, 2); // minimum 2
    const screen = new CostumeSelectScreen(this.ui, humanCount);
    screen.onReady = (costumeChoices) => {
      this.showArenaSelect(joinedPlayers, costumeChoices, totalPlayers);
    };
    screen.show();
  }

  showArenaSelect(joinedPlayers, costumeChoices, totalPlayers) {
    const screen = new ArenaSelectScreen(this.ui);
    screen.onReady = (arenaKey) => {
      this.startGame(joinedPlayers, costumeChoices, arenaKey, totalPlayers);
    };
    screen.show();
  }

  startGame(joinedPlayers, costumeChoices, arenaKey, totalPlayers) {
    // Load arena
    const ArenaClass = ARENA_MAP[arenaKey];
    this.arena = new ArenaClass(this.game);
    this.game.onUpdate((dt) => this.arena.update(dt));

    // Create damage system
    this.damageSystem = new DamageSystem(this.game);

    // Create players
    this.players = [];
    const spawnPoints = this.getSpawnPoints(totalPlayers);
    let humanIndex = 0;

    const joinedArray = [...joinedPlayers];

    // Register keyboard players
    if (joinedArray.includes(0)) {
      this.input.registerKeyboardPlayer(0, PLAYER_1_KEYS);
    }
    if (joinedArray.includes(1)) {
      this.input.registerKeyboardPlayer(1, PLAYER_2_KEYS);
    }

    // Register gamepad players
    for (const idx of joinedArray) {
      if (idx >= 2) {
        this.input.registerGamepadPlayer(idx, idx - 2);
      }
    }

    // Create human players
    for (const idx of joinedArray) {
      const color = PLAYER_COLORS[this.players.length];
      const p = new Player(this.game, this.input, idx, spawnPoints[this.players.length], color);
      const costumeKey = costumeChoices[humanIndex] || COSTUME_KEYS[0];
      applyCostume(p.ragdoll, costumeKey);
      this.damageSystem.register(p.ragdoll);
      this.players.push(p);
      humanIndex++;
    }

    // Fill remaining with AI
    while (this.players.length < totalPlayers) {
      const color = PLAYER_COLORS[this.players.length];
      const ai = new AIPlayer(this.game, this.players, spawnPoints[this.players.length], color);
      ai.isAI = true;
      const randomCostume = COSTUME_KEYS[Math.floor(Math.random() * COSTUME_KEYS.length)];
      applyCostume(ai.ragdoll, randomCostume);
      this.damageSystem.register(ai.ragdoll);
      this.players.push(ai);
    }

    // Ensure AI players have reference to all players
    for (const p of this.players) {
      if (p.isAI && p.allPlayers) {
        p.allPlayers = this.players;
      }
    }

    // HUD
    this.hud = new HUD(this.players);
    this.game.onUpdate(() => this.hud.update());

    // Match manager
    this.match = new MatchManager(this.game, this.players);
    this.match.onStateChange = (state, data) => {
      if (state === 'countdown') {
        this.hud.showCenter(Math.ceil(data.countdown).toString(), 1);
      }
      if (state === 'playing') {
        this.hud.showCenter('FIGHT!', 1.5);
      }
      if (state === 'roundEnd') {
        const winnerIdx = this.players.indexOf(data.winner);
        this.hud.showCenter(data.winner ? `P${winnerIdx + 1} wins the round!` : 'Draw!', 2.5);
      }
      if (state === 'matchEnd') {
        const winnerIdx = this.players.indexOf(data.winner);
        this.hud.showCenter(`P${winnerIdx + 1} WINS THE MATCH!`);
        setTimeout(() => {
          this.cleanup();
          this.showTitle();
        }, 5000);
      }
    };
    this.match.startMatch();
  }

  getSpawnPoints(count) {
    const radius = 5;
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        y: 3,
        z: Math.sin(angle) * radius,
      });
    }
    return points;
  }

  cleanup() {
    for (const p of this.players) p.destroy();
    this.players = [];
    if (this.arena) this.arena.destroy();
    this.arena = null;
    if (this.hud) this.hud.destroy();
    this.hud = null;
    this.match = null;
  }
}
```

**Step 2: Simplify src/main.js**

```js
import { GameApp } from './GameApp.js';

const app = new GameApp();
app.start();
```

**Step 3: Verify**

Run: `npx vite`
Expected: Title screen → Player join → Costume select → Arena select → Gameplay with HUD.

**Step 4: Commit**

```bash
git add src/GameApp.js src/main.js
git commit -m "feat: full game flow - title, join, costumes, arena select, match"
```

---

### Task 19: Camera System

**Files:**
- Create: `src/core/CameraController.js`
- Modify: `src/core/Game.js`

**Step 1: Create src/core/CameraController.js**

Dynamic camera that frames all alive players, zooms out when they spread, zooms in for close fights.

```js
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

    // Find center and bounds of all alive players
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

    // Distance determines zoom
    const spread = Math.max(maxX - minX, maxZ - minZ, 5);
    const zoom = THREE.MathUtils.clamp(spread * 1.5 + 10, this.minZoom, this.maxZoom);

    // Smooth follow
    const targetPos = new THREE.Vector3(centerX, Math.max(avgY, 2), centerZ);
    this.target.lerp(targetPos, dt * this.smoothness);

    const desiredPos = new THREE.Vector3(
      this.target.x + this.offset.x,
      this.offset.y * (zoom / 25),
      this.target.z + zoom
    );

    this.camera.position.lerp(desiredPos, dt * this.smoothness);
    this.camera.lookAt(this.target);
  }
}
```

**Step 2: Commit**

```bash
git add src/core/CameraController.js
git commit -m "feat: dynamic camera that tracks all alive players"
```

---

### Task 20: Audio System (Basic)

**Files:**
- Create: `src/audio/AudioManager.js`
- Create: `public/` directory (for audio assets placeholder)

**Step 1: Create src/audio/AudioManager.js**

Simple Web Audio API manager for sound effects (procedurally generated, no asset files needed).

```js
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playHit() {
    this.ensure();
    this.playNoise(0.1, 800, 200);
  }

  playKick() {
    this.ensure();
    this.playNoise(0.15, 400, 100);
  }

  playEliminated() {
    this.ensure();
    this.playTone(0.3, 200, 'sawtooth', -100);
  }

  playCountdown() {
    this.ensure();
    this.playTone(0.15, 600, 'square', 0);
  }

  playFight() {
    this.ensure();
    this.playTone(0.3, 800, 'square', 0);
  }

  playWin() {
    this.ensure();
    // Simple victory jingle: three rising tones
    this.playTone(0.2, 523, 'sine', 0);
    setTimeout(() => this.playTone(0.2, 659, 'sine', 0), 200);
    setTimeout(() => this.playTone(0.4, 784, 'sine', 0), 400);
  }

  playNoise(duration, freqStart, freqEnd) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTone(duration, freq, type, pitchBend) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (pitchBend) {
      osc.frequency.linearRampToValueAtTime(freq + pitchBend, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
```

**Step 2: Commit**

```bash
mkdir -p public
git add src/audio/AudioManager.js
git commit -m "feat: procedural audio manager for hits, kicks, and match events"
```

---

### Task 21: Slow-Mo Effect for Final Ring Out

**Files:**
- Modify: `src/core/Game.js`
- Modify: `src/core/MatchManager.js`

**Step 1: Add time scale to Game.js**

Add a `timeScale` property to Game and use it in the loop:

```js
// In Game constructor:
this.timeScale = 1;

// In animate(), change the step call:
world.step(this.fixedTimeStep, dt * this.timeScale, this.maxSubSteps);
```

**Step 2: Trigger slow-mo in MatchManager when last opponent eliminated**

In MatchManager, when `alivePlayers.length <= 1`:

```js
// Slow-mo on final ring out
this.game.timeScale = 0.3;
setTimeout(() => { this.game.timeScale = 1; }, 2000);
```

**Step 3: Commit**

```bash
git add src/core/Game.js src/core/MatchManager.js
git commit -m "feat: slow-motion effect on final ring out"
```

---

### Task 22: Polish & Final Integration Testing

**Files:**
- Modify: `src/GameApp.js` (wire camera, audio)
- Create: `src/core/PauseMenu.js`

**Step 1: Wire CameraController and AudioManager into GameApp**

In GameApp.startGame(), after creating players:

```js
import { CameraController } from './core/CameraController.js';
import { AudioManager } from './audio/AudioManager.js';

// In constructor:
this.audio = new AudioManager();
this.cameraController = null;

// In startGame(), after creating players:
this.cameraController = new CameraController(this.game.camera);
this.game.onUpdate((dt) => this.cameraController.update(dt, this.players));

// In onStateChange:
// countdown → this.audio.playCountdown()
// playing → this.audio.playFight()
// roundEnd → this.audio.playWin()
// matchEnd → this.audio.playWin()
```

**Step 2: Create src/core/PauseMenu.js**

```js
export class PauseMenu {
  constructor(game) {
    this.game = game;
    this.paused = false;
    this.element = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.toggle();
    });
  }

  toggle() {
    this.paused = !this.paused;
    this.game.timeScale = this.paused ? 0 : 1;

    if (this.paused) {
      this.element = document.createElement('div');
      this.element.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 100; font-family: 'Arial Black', Arial, sans-serif;
        color: white; font-size: 64px;
      `;
      this.element.textContent = 'PAUSED';
      document.body.appendChild(this.element);
    } else {
      if (this.element) this.element.remove();
      this.element = null;
    }
  }
}
```

**Step 3: Wire pause into GameApp constructor**

```js
import { PauseMenu } from './core/PauseMenu.js';

// In constructor:
this.pause = new PauseMenu(this.game);
```

**Step 4: Full verification**

Run: `npx vite`
Test the complete flow:
1. Title screen appears → press Enter
2. Player join → press WASD/arrows to join → Enter
3. Costume select → browse and confirm → Enter
4. Arena select → pick arena → Enter
5. Countdown 3, 2, 1, FIGHT!
6. Two ragdolls fight, HUD shows damage/round pips
7. Push opponent off → slow-mo → round win
8. First to 3 → match win screen
9. ESC pauses/unpauses

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: polish pass - camera, audio, pause menu, full game flow"
```

---

## Summary of Tasks

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffold + hello world | package.json, index.html, main.js |
| 2 | Game loop & core architecture | Game.js |
| 3 | Ragdoll character (10 bodies) | Ragdoll.js |
| 4 | Balance system | BalanceSystem.js |
| 5 | Input manager | InputManager.js, KeyboardBindings.js |
| 6 | Character controller (6 moves) | CharacterController.js |
| 7 | Player class | Player.js |
| 8 | Collision damage system | DamageSystem.js |
| 9 | AI controller | AIController.js, AIPlayer.js |
| 10 | Match manager | MatchManager.js |
| 11 | HUD + title/join screens | HUD.js, TitleScreen.js, PlayerJoinScreen.js |
| 12 | Rooftop arena | Arena.js, Rooftop.js |
| 13 | Factory arena | Factory.js |
| 14 | Wrestling ring arena | WrestlingRing.js |
| 15 | Costumes | Costumes.js |
| 16 | Costume select screen | CostumeSelectScreen.js |
| 17 | Arena select screen | ArenaSelectScreen.js |
| 18 | Full game integration | GameApp.js |
| 19 | Camera system | CameraController.js |
| 20 | Audio system | AudioManager.js |
| 21 | Slow-mo effect | Game.js, MatchManager.js |
| 22 | Polish & final integration | PauseMenu.js, GameApp.js |
