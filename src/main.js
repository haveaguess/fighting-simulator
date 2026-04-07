import { GameApp } from './GameApp.js';
import { startSandboxMode } from './sandboxMode.js';
import { startBrawlMode } from './brawlMode.js';
import { startWavesQuick } from './wavesQuickStart.js';

const params = new URLSearchParams(window.location.search);
if (params.has('daddy')) window.__daddyMode = true;

// Quick-start modes (explicit shortcuts, not game state params)
if (params.has('test')) {
  startSandboxMode();
} else if (params.has('quickwaves')) {
  startWavesQuick();
} else if (params.has('quickbrawl')) {
  startBrawlMode();
} else if (params.has('quickstart')) {
  // Quick start: P1 small ninja, P2 huge chicken, volcano waves
  const app = new GameApp();
  window.__app = app;
  app.game.start();
  app.gameMode = 'waves';
  const joinedPlayers = new Set([0, 1]);
  const costumeChoices = { 0: 'ninja', 1: 'chicken' };
  const sizeChoices = { 0: 0.5, 1: 2.0 };
  app.startWavesGame(joinedPlayers, costumeChoices, sizeChoices, 'landslide');
} else {
  // Full game — GameApp handles URL state restoration internally
  const app = new GameApp();
  window.__app = app;
  app.start();
}
