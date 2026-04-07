import { MenuMusic } from '../../audio/MenuMusic.js';

export class TitleScreen {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.onStart = null;
    this.menuMusic = new MenuMusic();
  }

  show() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85);
    `;
    this.element.innerHTML = `
      <h1 style="font-size: 80px; margin-bottom: 10px; color: #ff6644;
        text-shadow: 0 0 30px rgba(255,100,68,0.5);">WOBBLY BRAWLER</h1>
      <button id="start-btn" style="
        font-size: 36px; font-family: 'Arial Black', Arial, sans-serif;
        padding: 20px 60px; margin-top: 30px;
        background: #ff6644; color: white; border: none; border-radius: 16px;
        cursor: pointer; text-transform: uppercase; letter-spacing: 3px;
        box-shadow: 0 6px 20px rgba(255,100,68,0.4);
        transition: transform 0.1s, box-shadow 0.1s;
      ">START</button>
      <style>
        #start-btn:hover { transform: scale(1.05); box-shadow: 0 8px 30px rgba(255,100,68,0.6); }
        #start-btn:active { transform: scale(0.97); }
      </style>
    `;
    this.container.appendChild(this.element);

    // Secret code tracker
    this._codeBuffer = '';

    // Click START: start music (user gesture unlocks audio) + proceed to game
    this.element.querySelector('#start-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.menuMusic.start();
      this.element.remove();
      this.element = null;
      window.removeEventListener('keydown', this.handler);
      if (this.onStart) this.onStart();
    });

    this.handler = (e) => {
      // Any keypress also starts music (user gesture)
      this.menuMusic.start();

      // Track typed letters for secret code
      if (e.key && e.key.length === 1) {
        this._codeBuffer += e.key.toLowerCase();
        if (this._codeBuffer.length > 10) {
          this._codeBuffer = this._codeBuffer.slice(-10);
        }
        if (this._codeBuffer.includes('daddy')) {
          window.__daddyMode = true;
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

  stopMusic() {
    if (this.menuMusic) {
      this.menuMusic.stop();
      this.menuMusic = null;
    }
  }
}
