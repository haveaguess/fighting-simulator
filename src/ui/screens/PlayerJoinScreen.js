export class PlayerJoinScreen {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.joined = new Set();
    this.maxPlayers = 8;
    this.onReady = null;
  }

  show() {
    this.joined.clear();
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
    `;
    this.updateDisplay();
    this.container.appendChild(this.element);

    this.handler = (e) => {
      if (e.code === 'KeyW' || e.code === 'KeyA') {
        this.joined.add(0);
        this.updateDisplay();
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
        this.joined.add(1);
        this.updateDisplay();
      }
      if (e.code === 'Enter' && this.joined.size >= 1) {
        this.hide();
        if (this.onReady) this.onReady(this.joined);
      }
    };
    window.addEventListener('keydown', this.handler);

    this.gamepadInterval = setInterval(() => {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]?.buttons[0]?.pressed) {
          this.joined.add(i + 2);
          this.updateDisplay();
        }
      }
    }, 100);
  }

  updateDisplay() {
    if (!this.element) return;
    const slots = [];
    for (let i = 0; i < this.maxPlayers; i++) {
      const joined = this.joined.has(i);
      const label = i < 2 ? `P${i+1} (Keyboard)` : `P${i+1} (Gamepad)`;
      slots.push(`
        <div style="
          padding: 12px 24px; margin: 4px;
          background: ${joined ? 'rgba(68,255,68,0.3)' : 'rgba(255,255,255,0.1)'};
          border: 2px solid ${joined ? '#4f4' : '#555'};
          border-radius: 8px; min-width: 200px; text-align: center;
        ">
          ${label}: ${joined ? 'JOINED' : i < 2 ? 'Press movement key' : 'Press A button'}
        </div>
      `);
    }
    this.element.innerHTML = `
      <h2 style="font-size: 48px; margin-bottom: 20px;">PLAYER JOIN</h2>
      <div style="display: flex; flex-wrap: wrap; justify-content: center; max-width: 600px;">
        ${slots.join('')}
      </div>
      <p style="margin-top: 20px; font-size: 18px;">
        Empty slots will be filled with AI. Press ENTER when ready.
      </p>
    `;
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    clearInterval(this.gamepadInterval);
    if (this.element) this.element.remove();
  }
}
