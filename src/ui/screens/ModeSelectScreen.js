export class ModeSelectScreen {
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
        this.selected = 0;
        this.updateDisplay();
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.selected = 1;
        this.updateDisplay();
      }
      if (e.code === 'Enter') {
        this.hide();
        if (this.onReady) this.onReady(this.selected === 0 ? 'melee' : 'waves');
      }
    };
    window.addEventListener('keydown', this.handler);
  }

  updateDisplay() {
    if (!this.element) return;

    const modes = [
      {
        name: 'MELEE',
        desc: 'Free-for-all brawl! Last one standing wins.',
        icon: '\u2694\uFE0F',
        color: '#ff4444',
      },
      {
        name: 'WAVES',
        desc: 'Co-op survival! Fight waves of enemies together.',
        icon: '\uD83C\uDF0A',
        color: '#44aaff',
      },
    ];

    const cards = modes.map((m, i) => `
      <div style="
        padding: 30px 40px; margin: 15px;
        background: ${i === this.selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.03)'};
        border: 3px solid ${i === this.selected ? m.color : '#444'};
        border-radius: 16px; text-align: center; min-width: 250px;
        transform: ${i === this.selected ? 'scale(1.08)' : 'scale(1)'};
        transition: all 0.2s;
        cursor: pointer;
      ">
        <div style="font-size: 48px; margin-bottom: 10px;">${m.icon}</div>
        <div style="font-size: 32px; font-weight: bold; color: ${i === this.selected ? m.color : '#888'};">${m.name}</div>
        <div style="font-size: 14px; margin-top: 8px; opacity: 0.7; max-width: 200px;">${m.desc}</div>
      </div>
    `).join('');

    this.element.innerHTML = `
      <h2 style="font-size: 48px; margin-bottom: 30px;">CHOOSE MODE</h2>
      <div style="display: flex; justify-content: center;">${cards}</div>
      <p style="margin-top: 25px; font-size: 16px; opacity: 0.6;">
        Left/Right to select, ENTER to confirm
      </p>
    `;
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    if (this.element) this.element.remove();
    this.element = null;
  }
}
