export class PauseMenu {
  constructor(game) {
    this.game = game;
    this.paused = false;
    this.element = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.toggle();
    });
  }

  toggle() {
    this.paused = !this.paused;
    this.game.timeScale = this.paused ? 0 : 1;

    if (this.paused) {
      this.element = document.createElement('div');
      this.element.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 100; font-family: 'Arial Black', Arial, sans-serif;
        color: white; font-size: 64px;
      `;
      this.element.textContent = 'PAUSED';
      document.body.appendChild(this.element);
    } else {
      if (this.element) this.element.remove();
      this.element = null;
    }
  }
}
