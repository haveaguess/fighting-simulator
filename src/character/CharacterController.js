import * as CANNON from 'cannon-es';
import { Actions } from '../input/InputManager.js';

export class CharacterController {
  constructor(ragdoll, game, audio) {
    this.ragdoll = ragdoll;
    this.game = game;
    this.audio = audio;

    this.punchCooldown = 0;
    this.kickCooldown = 0;
    this.headbuttCooldown = 0;

    // Grab state
    this.grabConstraint = null;
    this.grabbedPlayer = null;

    // Back mount state
    this.mountedOn = null;       // player we're riding
    this.mountedBy = null;       // player riding us
    this.mountTimer = 0;         // how long we've been mounted
    this.mountShakeTimer = 0;    // big guy spin timer to shake off

    // Gang Beasts-style scaling
    const s = ragdoll.scale || 1;
    const sqrtS = Math.sqrt(s);

    this.scale = s;

    // Movement: force = mass * desired_acceleration
    // mass = 5*s². We want small=fast, big=slower-but-mobile.
    // Desired top speed: small~8, normal~6, big~4 units/sec
    // With damping 0.92/frame at 60fps, terminal_vel ≈ force/(mass*4.8)
    // So force = mass * 4.8 * desired_speed
    const desiredSpeed = 6 / Math.sqrt(s); // 0.5→8.5, 1.0→6, 2.0→4.2
    this.moveForce = 5 * s * s * 4.8 * desiredSpeed;
    this.horizontalDamping = 0.92;
    // Jump: everyone needs to reach platforms but not fly too high
    // v = impulse/mass, mass = 5*s². impulse = k*s² gives v = k/5 for all sizes
    // k=20 gives v=4.0, base height ≈ 0.82m. Hold adds extra for platforms.
    this.jumpImpulse = 20 * s * s;
    this.jumpHoldForce = 55 * s * s;
    this.jumpHoldMax = 0.22;
    this.jumpHoldTimer = 0;
    this.jumpedThisPress = false;

    // Leg sweep cooldown
    this._legSweepCooldown = 0;

    // Hit force: big guys hit harder
    this.punchImpulse = 30 * s;
    this.kickImpulse = 25 * s;
    this.headbuttImpulse = 35 * s;
    this.throwImpulse = 40 * s;

    // Range: base reach + own arm length
    // A small guy hitting a big guy needs range = small_arm + big_body_radius
    // We set a minimum so small guys can still reach nearby opponents
    // Actual hit check also considers target size (see _hitNearby)
    this.attackRange = Math.max(0.9, 0.5 + 0.4 * s);
    this.grabRange = Math.max(1.2, 0.7 + 0.5 * s);

    // Cooldowns: big = slow swings, small = rapid jabs
    this.punchCooldownTime = 0.4 * s;
    this.kickCooldownTime = 0.5 * s;
    this.headbuttCooldownTime = 0.6 * s;

    // Wind-up delay: big guys have a pause before attack lands
    // At scale 1.0 = 0 delay, at 2.0 = 0.25s delay
    this.attackWindup = Math.max(0, (s - 1) * 0.25);
    this._windupTimer = 0;
    this._windupAction = null; // { type, impulse, damage }

    // Damage per hit — big guys hit HARD, small guys hit soft
    // Using s (not sqrtS) so damage scales more aggressively with size
    this.punchDamage = Math.round(15 + 10 * s);
    this.kickDamage = Math.round(12 + 8 * s);
    this.headbuttDamage = Math.round(20 + 12 * s);
    this.grabPunchDamage = Math.round(15 + 10 * s);
    this.grabHeadbuttDamage = Math.round(20 + 12 * s);
    this.throwDamage = Math.round(12 + 8 * s);

    // Mount cooldown — can't immediately remount after being shaken off
    this._mountCooldown = 0;

    // Mount hint HUD (only for human players — set externally)
    this.isHuman = false;
    this._hintDiv = null;

    this.team = null;
  }

