import { GameApp } from './GameApp.js';
import { startTestMode } from './testMode.js';
import { startBrawlMode } from './brawlMode.js';

const params = window.location.search;
if (params.includes('test')) {
  startTestMode();
} else if (params.includes('brawl')) {
  startBrawlMode();
} else {
  const app = new GameApp();
  window.__app = app;
  app.start();
}
