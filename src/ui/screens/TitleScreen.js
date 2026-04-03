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

    this.handler = (e) => {
      if (e.code === 'Enter') {
        this.hide();
        if (this.onStart) this.onStart();
      }
    };
    window.addEventListener('keydown', this.handler);
  }

  hide() {
    window.removeEventListener('keydown', this.handler);
    if (this.element) this.element.remove();
  }
}
