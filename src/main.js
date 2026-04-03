import { GameApp } from './GameApp.js';

const app = new GameApp();
window.__app = app; // debug access
app.start();
