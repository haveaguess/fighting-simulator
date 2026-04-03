export const Actions = {
  MOVE_LEFT: 'moveLeft',
  MOVE_RIGHT: 'moveRight',
  MOVE_FORWARD: 'moveForward',
  MOVE_BACKWARD: 'moveBackward',
  JUMP: 'jump',
  PUNCH: 'punch',
  KICK: 'kick',
  GRAB: 'grab',
  HEADBUTT: 'headbutt',
};

export class InputManager {
  constructor() {
    this.players = new Map();
    this.keyStates = {};

    window.addEventListener('keydown', (e) => { this.keyStates[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keyStates[e.code] = false; });
  }

  registerKeyboardPlayer(playerIndex, bindings) {
    this.players.set(playerIndex, { source: 'keyboard', bindings });
  }

  registerGamepadPlayer(playerIndex, gamepadIndex) {
    this.players.set(playerIndex, { source: 'gamepad', gamepadIndex });
  }

  getActions(playerIndex) {
    const player = this.players.get(playerIndex);
    if (!player) return {};

    if (player.source === 'keyboard') {
      return this.getKeyboardActions(player.bindings);
    } else {
      return this.getGamepadActions(player.gamepadIndex);
    }
  }

  getKeyboardActions(bindings) {
    const actions = {};
    for (const [action, key] of Object.entries(bindings)) {
      actions[action] = !!this.keyStates[key];
    }
    return actions;
  }

  getGamepadActions(gamepadIndex) {
    const actions = {};
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return actions;

    const deadzone = 0.2;
    actions[Actions.MOVE_LEFT] = gp.axes[0] < -deadzone;
    actions[Actions.MOVE_RIGHT] = gp.axes[0] > deadzone;
    actions[Actions.MOVE_FORWARD] = gp.axes[1] < -deadzone;
    actions[Actions.MOVE_BACKWARD] = gp.axes[1] > deadzone;
    actions[Actions.JUMP] = gp.buttons[0]?.pressed;
    actions[Actions.PUNCH] = gp.buttons[2]?.pressed;
    actions[Actions.KICK] = gp.buttons[3]?.pressed;
    actions[Actions.GRAB] = gp.buttons[1]?.pressed;
    actions[Actions.HEADBUTT] = gp.buttons[5]?.pressed;

    return actions;
  }
}
