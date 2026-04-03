export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicGain = null;
    this.musicPlaying = false;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // === COMBAT SOUNDS ===
  playPunch() {
    this.ensure();
    // Quick snappy hit
    this.playNoise(0.08, 900, 300, 0.4);
    this.playTone(0.05, 200, 'square', -100, 0.15);
  }

  playKick() {
    this.ensure();
    // Heavier thud
    this.playNoise(0.12, 400, 80, 0.4);
    this.playTone(0.08, 150, 'sawtooth', -80, 0.2);
  }

  playHeadbutt() {
    this.ensure();
    // Bonk!
    this.playTone(0.1, 600, 'square', -300, 0.3);
    this.playTone(0.06, 300, 'sine', 0, 0.15);
  }

  playHit() {
    this.ensure();
    // Impact when hit lands on someone
    this.playNoise(0.1, 1200, 200, 0.35);
    this.playTone(0.08, 250, 'sawtooth', -150, 0.2);
  }

  // === MOVEMENT SOUNDS ===
  playJump() {
    this.ensure();
    // Whoosh upward
    this.playTone(0.15, 300, 'sine', 400, 0.12);
  }

  playLand() {
    this.ensure();
    // Thud
    this.playNoise(0.06, 200, 60, 0.2);
  }

  // === GAME EVENT SOUNDS ===
  playEliminated() {
    this.ensure();
    // Falling scream-like descending tone
    this.playTone(0.5, 500, 'sawtooth', -400, 0.25);
    this.playTone(0.4, 350, 'square', -250, 0.15);
  }

  playCountdown() {
    this.ensure();
    this.playTone(0.15, 600, 'square', 0, 0.2);
  }

  playFight() {
    this.ensure();
    this.playTone(0.2, 800, 'square', 0, 0.25);
    this.playTone(0.15, 1000, 'square', 0, 0.15);
  }

  playWin() {
    this.ensure();
    this.playTone(0.2, 523, 'sine', 0, 0.2);
    setTimeout(() => this.playTone(0.2, 659, 'sine', 0, 0.2), 200);
    setTimeout(() => this.playTone(0.4, 784, 'sine', 0, 0.25), 400);
  }

  // === AMBIENT / HAZARD SOUNDS ===
  startDishWhir() {
    this.ensure();
    if (this._dishOsc) return;
    // High-pitched mechanical hum — not a low rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220;
    gain.gain.value = 0.02;
    // Slight pitch wobble for spinning effect
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 1.5;
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start();
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    this._dishOsc = osc;
    this._dishGain = gain;
    this._dishLfo = lfo;
  }

  stopDishWhir() {
    if (this._dishOsc) {
      this._dishOsc.stop();
      this._dishLfo.stop();
      this._dishOsc = null;
      this._dishLfo = null;
    }
  }

  // === BACKGROUND MUSIC ===
  startMusic() {
    this.ensure();
    if (this.musicPlaying) return;
    this.musicPlaying = true;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.06;
    this.musicGain.connect(this.ctx.destination);

    // Simple looping bass line
    const notes = [130, 146, 164, 146, 130, 110, 130, 164]; // C3-ish pattern
    const noteLen = 0.4;
    let noteIdx = 0;

    const playNext = () => {
      if (!this.musicPlaying) return;
      const freq = notes[noteIdx % notes.length];
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.8, this.ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + noteLen * 0.9);
      osc.connect(env).connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + noteLen);
      noteIdx++;
      this._musicTimeout = setTimeout(playNext, noteLen * 1000);
    };

    // Also a steady kick drum
    const playKick = () => {
      if (!this.musicPlaying) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.1);
      env.gain.setValueAtTime(1, this.ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(env).connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
      this._kickTimeout = setTimeout(playKick, noteLen * 2 * 1000);
    };

    playNext();
    playKick();
  }

  stopMusic() {
    this.musicPlaying = false;
    clearTimeout(this._musicTimeout);
    clearTimeout(this._kickTimeout);
    if (this.musicGain) {
      this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    }
  }

  // === PRIMITIVES ===
  playNoise(duration, freqStart, freqEnd, volume = 0.3) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTone(duration, freq, type, pitchBend = 0, volume = 0.2) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (pitchBend) {
      osc.frequency.linearRampToValueAtTime(Math.max(20, freq + pitchBend), this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
