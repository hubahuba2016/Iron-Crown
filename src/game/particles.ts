import type { EnemyKind, Particle } from './types';

const MAX_PARTICLES = 450;

export class ParticleSystem {
  private particles: Particle[] = [];

  public clear(): void {
    this.particles = [];
  }

  public add(particle: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(particle);
  }

  public emitAmbientMote(width: number, height: number): void {
    this.add({
      kind: 'orb',
      x: width + 10,
      y: Math.random() * height * 0.85,
      vx: -60 - Math.random() * 80,
      vy: (Math.random() - 0.5) * 18,
      size: 1.5 + Math.random() * 1.8,
      alpha: 0.35 + Math.random() * 0.3,
      life: 0,
      maxLife: 4.5,
      color: '#94A3B8',
      gravity: 0,
    });
  }

  public spawnHoverExhaust(x: number, y: number, scrollSpeed: number): void {
    this.add({
      kind: 'orb',
      x: x + (Math.random() - 0.5) * 18,
      y,
      vx: (Math.random() - 0.5) * 24 - scrollSpeed * 0.25,
      vy: 85 + Math.random() * 65,
      size: 2.5 + Math.random() * 2.5,
      alpha: 0.75,
      life: 0,
      maxLife: 0.3 + Math.random() * 0.15,
      color: '#38BDF8',
      gravity: 0,
      additive: true,
    });
  }

  public spawnThrusterTrail(x: number, y: number, scrollSpeed: number): void {
    this.add({
      kind: 'orb',
      x: x + (Math.random() - 0.5) * 20,
      y,
      vx: -scrollSpeed * 0.35 + (Math.random() - 0.5) * 40,
      vy: 140 + Math.random() * 120,
      size: 3 + Math.random() * 3.5,
      alpha: 0.9,
      life: 0,
      maxLife: 0.24 + Math.random() * 0.12,
      color: Math.random() < 0.6 ? '#F59E0B' : '#FDE047',
      gravity: 0,
      additive: true,
    });
  }

