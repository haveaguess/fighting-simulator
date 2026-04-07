import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Game } from './core/Game.js';
import { Player } from './character/Player.js';
import { AIPlayer } from './character/AIPlayer.js';
import { Ragdoll } from './character/Ragdoll.js';
import { InputManager } from './input/InputManager.js';
import { PLAYER_1_KEYS } from './input/KeyboardBindings.js';
import { CameraController } from './core/CameraController.js';
import { AudioManager } from './audio/AudioManager.js';
import { DamageSystem } from './character/DamageSystem.js';
import { applyCostume, COSTUME_KEYS, COSTUMES } from './character/Costumes.js';
import { VoiceManager } from './audio/VoiceManager.js';
import { Rooftop } from './arenas/Rooftop.js';
import { Factory } from './arenas/Factory.js';
import { WrestlingRing } from './arenas/WrestlingRing.js';
import { Landslide } from './arenas/Landslide.js';
import { LandslideChaos } from './arenas/LandslideChaos.js';
import { ReplaySystem } from './core/ReplaySystem.js';

const ARENA_MAP = {
  rooftop: { cls: Rooftop, name: 'Rooftop' },
  factory: { cls: Factory, name: 'Factory' },
  wrestlingRing: { cls: WrestlingRing, name: 'Wrestling Ring' },
  landslide: { cls: Landslide, name: 'Landslide' },
  landslideChaos: { cls: LandslideChaos, name: 'Landslide Chaos' },
};

const SCALE_PRESETS = [
  { label: 'Tiny (0.4x)', value: 0.4 },
  { label: 'Small (0.7x)', value: 0.7 },
  { label: 'Normal (1x)', value: 1.0 },
  { label: 'Big (1.5x)', value: 1.5 },
  { label: 'Huge (2x)', value: 2.0 },
  { label: 'Giant (3x)', value: 3.0 },
];

const CHAOS_EVENTS = [
  { name: 'YEET', label: 'Yeet', needsChaos: false },
  { name: 'SWAP', label: 'Swap Positions', needsChaos: false },
  { name: 'BOUNCE', label: 'Bouncy Floor', needsChaos: false },
  { name: 'TINY', label: 'Shrink Player', needsChaos: false },
  { name: 'EARTHQUAKE', label: 'Earthquake', needsChaos: false },
  { name: 'GIFT', label: 'Gift (Heal)', needsChaos: false },
  { name: 'BURIAL', label: 'Burial', needsChaos: true },
  { name: 'RAIN', label: 'Brick Rain', needsChaos: true },
];