  update(dt, actions) {
    if (this.ragdoll.balance.isRagdolling()) {
      this.releaseGrab();
      this._dismount();
      return;
    }

    // Tick mount cooldown
    if (this._mountCooldown > 0) this._mountCooldown -= dt;

    const torso = this.ragdoll.getTorso();
    const isGrabbing = this.grabbedPlayer !== null;

    // === WIND-UP TIMER (big guy attack delay) ===
    if (this._windupTimer > 0) {
      this._windupTimer -= dt;
      if (this._windupTimer <= 0 && this._windupAction) {
        const wa = this._windupAction;
        this._windupAction = null;
        if (wa.type === 'punch') this._hitNearby(wa.impulse, wa.damage);
        else if (wa.type === 'kick') this._hitNearby(wa.impulse, wa.damage);
        else if (wa.type === 'headbutt') this._hitNearby(wa.impulse, wa.damage);
      }
    }

    // === BEING MOUNTED (big guy with small guy on back) ===
    // When mounted, big guy can only struggle — can't attack, movement slowed
    if (this.mountedBy) {
      this.mountShakeTimer += dt;
      // Show hint for big guy
      if (this.isHuman) this._showHint('SOMEONE ON YOUR BACK! Wait to grab them off...');
      // Slow movement while mounted (struggling)
      torso.velocity.x *= 0.95;
      torso.velocity.z *= 0.95;
      // Slow sway
      const freq = 2.5;
      const amplitude = 0.3 + this.mountShakeTimer * 0.2;
      this.ragdoll.facingAngle = this.ragdoll.facingAngle + Math.cos(this.mountShakeTimer * freq * Math.PI * 2) * amplitude * dt * 3;

      // After 2.5 seconds: big guy grabs rider off and SLAMS them
      if (this.mountShakeTimer > 2.5) {
        const rider = this.mountedBy;
        this._shakeOffRider();
        if (rider.ragdoll?.bodies?.torso) {
          const riderMass = rider.ragdoll.bodies.torso.mass;
          const spinDir = (Math.random() > 0.5 ? 1 : -1);
          const launchImp = Math.min(8 * riderMass, 15);
          rider.ragdoll.bodies.torso.applyImpulse(
            new CANNON.Vec3(spinDir * launchImp * 0.8, launchImp, (Math.random() - 0.5) * launchImp * 0.5)
          );
          // Heavy slam damage — 35! Staying on too long is very punishing
          rider.ragdoll.balance.takeDamage(35);
          if (this.audio) this.audio.playHit();
          if (this.audio) this.audio.playKick();
          // Set mount cooldown on the rider — can't remount for 3 seconds
          if (rider.controller) rider.controller._mountCooldown = 3.0;
        }
      }
      // Skip all attacks/movement — just struggle
      // Teammates can freely hit us while we're distracted
      torso.velocity.x *= this.horizontalDamping;
      torso.velocity.z *= this.horizontalDamping;
      return;
    }

    // === RIDING ON SOMEONE'S BACK ===
    if (this.mountedOn) {
      this.mountTimer += dt;
      // Update mount progress bar on rider (0 = just mounted, 1 = about to be thrown)
      this.ragdoll.mountProgress = Math.min(this.mountTimer / 2.5, 1);
      // Show hint
      if (this.isHuman) {
        const timeLeft = Math.max(0, 2.5 - this.mountTimer).toFixed(1);
        this._showHint(`ON THEIR BACK! PUNCH to hit, JUMP to escape! (${timeLeft}s)`);
      }
      const targetBody = this.mountedOn.ragdoll?.bodies?.torso;
      if (!targetBody || !this.mountedOn.alive) {
        this._dismount();
      } else {
        const tp = targetBody.position;

        // Auto-dismount dramatically if target is falling off the arena
        // Jump away to safety when they go near the edge or start falling
        if (tp.y < -1 || Math.abs(tp.x) > 12 || Math.abs(tp.z) > 12 || targetBody.velocity.y < -5) {
          this._dismount();
          // Dramatic leap back toward center
          const toCenter = new CANNON.Vec3(-torso.position.x, 0, -torso.position.z);
          if (toCenter.length() > 0.1) toCenter.normalize();
          torso.applyImpulse(new CANNON.Vec3(
            toCenter.x * 8 * this.scale * this.scale,
            15 * this.scale * this.scale,
            toCenter.z * 8 * this.scale * this.scale
          ));
          return;
        }

        // Stick to their back — position above and behind them
        const ts = this.mountedOn.ragdoll.scale || 1;
        const facing = this.mountedOn.ragdoll.facingAngle;
        // Sit on their back (behind them, slightly above)
        const behindX = -Math.sin(facing) * 0.3 * ts;
        const behindZ = -Math.cos(facing) * 0.3 * ts;
        torso.position.set(tp.x + behindX, tp.y + 0.5 * ts, tp.z + behindZ);
        torso.velocity.copy(targetBody.velocity);

        // Mounted punching — rapid and guaranteed hits
        this.punchCooldown = Math.max(0, this.punchCooldown - dt);
        if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
          this.punchCooldown = 0.2; // Very fast while mounted
          this.ragdoll.triggerPunch();
          if (this.audio) this.audio.playPunch();
          // Direct hit on mount target
          this.mountedOn.ragdoll.balance.takeDamage(8);
          if (this.audio) this.audio.playHit();
          this.ragdoll.voiceManager?.playAttack();
          this.mountedOn.ragdoll.onHit();
        }

        // Jump to dismount voluntarily
        if (actions[Actions.JUMP]) {
          const dismountTarget = this.mountedOn;
          this._dismount();
          torso.applyImpulse(new CANNON.Vec3(0, 10, -5));
        }

        // Slowed movement for mounted player
        torso.velocity.x *= this.horizontalDamping;
        torso.velocity.z *= this.horizontalDamping;
        return; // Skip normal movement while mounted
      }
    }

