import { Actions } from './InputManager.js';

/**
 * On-screen touch controls for mobile.
 * Left side: virtual joystick for movement
 * Right side: action buttons (Jump, Punch, Kick, Headbutt, Grab)
 */
export class TouchControls {
  constructor(inputManager, playerIndex = 0) {
    this.input = inputManager;
    this.playerIndex = playerIndex;
    this.actions = {};
    this.container = null;
    this._joystickActive = false;
    this._joystickOrigin = { x: 0, y: 0 };
    this._joystickTouchId = null;

    // Only show on touch devices
    if (!this._isTouchDevice()) return;

    this._build();
    this._hookIntoInputManager();
  }

  _isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  _build() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 900; pointer-events: none;
      user-select: none; -webkit-user-select: none;
    `;
    document.body.appendChild(this.container);

    // === LEFT: Virtual Joystick ===
    this._joystickArea = document.createElement('div');
    this._joystickArea.style.cssText = `
      position: absolute; left: 0; bottom: 0; width: 45%; height: 50%;
      pointer-events: auto; touch-action: none;
    `;
    this.container.appendChild(this._joystickArea);

    // Joystick base (appears on touch)
    this._joystickBase = document.createElement('div');
    this._joystickBase.style.cssText = `
      position: absolute; width: 120px; height: 120px;
      border-radius: 50%; border: 3px solid rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.08);
      display: none; transform: translate(-50%, -50%);
    `;
    this._joystickArea.appendChild(this._joystickBase);

    // Joystick thumb
    this._joystickThumb = document.createElement('div');
    this._joystickThumb.style.cssText = `
      position: absolute; width: 50px; height: 50px;
      border-radius: 50%; background: rgba(255,255,255,0.4);
      left: 50%; top: 50%; transform: translate(-50%, -50%);
    `;
    this._joystickBase.appendChild(this._joystickThumb);

    // Joystick touch handlers
    this._joystickArea.addEventListener('touchstart', (e) => this._onJoystickStart(e), { passive: false });
    this._joystickArea.addEventListener('touchmove', (e) => this._onJoystickMove(e), { passive: false });
    this._joystickArea.addEventListener('touchend', (e) => this._onJoystickEnd(e), { passive: false });
    this._joystickArea.addEventListener('touchcancel', (e) => this._onJoystickEnd(e), { passive: false });

    // === RIGHT: Action Buttons ===
    const buttonArea = document.createElement('div');
    buttonArea.style.cssText = `
      position: absolute; right: 10px; bottom: 20px;
      pointer-events: auto; touch-action: none;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    `;
    this.container.appendChild(buttonArea);

    // Top row: Jump
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; gap: 8px;';
    topRow.appendChild(this._makeButton('JUMP', Actions.JUMP, '#4488ff', 70));
    buttonArea.appendChild(topRow);

    // Middle row: Punch + Kick
    const midRow = document.createElement('div');
    midRow.style.cssText = 'display: flex; gap: 8px;';
    midRow.appendChild(this._makeButton('PUNCH', Actions.PUNCH, '#ff4444', 65));
    midRow.appendChild(this._makeButton('KICK', Actions.KICK, '#ff8844', 65));
    buttonArea.appendChild(midRow);

    // Bottom row: Grab + Headbutt
    const botRow = document.createElement('div');
    botRow.style.cssText = 'display: flex; gap: 8px;';
    botRow.appendChild(this._makeButton('GRAB', Actions.GRAB, '#44cc44', 60));
    botRow.appendChild(this._makeButton('HEAD', Actions.HEADBUTT, '#cc44cc', 60));
    buttonArea.appendChild(botRow);
  }

  _makeButton(label, action, color, size) {
    const btn = document.createElement('div');
    btn.style.cssText = `
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: ${color}; opacity: 0.6;
      display: flex; align-items: center; justify-content: center;
      font-family: Arial, sans-serif; font-size: ${Math.round(size * 0.22)}px;
      font-weight: bold; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      touch-action: none;
    `;
    btn.textContent = label;

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.actions[action] = true;
      btn.style.opacity = '0.9';
      btn.style.transform = 'scale(0.92)';
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.actions[action] = false;
      btn.style.opacity = '0.6';
      btn.style.transform = '';
    }, { passive: false });

    btn.addEventListener('touchcancel', (e) => {
      this.actions[action] = false;
      btn.style.opacity = '0.6';
      btn.style.transform = '';
    });

    return btn;
  }

  _onJoystickStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this._joystickTouchId = touch.identifier;
    this._joystickActive = true;
    this._joystickOrigin = { x: touch.clientX, y: touch.clientY };

    this._joystickBase.style.display = 'block';
    this._joystickBase.style.left = touch.clientX + 'px';
    this._joystickBase.style.top = touch.clientY + 'px';
    this._joystickThumb.style.left = '50%';
    this._joystickThumb.style.top = '50%';
  }

  _onJoystickMove(e) {
    e.preventDefault();
    if (!this._joystickActive) return;

    let touch = null;
    for (const t of e.changedTouches) {
      if (t.identifier === this._joystickTouchId) { touch = t; break; }
    }
    if (!touch) return;

    const dx = touch.clientX - this._joystickOrigin.x;
    const dy = touch.clientY - this._joystickOrigin.y;
    const maxDist = 50;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
    const angle = Math.atan2(dy, dx);
    const clampedX = Math.cos(angle) * dist;
    const clampedY = Math.sin(angle) * dist;

    // Move thumb visual
    this._joystickThumb.style.left = `calc(50% + ${clampedX}px)`;
    this._joystickThumb.style.top = `calc(50% + ${clampedY}px)`;

    // Map to actions
    const deadzone = 15;
    this.actions[Actions.MOVE_LEFT] = clampedX < -deadzone;
    this.actions[Actions.MOVE_RIGHT] = clampedX > deadzone;
    this.actions[Actions.MOVE_FORWARD] = clampedY < -deadzone;
    this.actions[Actions.MOVE_BACKWARD] = clampedY > deadzone;
  }

  _onJoystickEnd(e) {
    e.preventDefault();
    let found = false;
    for (const t of e.changedTouches) {
      if (t.identifier === this._joystickTouchId) { found = true; break; }
    }
    if (!found) return;

    this._joystickActive = false;
    this._joystickTouchId = null;
    this._joystickBase.style.display = 'none';

    this.actions[Actions.MOVE_LEFT] = false;
    this.actions[Actions.MOVE_RIGHT] = false;
    this.actions[Actions.MOVE_FORWARD] = false;
    this.actions[Actions.MOVE_BACKWARD] = false;
  }

  _hookIntoInputManager() {
    // Register a touch "player" that merges with keyboard
    const origGetActions = this.input.getActions.bind(this.input);
    this.input.getActions = (playerIndex) => {
      const actions = origGetActions(playerIndex);
      if (playerIndex === this.playerIndex) {
        // Merge touch actions — touch overrides if active
        for (const [action, active] of Object.entries(this.actions)) {
          if (active) actions[action] = true;
        }
      }
      return actions;
    };
  }

  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
