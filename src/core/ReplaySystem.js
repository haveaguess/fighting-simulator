import * as THREE from 'three';

/**
 * Action replay system — records player state each frame and can play it back
 * as ghost meshes in a corner overlay or full-screen in the main scene.
 */
export class ReplaySystem {
  constructor(game) {
    this.game = game;

    // Ring buffer: 300 frames ≈ 10s at 30fps
    this.maxFrames = 300;
    this.frames = [];
    this.frameIndex = 0;
    this.recording = false;
    this._sampleInterval = 1 / 30; // ~33ms
    this._sampleAccum = 0;
    this._updateCallback = null;

    // Track previous alive states for death detection
    this._prevAlive = new Map();
    this.onPlayerDeath = null; // callback(playerIndex)

    // Active replays
    this._cornerReplay = null;
    this._fullReplay = null;

    // Persistent corner replay renderer (reuse to avoid WebGL context overflow)
    this._cornerCanvas = null;
    this._cornerRenderer = null;
    this._cornerScene = null;
    this._cornerCamera = null;
    this._cornerContainer = null;
  }

  startRecording() {
    if (this.recording) return;
    this.recording = true;
    this.frames = [];
    this.frameIndex = 0;
    this._sampleAccum = 0;

    this._updateCallback = this.game.onUpdate((dt) => this._sample(dt));
  }

  stopRecording() {
    if (!this.recording) return;
    this.recording = false;
    if (this._updateCallback) {
      this.game.removeOnUpdate(this._updateCallback);
      this._updateCallback = null;
    }
  }

