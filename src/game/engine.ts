import { ParticleSystem } from './particles';
import { sound } from './sound';
import type { GameSprites } from './sprites';
import { loadHighScoreRecord, saveHighScoreRecord } from './storage';
import type {
  Enemy,
  EnemyKind,
  FloatingText,
  GameState,
  HighScoreRecord,
  HudSnapshot,
  Pickup,
  PickupKind,
  Platform,
  Player,
  Projectile,
} from './types';

export interface InputState {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  down: boolean;
  shoot: boolean;
  shieldPressed: boolean;
}

interface BgTower {
  x: number;
  width: number;
  height: number;
  hasBeacon: boolean;
  hasCrane: boolean;
}

const GRAVITY = 1980;
const JUMP_VELOCITY = -730;
const DOUBLE_JUMP_VELOCITY = -690;
const BASE_SCROLL_SPEED = 275;
const MAX_SCROLL_SPEED = 530;
const COMBO_WINDOW = 4.2;

export class IronCrownEngine {
  private sprites: GameSprites;
  private width = 1280;
  private height = 720;

  private state: GameState = 'TITLE_MENU';
  private player: Player;
  private platforms: Platform[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private particleSystem = new ParticleSystem();
  private floatingTexts: FloatingText[] = [];
  private farTowers: BgTower[] = [];
  private midGirders: BgTower[] = [];

  private nextEntityId = 1;
  private rightmostDeckX = 0;
  private lastDeckY = 520;
  private scrollSpeed = BASE_SCROLL_SPEED;
  private worldTime = 0;

  private distancePx = 0;
  private score = 0;
  private kills = 0;
  private combo = 1;
  private comboTimer = 0;
  private bestComboRun = 1;
  private isNewHighScore = false;
  private deathReason = '';
  private shakeTimer = 0;
  private shakeMagnitude = 0;
  private hurtFlashTimer = 0;

  private records: HighScoreRecord;

  constructor(sprites: GameSprites, width: number, height: number) {
    this.sprites = sprites;
    this.width = Math.max(320, width);
    this.height = Math.max(320, height);
    this.records = loadHighScoreRecord();
    this.player = this.createInitialPlayer();
    this.initBackgroundLayers();
    this.resetWorld();
  }

  public resize(width: number, height: number): void {
    const prevHeight = this.height;
    this.width = Math.max(320, width);
    this.height = Math.max(320, height);
    const dy = this.height - prevHeight;
    if (Math.abs(dy) > 1) {
      this.player.y += dy * 0.72;
      this.lastDeckY += dy * 0.72;
      for (const p of this.platforms) {
        p.y += dy * 0.72;
        p.baseY += dy * 0.72;
      }
      for (const e of this.enemies) {
        e.y += dy * 0.72;
      }
      for (const pk of this.pickups) {
        pk.y += dy * 0.72;
        pk.baseY += dy * 0.72;
      }
    }
  }

  public setState(nextState: GameState): void {
    this.state = nextState;
  }

  public getState(): GameState {
    return this.state;
  }

  public startNewRun(): void {
    this.records = loadHighScoreRecord();
    this.resetWorld();
    this.state = 'PLAYING';
  }

  private createInitialPlayer(): Player {
    const groundY = this.getGroundBaseY();
    const startX = Math.min(220, this.width * 0.2);
    return {
      x: startX,
      y: groundY - 76,
      vx: 0,
      vy: 0,
      width: 64,
      height: 76,
      hp: 100,
      maxHp: 100,
      grounded: true,
      jumpsRemaining: 2,
      maxJumps: 2,
      jumpHoldTimer: 0,
      dropThroughTimer: 0,
      fireCooldown: 0,
      recoilOffset: 0,
      muzzleFlashTimer: 0,
      invulnTimer: 0,
      shieldActiveTimer: 0,
      shieldCooldownTimer: 0,
      shieldMaxCooldown: 6.5,
      shieldDuration: 2.6,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      bobPhase: 0,
    };
  }

  private getGroundBaseY(): number {
    return Math.round(Math.min(this.height - 130, Math.max(300, this.height * 0.74)));
  }

  private initBackgroundLayers(): void {
    this.farTowers = [];
    let fx = -80;
    while (fx < this.width + 600) {
      const w = 70 + Math.random() * 110;
      this.farTowers.push({
        x: fx,
        width: w,
        height: 150 + Math.random() * 270,
        hasBeacon: Math.random() < 0.45,
        hasCrane: Math.random() < 0.3,
      });
      fx += w + 24 + Math.random() * 60;
    }

    this.midGirders = [];
    let mx = -60;
    while (mx < this.width + 600) {
      const w = 48 + Math.random() * 68;
      this.midGirders.push({
        x: mx,
        width: w,
        height: 110 + Math.random() * 190,
        hasBeacon: Math.random() < 0.3,
        hasCrane: false,
      });
      mx += w + 90 + Math.random() * 130;
    }
  }

  private resetWorld(): void {
    this.platforms = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particleSystem.clear();
    this.floatingTexts = [];
    this.nextEntityId = 1;
    this.distancePx = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.bestComboRun = 1;
    this.isNewHighScore = false;
    this.deathReason = '';
    this.scrollSpeed = BASE_SCROLL_SPEED;
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
    this.hurtFlashTimer = 0;

    const baseY = this.getGroundBaseY();
    this.lastDeckY = baseY;

    // Safe starting deck
    const starterWidth = Math.max(760, this.width * 0.75);
    this.platforms.push({
      id: this.nextEntityId++,
      x: -40,
      y: baseY,
      width: starterWidth,
      height: 80,
      kind: 'deck',
      baseY,
      bobPhase: 0,
      tileSeed: 0,
    });
    this.rightmostDeckX = -40 + starterWidth;

    this.player = this.createInitialPlayer();
    this.player.y = baseY - this.player.height;

    // Pre-generate initial horizon
    this.generateAhead();
  }

  public getHudSnapshot(): HudSnapshot {
    const distance = Math.floor(this.distancePx / 32);
    return {
      score: Math.floor(this.score),
      highScore: Math.max(this.records.highScore, Math.floor(this.score)),
      isNewHighScore: this.isNewHighScore,
      distance,
      kills: this.kills,
      combo: this.combo,
      comboTimerRatio: this.combo > 1 ? Math.max(0, this.comboTimer / COMBO_WINDOW) : 0,
      hp: Math.max(0, Math.ceil(this.player.hp)),
      maxHp: this.player.maxHp,
      shieldActive: this.player.shieldActiveTimer > 0,
      shieldActiveRatio:
        this.player.shieldActiveTimer > 0
          ? this.player.shieldActiveTimer / this.player.shieldDuration
          : 0,
      shieldReady:
        this.player.shieldActiveTimer <= 0 && this.player.shieldCooldownTimer <= 0,
      shieldCooldownRatio:
        this.player.shieldCooldownTimer > 0
          ? 1 - this.player.shieldCooldownTimer / this.player.shieldMaxCooldown
          : 1,
      speedMultiplier: Number((this.scrollSpeed / BASE_SCROLL_SPEED).toFixed(2)),
      bestDistance: Math.max(this.records.bestDistance, distance),
      bestKills: Math.max(this.records.bestKills, this.kills),
      bestCombo: Math.max(this.records.bestCombo, this.bestComboRun),
      deathReason: this.deathReason,
    };
  }

  public update(dtRaw: number, input: InputState): void {
    const dt = Math.min(0.033, Math.max(0.001, dtRaw));
    this.worldTime += dt;

    if (this.state === 'TITLE_MENU') {
      // Gentle idle animation on title screen
      this.updateBackground(dt, BASE_SCROLL_SPEED * 0.35);
      this.player.bobPhase += dt * 3;
      this.emitAmbientMotes(dt);
      this.particleSystem.update(dt, 0);
      return;
    }

    if (this.state !== 'PLAYING') {
      return;
    }

    // Progressive speed ramp
    const distanceMeters = this.distancePx / 32;
    this.scrollSpeed = Math.min(
      MAX_SCROLL_SPEED,
      BASE_SCROLL_SPEED + distanceMeters * 0.24
    );

    const scrollDx = this.scrollSpeed * dt;
    this.distancePx += scrollDx;
    this.score += (scrollDx / 32) * 10;

    if (this.records.highScore > 0 && Math.floor(this.score) > this.records.highScore) {
      if (!this.isNewHighScore) {
        this.isNewHighScore = true;
        this.addFloatingText(this.player.x, this.player.y - 26, 'NEW HIGH SCORE!', '#38BDF8');
      }
    }

    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.hurtFlashTimer > 0) this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt);