    // Movement (slower when grabbing)
    const moveMult = isGrabbing ? 0.5 : 1;
    const force = new CANNON.Vec3(0, 0, 0);
    if (actions[Actions.MOVE_LEFT]) force.x -= this.moveForce * moveMult;
    if (actions[Actions.MOVE_RIGHT]) force.x += this.moveForce * moveMult;
    if (actions[Actions.MOVE_FORWARD]) force.z -= this.moveForce * moveMult;
    if (actions[Actions.MOVE_BACKWARD]) force.z += this.moveForce * moveMult;
    torso.applyForce(force);

    // Variable jump
    if (actions[Actions.JUMP]) {
      if (this.isGrounded() && !this.jumpedThisPress) {
        torso.applyImpulse(new CANNON.Vec3(0, this.jumpImpulse, 0));
        this.jumpedThisPress = true;
        if (this.audio) this.audio.playJump();
        this.jumpHoldTimer = 0;
      }
      if (this.jumpedThisPress && this.jumpHoldTimer < this.jumpHoldMax) {
        this.jumpHoldTimer += dt;
        torso.applyForce(new CANNON.Vec3(0, this.jumpHoldForce, 0));
      }
    } else {
      if (this.isGrounded()) this.jumpedThisPress = false;
      this.jumpHoldTimer = this.jumpHoldMax;
    }

    // === CHECK FOR BACK MOUNT (small landing on big) ===
    if (!this.isGrounded() && !isGrabbing && !this.mountedOn) {
      this._checkBackMount();
    }

    // === CHECK FOR LEG SWEEP (small running through big's legs) ===
    if (this.isGrounded()) {
      this._checkLegSweep(dt);
    }

    // === GRAB + COMBO ATTACKS ===
    if (isGrabbing) {
      if (!this.grabbedPlayer.alive || !this.grabConstraint) {
        this.releaseGrab();
      } else {
        this.ragdoll.grabTarget = this.grabbedPlayer.ragdoll.getPosition();

        this.punchCooldown = Math.max(0, this.punchCooldown - dt);
        if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
          this.punchCooldown = this.punchCooldownTime * 0.9;
          this.ragdoll.triggerPunch();
          if (this.audio) this.audio.playPunch();
          this._hitGrabbed(this.punchImpulse * 0.7, this.grabPunchDamage);
        }

        this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
        if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
          this.headbuttCooldown = this.headbuttCooldownTime;
          this.ragdoll.triggerHeadbutt();
          if (this.audio) this.audio.playHeadbutt();
          this._hitGrabbed(this.headbuttImpulse * 0.5, this.grabHeadbuttDamage);
        }

