import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Game } from './core/Game.js';
import { Player } from './character/Player.js';
import { Ragdoll } from './character/Ragdoll.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS } from './input/KeyboardBindings.js';
import { CameraController } from './core/CameraController.js';
import { AudioManager } from './audio/AudioManager.js';

export function startTestMode() {
  const game = new Game();
  const input = new InputManager();
  const audio = new AudioManager();
  game._audio = audio;
  input.registerKeyboardPlayer(0, PLAYER_1_KEYS);

  // Simple flat arena — no hazards
  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(15, 0.5, 15)),
  });
  groundBody.position.set(0, -0.5, 0);
  game.world.addBody(groundBody);

  const groundMesh = new THREE.Mesh(
    new THREE.BoxGeometry(30, 1, 30),
    new THREE.MeshStandardMaterial({ color: 0x666666 })
  );
  groundMesh.receiveShadow = true;
  groundMesh.position.set(0, -0.5, 0);
  game.scene.add(groundMesh);
  game.scene.background = new THREE.Color(0x222244);

  // Grid lines on the ground for distance reference
  const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x333333);
  gridHelper.position.y = 0.01;
  game.scene.add(gridHelper);

  // Player 1 — human controlled
  const p1 = new Player(game, input, 0, { x: -3, y: 1.5, z: 0 }, 0x44ff44, audio);
  p1.costumeKey = 'wrestler';

  // Dummy enemy — a ragdoll that doesn't move
  const dummy = new Ragdoll(game, { x: 3, y: 1.5, z: 0 }, 0xff4444);
  const dummyPlayer = {
    ragdoll: dummy,
    alive: true,
    isAI: false,
    roundWins: 0,
    update() {},
    reset() {},
    destroy() { dummy.destroy(); },
  };

  const allPlayers = [p1, dummyPlayer];
  game._allPlayers = allPlayers;

  // Camera
  const cam = new CameraController(game.camera);
  game.onUpdate((dt) => cam.update(dt, allPlayers));

  // === DEBUG HUD ===
  const debugDiv = document.createElement('div');
  debugDiv.style.cssText = `
    position: fixed; top: 10px; left: 10px;
    background: rgba(0,0,0,0.8); color: #0f0;
    font-family: monospace; font-size: 13px;
    padding: 12px; border-radius: 8px;
    z-index: 1000; pointer-events: none;
    white-space: pre; line-height: 1.5;
    min-width: 350px;
  `;
  document.body.appendChild(debugDiv);

  // Event log (scrolling)
  const eventLog = [];
  function logEvent(msg) {
    eventLog.push({ time: performance.now(), msg });
    if (eventLog.length > 8) eventLog.shift();
  }

  // Monkey-patch the controller to log attacks
  const origHit = p1.controller._hitNearby.bind(p1.controller);
  p1.controller._hitNearby = function(impulse, damage) {
    const myPos = p1.ragdoll.getTorso().position;
    const dummyPos = dummy.getTorso().position;
    const dist = myPos.distanceTo(dummyPos);
    const inRange = dist < p1.controller.attackRange;
    logEvent(`ATTACK imp=${impulse} dist=${dist.toFixed(2)} ${inRange ? 'HIT!' : 'MISS'}`);
    origHit(impulse, damage);
    if (inRange) {
      const dv = dummy.getTorso().velocity;
      logEvent(`  -> knockback vel=(${dv.x.toFixed(1)}, ${dv.y.toFixed(1)}, ${dv.z.toFixed(1)})`);
    }
  };

  // Collision tracking on dummy
  dummy.getTorso().addEventListener('collide', (e) => {
    const imp = e.contact.getImpactVelocityAlongNormal();
    if (Math.abs(imp) > 0.5) {
      logEvent(`COLLISION impact=${imp.toFixed(2)}`);
    }
  });

  // Update debug HUD each frame
  game.onUpdate(() => {
    const t1 = p1.ragdoll.getTorso();
    const t2 = dummy.getTorso();
    const dist = t1.position.distanceTo(t2.position);

    const lines = [
      `=== TEST MODE ===`,
      `P1  pos=(${t1.position.x.toFixed(2)}, ${t1.position.y.toFixed(2)}, ${t1.position.z.toFixed(2)})`,
      `    vel=(${t1.velocity.x.toFixed(2)}, ${t1.velocity.y.toFixed(2)}, ${t1.velocity.z.toFixed(2)})`,
      `DUM pos=(${t2.position.x.toFixed(2)}, ${t2.position.y.toFixed(2)}, ${t2.position.z.toFixed(2)})`,
      `    vel=(${t2.velocity.x.toFixed(2)}, ${t2.velocity.y.toFixed(2)}, ${t2.velocity.z.toFixed(2)})`,
      `    dmg=${dummy.balance.getDamagePercent().toFixed(0)}%`,
      `DIST=${dist.toFixed(2)}  range=${p1.controller.attackRange}`,
      `grounded=${p1.controller.isGrounded()}  cooldowns: P=${p1.controller.punchCooldown.toFixed(2)} K=${p1.controller.kickCooldown.toFixed(2)}`,
      ``,
      `--- Events ---`,
      ...eventLog.map(e => e.msg),
    ];

    debugDiv.textContent = lines.join('\n');
  });

  // Controls legend
  const legendDiv = document.createElement('div');
  legendDiv.style.cssText = `
    position: fixed; bottom: 10px; left: 10px;
    background: rgba(0,0,0,0.8); color: #aaa;
    font-family: monospace; font-size: 12px;
    padding: 10px; border-radius: 8px;
    z-index: 1000; pointer-events: none;
  `;
  legendDiv.textContent = 'WASD=move  Space=jump  F=punch  G=kick  T=headbutt  R=grab';
  document.body.appendChild(legendDiv);

  game.start();
}
