import { SettingsScreen } from '../ui/screens/SettingsScreen.js';

export class PauseMenu {
  constructor(game, inputManager) {
    this.game = game;
    this.inputManager = inputManager;
    this.paused = false;
    this.element = null;
    this.settingsOpen = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.settingsOpen) this.toggle();
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
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        z-index: 100; font-family: 'Arial Black', Arial, sans-serif;
        color: white;
      `;
      this.element.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 40px;">PAUSED</div>
        <button id="pause-resume" style="
          background: rgba(255,255,255,0.15); color: white;
          border: 2px solid #888; padding: 14px 40px;
          border-radius: 8px; font-family: 'Arial Black', Arial, sans-serif;
          font-size: 24px; cursor: pointer; margin: 8px; min-width: 250px;
          transition: all 0.15s;
        ">Resume</button>
        <button id="pause-settings" style="
          background: rgba(255,255,255,0.15); color: white;
          border: 2px solid #888; padding: 14px 40px;
          border-radius: 8px; font-family: 'Arial Black', Arial, sans-serif;
          font-size: 24px; cursor: pointer; margin: 8px; min-width: 250px;
          transition: all 0.15s;
        ">Settings</button>
      `;
      document.body.appendChild(this.element);

      this.element.querySelector('#pause-resume').addEventListener('click', () => {
        this.toggle();
      });

      this.element.querySelector('#pause-settings').addEventListener('click', () => {
        this.openSettings();
      });
    } else {
      if (this.element) this.element.remove();
      this.element = null;
    }
  }

  openSettings() {
    this.settingsOpen = true;
    const settings = new SettingsScreen(document.body, this.inputManager);
    settings.onClose = () => {
      this.settingsOpen = false;
    };
    settings.show();
  }
}