  _sample(dt) {
    this._sampleAccum += dt;
    if (this._sampleAccum < this._sampleInterval) return;
    this._sampleAccum -= this._sampleInterval;

    const players = this.game._allPlayers || [];
    const snapshots = [];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const ragdoll = p.ragdoll;
      if (!ragdoll || !ragdoll.bodies.torso) {
        snapshots.push(null);
        continue;
      }

      const pos = ragdoll.getPosition();
      const vel = ragdoll.bodies.torso.velocity;

      snapshots.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: vel.x,
        vy: vel.y,
        vz: vel.z,
        facingAngle: ragdoll.facingAngle,
        alive: p.alive,
        celebrating: ragdoll.celebrating,
        scale: ragdoll.scale,
        color: ragdoll.color,
      });

      // Death detection
      const prevAlive = this._prevAlive.get(i);
      if (prevAlive === true && p.alive === false) {
        if (this.onPlayerDeath) {
          this.onPlayerDeath(i);
        }
      }
      this._prevAlive.set(i, p.alive);
    }

    // Ring buffer insert
    if (this.frames.length < this.maxFrames) {
      this.frames.push({ time: performance.now(), snapshots });
    } else {
      this.frames[this.frameIndex] = { time: performance.now(), snapshots };
    }
    this.frameIndex = (this.frameIndex + 1) % this.maxFrames;
  }

  /**
   * Get the last N seconds of recorded frames in chronological order.
   */
  _getRecentFrames(seconds) {
    if (this.frames.length === 0) return [];

    const now = performance.now();
    const cutoff = now - seconds * 1000;

    // Rebuild chronological order from ring buffer
    const ordered = [];
    const len = this.frames.length;
    const start = len < this.maxFrames ? 0 : this.frameIndex;
    for (let i = 0; i < len; i++) {
      const frame = this.frames[(start + i) % len];
      if (frame.time >= cutoff) {
        ordered.push(frame);
      }
    }
    return ordered;
  }

  // ─── CORNER REPLAY (on death) ──────────────────────────────

  _ensureCornerRenderer() {
    if (this._cornerRenderer) return;

    this._cornerContainer = document.createElement('div');
    this._cornerContainer.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; z-index: 2000;
      pointer-events: none; display: none;
    `;

    const label = document.createElement('div');
    label.style.cssText = `
      color: #fff; font-family: Arial, sans-serif; font-size: 14px;
      font-weight: bold; text-align: center; padding: 4px 0;
      text-shadow: 0 0 6px rgba(255,50,50,0.8);
      letter-spacing: 2px;
    `;
    label.textContent = 'INSTANT REPLAY';
    this._cornerContainer.appendChild(label);

    this._cornerCanvas = document.createElement('canvas');
    this._cornerCanvas.width = 300;
    this._cornerCanvas.height = 200;
    this._cornerCanvas.style.cssText = 'border: 2px solid rgba(255,255,255,0.3); border-radius: 6px;';
    this._cornerContainer.appendChild(this._cornerCanvas);

    document.body.appendChild(this._cornerContainer);

    this._cornerRenderer = new THREE.WebGLRenderer({ canvas: this._cornerCanvas, antialias: false });
    this._cornerRenderer.setSize(300, 200);
    this._cornerRenderer.setClearColor(0x111122);

    this._cornerScene = new THREE.Scene();
    this._cornerCamera = new THREE.PerspectiveCamera(50, 300 / 200, 0.1, 200);

    this._cornerScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 5);
    this._cornerScene.add(dirLight);
  }

  playCornerReplay(durationSeconds = 3) {
    // Cancel any existing corner replay
    this._cleanupCornerReplay();

    const frames = this._getRecentFrames(durationSeconds);
    if (frames.length < 2) return;

    // Reuse persistent renderer
    this._ensureCornerRenderer();
    const renderer = this._cornerRenderer;
    const scene = this._cornerScene;
    const camera = this._cornerCamera;
    this._cornerContainer.style.display = 'block';

    // Create ghost meshes for each unique player in frames
    const maxPlayers = Math.max(...frames.map(f => f.snapshots.length));
    const ghosts = [];

    for (let i = 0; i < maxPlayers; i++) {
      // Find first non-null snapshot for this player to get color/scale
      let snap = null;
      for (const frame of frames) {
        if (frame.snapshots[i]) { snap = frame.snapshots[i]; break; }
      }
      if (!snap) { ghosts.push(null); continue; }

      const s = snap.scale || 1;
      const color = snap.color || 0xcccccc;
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        roughness: 0.7,
      });

      const group = new THREE.Group();

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 12, 12), mat);
      head.position.y = 0.65 * s;
      group.add(head);

      // Torso (capsule)
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3 * s, 0.5 * s, 6, 12), mat);
      group.add(torso);

      scene.add(group);
      ghosts.push(group);
    }

    // Playback state
    const playbackSpeed = 0.5;
    const totalPlayTime = (durationSeconds / playbackSpeed) * 1000; // in ms
    const startTime = performance.now();
    const frameStartTime = frames[0].time;
    const frameDuration = frames[frames.length - 1].time - frameStartTime;

    const state = { animId: null };

    const animate = () => {
      state.animId = requestAnimationFrame(animate);

      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / totalPlayTime, 1);

      // Map progress to frame time
      const targetTime = frameStartTime + progress * frameDuration;

      // Find closest frame
      let bestFrame = frames[0];
      for (const frame of frames) {
        if (frame.time <= targetTime) bestFrame = frame;
        else break;
      }

      // Update ghost positions
      let cx = 0, cy = 0, cz = 0, count = 0;
      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i];
        if (!ghost) continue;
        const snap = bestFrame.snapshots[i];
        if (!snap) { ghost.visible = false; continue; }
        ghost.visible = true;
        ghost.position.set(snap.x, snap.y, snap.z);
        ghost.rotation.y = snap.facingAngle;
        cx += snap.x; cy += snap.y; cz += snap.z;
        count++;
      }

      // Camera follows centroid
      if (count > 0) {
        cx /= count; cy /= count; cz /= count;
        camera.position.set(cx, cy + 5, cz + 10);
        camera.lookAt(cx, cy, cz);
      }

      renderer.render(scene, camera);

      if (progress >= 1) {
        this._cleanupCornerReplay();
      }
    };

    this._cornerReplay = { ghosts, state };
    animate();
  }

  _cleanupCornerReplay() {
    if (!this._cornerReplay) return;
    const { ghosts, state } = this._cornerReplay;

    if (state.animId) cancelAnimationFrame(state.animId);

    // Dispose ghosts but keep the renderer/scene/camera
    if (this._cornerScene) {
      for (const ghost of ghosts) {
        if (!ghost) continue;
        ghost.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this._cornerScene.remove(ghost);
      }
    }

    // Hide container but don't remove it
    if (this._cornerContainer) {
      this._cornerContainer.style.display = 'none';
    }
    this._cornerReplay = null;
  }

  // ─── FULL-SCREEN REPLAY ────────────────────────────────────

  playFullReplay(durationSeconds = 7, onComplete = null) {
    this._cleanupFullReplay();

    const frames = this._getRecentFrames(durationSeconds);
    if (frames.length < 2) {
      if (onComplete) onComplete();
      return;
    }

    const scene = this.game.scene;

    // Create watermark
    const watermark = document.createElement('div');
    watermark.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: rgba(255, 255, 255, 0.25); font-family: Arial, sans-serif;
      font-size: 72px; font-weight: bold; letter-spacing: 8px;
      z-index: 1500; pointer-events: none;
      text-shadow: 0 0 20px rgba(255,100,100,0.3);
    `;
    watermark.textContent = 'REPLAY';
    document.body.appendChild(watermark);

    // Create ghost meshes in main scene — with a blue-ish tint
    const maxPlayers = Math.max(...frames.map(f => f.snapshots.length));
    const ghosts = [];

    for (let i = 0; i < maxPlayers; i++) {
      let snap = null;
      for (const frame of frames) {
        if (frame.snapshots[i]) { snap = frame.snapshots[i]; break; }
      }
      if (!snap) { ghosts.push(null); continue; }

      const s = snap.scale || 1;
      // Tint: mix player color with blue for "replay ghost" look
      const baseColor = new THREE.Color(snap.color || 0xcccccc);
      const tintColor = baseColor.clone().lerp(new THREE.Color(0x4488ff), 0.4);
      const mat = new THREE.MeshStandardMaterial({
        color: tintColor,
        transparent: true,
        opacity: 0.5,
        roughness: 0.5,
        emissive: tintColor,
        emissiveIntensity: 0.15,
      });

      const group = new THREE.Group();

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 12, 12), mat);
      head.position.y = 0.65 * s;
      group.add(head);

      // Torso
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3 * s, 0.5 * s, 6, 12), mat);
      group.add(torso);

      scene.add(group);
      ghosts.push(group);
    }

    // Playback
    const playbackSpeed = 0.5;
    const totalPlayTime = (durationSeconds / playbackSpeed) * 1000;
    const startTime = performance.now();
    const frameStartTime = frames[0].time;
    const frameDuration = frames[frames.length - 1].time - frameStartTime;

    // Save original camera state
    const origCamPos = this.game.camera.position.clone();
    const origCamTarget = new THREE.Vector3(0, 2, 0);

    const updateCallback = this.game.onUpdate(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / totalPlayTime, 1);

      const targetTime = frameStartTime + progress * frameDuration;

      let bestFrame = frames[0];
      for (const frame of frames) {
        if (frame.time <= targetTime) bestFrame = frame;
        else break;
      }

      let cx = 0, cy = 0, cz = 0, count = 0;
      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i];
        if (!ghost) continue;
        const snap = bestFrame.snapshots[i];
        if (!snap) { ghost.visible = false; continue; }
        ghost.visible = true;
        ghost.position.set(snap.x, snap.y, snap.z);
        ghost.rotation.y = snap.facingAngle;
        cx += snap.x; cy += snap.y; cz += snap.z;
        count++;
      }

      // Smoothly move camera to follow ghost centroid
      if (count > 0) {
        cx /= count; cy /= count; cz /= count;
        const cam = this.game.camera;
        const targetPos = new THREE.Vector3(cx, cy + 6, cz + 14);
        cam.position.lerp(targetPos, 0.05);
        cam.lookAt(cx, cy, cz);
      }

      if (progress >= 1) {
        this._cleanupFullReplay();
        if (onComplete) onComplete();
      }
    });

    this._fullReplay = { watermark, ghosts, updateCallback };
  }

  _cleanupFullReplay() {
    if (!this._fullReplay) return;
    const { watermark, ghosts, updateCallback } = this._fullReplay;

    this.game.removeOnUpdate(updateCallback);

    for (const ghost of ghosts) {
      if (!ghost) continue;
      ghost.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.game.scene.remove(ghost);
    }

    if (watermark.parentNode) watermark.parentNode.removeChild(watermark);
    this._fullReplay = null;
  }

  // ─── CLEANUP ───────────────────────────────────────────────

  destroy() {
    this.stopRecording();
    this._cleanupCornerReplay();
    this._cleanupFullReplay();
    this._prevAlive.clear();
    this.frames = [];

    // Dispose persistent corner renderer
    if (this._cornerRenderer) {
      this._cornerRenderer.dispose();
      this._cornerRenderer = null;
    }
    if (this._cornerContainer?.parentNode) {
      this._cornerContainer.parentNode.removeChild(this._cornerContainer);
    }
    this._cornerContainer = null;
    this._cornerScene = null;
    this._cornerCamera = null;
    this._cornerCanvas = null;
  }
}
