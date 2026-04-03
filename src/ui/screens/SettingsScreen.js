import { Actions } from '../../input/InputManager.js';

const ACTION_LABELS = {
  [Actions.MOVE_LEFT]: 'Move Left',
  [Actions.MOVE_RIGHT]: 'Move Right',
  [Actions.MOVE_FORWARD]: 'Move Forward',
  [Actions.MOVE_BACKWARD]: 'Move Backward',
  [Actions.JUMP]: 'Jump',
  [Actions.PUNCH]: 'Punch',
  [Actions.KICK]: 'Kick',
  [Actions.GRAB]: 'Grab',
  [Actions.HEADBUTT]: 'Headbutt',
};

const KEY_DISPLAY_NAMES = {
  KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F',
  KeyG: 'G', KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L',
  KeyM: 'M', KeyN: 'N', KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R',
  KeyS: 'S', KeyT: 'T', KeyU: 'U', KeyV: 'V', KeyW: 'W', KeyX: 'X',
  KeyY: 'Y', KeyZ: 'Z',
  Space: 'Space', Enter: 'Enter', ShiftLeft: 'L Shift', ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Numpad0: 'Num0', Numpad1: 'Num1', Numpad2: 'Num2', Numpad3: 'Num3',
  Numpad4: 'Num4', Numpad5: 'Num5', Numpad6: 'Num6', Numpad7: 'Num7',
  Numpad8: 'Num8', Numpad9: 'Num9',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=',
  Backquote: '`', Tab: 'Tab',
};

function keyName(code) {
  return KEY_DISPLAY_NAMES[code] || code;
}

export class SettingsScreen {
  constructor(container, inputManager) {
    this.container = container;
    this.inputManager = inputManager;
    this.element = null;
    this.onClose = null;
    this.listeningFor = null; // { playerIndex, action }
    this.selectedPlayer = 0;
  }

  show() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85);
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      padding-top: 40px;
      z-index: 200; font-family: 'Arial Black', Arial, sans-serif;
      color: white; overflow-y: auto;
    `;
    this.container.appendChild(this.element);
    this.updateDisplay();

    this.keyHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.listeningFor) {
        // Rebinding a key
        const { playerIndex, action } = this.listeningFor;
        const player = this.inputManager.players.get(playerIndex);
        if (player && player.source === 'keyboard') {
          player.bindings[action] = e.code;
        }
        this.listeningFor = null;
        this.updateDisplay();
        return;
      }

      if (e.code === 'Escape') {
        this.hide();
        if (this.onClose) this.onClose();
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  getKeyboardPlayers() {
    const players = [];
    for (const [idx, config] of this.inputManager.players) {
      if (config.source === 'keyboard') {
        players.push({ index: idx, bindings: config.bindings });
      }
    }
    return players;
  }

  updateDisplay() {
    if (!this.element) return;

    const kbPlayers = this.getKeyboardPlayers();

    let html = `<h2 style="font-size: 36px; margin-bottom: 16px;">SETTINGS</h2>`;

    if (kbPlayers.length === 0) {
      html += `<p style="font-size: 18px; opacity: 0.7;">No keyboard players registered yet. Join a game first.</p>`;
    }

    // Side by side layout
    html += `<div style="display: flex; gap: 20px; justify-content: center; align-items: flex-start; flex-wrap: wrap;">`;

    for (const kbPlayer of kbPlayers) {
      html += `<div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; min-width: 280px;">`;
      html += `<h3 style="font-size: 20px; margin-bottom: 10px; text-align: center;">Player ${kbPlayer.index + 1}</h3>`;
      html += `<table style="width: 100%; border-collapse: collapse;">`;

      for (const action of Object.keys(ACTION_LABELS)) {
        const currentKey = kbPlayer.bindings[action];
        const isListening = this.listeningFor &&
          this.listeningFor.playerIndex === kbPlayer.index &&
          this.listeningFor.action === action;

        html += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
            <td style="padding: 5px 8px; font-size: 14px;">${ACTION_LABELS[action]}</td>
            <td style="padding: 5px 8px; text-align: right;">
              <button
                data-player="${kbPlayer.index}"
                data-action="${action}"
                style="
                  background: ${isListening ? '#ff6644' : 'rgba(255,255,255,0.15)'};
                  color: white; border: 2px solid ${isListening ? '#ff6644' : '#555'};
                  padding: 4px 12px; border-radius: 6px;
                  font-family: 'Arial Black', Arial, sans-serif;
                  font-size: 13px; cursor: pointer; min-width: 70px;
                  transition: all 0.15s;
                "
              >
                ${isListening ? 'Press key...' : keyName(currentKey)}
              </button>
            </td>
          </tr>
        `;
      }

      html += `</table></div>`;
    }

    html += `</div>`;
    html += `<p style="font-size: 13px; opacity: 0.5; margin-top: 12px;">Click a button to rebind. Press ESC to close.</p>`;

    this.element.innerHTML = html;

    // Attach click handlers to all rebind buttons
    const buttons = this.element.querySelectorAll('button[data-action]');
    for (const btn of buttons) {
      btn.addEventListener('click', (e) => {
        const playerIndex = parseInt(btn.dataset.player);
        const action = btn.dataset.action;
        this.listeningFor = { playerIndex, action };
        this.updateDisplay();
      });
    }
  }

  hide() {
    window.removeEventListener('keydown', this.keyHandler, true);
    if (this.element) this.element.remove();
    this.element = null;
    this.listeningFor = null;
  }
}
