const LINE_TYPES = ['ready', 'attack', 'hit', 'death', 'victory'];
const BASE = import.meta.env.BASE_URL || '/';

// Global voice queue — only 1 voice plays at a time, next one waits
let _globalLastPlayTime = 0;
const GLOBAL_COOLDOWN_MS = 400;
// Priority: death > victory > attack > hit > ready
const PRIORITY = { death: 5, victory: 4, attack: 3, hit: 2, ready: 1 };
let _currentlyPlaying = null;

// Shared AudioContext for stereo panning
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

export class VoiceManager {
  constructor(costumeKey, volume = 0.35) {
    this.costumeKey = costumeKey;
    this.volume = volume;
    this.clips = {};
    this._lastPlayTime = 0;
    this._panValue = 0; // -1 left, 0 center, 1 right

    for (const line of LINE_TYPES) {
      const audio = new Audio(`${BASE}audio/voices/${costumeKey}/${line}.mp3`);
      audio.volume = volume;
      audio.preload = 'auto';
      this.clips[line] = audio;
    }
  }

  // Set stereo position based on character's x position in the arena
  // Call this from the game loop with the character's world x position
  setPan(worldX) {
    // Map world position to -1..1 pan (arena is roughly -10 to 10)
    this._panValue = Math.max(-1, Math.min(1, worldX / 10));
  }

  _play(line) {
    const now = Date.now();
    const priority = PRIORITY[line] || 1;

    // Per-instance cooldown
    if (now - this._lastPlayTime < 300) return;

    // Global cooldown — but high priority (death/victory) always plays
    if (priority < 4 && now - _globalLastPlayTime < GLOBAL_COOLDOWN_MS) return;

    // If something is currently playing, only interrupt if higher priority
    if (_currentlyPlaying && _currentlyPlaying.priority >= priority && !_currentlyPlaying.ended) return;

    const clip = this.clips[line];
    if (!clip) return;

    this._lastPlayTime = now;
    _globalLastPlayTime = now;

    // Try to play with stereo panning via Web Audio
    const ctx = getAudioCtx();
    if (ctx) {
      this._playWithPan(clip, ctx, priority);
    } else {
      // Fallback: plain HTML5 audio
      clip.currentTime = 0;
      clip.volume = this.volume;
      clip.play().catch(() => {});
    }

    _currentlyPlaying = { priority, ended: false };
    clip.addEventListener('ended', () => {
      if (_currentlyPlaying && _currentlyPlaying.priority === priority) {
        _currentlyPlaying = null;
      }
    }, { once: true });
  }

  _playWithPan(clip, ctx, priority) {
    // Create a new audio element clone so we don't interrupt preloaded source
    const clone = clip.cloneNode();
    clone.volume = 1; // volume controlled by gain node

    const source = ctx.createMediaElementSource(clone);
    const panner = ctx.createStereoPanner();
    const gain = ctx.createGain();

    panner.pan.value = this._panValue;
    gain.gain.value = this.volume;

    source.connect(panner).connect(gain).connect(ctx.destination);

    clone.currentTime = 0;
    clone.play().catch(() => {});

    clone.addEventListener('ended', () => {
      source.disconnect();
      panner.disconnect();
      gain.disconnect();
      if (_currentlyPlaying && _currentlyPlaying.priority === priority) {
        _currentlyPlaying = null;
      }
    }, { once: true });
  }

  playReady()   { this._play('ready'); }
  playAttack()  { this._play('attack'); }
  playHit()     { this._play('hit'); }
  playDeath()   { this._play('death'); }
  playVictory() { this._play('victory'); }

  setVolume(v) {
    this.volume = v;
  }
}
