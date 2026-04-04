export class TitleScreen {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.onStart = null;
  }

  show() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
    `;
    this.element.innerHTML = `
      <h1 style="font-size: 80px; margin-bottom: 10px; color: #ff6644;">WOBBLY BRAWLER</h1>
      <p style="font-size: 24px; animation: blink 1s infinite;">Press ENTER to Start</p>
      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      </style>
    `;
    this.container.appendChild(this.element);

    // Secret code tracker
    this._codeBuffer = '';

    this.handler = (e) => {
      if (e.code === 'Enter') {
        this.hide();
        if (this.onStart) this.onStart();
      }

      // Track typed letters for secret code
      if (e.key && e.key.length === 1) {
        this._codeBuffer += e.key.toLowerCase();
        // Keep only last 10 chars
        if (this._codeBuffer.length > 10) {
          this._codeBuffer = this._codeBuffer.slice(-10);
        }
        if (this._codeBuffer.includes('daddy')) {
          window.__daddyMode = true;
          // Visual confirmation
          const flash = document.createElement('div');
          flash.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 36px; color: #ff44ff; font-family: 'Arial Black', sans-serif;
            z-index: 9999; pointer-events: none;
            text-shadow: 2px 2px 8px rgba(255,0,255,0.8);
          `;
          flash.textContent = 'DADDY MODE ACTIVATED';
          document.body.appendChild(flash);
          setTimeout(() => flash.remove(), 2000);
          this._codeBuffer = '';
        }
      }
    };
    window.addEventListener('keydown', this.handler);
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    if (this.element) this.element.remove();
  }
}
