export class HUD {
  constructor(players) {
    this.players = players;
    this.container = document.getElementById('ui-overlay');
    this.elements = {};
    this.init();
  }

  init() {
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
        j < p.roundWins ? '\u25CF' : '\u25CB'
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