    this.updateBackground(dt, this.scrollSpeed);
    this.updatePlatforms(dt, scrollDx);
    this.generateAhead();
    this.updatePlayer(dt, input);
    this.updateEnemies(dt, scrollDx);
    this.updateProjectiles(dt, scrollDx);
    this.updatePickups(dt, scrollDx);
    this.particleSystem.update(dt, scrollDx);
    this.updateFloatingTexts(dt);

    if (this.player.hp <= 0) {
      this.triggerGameOver();
    }
  }

  private updateBackground(dt: number, speed: number): void {
    for (const t of this.farTowers) {
      t.x -= speed * 0.14 * dt;
    }
    if (this.farTowers.length > 0 && this.farTowers[0].x + this.farTowers[0].width < -120) {
      const first = this.farTowers.shift()!;
      const last = this.farTowers[this.farTowers.length - 1];
      first.x = last.x + last.width + 24 + Math.random() * 65;
      first.height = 150 + Math.random() * 270;
      this.farTowers.push(first);
    }

    for (const g of this.midGirders) {
      g.x -= speed * 0.34 * dt;
    }
    if (this.midGirders.length > 0 && this.midGirders[0].x + this.midGirders[0].width < -120) {
      const first = this.midGirders.shift()!;
      const last = this.midGirders[this.midGirders.length - 1];
      first.x = last.x + last.width + 90 + Math.random() * 140;
      first.height = 110 + Math.random() * 190;
      this.midGirders.push(first);
    }
  }

  private updatePlatforms(dt: number, scrollDx: number): void {
    this.rightmostDeckX -= scrollDx;
    for (const p of this.platforms) {
      p.x -= scrollDx;
      if (p.kind === 'hover') {
        p.bobPhase += dt * 2.8;
        p.y = p.baseY + Math.sin(p.bobPhase) * 7;
        // Hover thruster exhaust particles
        if (Math.random() < 0.35) {
          this.particleSystem.spawnHoverExhaust(
            p.x + p.width * 0.5,
            p.y + 42,
            this.scrollSpeed
          );
        }
      }
    }
    this.platforms = this.platforms.filter((p) => p.x + p.width > -240);
  }

  private generateAhead(): void {
    const distanceMeters = this.distancePx / 32;
    const difficulty = Math.min(1, distanceMeters / 950);
    const groundBaseY = this.getGroundBaseY();

    while (this.rightmostDeckX < this.width + 540) {
      // Gap width scales fairly with scroll speed so double jump always clears it comfortably
      const minGap = 115 + difficulty * 45;
      const maxGap = Math.min(350, 185 + difficulty * 155);
      const gapWidth = minGap + Math.random() * (maxGap - minGap);

      const nextX = this.rightmostDeckX + gapWidth;
      const deltaY = (Math.random() - 0.5) * 115;
      const nextY = Math.max(
        groundBaseY - 115,
        Math.min(groundBaseY + 25, this.lastDeckY + deltaY)
      );

      const deckWidth = Math.max(260, 560 - difficulty * 170 + (Math.random() - 0.3) * 200);

      const deck: Platform = {
        id: this.nextEntityId++,
        x: nextX,
        y: nextY,
        width: deckWidth,
        height: 80,
        kind: 'deck',
        baseY: nextY,
        bobPhase: 0,
        tileSeed: Math.floor(Math.random() * 4),
      };
      this.platforms.push(deck);

      // Add hovering platform over wide gaps or as elevated tactical routes
      const needsBridge = gapWidth > 235;
      const spawnHover = needsBridge || Math.random() < 0.45;
      if (spawnHover) {
        const hoverW = 166;
        const hoverX = needsBridge
          ? this.rightmostDeckX + gapWidth * 0.5 - hoverW * 0.5
          : nextX + deckWidth * (0.25 + Math.random() * 0.4);
        const hoverY = needsBridge
          ? Math.min(this.lastDeckY, nextY) - 45 - Math.random() * 35
          : nextY - 125 - Math.random() * 45;

        const hover: Platform = {
          id: this.nextEntityId++,
          x: hoverX,
          y: hoverY,
          width: hoverW,
          height: 24,
          kind: 'hover',
          baseY: hoverY,
          bobPhase: Math.random() * Math.PI * 2,
          tileSeed: 0,
        };
        this.platforms.push(hover);

        // Reward on hover platform
        const rewardRoll = Math.random();
        if (this.player.hp < 65 && rewardRoll < 0.45) {
          this.spawnPickup('medkit', hoverX + hoverW * 0.5, hoverY - 26);
        } else if (rewardRoll < 0.32) {
          this.spawnPickup('shield', hoverX + hoverW * 0.5, hoverY - 26);
        } else {
          this.spawnPickup('core', hoverX + hoverW * 0.5, hoverY - 26);
        }
      } else if (Math.random() < 0.55) {
        // Arc of data cores across the gap
        const midGapX = this.rightmostDeckX + gapWidth * 0.5;
        const arcTopY = Math.min(this.lastDeckY, nextY) - 96;
        this.spawnPickup('core', midGapX - 28, arcTopY + 14);
        this.spawnPickup('core', midGapX, arcTopY);
        this.spawnPickup('core', midGapX + 28, arcTopY + 14);
      }

      // Spawn enemies on deck or in sky
      this.populateEncounter(deck, gapWidth, difficulty);

      this.rightmostDeckX = nextX + deckWidth;
      this.lastDeckY = nextY;
    }
  }

  private populateEncounter(deck: Platform, gapWidth: number, difficulty: number): void {
    // 1. Ground enemy on deck (skip very short decks or early intro)
    if (deck.width > 300 && Math.random() < 0.52 + difficulty * 0.28) {
      const isHeavy = difficulty > 0.25 && deck.width > 390 && Math.random() < 0.24 + difficulty * 0.18;
      const kind: EnemyKind = isHeavy ? 'heavy' : 'walker';
      const w = isHeavy ? 66 : 48;
      const h = isHeavy ? 68 : 48;
      const ex = deck.x + Math.max(150, deck.width * 0.48);
      this.enemies.push({
        id: this.nextEntityId++,
        kind,
        x: ex,
        y: deck.y - h,
        vx: isHeavy ? -28 : -58,
        vy: 0,
        width: w,
        height: h,
        hp: isHeavy ? 6 : 3,
        maxHp: isHeavy ? 6 : 3,
        hitFlashTimer: 0,
        fireTimer: 0.9 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        platformId: deck.id,
        patrolMinX: deck.x + 28,
        patrolMaxX: deck.x + deck.width - w - 24,
        scoreValue: isHeavy ? 300 : 150,
      });
    }

    // 2. Aerial Scout Drone
    if (Math.random() < 0.42 + difficulty * 0.34) {
      const droneX = deck.x + deck.width * (0.2 + Math.random() * 0.65);
      const droneY = deck.y - 125 - Math.random() * 90;
      this.enemies.push({
        id: this.nextEntityId++,
        kind: 'drone',
        x: droneX,
        y: droneY,
        vx: -40 - difficulty * 40,
        vy: 0,
        width: 44,
        height: 36,
        hp: 2,
        maxHp: 2,
        hitFlashTimer: 0,
        fireTimer: 0.8 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2,
        scoreValue: 100,
      });
    }

    // 3. Gap Interceptor (dash mine)
    if (difficulty > 0.12 && gapWidth > 145 && Math.random() < 0.26 + difficulty * 0.25) {
      this.enemies.push({
        id: this.nextEntityId++,
        kind: 'interceptor',
        x: deck.x - gapWidth * 0.25,
        y: deck.y - 85 - Math.random() * 55,
        vx: 0,
        vy: 0,
        width: 42,
        height: 42,
        hp: 1,
        maxHp: 1,
        hitFlashTimer: 0,
        fireTimer: 0,
        phase: Math.random() * Math.PI * 2,
        scoreValue: 120,
        dashArmed: false,
        dashing: false,
      });
    }

    // Occasional deck medkit if player needs health
    if (this.player.hp < 75 && Math.random() < 0.28) {
      this.spawnPickup('medkit', deck.x + deck.width * 0.28, deck.y - 26);
    }
  }

  private spawnPickup(kind: PickupKind, x: number, y: number): void {
    this.pickups.push({
      id: this.nextEntityId++,
      kind,
      x,
      y,
      baseY: y,
      radius: 14,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private updatePlayer(dt: number, input: InputState): void {
    const p = this.player;

    // Cooldowns & timers
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.muzzleFlashTimer > 0) p.muzzleFlashTimer = Math.max(0, p.muzzleFlashTimer - dt);
    if (p.recoilOffset > 0) p.recoilOffset = Math.max(0, p.recoilOffset - dt * 55);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.dropThroughTimer > 0) p.dropThroughTimer = Math.max(0, p.dropThroughTimer - dt);

    if (p.shieldActiveTimer > 0) {
      p.shieldActiveTimer = Math.max(0, p.shieldActiveTimer - dt);
      if (p.shieldActiveTimer === 0) {
        p.shieldCooldownTimer = p.shieldMaxCooldown;
      }
    } else if (p.shieldCooldownTimer > 0) {
      p.shieldCooldownTimer = Math.max(0, p.shieldCooldownTimer - dt);
    }

    // Activate Shield
    if (
      input.shieldPressed &&
      p.shieldActiveTimer <= 0 &&
      p.shieldCooldownTimer <= 0
    ) {
      p.shieldActiveTimer = p.shieldDuration;
      sound.playShieldOn();
      this.spawnBurst(p.x + p.width * 0.7, p.y + p.height * 0.5, '#38BDF8', 14, 180);
      this.addFloatingText(p.x + p.width * 0.5, p.y - 14, 'SHIELD ACTIVE', '#38BDF8');
    }

    // Horizontal positioning inside screen bounds
    const moveSpeed = 340;
    let targetVx = 0;
    if (input.left) targetVx -= moveSpeed;
    if (input.right) targetVx += moveSpeed;
    p.vx += (targetVx - p.vx) * Math.min(1, dt * 16);
    p.x += p.vx * dt;
    const minX = 28;
    const maxX = Math.max(120, this.width * 0.66 - p.width);
    p.x = Math.max(minX, Math.min(maxX, p.x));

    // Drop through hovering platforms
    if (input.down && p.grounded) {
      const standingOnHover = this.platforms.some(
        (pl) =>
          pl.kind === 'hover' &&
          p.x + p.width - 8 > pl.x &&
          p.x + 8 < pl.x + pl.width &&
          Math.abs(p.y + p.height - pl.y) < 10
      );
      if (standingOnHover) {
        p.dropThroughTimer = 0.24;
        p.grounded = false;
        p.y += 4;
      }
    }

    // Coyote time & jump buffer
    if (p.grounded) {
      p.coyoteTimer = 0.11;
      p.jumpsRemaining = p.maxJumps;
    } else {
      p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
    }

    if (input.jumpPressed) {
      p.jumpBufferTimer = 0.12;
    } else {
      p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
    }

    if (p.jumpBufferTimer > 0) {
      if (p.coyoteTimer > 0) {
        p.vy = JUMP_VELOCITY;
        p.grounded = false;
        p.coyoteTimer = 0;
        p.jumpBufferTimer = 0;
        p.jumpsRemaining = p.maxJumps - 1;
        p.jumpHoldTimer = 0.16;
        sound.playJump(false);
        this.spawnJetFlameBurst(p.x + p.width * 0.5, p.y + p.height, 10);
      } else if (p.jumpsRemaining > 0) {
        p.vy = DOUBLE_JUMP_VELOCITY;
        p.jumpsRemaining -= 1;
        p.jumpBufferTimer = 0;
        p.jumpHoldTimer = 0.14;
        sound.playJump(true);
        this.spawnJetFlameBurst(p.x + p.width * 0.5, p.y + p.height, 16);
      }
    }

    // Variable jump height while holding jump
    if (input.jumpHeld && p.jumpHoldTimer > 0 && p.vy < 0) {
      p.vy -= 520 * dt;
      p.jumpHoldTimer -= dt;
    } else {
      p.jumpHoldTimer = 0;
    }

    // Gravity
    const prevBottom = p.y + p.height;
    p.vy = Math.min(1150, p.vy + GRAVITY * dt);
    p.y += p.vy * dt;

    // Thruster trail while airborne
    if (!p.grounded) {
      if (p.vy < 140 && Math.random() < 0.65) {
        this.particleSystem.spawnThrusterTrail(
          p.x + p.width * 0.5,
          p.y + p.height + 6,
          this.scrollSpeed
        );
      }
    } else {
      p.bobPhase += dt * 16;
    }

    // Platform collisions (one-way landing on top surfaces + deck side-blocking slightly forgiving)
    p.grounded = false;
    const footLeft = p.x + 10;
    const footRight = p.x + p.width - 10;
    const nextBottom = p.y + p.height;

    if (p.vy >= 0) {
      for (const pl of this.platforms) {
        if (pl.kind === 'hover' && p.dropThroughTimer > 0) continue;
        if (footRight > pl.x && footLeft < pl.x + pl.width) {
          // Crossed top surface or resting cleanly on it
          if (prevBottom <= pl.y + 14 && nextBottom >= pl.y) {
            p.y = pl.y - p.height;
            p.vy = 0;
            p.grounded = true;
            p.jumpsRemaining = p.maxJumps;
            break;
          }
        }
      }
    }

    // Shooting
    if (input.shoot && p.fireCooldown <= 0) {
      this.firePlayerCannon();
    }

    // Chasm fall check
    if (p.y > this.height + 70) {
      this.handleChasmFall();
    }
  }

  private firePlayerCannon(): void {
    const p = this.player;
    p.fireCooldown = 0.165;
    p.recoilOffset = 6;
    p.muzzleFlashTimer = 0.065;

    const muzzleX = p.x + p.width + 20;
    const muzzleY = p.y + p.height * 0.57;

    this.projectiles.push({
      id: this.nextEntityId++,
      fromPlayer: true,
      x: muzzleX,
      y: muzzleY,
      vx: 960,
      vy: 0,
      radius: 6,
      damage: 1,
      color: '#38BDF8',
      trail: [],
    });

    sound.playShoot();

    // Muzzle spark particles
    this.particleSystem.spawnMuzzleSparks(muzzleX, muzzleY);
  }

  private handleChasmFall(): void {
    const p = this.player;
    const pitDamage = 40;
    p.hp = Math.max(0, p.hp - pitDamage);
    this.combo = 1;
    this.comboTimer = 0;
    this.hurtFlashTimer = 0.35;
    this.triggerShake(0.32, 11);

    this.particleSystem.spawnPlayerDamageExplosion(
      p.x + p.width * 0.5,
      Math.min(this.height - 24, p.y + p.height * 0.5),
      p.hp <= 0
    );

    if (p.hp <= 0) {
      this.deathReason = 'Fell into an orbital chasm';
      return;
    }

    sound.playDamage();
    sound.playJump(true);

    // Find safest nearby deck or spawn an emergency hover rescue pad!
    const targetPlatform =
      this.platforms.find(
        (pl) => pl.x + pl.width > p.x + 40 && pl.x < p.x + this.width * 0.7
      ) ?? null;

    if (targetPlatform) {
      p.x = Math.max(40, Math.min(this.width * 0.45, targetPlatform.x + 44));
      p.y = targetPlatform.y - p.height - 130;
    } else {
      const safeY = this.getGroundBaseY() - 20;
      this.platforms.push({
        id: this.nextEntityId++,
        x: p.x - 40,
        y: safeY,
        width: 170,
        height: 24,
        kind: 'hover',
        baseY: safeY,
        bobPhase: 0,
        tileSeed: 0,
      });
      p.y = safeY - p.height - 120;
    }

    p.vy = -320;
    p.jumpsRemaining = 1;
    p.invulnTimer = 1.6;
    this.spawnJetFlameBurst(p.x + p.width * 0.5, p.y + p.height, 22);
    this.addFloatingText(p.x + p.width * 0.5, p.y - 12, '-40 HP · EMERGENCY THRUST', '#F59E0B');
  }

  private updateEnemies(dt: number, scrollDx: number): void {
    const p = this.player;
    const playerCx = p.x + p.width * 0.5;
    const playerCy = p.y + p.height * 0.5;

    for (const e of this.enemies) {
      e.x -= scrollDx;
      if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
      e.phase += dt * 3.2;

      if (e.kind === 'drone') {
        e.x += e.vx * dt;
        e.y += Math.sin(e.phase) * 48 * dt;

        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.x < this.width - 30 && e.x > p.x + 20) {
          e.fireTimer = 1.9 + Math.random() * 0.9;
          this.spawnEnemyShot(e.x, e.y + e.height * 0.5, -390, (playerCy - (e.y + e.height * 0.5)) * 0.42, '#EF4444', 15);
        }
      } else if (e.kind === 'walker' || e.kind === 'heavy') {
        // Patrol platform
        const host = this.platforms.find((pl) => pl.id === e.platformId);
        if (host) {
          e.x += e.vx * dt;
          const minX = host.x + 18;
          const maxX = host.x + host.width - e.width - 18;
          if (e.x <= minX) {
            e.x = minX;
            e.vx = Math.abs(e.vx);
          } else if (e.x >= maxX) {
            e.x = maxX;
            e.vx = -Math.abs(e.vx);
          }
          e.y = host.y - e.height;
        }

        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.x < this.width - 20 && e.x > p.x + 30) {
          if (e.kind === 'heavy') {
            e.fireTimer = 1.75 + Math.random() * 0.6;
            // Twin spread bolt
            this.spawnEnemyShot(e.x, e.y + e.height * 0.42, -430, -35, '#F97316', 18);
            this.spawnEnemyShot(e.x, e.y + e.height * 0.58, -430, 15, '#F97316', 18);
          } else {
            e.fireTimer = 1.8 + Math.random() * 0.9;
            this.spawnEnemyShot(e.x, e.y + e.height * 0.46, -420, 0, '#EF4444', 15);
          }
        }
      } else if (e.kind === 'interceptor') {
        if (!e.dashArmed && e.x < this.width - 40) {
          e.dashArmed = true;
          e.fireTimer = 0.55;
        }
        if (e.dashArmed && !e.dashing) {
          e.fireTimer -= dt;
          e.y += (playerCy - (e.y + e.height * 0.5)) * dt * 2.2;
          if (e.fireTimer <= 0) {
            e.dashing = true;
            e.vx = -470;
          }
        } else if (e.dashing) {
          e.x += e.vx * dt;
        }
      }

      // Check collision with Player
      if (
        p.x + 8 < e.x + e.width - 6 &&
        p.x + p.width - 8 > e.x + 6 &&
        p.y + 8 < e.y + e.height - 6 &&
        p.y + p.height - 6 > e.y + 6
      ) {
        if (p.shieldActiveTimer > 0) {
          // Shield bashes & destroys smaller enemies or bounces heavy ones
          sound.playDeflect();
          this.damageEnemy(e, e.kind === 'heavy' ? 3 : e.hp, true);
          this.triggerShake(0.14, 5);
        } else if (p.invulnTimer <= 0) {
          const dmg = e.kind === 'heavy' ? 28 : 22;
          this.damagePlayer(dmg, e.kind === 'heavy' ? 'Crushed by Heavy Mech' : 'Collided with enemy unit');
          if (e.kind === 'interceptor') {
            e.hp = 0;
          }
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.x + e.width > -160);
    void playerCx;
  }

  private spawnEnemyShot(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    damage: number
  ): void {
    this.projectiles.push({
      id: this.nextEntityId++,
      fromPlayer: false,
      x,
      y,
      vx,
      vy,
      radius: 6.5,
      damage,
      color,
      trail: [],
    });
  }

  private updateProjectiles(dt: number, scrollDx: number): void {
    const p = this.player;
    const shieldCenterX = p.x + p.width * 0.72;
    const shieldCenterY = p.y + p.height * 0.52;
    const shieldRadius = 46;

    const remaining: Projectile[] = [];

    for (const proj of this.projectiles) {
      proj.trail.push({ x: proj.x, y: proj.y });
      if (proj.trail.length > 5) proj.trail.shift();

      proj.x += proj.vx * dt - (proj.fromPlayer ? 0 : scrollDx * 0.25);
      proj.y += proj.vy * dt;

      if (proj.x < -80 || proj.x > this.width + 120 || proj.y < -80 || proj.y > this.height + 80) {
        continue;
      }

      let consumed = false;

      if (proj.fromPlayer) {
        for (const e of this.enemies) {
          if (
            proj.x + proj.radius > e.x &&
            proj.x - proj.radius < e.x + e.width &&
            proj.y + proj.radius > e.y &&
            proj.y - proj.radius < e.y + e.height
          ) {
            this.damageEnemy(e, proj.damage, false);
            this.spawnBurst(proj.x, proj.y, '#7DD3FC', 6, 130);
            consumed = true;
            break;
          }
        }
      } else {
        // Enemy projectile vs Player Shield
        if (p.shieldActiveTimer > 0) {
          const dx = proj.x - shieldCenterX;
          const dy = proj.y - shieldCenterY;
          if (dx * dx + dy * dy <= (shieldRadius + proj.radius) * (shieldRadius + proj.radius)) {
            sound.playDeflect();
            this.score += 25 * this.combo;
            this.spawnBurst(proj.x, proj.y, '#38BDF8', 10, 190);
            this.addFloatingText(proj.x, proj.y - 12, `+${25 * this.combo} PARRY`, '#38BDF8');
            consumed = true;
          }
        }

        // Enemy projectile vs Player Body
        if (
          !consumed &&
          p.invulnTimer <= 0 &&
          proj.x + proj.radius > p.x + 8 &&
          proj.x - proj.radius < p.x + p.width - 8 &&
          proj.y + proj.radius > p.y + 8 &&
          proj.y - proj.radius < p.y + p.height - 6
        ) {
          this.damagePlayer(proj.damage, 'Destroyed by enemy fire');
          this.spawnBurst(proj.x, proj.y, '#EF4444', 10, 170);
          consumed = true;
        }
      }

      if (!consumed) {
        remaining.push(proj);
      }
    }

    this.projectiles = remaining;
  }

  private damageEnemy(e: Enemy, amount: number, fromShield: boolean): void {
    e.hp -= amount;
    e.hitFlashTimer = 0.09;

    if (e.hp <= 0) {
      sound.playExplosion();
      this.kills += 1;
      this.combo = Math.min(5, this.combo + 1);
      this.comboTimer = COMBO_WINDOW;
      this.bestComboRun = Math.max(this.bestComboRun, this.combo);

      const gained = e.scoreValue * this.combo;
      this.score += gained;
      this.triggerShake(0.14, e.kind === 'heavy' ? 8 : 4.5);

      const cx = e.x + e.width * 0.5;
      const cy = e.y + e.height * 0.5;
      this.particleSystem.spawnEnemyExplosion(cx, cy, e.kind, fromShield);
      this.addFloatingText(
        cx,
        e.y - 8,
        `+${gained}${this.combo > 1 ? ` · x${this.combo}` : ''}`,
        fromShield ? '#38BDF8' : '#FBBF24'
      );

      // Heavy enemies drop a guaranteed Medkit or Core
      if (e.kind === 'heavy') {
        this.spawnPickup(this.player.hp < 85 ? 'medkit' : 'core', cx, cy);
      }
    } else if (!fromShield) {
      sound.playEnemyHit();
    }
  }

  private damagePlayer(amount: number, reason: string): void {
    const p = this.player;
    p.hp = Math.max(0, p.hp - amount);
    p.invulnTimer = 1.05;
    this.combo = 1;
    this.comboTimer = 0;
    this.hurtFlashTimer = 0.28;
    this.triggerShake(0.24, 9);
    sound.playDamage();
    this.particleSystem.spawnPlayerDamageExplosion(
      p.x + p.width * 0.5,
      p.y + p.height * 0.5,
      p.hp <= 0
    );
    this.addFloatingText(p.x + p.width * 0.5, p.y - 12, `-${amount} HP`, '#EF4444');
    if (p.hp <= 0) {
      this.deathReason = reason;
    }
  }

  private updatePickups(dt: number, scrollDx: number): void {
    const p = this.player;
    const px = p.x + p.width * 0.5;
    const py = p.y + p.height * 0.5;

    const remaining: Pickup[] = [];
    for (const pk of this.pickups) {
      pk.x -= scrollDx;
      pk.phase += dt * 4;
      pk.y = pk.baseY + Math.sin(pk.phase) * 5;

      if (pk.x + pk.radius < -60) continue;

      const dx = pk.x - px;
      const dy = pk.y - py;
      if (dx * dx + dy * dy <= (pk.radius + 36) * (pk.radius + 36)) {
        if (pk.kind === 'medkit') {
          const prevHp = p.hp;
          p.hp = Math.min(p.maxHp, p.hp + 25);
          const healed = Math.round(p.hp - prevHp);
          sound.playPickup(true);
          this.spawnBurst(pk.x, pk.y, '#10B981', 12, 160);
          this.addFloatingText(
            pk.x,
            pk.y - 12,
            healed > 0 ? `+${healed} HP` : '+75 FULL HP BONUS',
            '#34D399'
          );
          if (healed === 0) this.score += 75;
        } else if (pk.kind === 'shield') {
          p.shieldCooldownTimer = 0;
          this.score += 50 * this.combo;
          sound.playPickup(true);
          this.spawnBurst(pk.x, pk.y, '#38BDF8', 12, 170);
          this.addFloatingText(pk.x, pk.y - 12, 'SHIELD CHARGED', '#38BDF8');
        } else {
          const pts = 100 * this.combo;
          this.score += pts;
          sound.playPickup(false);
          this.spawnBurst(pk.x, pk.y, '#FBBF24', 10, 140);
          this.addFloatingText(pk.x, pk.y - 12, `+${pts}`, '#FBBF24');
        }
        continue;
      }

      remaining.push(pk);
    }

    this.pickups = remaining;
  }

  private emitAmbientMotes(dt: number): void {
    if (Math.random() < dt * 12) {
      this.particleSystem.emitAmbientMote(this.width, this.height);
    }
  }

  private spawnJetFlameBurst(x: number, y: number, count: number): void {
    this.particleSystem.spawnJetFlameBurst(x, y, count, this.scrollSpeed);
  }

  private spawnBurst(x: number, y: number, color: string, count: number, speed: number): void {
    this.particleSystem.spawnBurst(x, y, color, count, speed);
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -48,
      text,
      color,
      life: 0,
      maxLife: 0.95,
    });
  }

  private updateFloatingTexts(dt: number): void {
    const next: FloatingText[] = [];
    for (const ft of this.floatingTexts) {
      ft.life += dt;
      if (ft.life >= ft.maxLife) continue;
      ft.y += ft.vy * dt;
      next.push(ft);
    }
    this.floatingTexts = next;
  }

  private triggerShake(duration: number, magnitude: number): void {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
  }

  private triggerGameOver(): void {
    this.state = 'GAME_OVER';
    sound.playGameOver();
    const distance = Math.floor(this.distancePx / 32);
    if (this.score > this.records.highScore) {
      this.isNewHighScore = true;
    }
    this.records = saveHighScoreRecord({
      highScore: Math.floor(this.score),
      bestDistance: distance,
      bestKills: this.kills,
      bestCombo: this.bestComboRun,
    });
  }

  // ==================== RENDERING ====================
  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    if (this.shakeTimer > 0) {
      const mag = this.shakeMagnitude * (this.shakeTimer / 0.3);
      ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
    }

    this.renderBackdrop(ctx);
    this.renderPlatforms(ctx);
    this.renderPickups(ctx);
    this.renderEnemies(ctx);
    this.renderPlayer(ctx);
    this.renderProjectiles(ctx);
    this.renderParticles(ctx);
    this.renderFloatingTexts(ctx);

    // Subtle red damage vignette
    if (this.hurtFlashTimer > 0) {
      const alpha = Math.min(0.32, this.hurtFlashTimer * 1.1);
      const grad = ctx.createRadialGradient(
        this.width * 0.5,
        this.height * 0.5,
        this.height * 0.25,
        this.width * 0.5,
        this.height * 0.5,
        Math.max(this.width, this.height) * 0.72
      );
      grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      grad.addColorStop(1, `rgba(239, 68, 68, ${alpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D): void {
    // Sky gradient (60% calm cool dark slate)
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, '#080D18');
    sky.addColorStop(0.55, '#0F182A');
    sky.addColorStop(1, '#16233A');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle horizon glow
    const horizonGrad = ctx.createLinearGradient(0, this.height * 0.45, 0, this.height);
    horizonGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    horizonGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.05)');
    horizonGrad.addColorStop(1, 'rgba(15, 23, 42, 0.75)');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, this.height * 0.45, this.width, this.height * 0.55);

    // Far parallax orbital towers
    for (const t of this.farTowers) {
      const topY = this.height - t.height;
      ctx.fillStyle = '#0D1524';
      ctx.fillRect(t.x, topY, t.width, t.height);
      ctx.fillStyle = '#131E33';
      ctx.fillRect(t.x + 6, topY + 12, t.width - 12, 8);

      if (t.hasBeacon) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.fillRect(t.x + t.width * 0.5 - 2, topY - 18, 4, 18);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.fillRect(t.x + t.width * 0.5 - 3, topY - 22, 6, 4);
      }
      if (t.hasCrane) {
        ctx.fillStyle = '#0D1524';
        ctx.fillRect(t.x + 8, topY - 28, 6, 28);
        ctx.fillRect(t.x - 10, topY - 28, t.width * 0.85, 5);
      }
    }

    // Mid parallax structural trusses
    for (const g of this.midGirders) {
      const topY = this.height - g.height;
      ctx.fillStyle = '#131D31';
      ctx.fillRect(g.x, topY, g.width, g.height);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(g.x + 0.5, topY + 0.5, g.width - 1, g.height - 1);

      // Vertical conduit slit
      if (g.hasBeacon) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.fillRect(g.x + g.width * 0.5 - 2, topY + 24, 4, g.height - 40);
      }
    }
  }

  private renderPlatforms(ctx: CanvasRenderingContext2D): void {
    const tiles = this.sprites.deckTiles;

    for (const p of this.platforms) {
      if (p.kind === 'deck') {
        const deckTop = p.y;
        const deckH = 78;
        const supportTop = deckTop + deckH - 4;
        const supportH = Math.max(0, this.height - supportTop + 40);

        // Deep industrial substructure down into chasm
        ctx.fillStyle = '#111827';
        ctx.fillRect(p.x + 6, supportTop, p.width - 12, supportH);

        // Vertical structural ribs on substructure
        ctx.fillStyle = '#1B2538';
        for (let rx = p.x + 28; rx < p.x + p.width - 28; rx += 92) {
          ctx.fillRect(rx, supportTop, 12, supportH);
        }

        // Edge hazard trim on chasm drops
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(p.x, supportTop, 8, supportH);
        ctx.fillRect(p.x + p.width - 8, supportTop, 8, supportH);

        // Tile modular segments from platformcomplete_264ac81b.png
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x, deckTop, p.width, deckH);
        ctx.clip();

        if (tiles.length > 0) {
          let cursorX = p.x;
          let idx = p.tileSeed;
          while (cursorX < p.x + p.width) {
            const tile = tiles[idx % tiles.length];
            const drawW = Math.round((tile.width / tile.height) * deckH);
            ctx.drawImage(tile, cursorX, deckTop, drawW + 1, deckH);
            cursorX += drawW;
            idx++;
          }
        } else {
          ctx.fillStyle = '#334155';
          ctx.fillRect(p.x, deckTop, p.width, deckH);
        }
        ctx.restore();

        // Crisp top surface highlight & gap-edge bevel
        ctx.fillStyle = 'rgba(186, 230, 253, 0.32)';
        ctx.fillRect(p.x, deckTop, p.width, 2);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(p.x, deckTop, 5, 10);
        ctx.fillRect(p.x + p.width - 5, deckTop, 5, 10);
      } else {
        // Hovering platform using hovering-platform_7df7dccf.png
        const hb = this.sprites.hoverBounds;
        const scaleX = p.width / hb.width;
        const drawW = p.width;
        const drawH = hb.height * scaleX;
        // Align top rim of metallic hover plate cleanly to p.y
        const drawY = p.y - 4;

        ctx.drawImage(
          this.sprites.hoverPlatform,
          hb.minX,
          hb.minY,
          hb.width,
          hb.height,
          p.x,
          drawY,
          drawW,
          drawH
        );
      }
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;

    // Blink briefly during post-damage invulnerability
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 18) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    const anchor = this.sprites.heroAnchor;
    const visualBodyHeight = 92;
    const scale = visualBodyHeight / anchor.height;

    let sprite = this.sprites.heroIdle;
    if (p.shieldActiveTimer > 0) {
      sprite = this.sprites.heroShield;
    } else if (!p.grounded) {
      sprite = this.sprites.heroJump;
    }

    // Center X and align standing treads bottom (anchor.maxY) to (p.y + p.height)
    const idleBob = p.grounded ? Math.sin(p.bobPhase) * 1.4 : 0;
    const anchorCenterX = anchor.minX + anchor.width * 0.5;
    const destCenterX = p.x + p.width * 0.5 - p.recoilOffset;
    const destFootY = p.y + p.height + idleBob;

    const drawX = destCenterX - anchorCenterX * scale;
    const drawY = destFootY - anchor.maxY * scale;
    const drawW = sprite.width * scale;
    const drawH = sprite.height * scale;

    // Ground shadow when near a platform
    if (p.grounded) {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.beginPath();
      ctx.ellipse(p.x + p.width * 0.5, p.y + p.height + 2, 30, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(sprite, drawX, drawY, drawW, drawH);

    // Active energy shield aura ring
    if (p.shieldActiveTimer > 0) {
      ctx.save();
      const pulse = 0.22 + Math.sin(this.worldTime * 14) * 0.08;
      ctx.strokeStyle = `rgba(56, 189, 248, ${pulse + 0.35})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x + p.width * 0.65, p.y + p.height * 0.52, 46, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      ctx.restore();
    }

    // Muzzle flash
    if (p.muzzleFlashTimer > 0) {
      const mx = p.x + p.width + 22 - p.recoilOffset;
      const my = p.y + p.height * 0.57;
      ctx.save();
      const flashGrad = ctx.createRadialGradient(mx, my, 2, mx, my, 18);
      flashGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      flashGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.85)');
      flashGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(mx, my, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      ctx.save();
      const cx = e.x + e.width * 0.5;
      const cy = e.y + e.height * 0.5;
      const flash = e.hitFlashTimer > 0;

      if (e.kind === 'drone') {
        // Aerial Scout Drone
        ctx.fillStyle = flash ? '#F8FAFC' : '#334155';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(e.x + 4, e.y + 8, e.width - 8, e.height - 14, 10);
        ctx.fill();
        ctx.stroke();

        // Top rotor blades
        const rotorSpan = 16 + Math.sin(this.worldTime * 35) * 8;
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(cx - rotorSpan, e.y + 3, rotorSpan * 2, 3);

        // Glowing crimson cyclops optic
        ctx.fillStyle = flash ? '#FFFFFF' : '#EF4444';
        ctx.beginPath();
        ctx.arc(e.x + 14, cy + 2, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FCA5A5';
        ctx.beginPath();
        ctx.arc(e.x + 12, cy + 1, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'walker' || e.kind === 'heavy') {
        const isHeavy = e.kind === 'heavy';
        // Treads
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.roundRect(e.x + 2, e.y + e.height - 14, e.width - 4, 14, 6);
        ctx.fill();

        // Armored chassis
        ctx.fillStyle = flash ? '#FFFFFF' : isHeavy ? '#475569' : '#3B4A61';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(e.x + 6, e.y + 6, e.width - 12, e.height - 18, 6);
        ctx.fill();
        ctx.stroke();

        // Shoulder armor plates on heavy
        if (isHeavy) {
          ctx.fillStyle = flash ? '#FFFFFF' : '#F59E0B';
          ctx.fillRect(e.x + 8, e.y + 2, e.width - 16, 6);
        }

        // Cannon barrel pointing left
        ctx.fillStyle = '#64748B';
        ctx.fillRect(e.x - 10, e.y + e.height * 0.42, 18, isHeavy ? 10 : 7);

        // Crimson sensor visor
        ctx.fillStyle = isHeavy ? '#F97316' : '#EF4444';
        ctx.fillRect(e.x + 10, e.y + 16, isHeavy ? 16 : 12, 6);
      } else if (e.kind === 'interceptor') {
        // Dive mine with armed telegraph laser
        if (e.dashArmed && !e.dashing) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(e.x, cy);
          ctx.lineTo(0, cy);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.translate(cx, cy);
        ctx.rotate(this.worldTime * 3);
        ctx.fillStyle = flash ? '#FFFFFF' : '#334155';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI * 2 * i) / 8;
          const r = i % 2 === 0 ? e.width * 0.56 : e.width * 0.34;
          if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = e.dashing ? '#F97316' : '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Enemy HP mini-bar when damaged
      if (e.hp < e.maxHp) {
        const bw = e.width;
        const bx = e.x;
        const by = e.y - 10;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(bx, by, bw, 4);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 4);
      }

      ctx.restore();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D): void {
    for (const proj of this.projectiles) {
      ctx.save();
      if (proj.trail.length > 1) {
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = proj.fromPlayer ? 4 : 3;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
        for (let i = 1; i < proj.trail.length; i++) {
          ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
        }
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = proj.fromPlayer ? '#E0F2FE' : proj.color;
      ctx.beginPath();
      if (proj.fromPlayer) {
        ctx.roundRect(proj.x - 10, proj.y - 3.5, 20, 7, 3.5);
      } else {
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderPickups(ctx: CanvasRenderingContext2D): void {
    for (const pk of this.pickups) {
      ctx.save();
      ctx.translate(pk.x, pk.y);

      if (pk.kind === 'medkit') {
        // Emerald repair canister
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#065F46';
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-12, -12, 24, 24, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ECFDF5';
        ctx.fillRect(-2.5, -7, 5, 14);
        ctx.fillRect(-7, -2.5, 14, 5);
      } else if (pk.kind === 'shield') {
        // Cyan shield cell
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0C4A6E';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#E0F2FE';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Golden Data Core diamond
        ctx.rotate(Math.PI * 0.25);
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.fillRect(-9, -9, 18, 18);
        ctx.strokeRect(-9, -9, 18, 18);
      }

      ctx.restore();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    this.particleSystem.render(ctx);
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      const t = 1 - ft.life / ft.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#090E1A';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