        this.kickCooldown = Math.max(0, this.kickCooldown - dt);
        if (actions[Actions.KICK] && this.kickCooldown <= 0) {
          this.kickCooldown = this.kickCooldownTime;
          this.ragdoll.triggerKick();
          if (this.audio) this.audio.playKick();
          this._throwGrabbed();
        }

        if (!actions[Actions.GRAB]) {
          this.releaseGrab();
        }
      }
    } else {
      this.ragdoll.grabTarget = null;

      // Normal attacks — with wind-up for big characters
      this.punchCooldown = Math.max(0, this.punchCooldown - dt);
      if (actions[Actions.PUNCH] && this.punchCooldown <= 0) {
        this.punchCooldown = this.punchCooldownTime;
        this.ragdoll.triggerPunch();
        if (this.audio) this.audio.playPunch();
        if (this.attackWindup > 0) {
          // Big guy: start wind-up, hit lands after delay
          this._windupTimer = this.attackWindup;
          this._windupAction = { type: 'punch', impulse: this.punchImpulse, damage: this.punchDamage };
        } else {
          this._hitNearby(this.punchImpulse, this.punchDamage);
        }
      }

      this.kickCooldown = Math.max(0, this.kickCooldown - dt);
      if (actions[Actions.KICK] && this.kickCooldown <= 0) {
        this.kickCooldown = this.kickCooldownTime;
        this.ragdoll.triggerKick();
        if (this.audio) this.audio.playKick();
        if (this.attackWindup > 0) {
          this._windupTimer = this.attackWindup;
          this._windupAction = { type: 'kick', impulse: this.kickImpulse, damage: this.kickDamage };
        } else {
          this._hitNearby(this.kickImpulse, this.kickDamage);
        }
      }

      this.headbuttCooldown = Math.max(0, this.headbuttCooldown - dt);
      if (actions[Actions.HEADBUTT] && this.headbuttCooldown <= 0) {
        this.headbuttCooldown = this.headbuttCooldownTime;
        this.ragdoll.triggerHeadbutt();
        if (this.audio) this.audio.playHeadbutt();
        if (this.attackWindup > 0) {
          this._windupTimer = this.attackWindup;
          this._windupAction = { type: 'headbutt', impulse: this.headbuttImpulse, damage: this.headbuttDamage };
        } else {
          this._hitNearby(this.headbuttImpulse, this.headbuttDamage);
        }
      }

      if (actions[Actions.GRAB]) {
        this.ragdoll.grabReaching = true;
        this.tryGrab();
      } else {
        this.ragdoll.grabReaching = false;
      }
    }

    // Horizontal damping
    torso.velocity.x *= this.horizontalDamping;
    torso.velocity.z *= this.horizontalDamping;
  }

  // === BACK MOUNT: small player lands on big player's back ===
  _checkBackMount() {
    // Can't mount if on cooldown (just got shaken off)
    if (this._mountCooldown > 0) return;

    const myScale = this.scale;
    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    // Must be falling down
    if (myBody.velocity.y > 0) return;

    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.ragdoll || !p.alive) continue;
      if (p.ragdoll === this.ragdoll) continue;
      if (this.team !== null && p.team === this.team) continue;

      const theirScale = p.ragdoll.scale || 1;
      // Just need to be smaller than them (any amount)
      if (theirScale <= myScale) continue;
      // They can't already have a rider
      if (p.controller?.mountedBy) continue;

      const theirPos = p.ragdoll.getPosition();
      const dx = myPos.x - theirPos.x;
      const dz = myPos.z - theirPos.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);
      const vertDist = myPos.y - theirPos.y;

      // Must be above them and close horizontally — generous ranges
      if (horizDist < 1.0 * theirScale && vertDist > 0.1 * theirScale && vertDist < 2.0 * theirScale) {
        // Mount!
        this.mountedOn = p;
        this.mountTimer = 0;
        if (p.controller) {
          p.controller.mountedBy = this._findMyPlayer();
          p.controller.mountShakeTimer = 0;
        }
        // Cancel falling velocity
        myBody.velocity.set(0, 0, 0);
        return;
      }
    }
  }

  _findMyPlayer() {
    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (p.ragdoll === this.ragdoll) return p;
    }
    return null;
  }

  _dismount() {
    if (this.mountedOn?.controller) {
      this.mountedOn.controller.mountedBy = null;
      this.mountedOn.controller.mountShakeTimer = 0;
    }
    this.ragdoll.mountProgress = 0;
    this.mountedOn = null;
    this.mountTimer = 0;
  }

  _shakeOffRider() {
    if (!this.mountedBy) return;
    if (this.mountedBy.ragdoll) {
      this.mountedBy.ragdoll.mountProgress = 0;
    }
    if (this.mountedBy.controller) {
      this.mountedBy.controller.mountedOn = null;
      this.mountedBy.controller.mountTimer = 0;
    }
    this.mountedBy = null;
    this.mountShakeTimer = 0;
  }

  // === LEG SWEEP: small player runs through big player's legs ===
  _checkLegSweep(dt) {
    const myScale = this.scale;

    // Cooldown — can't spam it
    if (this._legSweepCooldown > 0) {
      this._legSweepCooldown -= dt;
      return;
    }

    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;
    const mySpeed = Math.sqrt(myBody.velocity.x ** 2 + myBody.velocity.z ** 2);

    // Must be moving fast
    if (mySpeed < 3) return;

    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.ragdoll || !p.alive) continue;
      if (p.ragdoll === this.ragdoll) continue;
      if (this.team !== null && p.team === this.team) continue;

      const theirScale = p.ragdoll.scale || 1;
      // Just need to be smaller than them
      if (theirScale <= myScale) continue;

      const theirBody = p.ragdoll.bodies.torso;
      const theirPos = theirBody.position;
      const dx = myPos.x - theirPos.x;
      const dz = myPos.z - theirPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Must be very close (running through their legs)
      if (dist < 0.6 * theirScale) {
        // Trip them — stumble, not a full launch
        const knockDir = new CANNON.Vec3(
          myBody.velocity.x * 0.3,
          4 * theirScale,
          myBody.velocity.z * 0.3
        );
        theirBody.applyImpulse(knockDir);
        p.ragdoll.balance.takeDamage(5);

        // Small guy slides through
        myBody.velocity.x *= 1.2;
        myBody.velocity.z *= 1.2;

        // 2 second cooldown before can sweep again
        this._legSweepCooldown = 2.0;

        if (this.audio) this.audio.playKick();
        break;
      }
    }
  }

  _hitGrabbed(impulse, damage) {
    if (!this.grabbedPlayer) return;
    const theirBody = this.grabbedPlayer.ragdoll.bodies.torso;
    if (!theirBody) return;

    const myPos = this.ragdoll.getTorso().position;
    const knockDir = new CANNON.Vec3(
      theirBody.position.x - myPos.x,
      0.2,
      theirBody.position.z - myPos.z
    );
    if (knockDir.length() > 0.01) knockDir.normalize();
    else knockDir.set(1, 0.2, 0);

    const knockMult = this.grabbedPlayer.ragdoll.balance.getKnockbackMultiplier();
    const rawGrabImp = impulse * knockMult * 0.3;
    const cappedGrabImp = Math.min(rawGrabImp, 6 * theirBody.mass);
    theirBody.applyImpulse(new CANNON.Vec3(
      knockDir.x * cappedGrabImp,
      knockDir.y * cappedGrabImp,
      knockDir.z * cappedGrabImp
    ));

    this.grabbedPlayer.ragdoll.balance.takeDamage(damage);
    if (this.audio) this.audio.playHit();
  }

  _throwGrabbed() {
    if (!this.grabbedPlayer) return;
    const theirBody = this.grabbedPlayer.ragdoll.bodies.torso;
    if (!theirBody) return;

    const myPos = this.ragdoll.getTorso().position;
    const throwDir = new CANNON.Vec3(
      theirBody.position.x - myPos.x,
      0.8,
      theirBody.position.z - myPos.z
    );
    if (throwDir.length() > 0.01) throwDir.normalize();
    else throwDir.set(0, 1, 0);

    const knockMult = this.grabbedPlayer.ragdoll.balance.getKnockbackMultiplier();
    const rawThrowImp = this.throwImpulse * knockMult;
    const cappedThrowImp = Math.min(rawThrowImp, 12 * theirBody.mass);
    theirBody.applyImpulse(new CANNON.Vec3(
      throwDir.x * cappedThrowImp,
      throwDir.y * cappedThrowImp,
      throwDir.z * cappedThrowImp
    ));

    this.grabbedPlayer.ragdoll.balance.takeDamage(this.throwDamage);
    if (this.audio) this.audio.playKick();

    this.releaseGrab();
  }

  _hitNearby(impulse, damageAmount) {
    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.ragdoll || !p.alive) continue;
      const theirBody = p.ragdoll.bodies.torso;
      if (!theirBody || theirBody === myBody) continue;
      if (this.team !== null && p.team === this.team) continue;

      const dist = myPos.distanceTo(theirBody.position);
      // Effective range includes target's body radius (big targets are easier to hit)
      const targetRadius = 0.35 * (p.ragdoll.scale || 1);
      const effectiveRange = this.attackRange + targetRadius;
      if (dist < effectiveRange) {
        const knockDir = new CANNON.Vec3(
          theirBody.position.x - myPos.x,
          0.1,
          theirBody.position.z - myPos.z
        );
        if (knockDir.length() > 0.01) knockDir.normalize();
        else knockDir.set(1, 0.1, 0);

        const knockMult = p.ragdoll.balance.getKnockbackMultiplier();
        // Scale impulse relative to target mass so small guys don't fly to the moon
        // Target a max velocity change of ~6 regardless of size mismatch
        const targetMass = theirBody.mass;
        const rawImpulse = impulse * knockMult;
        const maxVelocityChange = 6;
        const cappedImpulse = Math.min(rawImpulse, maxVelocityChange * targetMass);
        theirBody.applyImpulse(new CANNON.Vec3(
          knockDir.x * cappedImpulse,
          knockDir.y * cappedImpulse,
          knockDir.z * cappedImpulse
        ));

        p.ragdoll.balance.takeDamage(damageAmount);
        if (this.audio) this.audio.playHit();
        this.ragdoll.voiceManager?.playAttack();
        p.ragdoll.onHit();
      }
    }
  }

  isGrounded() {
    const torso = this.ragdoll.getTorso();
    return torso.position.y < 0.9 * (this.ragdoll.scale || 1);
  }

  tryGrab() {
    if (this.grabConstraint) return;

    const myBody = this.ragdoll.getTorso();
    const myPos = myBody.position;

    const allPlayers = this.game._allPlayers || [];
    for (const p of allPlayers) {
      if (!p.ragdoll || !p.alive) continue;
      const theirBody = p.ragdoll.bodies.torso;
      if (!theirBody || theirBody === myBody) continue;
      if (this.team !== null && p.team === this.team) continue;

      const dist = myPos.distanceTo(theirBody.position);
      if (dist < this.grabRange) {
        this.grabConstraint = new CANNON.DistanceConstraint(myBody, theirBody, 0.8);
        this.game.world.addConstraint(this.grabConstraint);
        this.grabbedPlayer = p;
        return;
      }
    }
  }

  releaseGrab() {
    if (this.grabConstraint) {
      this.game.world.removeConstraint(this.grabConstraint);
      this.grabConstraint = null;
    }
    this.grabbedPlayer = null;
    this.ragdoll.grabTarget = null;
  }

  _showHint(text) {
    if (!this._hintDiv) {
      this._hintDiv = document.createElement('div');
      this._hintDiv.style.cssText = `
        position: fixed; top: 15%; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.75); color: #ffcc00;
        font-family: 'Arial Black', Arial, sans-serif; font-size: 18px;
        padding: 10px 24px; border-radius: 10px;
        z-index: 800; pointer-events: none; text-align: center;
        text-shadow: 0 0 8px rgba(255,200,0,0.5);
      `;
      document.body.appendChild(this._hintDiv);
    }
    this._hintDiv.textContent = text;
    this._hintDiv.style.display = 'block';
    // Auto-hide after a frame if not refreshed
    clearTimeout(this._hintTimeout);
    this._hintTimeout = setTimeout(() => {
      if (this._hintDiv) this._hintDiv.style.display = 'none';
    }, 200);
  }
}
