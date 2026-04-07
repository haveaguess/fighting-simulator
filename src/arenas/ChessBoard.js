import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena.js';

// Chess pieces and their movement rules
const CHESS_PIECES = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];

const PIECE_COLORS = {
  pawn: 0xccaa66,
  rook: 0x888888,
  knight: 0x66aa88,
  bishop: 0xaa66aa,
  queen: 0xffcc44,
  king: 0xff4444,
};

// Movement directions for each piece (unit vectors on the XZ plane)
// Players can move continuously in these directions (not grid-locked)
const PIECE_MOVEMENT = {
  pawn: [{ x: 0, z: -1 }, { x: -1, z: -1 }, { x: 1, z: -1 }], // forward + diagonal forward
  rook: [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }], // straight lines
  knight: [ // L-shapes — all 8 knight directions
    { x: 1, z: 2 }, { x: 2, z: 1 }, { x: 2, z: -1 }, { x: 1, z: -2 },
    { x: -1, z: -2 }, { x: -2, z: -1 }, { x: -2, z: 1 }, { x: -1, z: 2 },
  ],
  bishop: [{ x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: -1, z: -1 }], // diagonals
  queen: [ // all 8 directions
    { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
    { x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: -1, z: -1 },
  ],
  king: [ // all 8 directions (same as queen, but movement is slower)
    { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
    { x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: -1, z: -1 },
  ],
};

// Speed multiplier per piece
const PIECE_SPEED = {
  pawn: 0.8,
  rook: 1.0,
  knight: 1.3, // knights are fast (compensates for weird movement)
  bishop: 1.1,
  queen: 0.9, // queen is powerful but not the fastest
  king: 0.7, // king is slow
};

export class ChessBoard extends Arena {
  constructor(game) {
    super(game);

    game.scene.background = new THREE.Color(0x2a1a0a);

    const tileSize = 2.5;
    const boardSize = 8;
    const boardWidth = tileSize * boardSize;
    const offset = -boardWidth / 2 + tileSize / 2;

    // === SOLID PLATFORM underneath (physics — one big slab, no cracks) ===
    this.addStaticBox(
      { x: boardWidth + 1, y: 1, z: boardWidth + 1 },
      { x: 0, y: -0.5, z: 0 },
      0x553322
    );

    // === CHESS BOARD TILES (visual only — sit on top of the platform) ===
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const isWhite = (row + col) % 2 === 0;
        const color = isWhite ? 0xeeddcc : 0x664433;
        const x = offset + col * tileSize;
        const z = offset + row * tileSize;
        const tileMesh = new THREE.Mesh(
          new THREE.BoxGeometry(tileSize - 0.02, 0.1, tileSize - 0.02),
          new THREE.MeshStandardMaterial({ color })
        );
        tileMesh.position.set(x, 0.05, z);
        tileMesh.receiveShadow = true;
        game.scene.add(tileMesh);
        this.meshes.push(tileMesh);
      }
    }

    // === BOARD BORDER — low lip you can be knocked over ===
    const borderThick = 0.4;
    const borderHeight = 0.3;
    const half = boardWidth / 2;
    // North/South
    this.addStaticBox(
      { x: boardWidth + borderThick * 2, y: borderHeight, z: borderThick },
      { x: 0, y: borderHeight / 2, z: -half - borderThick / 2 },
      0x442211
    );
    this.addStaticBox(
      { x: boardWidth + borderThick * 2, y: borderHeight, z: borderThick },
      { x: 0, y: borderHeight / 2, z: half + borderThick / 2 },
      0x442211
    );
    // East/West
    this.addStaticBox(
      { x: borderThick, y: borderHeight, z: boardWidth },
      { x: -half - borderThick / 2, y: borderHeight / 2, z: 0 },
      0x442211
    );
    this.addStaticBox(
      { x: borderThick, y: borderHeight, z: boardWidth },
      { x: half + borderThick / 2, y: borderHeight / 2, z: 0 },
      0x442211
    );

    // === COORDINATE LABELS (A-H, 1-8) ===
    const files = 'ABCDEFGH';
    for (let i = 0; i < 8; i++) {
      // File labels (A-H) along bottom
      const fileSprite = this._createLabel(files[i], 0xccaa88);
      fileSprite.position.set(offset + i * tileSize, 0.01, half + 1.5);
      game.scene.add(fileSprite);
      this.meshes.push(fileSprite);

      // Rank labels (1-8) along left
      const rankSprite = this._createLabel(String(8 - i), 0xccaa88);
      rankSprite.position.set(-half - 1.5, 0.01, offset + i * tileSize);
      game.scene.add(rankSprite);
      this.meshes.push(rankSprite);
    }

    // === PIECE ASSIGNMENT ===
    // Store piece data to be applied to players (checked every frame for new spawns)
    this.pieceAssignments = new Map(); // player -> piece type

    // === PIECE HAT INDICATORS ===
    // Each player gets a chess piece shape floating above their head
    this.pieceHats = new Map();

    // === HUD showing piece type and allowed directions ===
    this.hudDiv = document.createElement('div');
    this.hudDiv.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.7); color: #eee;
      font-family: 'Arial', sans-serif; font-size: 14px;
      padding: 8px 16px; border-radius: 8px;
      z-index: 800; pointer-events: none; text-align: center;
      display: none;
    `;
    document.body.appendChild(this.hudDiv);

    // Movement constraint state
    this._moveOverrides = new Map(); // ragdoll -> { piece, directions }
  }

  _createLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1, 1, 1);
    return sprite;
  }

  // Create chess piece shape using LatheGeometry (profile revolved around Y axis)
  // Returns a full-size piece mesh that encloses the character
  _createPieceShape(pieceType, scale, color) {
    const s = scale || 1;
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.15,
      roughness: 0.4,
      transparent: true,
      opacity: 0.75,
    });

    // Profile points for LatheGeometry: [Vector2(radius, height)]
    // Heights normalized to ~0-2 range, will be scaled by character size
    let points;
    switch (pieceType) {
      case 'pawn':
        points = [
          [0, 0], [0.4, 0], [0.42, 0.05], [0.35, 0.1], [0.2, 0.15],
          [0.15, 0.4], [0.18, 0.5], [0.22, 0.55], [0.22, 0.6],
          [0.18, 0.65], [0.12, 0.8], [0.18, 0.95], [0.22, 1.05],
          [0.2, 1.15], [0.12, 1.2], [0, 1.25],
        ];
        break;
      case 'rook':
        points = [
          [0, 0], [0.45, 0], [0.47, 0.05], [0.38, 0.1], [0.22, 0.15],
          [0.18, 0.5], [0.2, 0.6], [0.25, 0.65], [0.25, 0.7],
          [0.2, 0.75], [0.18, 0.9], [0.2, 1.0], [0.28, 1.05],
          [0.3, 1.15], [0.3, 1.25], [0.25, 1.25], [0.25, 1.15],
          [0.15, 1.15], [0.15, 1.25], [0.08, 1.25], [0.08, 1.1],
          [0, 1.1],
        ];
        break;
      case 'knight':
        // Knight is asymmetric — use a group instead of lathe
        return this._createKnightShape(s, color);
      case 'bishop':
        points = [
          [0, 0], [0.42, 0], [0.44, 0.05], [0.36, 0.1], [0.2, 0.15],
          [0.16, 0.5], [0.19, 0.6], [0.22, 0.65], [0.22, 0.7],
          [0.18, 0.75], [0.14, 0.9], [0.16, 1.0], [0.2, 1.1],
          [0.15, 1.2], [0.08, 1.35], [0.04, 1.45], [0.06, 1.5],
          [0.04, 1.55], [0, 1.6],
        ];
        break;
      case 'queen':
        points = [
          [0, 0], [0.45, 0], [0.47, 0.05], [0.38, 0.1], [0.22, 0.15],
          [0.18, 0.5], [0.2, 0.6], [0.25, 0.65], [0.25, 0.7],
          [0.2, 0.75], [0.16, 0.9], [0.18, 1.0], [0.22, 1.1],
          [0.18, 1.2], [0.12, 1.35], [0.16, 1.45], [0.2, 1.5],
          [0.14, 1.6], [0.08, 1.65], [0.1, 1.7], [0.06, 1.75],
          [0, 1.8],
        ];
        break;
      case 'king':
        points = [
          [0, 0], [0.45, 0], [0.47, 0.05], [0.38, 0.1], [0.22, 0.15],
          [0.18, 0.5], [0.2, 0.6], [0.25, 0.65], [0.25, 0.7],
          [0.2, 0.75], [0.16, 0.9], [0.18, 1.0], [0.22, 1.1],
          [0.18, 1.2], [0.1, 1.4], [0.06, 1.5], [0.08, 1.55],
          [0.04, 1.6], [0, 1.65],
        ];
        break;
      default:
        points = [[0, 0], [0.3, 0], [0.2, 0.5], [0.15, 1.0], [0, 1.1]];
    }

    const vectors = points.map(([r, h]) => new THREE.Vector2(r * s, h * s));
    const geo = new THREE.LatheGeometry(vectors, 24);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    // Add cross on top for king
    if (pieceType === 'king') {
      const crossMat = mat.clone();
      crossMat.opacity = 0.7;
      const vert = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.25 * s, 0.04 * s), crossMat);
      vert.position.y = 1.75 * s;
      mesh.add(vert);
      const horiz = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.04 * s, 0.04 * s), crossMat);
      horiz.position.y = 1.8 * s;
      mesh.add(horiz);
    }

    return mesh;
  }

  _createKnightShape(s, color) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.15,
      roughness: 0.4,
      transparent: true,
      opacity: 0.75,
    });
    const group = new THREE.Group();

    // Base (lathe)
    const basePoints = [
      [0, 0], [0.42, 0], [0.44, 0.05], [0.35, 0.1], [0.2, 0.15], [0.18, 0.5], [0, 0.5],
    ].map(([r, h]) => new THREE.Vector2(r * s, h * s));
    group.add(new THREE.Mesh(new THREE.LatheGeometry(basePoints, 16), mat));

    // Horse head — elongated box tilted forward
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * s, 0.6 * s, 0.3 * s),
      mat
    );
    head.position.set(0, 0.8 * s, 0.05 * s);
    head.rotation.x = -0.3;
    group.add(head);

    // Snout
    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(0.15 * s, 0.15 * s, 0.2 * s),
      mat
    );
    snout.position.set(0, 0.65 * s, 0.2 * s);
    group.add(snout);

    // Ears
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.05 * s, 0.15 * s, 4),
      mat
    );
    ear.position.set(0.06 * s, 1.1 * s, 0);
    group.add(ear);
    const ear2 = ear.clone();
    ear2.position.x = -0.06 * s;
    group.add(ear2);

    return group;
  }

  _applyPieceLook(player, pieceType) {
    const ragdoll = player.ragdoll;
    if (!ragdoll) return;

    // Determine white/black team based on player index
    const players = this.game._allPlayers || [];
    const idx = players.indexOf(player);
    const isWhiteTeam = !player.isAI; // humans are white, AI are black
    const pieceColor = isWhiteTeam ? 0xf5f0e0 : 0x2a2520;

    const s = ragdoll.scale || 1;

    // Create the chess piece shell that surrounds the character
    const pieceShell = this._createPieceShape(pieceType, s, pieceColor);
    pieceShell.position.y = -0.5 * s;
    ragdoll.meshes.torso.add(pieceShell);

    // Floating piece name label above the character
    const emoji = { pawn: '♟', rook: '♜', knight: '♞', bishop: '♝', queen: '♛', king: '♚' }[pieceType] || '';
    const label = this._createLabel(`${emoji} ${pieceType.toUpperCase()}`, isWhiteTeam ? 0xffffff : 0xff8844);
    label.scale.set(1.5 * s, 0.5 * s, 1);
    ragdoll._chessPieceLabel = label;
    this.game.scene.add(label);
    this.meshes.push(label);

    // Don't make body transparent — keep characters fully visible
    // Just tint them to match their team
    const tint = isWhiteTeam ? 0xeeeedd : 0x554433;
    const bodyParts = ['torso', 'leftUpperArm', 'rightUpperArm',
      'leftLowerArm', 'rightLowerArm', 'leftUpperLeg', 'rightUpperLeg',
      'leftLowerLeg', 'rightLowerLeg'];
    for (const part of bodyParts) {
      const mesh = ragdoll.meshes[part];
      if (mesh?.material) {
        mesh.material.color.setHex(tint);
      }
    }
    if (ragdoll.meshes.head?.material) {
      ragdoll.meshes.head.material.color.setHex(isWhiteTeam ? 0xffeecc : 0x443322);
    }
  }

  _assignPieces() {
    const players = this.game._allPlayers || [];
    if (players.length === 0) return;

    let hudChanged = false;
    for (const p of players) {
      if (!p.ragdoll) continue;

      // Check if this player needs a piece assigned (new player)
      if (!this.pieceAssignments.has(p)) {
        const piece = CHESS_PIECES[Math.floor(Math.random() * CHESS_PIECES.length)];
        this.pieceAssignments.set(p, piece);
        hudChanged = true;
      }

      const piece = this.pieceAssignments.get(p);

      // Check if ragdoll changed (player was reset between waves)
      // Track by checking if our movement override references the current ragdoll
      const existingOverride = this._moveOverrides.get(p.ragdoll);
      if (!existingOverride) {
        // New ragdoll — re-apply piece look and movement constraint
        this._applyPieceLook(p, piece);
        const dirs = PIECE_MOVEMENT[piece];
        const speed = PIECE_SPEED[piece];
        this._moveOverrides.set(p.ragdoll, { piece, directions: dirs, speed });
      }
    }

    // Clean up stale overrides for destroyed ragdolls
    for (const [ragdoll] of this._moveOverrides) {
      let found = false;
      for (const p of players) {
        if (p.ragdoll === ragdoll) { found = true; break; }
      }
      if (!found) this._moveOverrides.delete(ragdoll);
    }

    // Update HUD
    if (hudChanged) {
      const humanPieces = players
        .filter(p => !p.isAI && this.pieceAssignments.has(p))
        .map(p => {
          const piece = this.pieceAssignments.get(p);
          const emoji = { pawn: '♟', rook: '♜', knight: '♞', bishop: '♝', queen: '♛', king: '♚' }[piece];
          return `P${(p.playerIndex || 0) + 1}: ${emoji} ${piece.toUpperCase()}`;
        });
      if (humanPieces.length > 0) {
        this.hudDiv.textContent = humanPieces.join('  |  ');
        this.hudDiv.style.display = 'block';
      }
    }
  }

  update(dt) {
    super.update(dt);

    // Assign pieces to any new players (including late-spawned AI)
    this._assignPieces();

    const players = this.game._allPlayers || [];
    for (const p of players) {
      if (!p.alive || !p.ragdoll) continue;

      const override = this._moveOverrides.get(p.ragdoll);
      if (!override) continue;

      const body = p.ragdoll.getTorso();
      const vel = body.velocity;

      // Get the player's intended movement direction
      const moveX = vel.x;
      const moveZ = vel.z;
      const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);

      if (moveLen < 0.3) continue; // not moving, skip

      // Normalize intended direction
      const intendedX = moveX / moveLen;
      const intendedZ = moveZ / moveLen;

      // Find the closest allowed direction
      let bestDot = -Infinity;
      let bestDirX = 0;
      let bestDirZ = 0;

      for (const dir of override.directions) {
        const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
        const nx = dir.x / len;
        const nz = dir.z / len;
        const dot = intendedX * nx + intendedZ * nz;
        if (dot > bestDot) {
          bestDot = dot;
          bestDirX = nx;
          bestDirZ = nz;
        }
      }

      // Only allow movement if reasonably aligned with an allowed direction
      if (bestDot > 0.3) {
        // Project velocity onto the best allowed direction
        const projSpeed = moveLen * bestDot * override.speed;
        body.velocity.x = bestDirX * projSpeed;
        body.velocity.z = bestDirZ * projSpeed;
      } else {
        // Moving in a disallowed direction — brake
        body.velocity.x *= 0.8;
        body.velocity.z *= 0.8;
      }

      // Position floating piece name label
      const label = p.ragdoll._chessPieceLabel;
      if (label) {
        const pos = p.ragdoll.getPosition();
        const s = p.ragdoll.scale || 1;
        label.position.set(pos.x, pos.y + 1.5 * s, pos.z);
      }
    }
  }

  destroy() {
    super.destroy();
    if (this.hudDiv) this.hudDiv.remove();
    this.pieceAssignments.clear();
    this.pieceHats.clear();
    this._moveOverrides.clear();
  }
}