export function startSandboxMode() {
  const game = new Game();
  const input = new InputManager();
  const audio = new AudioManager();
  game._audio = audio;
  input.registerKeyboardPlayer(0, PLAYER_1_KEYS);

  const damageSystem = new DamageSystem(game);

  // State
  let arena = null;
  let arenaKey = 'rooftop';
  let arenaCallback = null;
  let p1 = null;
  let p1Scale = 1.0;
  let p1Costume = 'wrestler';
  let dummy = null;
  let dummyPlayer = null;
  let spawnedAI = [];
  let allPlayers = [];

  // Camera
  const cam = new CameraController(game.camera);
  game.onUpdate((dt) => cam.update(dt, allPlayers));

  // Replay system
  const replay = new ReplaySystem(game);
  replay.onPlayerDeath = () => {
    replay.playCornerReplay(3);
  };
  replay.startRecording();

  // === ARENA MANAGEMENT ===
  function loadArena(key) {
    // Cleanup old
    if (arena) {
      arena.destroy();
      if (arenaCallback) game.removeOnUpdate(arenaCallback);
    }
    clearAllAI();

    arenaKey = key;
    const ArenaCls = ARENA_MAP[key].cls;
    arena = new ArenaCls(game);
    arenaCallback = game.onUpdate((dt) => arena.update(dt));

    // Reset player + dummy
    respawnP1();
    respawnDummy();
    rebuildAllPlayers();
  }

  // === PLAYER MANAGEMENT ===
  function respawnP1() {
    if (p1) {
      p1.destroy();
    }
    p1 = new Player(game, input, 0, { x: -3, y: 1.5, z: 0 }, 0x44ff44, audio);
    p1.ragdoll.destroy();
    p1.ragdoll = new Ragdoll(game, { x: -3, y: 1.5, z: 0 }, 0x44ff44, p1Scale);
    p1.controller = new (p1.controller.constructor)(p1.ragdoll, game, audio);
    p1.costumeKey = p1Costume;
    applyCostume(p1.ragdoll, p1Costume);
    p1.ragdoll.voiceManager = new VoiceManager(p1Costume);
    p1.damageSystem = damageSystem;
    damageSystem.register(p1.ragdoll);
    rebuildAllPlayers();
  }

  function changeP1Scale(scale) {
    p1Scale = scale;
    const pos = p1.ragdoll.getPosition();
    p1.destroy();
    p1 = new Player(game, input, 0, pos, 0x44ff44, audio);
    p1.ragdoll.destroy();
    p1.ragdoll = new Ragdoll(game, pos, 0x44ff44, scale);
    p1.controller = new (p1.controller.constructor)(p1.ragdoll, game, audio);
    p1.costumeKey = p1Costume;
    applyCostume(p1.ragdoll, p1Costume);
    p1.ragdoll.voiceManager = new VoiceManager(p1Costume);
    p1.damageSystem = damageSystem;
    damageSystem.register(p1.ragdoll);
    rebuildAllPlayers();
  }

  function changeP1Costume(costumeKey) {
    p1Costume = costumeKey;
    p1.costumeKey = costumeKey;
    applyCostume(p1.ragdoll, costumeKey);
    p1.ragdoll.voiceManager = new VoiceManager(costumeKey);
  }

  function respawnDummy() {
    if (dummyPlayer) {
      dummyPlayer.destroy();
    }
    dummy = new Ragdoll(game, { x: 3, y: 1.5, z: 0 }, 0xff4444);
    damageSystem.register(dummy);
    dummyPlayer = {
      ragdoll: dummy,
      alive: true,
      isAI: false,
      roundWins: 0,
      team: null,
      update() {},
      reset() {},
      destroy() { dummy.destroy(); },
    };
    rebuildAllPlayers();
  }

  function spawnAI(scale, costumeKey) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 4 + Math.random() * 3;
    const pos = { x: Math.cos(angle) * dist, y: 1.5, z: Math.sin(angle) * dist };
    const colors = [0xaa0000, 0x880000, 0xcc2200, 0x990000, 0xbb1100];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const ai = new AIPlayer(game, allPlayers, pos, color, audio, scale);
    ai.isAI = true;
    ai.costumeKey = costumeKey;
    ai.damageSystem = damageSystem;
    applyCostume(ai.ragdoll, costumeKey);
    ai.ragdoll.voiceManager = new VoiceManager(costumeKey);
    damageSystem.register(ai.ragdoll);
    spawnedAI.push(ai);
    rebuildAllPlayers();
  }

  function clearAllAI() {
    for (const ai of spawnedAI) ai.destroy();
    spawnedAI = [];
    rebuildAllPlayers();
  }

  function rebuildAllPlayers() {
    allPlayers = [p1, dummyPlayer, ...spawnedAI].filter(Boolean);
    game._allPlayers = allPlayers;
    for (const ai of spawnedAI) {
      ai.allPlayers = allPlayers;
    }
  }

  // === CHAOS EVENTS (work on any arena) ===
  // Bounce timer state
  let bounceTimer = 0;
  let tinyTimer = 0;
  let tinyTarget = null;

  game.onUpdate((dt) => {
    if (bounceTimer > 0) {
      bounceTimer -= dt;
      if (bounceTimer <= 0) {
        game.world.defaultContactMaterial.restitution = 0.1;
      }
    }
    if (tinyTimer > 0) {
      tinyTimer -= dt;
      if (tinyTimer <= 0 && tinyTarget) {
        for (const name of Object.keys(tinyTarget.ragdoll.meshes)) {
          const m = tinyTarget.ragdoll.meshes[name];
          if (m && m.scale) m.scale.divideScalar(0.4);
        }
        tinyTarget = null;
      }
    }

    // Auto-respawn P1 if fallen off
    if (p1 && !p1.alive) {
      p1.alive = true;
      const pos = p1.ragdoll.getPosition();
      if (pos.y < -5 || Math.abs(pos.x) > 20 || Math.abs(pos.z) > 20) {
        changeP1Scale(p1Scale); // respawns at center
      }
    }

    // Auto-respawn dummy if fallen off
    if (dummyPlayer && dummy) {
      const dPos = dummy.getPosition();
      if (dPos.y < -5 || Math.abs(dPos.x) > 20 || Math.abs(dPos.z) > 20) {
        respawnDummy();
      }
    }
  });

  function triggerChaosEvent(eventName) {
    // If it's a LandslideChaos-only event, delegate to the arena
    if (arena instanceof LandslideChaos) {
      // Override the random pick and force the specific event
      const origPick = arena._pickRandomEvent.bind(arena);
      arena._pickRandomEvent = () => ({ name: eventName, caption: eventName, weight: 1 });
      arena.triggerEvent();
      arena._pickRandomEvent = origPick;
      return;
    }

    // Generic events that work on any arena
    const players = allPlayers.filter(p => p.alive);
    const victim = players[Math.floor(Math.random() * players.length)];

    switch (eventName) {
      case 'YEET': {
        if (audio) audio.ensure();
        if (victim) {
          const body = victim.ragdoll.getTorso();
          body.velocity.set(
            (Math.random() - 0.5) * 10,
            25 + Math.random() * 10,
            (Math.random() - 0.5) * 10
          );
        }
        break;
      }
      case 'SWAP': {
        if (players.length >= 2) {
          const positions = players.map(p => {
            const pos = p.ragdoll.getTorso().position;
            return { x: pos.x, y: pos.y, z: pos.z };
          });
          for (let i = 0; i < players.length; i++) {
            const newPos = positions[(i + 1) % positions.length];
            players[i].ragdoll.getTorso().position.set(newPos.x, newPos.y + 1, newPos.z);
            players[i].ragdoll.getTorso().velocity.set(0, 0, 0);
          }
        }
        break;
      }
      case 'BOUNCE': {
        bounceTimer = 5;
        game.world.defaultContactMaterial.restitution = 2.0;
        break;
      }
      case 'TINY': {
        if (victim) {
          // Undo previous tiny
          if (tinyTarget) {
            for (const name of Object.keys(tinyTarget.ragdoll.meshes)) {
              const m = tinyTarget.ragdoll.meshes[name];
              if (m && m.scale) m.scale.divideScalar(0.4);
            }
          }
          tinyTarget = victim;
          tinyTimer = 5;
          for (const name of Object.keys(victim.ragdoll.meshes)) {
            const m = victim.ragdoll.meshes[name];
            if (m && m.scale) m.scale.multiplyScalar(0.4);
          }
        }
        break;
      }
      case 'EARTHQUAKE': {
        for (const p of players) {
          p.ragdoll.getTorso().applyImpulse(
            new CANNON.Vec3(
              (Math.random() - 0.5) * 20,
              5,
              (Math.random() - 0.5) * 20
            )
          );
        }
        break;
      }
      case 'GIFT': {
        if (victim && victim.ragdoll.balance) {
          victim.ragdoll.balance.damage = 0;
        }
        break;
      }
      case 'BURIAL':
      case 'RAIN':
        // These need LandslideChaos — show message
        showStatus('Switch to Landslide Chaos arena first!');
        break;
    }
  }

  // === STATUS MESSAGES ===
  let statusTimeout = null;
  function showStatus(msg) {
    statusDiv.textContent = msg;
    statusDiv.style.opacity = '1';
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => { statusDiv.style.opacity = '0'; }, 2000);
  }

  // === BUILD UI ===
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 10px; right: 10px; width: 260px;
    background: rgba(0,0,0,0.85); color: #ddd;
    font-family: 'Arial', sans-serif; font-size: 12px;
    padding: 0; border-radius: 10px; z-index: 1000;
    max-height: calc(100vh - 20px); overflow-y: auto;
    user-select: none;
  `;
  document.body.appendChild(panel);

  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    padding: 10px 14px; font-size: 16px; font-weight: bold;
    color: #fff; border-bottom: 1px solid #444;
    background: rgba(255,255,255,0.05); border-radius: 10px 10px 0 0;
  `;
  titleBar.textContent = 'SANDBOX';
  panel.appendChild(titleBar);

  function createSection(title) {
    const section = document.createElement('div');
    section.style.cssText = 'border-bottom: 1px solid #333;';

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 14px; cursor: pointer; font-weight: bold;
      color: #aaa; font-size: 11px; text-transform: uppercase;
      letter-spacing: 1px; display: flex; justify-content: space-between;
      align-items: center;
    `;
    header.textContent = title;
    const arrow = document.createElement('span');
    arrow.textContent = '\u25BC';
    arrow.style.cssText = 'font-size: 9px; transition: transform 0.2s;';
    header.appendChild(arrow);

    const body = document.createElement('div');
    body.style.cssText = 'padding: 6px 14px 10px; display: block;';

    let open = true;
    header.onclick = () => {
      open = !open;
      body.style.display = open ? 'block' : 'none';
      arrow.style.transform = open ? '' : 'rotate(-90deg)';
    };

    section.appendChild(header);
    section.appendChild(body);
    panel.appendChild(section);
    return body;
  }

  function makeBtn(text, onClick, color = '#555') {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 5px 10px; margin: 2px; border: none; border-radius: 5px;
      background: ${color}; color: #fff; cursor: pointer; font-size: 11px;
      font-family: Arial, sans-serif;
    `;
    btn.onmouseenter = () => { btn.style.filter = 'brightness(1.3)'; };
    btn.onmouseleave = () => { btn.style.filter = ''; };
    btn.onclick = onClick;
    return btn;
  }

  function makeSelect(options, onChange) {
    const sel = document.createElement('select');
    sel.style.cssText = `
      padding: 4px 6px; margin: 2px; border: 1px solid #555; border-radius: 4px;
      background: #333; color: #fff; font-size: 11px; font-family: Arial, sans-serif;
    `;
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    }
    sel.onchange = () => onChange(sel.value);
    return sel;
  }

  // --- Player Scale ---
  const scaleSection = createSection('Player Scale');
  const scaleRow = document.createElement('div');
  scaleRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
  for (const preset of SCALE_PRESETS) {
    const color = preset.value === 1.0 ? '#2a6' : (preset.value < 1 ? '#26a' : '#a62');
    scaleRow.appendChild(makeBtn(preset.label, () => {
      changeP1Scale(preset.value);
      showStatus(`Player scale: ${preset.value}x`);
    }, color));
  }
  scaleSection.appendChild(scaleRow);

  // --- Costumes ---
  const costumeSection = createSection('Costume');
  const costumeOptions = COSTUME_KEYS.map(k => ({ value: k, label: COSTUMES[k].name }));
  const costumeSelect = makeSelect(costumeOptions, (val) => {
    changeP1Costume(val);
    showStatus(`Costume: ${COSTUMES[val].name}`);
  });
  costumeSelect.value = p1Costume;
  costumeSection.appendChild(costumeSelect);

  // --- Spawn AI ---
  const spawnSection = createSection('Spawn AI');
  const spawnScaleSelect = makeSelect(
    SCALE_PRESETS.map(s => ({ value: s.value.toString(), label: s.label })),
    () => {}
  );
  spawnScaleSelect.value = '1';
  const spawnLabel1 = document.createElement('div');
  spawnLabel1.style.cssText = 'color: #888; font-size: 10px; margin: 4px 0 2px;';
  spawnLabel1.textContent = 'Size:';
  spawnSection.appendChild(spawnLabel1);
  spawnSection.appendChild(spawnScaleSelect);

  const spawnCostumeSelect = makeSelect(
    costumeOptions,
    () => {}
  );
  const spawnLabel2 = document.createElement('div');
  spawnLabel2.style.cssText = 'color: #888; font-size: 10px; margin: 4px 0 2px;';
  spawnLabel2.textContent = 'Costume:';
  spawnSection.appendChild(spawnLabel2);
  spawnSection.appendChild(spawnCostumeSelect);

  const spawnBtnRow = document.createElement('div');
  spawnBtnRow.style.cssText = 'margin-top: 6px; display: flex; flex-wrap: wrap; gap: 2px;';
  spawnBtnRow.appendChild(makeBtn('Spawn 1', () => {
    spawnAI(parseFloat(spawnScaleSelect.value), spawnCostumeSelect.value);
    showStatus('Spawned AI');
  }, '#a62'));
  spawnBtnRow.appendChild(makeBtn('Spawn 5', () => {
    for (let i = 0; i < 5; i++) {
      const randScale = SCALE_PRESETS[Math.floor(Math.random() * SCALE_PRESETS.length)].value;
      const randCostume = COSTUME_KEYS[Math.floor(Math.random() * COSTUME_KEYS.length)];
      spawnAI(randScale, randCostume);
    }
    showStatus('Spawned 5 random AI');
  }, '#a42'));
  spawnBtnRow.appendChild(makeBtn('Clear All AI', () => {
    clearAllAI();
    showStatus('Cleared all AI');
  }, '#822'));
  spawnSection.appendChild(spawnBtnRow);

  // --- Chaos Events ---
  const chaosSection = createSection('Chaos Events');
  const chaosRow = document.createElement('div');
  chaosRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
  for (const event of CHAOS_EVENTS) {
    const color = event.needsChaos ? '#864' : '#648';
    chaosRow.appendChild(makeBtn(event.label, () => {
      triggerChaosEvent(event.name);
      if (!event.needsChaos || arena instanceof LandslideChaos) {
        showStatus(`Event: ${event.label}`);
      }
    }, color));
  }
  chaosSection.appendChild(chaosRow);
  const chaosNote = document.createElement('div');
  chaosNote.style.cssText = 'color: #666; font-size: 9px; margin-top: 4px;';
  chaosNote.textContent = 'Brown buttons need Landslide Chaos arena';
  chaosSection.appendChild(chaosNote);

  // --- Arena ---
  const arenaSection = createSection('Arena');
  const arenaRow = document.createElement('div');
  arenaRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
  for (const [key, info] of Object.entries(ARENA_MAP)) {
    arenaRow.appendChild(makeBtn(info.name, () => {
      loadArena(key);
      showStatus(`Arena: ${info.name}`);
    }, '#456'));
  }
  arenaSection.appendChild(arenaRow);

  // --- Actions ---
  const actionsSection = createSection('Actions');
  const actionsRow = document.createElement('div');
  actionsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
  actionsRow.appendChild(makeBtn('Celebrate', () => {
    if (p1?.ragdoll) p1.ragdoll.startCelebration();
    showStatus('Celebrating!');
    setTimeout(() => { if (p1?.ragdoll) p1.ragdoll.stopCelebration(); }, 4000);
  }, '#684'));
  actionsRow.appendChild(makeBtn('Reset Dummy', () => {
    respawnDummy();
    showStatus('Dummy reset');
  }, '#556'));
  actionsRow.appendChild(makeBtn('Reset All', () => {
    loadArena(arenaKey);
    showStatus('Full reset');
  }, '#855'));
  actionsRow.appendChild(makeBtn(
    window.__daddyMode ? 'Daddy: ON' : 'Daddy: OFF',
    (e) => {
      window.__daddyMode = !window.__daddyMode;
      e.target.textContent = window.__daddyMode ? 'Daddy: ON' : 'Daddy: OFF';
      e.target.style.background = window.__daddyMode ? '#a84' : '#555';
      showStatus(`Daddy mode: ${window.__daddyMode ? 'ON' : 'OFF'}`);
    },
    window.__daddyMode ? '#a84' : '#555'
  ));
  actionsSection.appendChild(actionsRow);

  // --- Debug HUD ---
  const debugDiv = document.createElement('div');
  debugDiv.style.cssText = `
    position: fixed; top: 10px; left: 10px;
    background: rgba(0,0,0,0.8); color: #0f0;
    font-family: monospace; font-size: 12px;
    padding: 10px; border-radius: 8px;
    z-index: 1000; pointer-events: none;
    white-space: pre; line-height: 1.4;
    min-width: 320px;
  `;
  document.body.appendChild(debugDiv);

  game.onUpdate(() => {
    if (!p1 || !dummy) return;
    const t1 = p1.ragdoll.getTorso();
    const t2 = dummy.getTorso();
    const dist = t1.position.distanceTo(t2.position);

    const speed1 = Math.sqrt(t1.velocity.x**2 + t1.velocity.z**2);
    const c = p1.controller;
    const lines = [
      `=== SANDBOX ===`,
      `Arena: ${ARENA_MAP[arenaKey].name}  Scale: ${p1Scale}x`,
      `P1  pos=(${t1.position.x.toFixed(1)}, ${t1.position.y.toFixed(1)}, ${t1.position.z.toFixed(1)})`,
      `    speed=${speed1.toFixed(1)} mass=${t1.mass.toFixed(1)}`,
      `    moveForce=${c.moveForce.toFixed(0)} accel=${(c.moveForce/t1.mass).toFixed(1)}`,
      `    atkRange=${c.attackRange.toFixed(2)} grabRange=${c.grabRange.toFixed(2)}`,
      `    punchCD=${c.punchCooldownTime.toFixed(2)}s dmg=${c.punchDamage}`,
      `    grounded=${c.isGrounded()}`,
      `    dmg=${p1.ragdoll.balance.getDamagePercent().toFixed(0)}%`,
      `DIST=${dist.toFixed(2)}  AI=${spawnedAI.length}`,
      ...spawnedAI.slice(0, 3).map((ai, i) => {
        const ab = ai.ragdoll.getTorso();
        const ad = ai.ragdoll.getPosition();
        const adist = t1.position.distanceTo(ab.position);
        const effRange = c.attackRange + 0.35 * (ai.ragdoll.scale || 1);
        return `  AI${i} s=${(ai.ragdoll.scale||1).toFixed(1)} dist=${adist.toFixed(2)} effR=${effRange.toFixed(2)} ${adist < effRange ? 'IN RANGE' : ''}`;
      }),
    ];
    debugDiv.textContent = lines.join('\n');
  });

  // --- Status toast ---
  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = `
    position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.85); color: #fff;
    font-family: Arial, sans-serif; font-size: 16px; font-weight: bold;
    padding: 10px 24px; border-radius: 8px;
    z-index: 1100; pointer-events: none;
    transition: opacity 0.3s; opacity: 0;
  `;
  document.body.appendChild(statusDiv);

  // --- Controls legend ---
  const legendDiv = document.createElement('div');
  legendDiv.style.cssText = `
    position: fixed; bottom: 10px; left: 10px;
    background: rgba(0,0,0,0.8); color: #aaa;
    font-family: monospace; font-size: 11px;
    padding: 8px; border-radius: 8px;
    z-index: 1000; pointer-events: none;
  `;
  legendDiv.textContent = 'WASD=move  Space=jump  F=punch  G=kick  T=headbutt  R=grab';
  document.body.appendChild(legendDiv);

  // === INIT ===
  loadArena('rooftop');
  game.start();
}
