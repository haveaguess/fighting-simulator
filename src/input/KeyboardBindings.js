import { Actions } from './InputManager.js';

export const PLAYER_1_KEYS = {
  [Actions.MOVE_LEFT]: 'KeyA',
  [Actions.MOVE_RIGHT]: 'KeyD',
  [Actions.MOVE_FORWARD]: 'KeyW',
  [Actions.MOVE_BACKWARD]: 'KeyS',
  [Actions.JUMP]: 'Space',
  [Actions.PUNCH]: 'KeyF',
  [Actions.KICK]: 'KeyG',
  [Actions.GRAB]: 'KeyR',
  [Actions.HEADBUTT]: 'KeyT',
};

export const PLAYER_2_KEYS = {
  [Actions.MOVE_LEFT]: 'ArrowLeft',
  [Actions.MOVE_RIGHT]: 'ArrowRight',
  [Actions.MOVE_FORWARD]: 'ArrowUp',
  [Actions.MOVE_BACKWARD]: 'ArrowDown',
  [Actions.JUMP]: 'Numpad0',
  [Actions.PUNCH]: 'Numpad1',
  [Actions.KICK]: 'Numpad2',
  [Actions.GRAB]: 'Numpad3',
  [Actions.HEADBUTT]: 'Numpad4',
};
