export class MatchManager {
  constructor(game, players) {
    this.game = game;
    this.players = players;
    this.roundsToWin = 3;
    this.state = 'waiting'; // waiting, countdown, playing, roundEnd, matchEnd
    this.countdownTimer = 0;
    this.roundEndTimer = 0;
    this.roundWinner = null;
    this.matchWinner = null;
    this.onStateChange = null; // callback

    this._updateCallback = game.onUpdate((dt) => this.update(dt));
  }

  startMatch() {
    for (const p of this.players) {
      p.roundWins = 0;
    }
    this.startRound();
  }

  startRound() {
    this.state = 'countdown';
    this.countdownTimer = 3;
    this.roundWinner = null;

    const spawnPoints = this.getSpawnPoints();
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].reset(spawnPoints[i % spawnPoints.length]);
    }

    if (this.onStateChange) this.onStateChange(this.state, { countdown: 3 });
  }

  getSpawnPoints() {
    const count = this.players.length;
    const radius = 5;
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        y: 3,
        z: Math.sin(angle) * radius,
      });
    }
    return points;
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.state = 'playing';
        if (this.onStateChange) this.onStateChange(this.state);
      }
      return;
    }

    if (this.state === 'playing') {
      const alivePlayers = this.players.filter(p => p.alive);
      if (alivePlayers.length <= 1) {
        this.game.timeScale = 0.3;
        setTimeout(() => { this.game.timeScale = 1; }, 2000);
        this.roundWinner = alivePlayers[0] || null;
        if (this.roundWinner) {
          this.roundWinner.roundWins++;
          if (this.roundWinner.roundWins >= this.roundsToWin) {
            this.state = 'matchEnd';
            this.matchWinner = this.roundWinner;
            if (this.onStateChange) this.onStateChange(this.state, { winner: this.matchWinner });
            return;
          }
        }
        this.state = 'roundEnd';
        this.roundEndTimer = 3;
        if (this.onStateChange) this.onStateChange(this.state, { winner: this.roundWinner });
      }
      return;
    }

    if (this.state === 'roundEnd') {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        this.startRound();
      }
    }
  }
}
