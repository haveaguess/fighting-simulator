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
      this.selections[i] = 0;
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
      if (e.code === 'KeyA') this.navigate(0, -1);
      if (e.code === 'KeyD') this.navigate(0, 1);
      if (e.code === 'KeyW') this.confirm(0);

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
            ${confirmed ? 'READY!' : i === 0 ? 'A/D browse, W confirm' : 'Left/Right browse, Up confirm'}
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
