import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

// Random whimsical events triggered by the pressure plate
const EVENTS = [
  {
    name: 'BURIAL',
    caption: '☠️ BURIED ALIVE!',
    weight: 2,
  },
  {
    name: 'YEET',
    caption: '🚀 YEEEEEET!',
    weight: 2,
  },
  {
    name: 'SWAP',
    caption: '🔄 SWITCHEROO!',
    weight: 2,
  },
  {
    name: 'RAIN',
    caption: '🧱 BRICK RAIN!',
    weight: 2,
  },
  {
    name: 'BOUNCE',
    caption: '🦘 BOUNCY FLOOR!',
    weight: 1,
  },
  {
    name: 'TINY',
    caption: '🔬 HONEY I SHRUNK THE PLAYERS!',
    weight: 1,
  },
  {
    name: 'EARTHQUAKE',
    caption: '🌋 EARTHQUAKE!',
    weight: 2,
  },
  {
    name: 'GIFT',
    caption: '🎁 SURPRISE GIFT!',
    weight: 1,
  },
];

export class LandslideChaos extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x2a3a2a);

    // === MAIN PLATFORM ===
    this.addStaticBox({ x: 22, y: 1, z: 18 }, { x: 0, y: -0.5, z: 0 }, 0x667766);

    // Low walls around edge
    this.addStaticBox({ x: 22, y: 0.6, z: 0.5 }, { x: 0, y: 0.3, z: -9.25 }, 0x556655);
    this.addStaticBox({ x: 22, y: 0.6, z: 0.5 }, { x: 0, y: 0.3, z: 9.25 }, 0x556655);
    this.addStaticBox({ x: 0.5, y: 0.6, z: 18 }, { x: -11.25, y: 0.3, z: 0 }, 0x556655);
    this.addStaticBox({ x: 0.5, y: 0.6, z: 18 }, { x: 11.25, y: 0.3, z: 0 }, 0x556655);

    // === HILL with steps to pressure plate ===
    this.addStaticBox({ x: 5, y: 0.6, z: 4 }, { x: 0, y: 0.3, z: -5.5 }, 0x887766);
    this.addStaticBox({ x: 4, y: 0.6, z: 3 }, { x: 0, y: 0.9, z: -5.5 }, 0x887766);
    this.addStaticBox({ x: 3, y: 0.6, z: 2 }, { x: 0, y: 1.5, z: -5.5 }, 0x887766);

    // === PRESSURE PLATE ===
    this.plateMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.5, emissive: 0x661111, emissiveIntensity: 0.5 })
    );
    this.plateMesh.position.set(0, 1.9, -5.5);
    game.scene.add(this.plateMesh);
    this.meshes.push(this.plateMesh);

    // Question mark floating above plate
    this.questionMark = this._createTextSprite('?', 0xffcc00, 2);
    this.questionMark.position.set(0, 3.5, -5.5);
    game.scene.add(this.questionMark);
    this.meshes.push(this.questionMark);

    this.platePosition = { x: 0, y: 1.9, z: -5.5 };
    this.plateRadius = 1.0;
    this.plateCooldown = 0;

    // === BLOCK POOL — shared shape, reusable bodies ===
    this.blocks = [];
    this.blockMeshes = [];
    const blockShape = new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4));
    const blockColors = [0xcc6633, 0xaa5522, 0x886644, 0x997755, 0xbb7744];

    for (let i = 0; i < 100; i++) {
      const body = new CANNON.Body({ mass: 2, shape: blockShape, linearDamping: 0.1 });
      body.position.set(0, 200 + i, 0);
      body.sleep();
      game.world.addBody(body);

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshStandardMaterial({ color: blockColors[i % blockColors.length], roughness: 0.8 })
      );
      mesh.castShadow = true;
      mesh.visible = false;
      game.scene.add(mesh);

      this.blocks.push(body);
      this.blockMeshes.push(mesh);
      this.bodies.push(body);
      this.meshes.push(mesh);
    }

    // === CAPTION DISPLAY ===
    this.captionDiv = document.createElement('div');
    this.captionDiv.style.cssText = `
      position: fixed; top: 35%; left: 50%; transform: translate(-50%, -50%);
      font-family: 'Arial Black', Arial, sans-serif; font-size: 48px;
      color: white; text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
      z-index: 500; pointer-events: none; text-align: center;
      display: none; transition: opacity 0.3s;
    `;
    document.body.appendChild(this.captionDiv);

    // State
    this.eventActive = false;
    this.eventTimer = 0;
    this.currentEvent = null;
    this._rumbleTimer = 0;
    this._bounceTimer = 0;
    this._tinyTimer = 0;
    this._blockDropIndex = 0;
    this._blockDropTimer = 0;
  }

  _createTextSprite(text, color, size) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  showCaption(text, duration = 2.5) {
    this.captionDiv.textContent = text;
    this.captionDiv.style.display = 'block';
    this.captionDiv.style.opacity = '1';
    setTimeout(() => {
      this.captionDiv.style.opacity = '0';
      setTimeout(() => { this.captionDiv.style.display = 'none'; }, 300);
    }, duration * 1000);
  }

  _pickRandomEvent() {
    const totalWeight = EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalWeight;
    for (const e of EVENTS) {
      r -= e.weight;
      if (r <= 0) return e;
    }
    return EVENTS[0];
  }

  _pickRandomPlayer() {
    const players = (this.game._allPlayers || []).filter(p => p.alive);
    if (players.length === 0) return null;
    return players[Math.floor(Math.random() * players.length)];
  }

  _resetBlocks() {
    for (let i = 0; i < this.blocks.length; i++) {
      this.blocks[i].position.set(0, 200 + i, 0);
      this.blocks[i].velocity.set(0, 0, 0);
      this.blocks[i].sleep();
      this.blockMeshes[i].visible = false;
    }
    this._blockDropIndex = 0;
  }

  triggerEvent() {
    const event = this._pickRandomEvent();
    this.currentEvent = event;
    this.eventActive = true;
    this.eventTimer = 0;
    this._blockDropIndex = 0;
    this._blockDropTimer = 0;

    this.showCaption(event.caption);
    this.plateMesh.material.emissiveIntensity = 3;

    const audio = this.game._audio;
    const victim = this._pickRandomPlayer();

    switch (event.name) {
      case 'BURIAL': {
        // Drop 80 blocks on a random player
        if (audio) audio.playRumble();
        this._burialTarget = victim;
        break;
      }
      case 'YEET': {
        // Launch a random player into the sky
        if (audio) audio.playBoing();
        if (victim) {
          const body = victim.ragdoll.getTorso();
          body.velocity.set((Math.random() - 0.5) * 10, 25 + Math.random() * 10, (Math.random() - 0.5) * 10);
        }
        break;
      }
      case 'SWAP': {
        // Swap all players' positions
        if (audio) audio.playMagic();
        const players = (this.game._allPlayers || []).filter(p => p.alive);
        if (players.length >= 2) {
          const positions = players.map(p => {
            const pos = p.ragdoll.getTorso().position;
            return { x: pos.x, y: pos.y, z: pos.z };
          });
          // Rotate positions
          for (let i = 0; i < players.length; i++) {
            const newPos = positions[(i + 1) % positions.length];
            players[i].ragdoll.getTorso().position.set(newPos.x, newPos.y + 1, newPos.z);
            players[i].ragdoll.getTorso().velocity.set(0, 0, 0);
          }
        }
        break;
      }
      case 'RAIN': {
        // Rain blocks across the whole arena
        if (audio) audio.playDramatic();
        this._rainMode = true;
        break;
      }
      case 'BOUNCE': {
        // Make the floor super bouncy for a few seconds
        if (audio) audio.playBoing();
        this._bounceTimer = 5;
        this.game.world.defaultContactMaterial.restitution = 2.0;
        break;
      }
      case 'TINY': {
        // Shrink a random player's visual (cosmetic only, physics same)
        if (audio) audio.playMagic();
        if (victim) {
          this._tinyTarget = victim;
          this._tinyTimer = 5;
          // Scale down all meshes
          for (const name of Object.keys(victim.ragdoll.meshes)) {
            const m = victim.ragdoll.meshes[name];
            if (m && m.scale) m.scale.multiplyScalar(0.4);
          }
        }
        break;
      }
      case 'EARTHQUAKE': {
        // Violent shaking + blocks from all sides
        if (audio) audio.playRumble();
        this._rumbleTimer = 3;
        this._rainMode = true;
        // Push all players randomly
        const players = (this.game._allPlayers || []).filter(p => p.alive);
        for (const p of players) {
          p.ragdoll.getTorso().applyImpulse(
            new CANNON.Vec3((Math.random() - 0.5) * 20, 5, (Math.random() - 0.5) * 20)
          );
        }
        break;
      }
      case 'GIFT': {
        // Heal the player who pressed the plate!
        if (audio) audio.playMagic();
        if (victim && victim.ragdoll.balance) {
          victim.ragdoll.balance.damage = 0;
          this.showCaption('🎁 FULL HEAL! Lucky you!', 2);
        }
        break;
      }
    }
  }

  update(dt) {
    super.update(dt);

    // Question mark bobbing
    if (this.questionMark) {
      this.questionMark.position.y = 3.5 + Math.sin(performance.now() * 0.003) * 0.3;
      this.questionMark.material.rotation = Math.sin(performance.now() * 0.002) * 0.2;
    }

    // === CHECK PRESSURE PLATE ===
    this.plateCooldown = Math.max(0, this.plateCooldown - dt);
    if (this.plateCooldown <= 0 && !this.eventActive) {
      const allPlayers = this.game._allPlayers || [];
      for (const p of allPlayers) {
        if (!p.alive) continue;
        const pos = p.ragdoll.getPosition();
        const dx = pos.x - this.platePosition.x;
        const dz = pos.z - this.platePosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < this.plateRadius && pos.y > 1.2 && pos.y < 3.5) {
          this.triggerEvent();
          break;
        }
      }

      // Pulse plate
      const pulse = 0.5 + Math.sin(performance.now() * 0.005) * 0.5;
      this.plateMesh.material.emissiveIntensity = 0.3 + pulse * 0.5;
    }

    // === EVENT UPDATES ===
    if (this.eventActive) {
      this.eventTimer += dt;

      // BURIAL — drop blocks on target
      if (this.currentEvent?.name === 'BURIAL' && this._burialTarget) {
        this._blockDropTimer += dt;
        while (this._blockDropTimer > 0.03 && this._blockDropIndex < 80) {
          const block = this.blocks[this._blockDropIndex];
          const mesh = this.blockMeshes[this._blockDropIndex];
          const tPos = this._burialTarget.ragdoll.getPosition();
          block.position.set(
            tPos.x + (Math.random() - 0.5) * 3,
            8 + Math.random() * 4,
            tPos.z + (Math.random() - 0.5) * 3
          );
          block.velocity.set((Math.random() - 0.5) * 2, -3, (Math.random() - 0.5) * 2);
          block.wakeUp();
          mesh.visible = true;
          this._blockDropIndex++;
          this._blockDropTimer -= 0.03;
        }
      }

      // RAIN / EARTHQUAKE — blocks across arena
      if (this._rainMode) {
        this._blockDropTimer += dt;
        while (this._blockDropTimer > 0.05 && this._blockDropIndex < 100) {
          const block = this.blocks[this._blockDropIndex];
          const mesh = this.blockMeshes[this._blockDropIndex];
          block.position.set(
            (Math.random() - 0.5) * 18,
            10 + Math.random() * 5,
            (Math.random() - 0.5) * 14
          );
          block.velocity.set((Math.random() - 0.5) * 3, -2, (Math.random() - 0.5) * 3);
          block.wakeUp();
          mesh.visible = true;
          this._blockDropIndex++;
          this._blockDropTimer -= 0.05;
        }
      }

      // Sync visible blocks
      for (let i = 0; i < this.blocks.length; i++) {
        if (this.blockMeshes[i].visible) {
          this.blockMeshes[i].position.copy(this.blocks[i].position);
          this.blockMeshes[i].quaternion.copy(this.blocks[i].quaternion);
        }
      }

      // Block damage on contact with players
      this._checkBlockDamage();

      // End event after timeout
      if (this.eventTimer > 6) {
        this.eventActive = false;
        this._rainMode = false;
        this._burialTarget = null;
        this.plateCooldown = 3;
        this.plateMesh.material.emissiveIntensity = 0.5;
        this.currentEvent = null;

        // Clean up blocks after a delay
        setTimeout(() => this._resetBlocks(), 3000);
      }
    }

    // === BOUNCE TIMER ===
    if (this._bounceTimer > 0) {
      this._bounceTimer -= dt;
      if (this._bounceTimer <= 0) {
        this.game.world.defaultContactMaterial.restitution = 0.1;
      }
    }

    // === TINY TIMER ===
    if (this._tinyTimer > 0) {
      this._tinyTimer -= dt;
      if (this._tinyTimer <= 0 && this._tinyTarget) {
        // Restore scale
        for (const name of Object.keys(this._tinyTarget.ragdoll.meshes)) {
          const m = this._tinyTarget.ragdoll.meshes[name];
          if (m && m.scale) m.scale.divideScalar(0.4);
        }
        this._tinyTarget = null;
      }
    }

    // === CAMERA RUMBLE ===
    if (this._rumbleTimer > 0) {
      this._rumbleTimer -= dt;
      const cam = this.game.camera;
      const intensity = Math.min(this._rumbleTimer, 1);
      cam.position.x += (Math.random() - 0.5) * intensity * 0.25;
      cam.position.y += (Math.random() - 0.5) * intensity * 0.1;
    }

    // Sync remaining visible blocks even when event not active
    if (!this.eventActive) {
      for (let i = 0; i < this.blocks.length; i++) {
        if (this.blockMeshes[i].visible) {
          this.blockMeshes[i].position.copy(this.blocks[i].position);
          this.blockMeshes[i].quaternion.copy(this.blocks[i].quaternion);
          if (this.blocks[i].position.y < -10) {
            this.blocks[i].position.set(0, 200 + i, 0);
            this.blocks[i].sleep();
            this.blockMeshes[i].visible = false;
          }
        }
      }
    }
  }

  _checkBlockDamage() {
    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.alive || !p.ragdoll) continue;
      const pPos = p.ragdoll.getTorso().position;

      for (let i = 0; i < this.blocks.length; i++) {
        if (!this.blockMeshes[i].visible) continue;
        const block = this.blocks[i];
        // Only damage if block is falling fast
        if (block.velocity.y > -1) continue;

        const dx = pPos.x - block.position.x;
        const dy = pPos.y - block.position.y;
        const dz = pPos.z - block.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 1.2) {
          p.ragdoll.balance.takeDamage(15);
          // Small knockback
          const knockMult = p.ragdoll.balance.getKnockbackMultiplier();
          p.ragdoll.getTorso().applyImpulse(new CANNON.Vec3(
            dx * 5 * knockMult, 3 * knockMult, dz * 5 * knockMult
          ));
          break;
        }
      }
    }
  }

  destroy() {
    super.destroy();
    if (this.captionDiv) this.captionDiv.remove();
    // Restore restitution
    this.game.world.defaultContactMaterial.restitution = 0.1;
    // Restore tiny
    if (this._tinyTarget) {
      for (const name of Object.keys(this._tinyTarget.ragdoll.meshes)) {
        const m = this._tinyTarget.ragdoll.meshes[name];
        if (m && m.scale) m.scale.divideScalar(0.4);
      }
    }
  }
}
