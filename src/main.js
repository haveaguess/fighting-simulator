import { GameApp } from './GameApp.js';
import { startTestMode } from './testMode.js';

if (window.location.search.includes('test')) {
  startTestMode();
} else {
  const app = new GameApp();
  window.__app = app;
  app.start();
}
