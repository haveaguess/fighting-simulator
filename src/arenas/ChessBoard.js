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

    // === CHESS BOARD TILES ===
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const isWhite = (row + col) % 2 === 0;
        const color = isWhite ? 0xeeddcc : 0x664433;
        const x = offset + col * tileSize;
        const z = offset + row * tileSize;
        this.addStaticBox(
          { x: tileSize, y: 0.5, z: tileSize },
          { x, y: -0.25, z },
          color
        );
      }
    }

    // === BOARD BORDER — raised wooden frame ===
    const borderThick = 0.8;
    const borderHeight = 0.8;
    const half = boardWidth / 2;
    // North/South
    this.addStaticBox(
      { x: boardWidth + borderThick * 2, y: borderHeight, z: borderThick },
      { x: 0, y: borderHeight / 2 - 0.25, z: -half - borderThick / 2 },
      0x442211
    );
    this.addStaticBox(
      { x: boardWidth + borderThick * 2, y: borderHeight, z: borderThick },
      { x: 0, y: borderHeight / 2 - 0.25, z: half + borderThick / 2 },
      0x442211
    );
    // East/West
    this.addStaticBox(
      { x: borderThick, y: borderHeight, z: boardWidth },
      { x: -half - borderThick / 2, y: borderHeight / 2 - 0.25, z: 0 },
      0x442211
    );
    this.addStaticBox(
      { x: borderThick, y: borderHeight, z: boardWidth },
      { x: half + borderThick / 2, y: borderHeight / 2 - 0.25, z: 0 },
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
    // Store piece data to be applied to players
    this.pieceAssignments = new Map(); // player -> piece type
    this._assignmentsDone = false;

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

  _createPieceHat(pieceType) {
    const color = PIECE_COLORS[pieceType];
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5 });
    let mesh;

    switch (pieceType) {
      case 'pawn':
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mat);
        break;
      case 'rook':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), mat);
        break;
      case 'knight': {
        // L-shaped indicator
        const group = new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), mat));
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), mat);
        top.position.set(0.05, 0.15, 0);
        group.add(top);
        mesh = group;
        break;
      }
      case 'bishop':
        mesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), mat);
        break;
      case 'queen':
        mesh = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 5), mat);
        break;
      case 'king': {
        // Cross shape
        const group = new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), mat));
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), mat);
        cross.position.y = 0.1;
        group.add(cross);
        mesh = group;
        break;
      }
      default:
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mat);
    }
    return mesh;
  }

  _assignPieces() {
    if (this._assignmentsDone) return;
    const players = this.game._allPlayers || [];
    if (players.length === 0) return;
    this._assignmentsDone = true;

    // Shuffle pieces and assign
    const available = [...CHESS_PIECES];
    for (const p of players) {
      const piece = available[Math.floor(Math.random() * available.length)];
      this.pieceAssignments.set(p, piece);

      // Create hat
      const hat = this._createPieceHat(piece);
      this.game.scene.add(hat);
      this.pieceHats.set(p, hat);
      this.meshes.push(hat);

      // Store movement constraint
      const dirs = PIECE_MOVEMENT[piece];
      const speed = PIECE_SPEED[piece];
      this._moveOverrides.set(p.ragdoll, { piece, directions: dirs, speed });
    }

    // Show HUD for human players
    const humanPieces = players
      .filter(p => !p.isAI)
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

  update(dt) {
    super.update(dt);

    // Assign pieces on first update when players exist
    if (!this._assignmentsDone) {
      this._assignPieces();
    }

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

      // Position piece hat above player's head
      const hat = this.pieceHats.get(p);
      if (hat) {
        const pos = p.ragdoll.getPosition();
        const s = p.ragdoll.scale || 1;
        hat.position.set(pos.x, pos.y + 1.3 * s, pos.z);
        hat.rotation.y += dt * 2; // gentle spin
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