  public spawnMuzzleSparks(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      this.add({
        kind: 'spark',
        x,
        y,
        vx: 190 + Math.random() * 170,
        vy: (Math.random() - 0.5) * 130,
        size: 2.2 + Math.random() * 1.8,
        alpha: 0.95,
        life: 0,
        maxLife: 0.14,
        color: i % 2 === 0 ? '#7DD3FC' : '#FDE047',
        gravity: 0,
        additive: true,
      });
    }
  }

  public spawnJetFlameBurst(x: number, y: number, count: number, scrollSpeed: number): void {
    for (let i = 0; i < count; i++) {
      this.add({
        kind: 'orb',
        x: x + (Math.random() - 0.5) * 26,
        y: y + 2,
        vx: (Math.random() - 0.5) * 150 - scrollSpeed * 0.25,
        vy: 110 + Math.random() * 190,
        size: 3 + Math.random() * 4.5,
        alpha: 0.95,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.16,
        color: i % 3 === 0 ? '#7DD3FC' : i % 2 === 0 ? '#F59E0B' : '#FEF08A',
        gravity: 160,
        additive: true,
      });
    }
  }

  public spawnBurst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.4 + Math.random() * 0.75);
      this.add({
        kind: i % 2 === 0 ? 'spark' : 'orb',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.5 + Math.random() * 3.2,
        alpha: 1,
        life: 0,
        maxLife: 0.26 + Math.random() * 0.22,
        color,
        gravity: 220,
        drag: 0.96,
        additive: true,
      });
    }
  }

  /**
   * Multi-layered explosion when an enemy is defeated:
   * core flash + expanding shockwave ring + fireball orbs + directional sparks + tumbling hull debris + smoke puffs.
   */
  public spawnEnemyExplosion(
    x: number,
    y: number,
    enemyKind: EnemyKind,
    fromShield: boolean
  ): void {
    const isHeavy = enemyKind === 'heavy';
    const scale = isHeavy ? 1.5 : enemyKind === 'walker' ? 1.1 : 1.0;

    // 1. Bright core flash
    this.add({
      kind: 'flash',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 14 * scale,
      endSize: 54 * scale,
      alpha: 0.95,
      life: 0,
      maxLife: 0.16,
      color: fromShield ? '#E0F2FE' : '#FEF08A',
      gravity: 0,
      additive: true,
    });

    // 2. Shockwave ring(s)
    this.add({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 10 * scale,
      endSize: 68 * scale,
      alpha: 0.9,
      life: 0,
      maxLife: 0.34,
      color: fromShield ? '#38BDF8' : '#F59E0B',
      gravity: 0,
      additive: true,
    });

    if (isHeavy) {
      this.add({
        kind: 'ring',
        x,
        y,
        vx: 0,
        vy: 0,
        size: 6,
        endSize: 98,
        alpha: 0.75,
        life: 0,
        maxLife: 0.45,
        color: '#FB923C',
        gravity: 0,
        additive: true,
      });
    }

    // 3. Fireball / plasma orbs
    const fireCount = Math.round(14 * scale);
    const firePalette = fromShield
      ? ['#38BDF8', '#7DD3FC', '#FBBF24']
      : ['#FDE047', '#F59E0B', '#F97316', '#EF4444'];
    for (let i = 0; i < fireCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (55 + Math.random() * 190) * scale;
      this.add({
        kind: 'orb',
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        size: (4 + Math.random() * 6) * scale,
        endSize: 1.5,
        alpha: 0.95,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.26,
        color: firePalette[i % firePalette.length],
        gravity: 90,
        drag: 0.92,
        additive: true,
      });
    }

    // 4. High-speed directional sparks
    const sparkCount = Math.round(16 * scale);
    for (let i = 0; i < sparkCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (180 + Math.random() * 280) * scale;
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        size: 2.2 + Math.random() * 2.2,
        alpha: 1,
        life: 0,
        maxLife: 0.24 + Math.random() * 0.22,
        color: fromShield && i % 2 === 0 ? '#7DD3FC' : '#FDE047',
        gravity: 340,
        drag: 0.96,
        additive: true,
      });
    }

    // 5. Tumbling metal hull debris shards
    const debrisCount = Math.round(8 * scale);
    const debrisPalette = ['#475569', '#64748B', '#334155', '#94A3B8'];
    for (let i = 0; i < debrisCount; i++) {
      const ang = -Math.PI * 0.1 - Math.random() * Math.PI * 0.8 + (Math.random() - 0.5) * 0.8;
      const spd = (110 + Math.random() * 210) * scale;
      this.add({
        kind: 'debris',
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 90,
        size: 4 + Math.random() * 5,
        alpha: 1,
        life: 0,
        maxLife: 0.52 + Math.random() * 0.35,
        color: debrisPalette[i % debrisPalette.length],
        gravity: 680,
        drag: 0.985,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 18,
      });
    }

    // 6. Expanding smoke puffs
    const smokeCount = Math.round(7 * scale);
    for (let i = 0; i < smokeCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 75;
      this.add({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 18,
        vx: Math.cos(ang) * spd - 35,
        vy: Math.sin(ang) * spd - 55,
        size: (8 + Math.random() * 9) * scale,
        endSize: (22 + Math.random() * 14) * scale,
        alpha: 0.5,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35,
        color: '#1E293B',
        gravity: -30,
        drag: 0.94,
      });
    }
  }

  /**
   * Multi-layered damage explosion when the player takes hull/chasm damage.
   */
  public spawnPlayerDamageExplosion(x: number, y: number, isFatal: boolean): void {
    const scale = isFatal ? 1.65 : 1.05;

    // 1. Crimson/amber impact flash
    this.add({
      kind: 'flash',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 16 * scale,
      endSize: 58 * scale,
      alpha: 0.9,
      life: 0,
      maxLife: 0.18,
      color: isFatal ? '#FEF08A' : '#FCA5A5',
      gravity: 0,
      additive: true,
    });

    // 2. Crimson shockwave ring
    this.add({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 12 * scale,
      endSize: 76 * scale,
      alpha: 0.9,
      life: 0,
      maxLife: 0.34,
      color: '#EF4444',
      gravity: 0,
      additive: true,
    });

    // 3. Hot sparks & damage embers
    const sparkCount = isFatal ? 26 : 16;
    const palette = ['#EF4444', '#F97316', '#FBBF24', '#FCA5A5'];
    for (let i = 0; i < sparkCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (150 + Math.random() * 260) * scale;
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        size: 2.5 + Math.random() * 2.5,
        alpha: 1,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.22,
        color: palette[i % palette.length],
        gravity: 320,
        drag: 0.95,
        additive: true,
      });
    }

    // 4. Armor plate shards
    const shardCount = isFatal ? 14 : 7;
    const shardPalette = ['#38BDF8', '#475569', '#94A3B8', '#EF4444'];
    for (let i = 0; i < shardCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (110 + Math.random() * 210) * scale;
      this.add({
        kind: 'debris',
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 18,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 110,
        size: 4 + Math.random() * 4.5,
        alpha: 1,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
        color: shardPalette[i % shardPalette.length],
        gravity: 660,
        drag: 0.985,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 18,
      });
    }

    // 5. Charred smoke puffs
    const smokeCount = isFatal ? 12 : 6;
    for (let i = 0; i < smokeCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 80;
      this.add({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(ang) * spd - 30,
        vy: Math.sin(ang) * spd - 60,
        size: 9 * scale,
        endSize: 26 * scale,
        alpha: 0.55,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.35,
        color: '#1E293B',
        gravity: -25,
        drag: 0.93,
      });
    }
  }

  public update(dt: number, scrollDx: number): void {
    const next: Particle[] = [];
    const dragStep = dt * 60;

    for (const pt of this.particles) {
      pt.life += dt;
      if (pt.life >= pt.maxLife) continue;

      if (pt.drag && pt.drag < 1) {
        const factor = Math.pow(pt.drag, dragStep);
        pt.vx *= factor;
        pt.vy *= factor;
      }

      pt.vy += pt.gravity * dt;
      pt.x += pt.vx * dt - (pt.kind === 'smoke' || pt.kind === 'debris' ? scrollDx * 0.45 : 0);
      pt.y += pt.vy * dt;

      if (pt.rotation !== undefined && pt.vRot !== undefined) {
        pt.rotation += pt.vRot * dt;
      }

      next.push(pt);
    }

    this.particles = next;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.particles) {
      const progress = pt.life / pt.maxLife;
      const remaining = 1 - progress;

      ctx.save();
      if (pt.additive) {
        ctx.globalCompositeOperation = 'lighter';
      }

      if (pt.kind === 'ring') {
        const end = pt.endSize ?? pt.size * 3;
        const eased = 1 - Math.pow(remaining, 2);
        const radius = pt.size + (end - pt.size) * eased;
        ctx.globalAlpha = pt.alpha * remaining;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(1, 4.5 * remaining);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.kind === 'flash') {
        const end = pt.endSize ?? pt.size * 2.5;
        const radius = pt.size + (end - pt.size) * progress;
        ctx.globalAlpha = pt.alpha * remaining * remaining;
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.45, pt.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'spark') {
        ctx.globalAlpha = pt.alpha * remaining;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = pt.size;
        ctx.lineCap = 'round';
        const tailScale = 0.032;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * tailScale, pt.y - pt.vy * tailScale);
        ctx.stroke();
      } else if (pt.kind === 'debris') {
        ctx.globalAlpha = pt.alpha * Math.min(1, remaining * 1.6);
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation ?? 0);
        ctx.fillStyle = pt.color;
        const half = pt.size * 0.5;
        ctx.fillRect(-half, -half * 0.65, pt.size, pt.size * 0.65);
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-half, -half * 0.65, pt.size, pt.size * 0.65);
      } else if (pt.kind === 'smoke') {
        const end = pt.endSize ?? pt.size * 2.2;
        const radius = pt.size + (end - pt.size) * progress;
        ctx.globalAlpha = pt.alpha * remaining;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const end = pt.endSize ?? pt.size * 0.35;
        const radius = pt.size + (end - pt.size) * progress;
        ctx.globalAlpha = pt.alpha * remaining;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
