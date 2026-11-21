export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type EnemyKind = 'drone' | 'walker' | 'heavy' | 'interceptor';

export type PickupKind = 'medkit' | 'shield' | 'core';

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  grounded: boolean;
  jumpsRemaining: number;
  maxJumps: number;
  jumpHoldTimer: number;
  dropThroughTimer: number;
  fireCooldown: number;
  recoilOffset: number;
  muzzleFlashTimer: number;
  invulnTimer: number;
  shieldActiveTimer: number;
  shieldCooldownTimer: number;
  shieldMaxCooldown: number;
  shieldDuration: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  bobPhase: number;
}

export interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'deck' | 'hover';
  baseY: number;
  bobPhase: number;
  tileSeed: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  fireTimer: number;
  phase: number;
  platformId?: number;
  patrolMinX?: number;
  patrolMaxX?: number;
  scoreValue: number;
  dashArmed?: boolean;
  dashing?: boolean;
}

export interface Projectile {
  id: number;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  phase: number;
}

export type ParticleKind = 'orb' | 'spark' | 'debris' | 'smoke' | 'ring' | 'flash';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  endSize?: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
  drag?: number;
  rotation?: number;
  vRot?: number;
  additive?: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface HighScoreRecord {
  highScore: number;
  bestDistance: number;
  bestKills: number;
  bestCombo: number;
}

export interface HudSnapshot {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  distance: number;
  kills: number;
  combo: number;
  comboTimerRatio: number;
  hp: number;
  maxHp: number;
  shieldActive: boolean;
  shieldActiveRatio: number;
  shieldReady: boolean;
  shieldCooldownRatio: number;
  speedMultiplier: number;
  bestDistance: number;
  bestKills: number;
  bestCombo: number;
  deathReason: string;
}
