export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playHit() {
    this.ensure();
    this.playNoise(0.1, 800, 200);
  }

  playKick() {
    this.ensure();
    this.playNoise(0.15, 400, 100);
  }

  playEliminated() {
    this.ensure();
    this.playTone(0.3, 200, 'sawtooth', -100);
  }

  playCountdown() {
    this.ensure();
    this.playTone(0.15, 600, 'square', 0);
  }

  playFight() {
    this.ensure();
    this.playTone(0.3, 800, 'square', 0);
  }

  playWin() {
    this.ensure();
    this.playTone(0.2, 523, 'sine', 0);
    setTimeout(() => this.playTone(0.2, 659, 'sine', 0), 200);
    setTimeout(() => this.playTone(0.4, 784, 'sine', 0), 400);
  }

  playNoise(duration, freqStart, freqEnd) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTone(duration, freq, type, pitchBend) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (pitchBend) {
      osc.frequency.linearRampToValueAtTime(freq + pitchBend, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
