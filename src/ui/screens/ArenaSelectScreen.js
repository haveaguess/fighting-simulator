const ARENAS = [
  { key: 'rooftop', name: 'Rooftop', description: 'Spinning dish + breakable ledges', color: '#888888' },
  { key: 'factory', name: 'Factory', description: 'Conveyors + crushers', color: '#555555' },
  { key: 'wrestlingRing', name: 'Wrestling Ring', description: 'Bouncy ropes + electrify', color: '#336633' },
  { key: 'landslide', name: 'Landslide', description: 'Pressure plate triggers rock avalanche', color: '#8B7355' },
];

export class ArenaSelectScreen {
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
        this.selected = (this.selected - 1 + ARENAS.length) % ARENAS.length;
        this.updateDisplay();
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.selected = (this.selected + 1) % ARENAS.length;
        this.updateDisplay();
      }
      if (e.code === 'Enter') {
        this.hide();
        if (this.onReady) this.onReady(ARENAS[this.selected].key);
      }
      if (e.code === 'KeyR') {
        this.selected = Math.floor(Math.random() * ARENAS.length);
        this.hide();
        if (this.onReady) this.onReady(ARENAS[this.selected].key);
      }
    };
    window.addEventListener('keydown', this.handler);
  }

  updateDisplay() {
    if (!this.element) return;
    const cards = ARENAS.map((a, i) => `
      <div style="
        padding: 24px; margin: 10px;
        background: ${i === this.selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'};
        border: 3px solid ${i === this.selected ? '#fff' : '#444'};
        border-radius: 12px; text-align: center; min-width: 180px;
        transform: ${i === this.selected ? 'scale(1.1)' : 'scale(1)'};
        transition: all 0.2s;
      ">
        <div style="width:100px;height:60px;margin:0 auto 10px;background:${a.color};border-radius:8px;"></div>
        <div style="font-size: 24px; font-weight: bold;">${a.name}</div>
        <div style="font-size: 14px; margin-top: 6px; opacity: 0.7;">${a.description}</div>
      </div>
    `).join('');

    this.element.innerHTML = `
      <h2 style="font-size: 48px; margin-bottom: 30px;">SELECT ARENA</h2>
      <div style="display: flex; justify-content: center;">${cards}</div>
      <p style="margin-top: 20px; font-size: 16px;">
        Left/Right to browse, ENTER to select, R for random
      </p>
    `;
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    if (this.element) this.element.remove();
  }
}
