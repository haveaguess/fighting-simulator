const BASE = import.meta.env.BASE_URL || '/';

export class MenuMusic {
  constructor() {
    this.audio = null;
    this.playing = false;
  }

  start() {
    if (this.playing) return;
    this.playing = true;

    const url = `${BASE}audio/music/menu_song.mp3`;
    console.log('[MenuMusic] Starting, url:', url);
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.volume = 0.5;

    this.audio.addEventListener('canplaythrough', () => {
      console.log('[MenuMusic] canplaythrough fired');
    });

    this.audio.addEventListener('error', (e) => {
      console.error('[MenuMusic] Audio error:', e.target.error);
    });

    this.audio.play().then(() => {
      console.log('[MenuMusic] Playing successfully');
    }).catch((err) => {
      console.warn('[MenuMusic] Play blocked:', err.message, '— will retry on next gesture');
      const retry = () => {
        if (this.playing && this.audio) {
          this.audio.play().then(() => {
            console.log('[MenuMusic] Retry play succeeded');
          }).catch((err2) => {
            console.warn('[MenuMusic] Retry also failed:', err2.message);
          });
        }
        document.removeEventListener('keydown', retry);
        document.removeEventListener('click', retry);
        document.removeEventListener('touchstart', retry);
      };
      document.addEventListener('keydown', retry, { once: true });
      document.addEventListener('click', retry, { once: true });
      document.addEventListener('touchstart', retry, { once: true });
    });
  }

  stop() {
    console.log('[MenuMusic] Stopping');
    this.playing = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
  }
}
