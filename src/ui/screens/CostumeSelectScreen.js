import { COSTUMES, COSTUME_KEYS } from '../../character/Costumes.js';

const SIZE_OPTIONS = [
  { label: 'Tiny', scale: 0.5 },
  { label: 'Small', scale: 0.7 },
  { label: 'Normal', scale: 1.0 },
  { label: 'Big', scale: 1.5 },
  { label: 'Huge', scale: 2.0 },
];

const DEFAULT_SIZE_INDEX = 2; // Normal

export class CostumeSelectScreen {
  constructor(container, playerCount) {
    this.container = container;
    this.playerCount = playerCount;
    this.selections = {};
    this.sizeSelections = {};
    this.confirmed = new Set();
    this.onReady = null;
    this.element = null;

    for (let i = 0; i < playerCount; i++) {
      this.selections[i] = 0;
      this.sizeSelections[i] = DEFAULT_SIZE_INDEX;
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
      if (e.code === 'KeyW') this.navigate(0, -1);
      if (e.code === 'KeyS') this.navigate(0, 1);
      if (e.code === 'KeyA') this.navigateSize(0, -1);
      if (e.code === 'KeyD') this.navigateSize(0, 1);

      if (e.code === 'ArrowUp') this.navigate(1, -1);
      if (e.code === 'ArrowDown') this.navigate(1, 1);
      if (e.code === 'ArrowLeft') this.navigateSize(1, -1);
      if (e.code === 'ArrowRight') this.navigateSize(1, 1);

      if (e.code === 'Enter') {
        // Confirm unconfirmed players first, then start if all confirmed
        let anyConfirmed = false;
        for (let i = 0; i < this.playerCount; i++) {
          if (!this.confirmed.has(i)) {
            this.confirm(i);
            anyConfirmed = true;
            break;
          }
        }
        if (!anyConfirmed && this.confirmed.size >= this.playerCount) {
          this.hide();
          const costumeResult = {};
          const sizeResult = {};
          for (let i = 0; i < this.playerCount; i++) {
            costumeResult[i] = COSTUME_KEYS[this.selections[i]];
            sizeResult[i] = SIZE_OPTIONS[this.sizeSelections[i]].scale;
          }
          if (this.onReady) this.onReady(costumeResult, sizeResult);
        }
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

  navigateSize(player, dir) {
    if (this.confirmed.has(player)) return;
    const len = SIZE_OPTIONS.length;
    this.sizeSelections[player] = (this.sizeSelections[player] + dir + len) % len;
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
      const sizeOption = SIZE_OPTIONS[this.sizeSelections[i]];
      const confirmed = this.confirmed.has(i);
      const previewSize = Math.round(60 * sizeOption.scale);
      cards.push(`
        <div style="
          padding: 20px; margin: 10px;
          background: ${confirmed ? 'rgba(68,255,68,0.2)' : 'rgba(255,255,255,0.1)'};
          border: 2px solid ${confirmed ? '#4f4' : '#888'};
          border-radius: 12px; text-align: center; min-width: 160px;
        ">
          <div style="font-size: 20px; margin-bottom: 8px;">P${i + 1}</div>
          <div style="font-size: 32px; margin: 10px 0; height: 120px; display: flex; align-items: center; justify-content: center;">
            <div style="width:${previewSize}px;height:${previewSize}px;border-radius:50%;background:#${costume.torso.color.toString(16).padStart(6,'0')};transition:all 0.15s;"></div>
          </div>
          <div style="font-size: 18px;">${costume.name}</div>
          <div style="font-size: 14px; color: #aaf; margin-top: 4px;">${sizeOption.label} (${sizeOption.scale}x)</div>
          <div style="font-size: 12px; margin-top: 6px; color: #888;">
            ${confirmed ? '<span style="color:#4f4;">READY!</span>' : i === 0 ? 'W/S costume · A/D size · Enter confirm' : 'Up/Down costume · Left/Right size · Enter confirm'}
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
