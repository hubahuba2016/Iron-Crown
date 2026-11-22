import type { EnemyKind } from './types';

export interface SpriteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface EnemySpriteAsset {
  canvas: HTMLCanvasElement;
  flashCanvas: HTMLCanvasElement;
  bounds: SpriteBounds;
}

export interface GameSprites {
  heroIdle: HTMLCanvasElement;
  heroJump: HTMLCanvasElement;
  heroShield: HTMLCanvasElement;
  hoverPlatform: HTMLCanvasElement;
  deckTiles: HTMLCanvasElement[];
  heroAnchor: SpriteBounds;
  hoverBounds: SpriteBounds;
  enemies: Partial<Record<EnemyKind, EnemySpriteAsset>>;
  ready: boolean;
}

const ASSET_PATHS = {
  heroIdle: './assets/aistudio/hero_78bebaf3.png',
  heroJump: './assets/aistudio/HeroJump_0dc99a97.png',
  heroShield: './assets/aistudio/heroShieldOn_aeaae261.png',
  hoverPlatform: './assets/aistudio/hovering-platform_7df7dccf.png',
  platformComplete: './assets/aistudio/platformcomplete_264ac81b.png',
} as const;

const ENEMY_ASSET_PATHS: Record<EnemyKind, string> = {
  drone: './src/assets/images/enemy_scout_drone_1795311768821.jpg',
  walker: './src/assets/images/enemy_deck_walker_1795311766859.jpg',
  heavy: './src/assets/images/enemy_heavy_mech_1795311768490.jpg',
  interceptor: './src/assets/images/enemy_gap_interceptor_1795311768186.jpg',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

function toCleanCanvas(img: HTMLImageElement, removeInteriorWhite = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const isNeutralBright = (idx: number, minLum: number, maxChroma: number) => {
    if (data[idx + 3] === 0) return true;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return minC >= minLum && maxC - minC <= maxChroma;
  };

  const cornerOpaqueWhite =
    (data[3] > 200 && isNeutralBright(0, 232, 24)) ||
    (data[(width - 1) * 4 + 3] > 200 && isNeutralBright((width - 1) * 4, 232, 24));

  if (cornerOpaqueWhite) {
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    const tryPush = (px: number, py: number) => {
      if (px < 0 || py < 0 || px >= width || py >= height) return;
      const pos = py * width + px;
      if (visited[pos]) return;
      const idx = pos * 4;
      if (isNeutralBright(idx, 230, 26)) {
        visited[pos] = 1;
        queue[tail++] = pos;
      }
    };

    for (let x = 0; x < width; x++) {
      tryPush(x, 0);
      tryPush(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      tryPush(0, y);
      tryPush(width - 1, y);
    }

    while (head < tail) {
      const pos = queue[head++];
      data[pos * 4 + 3] = 0;
      const px = pos % width;
      const py = (pos - px) / width;
      tryPush(px + 1, py);
      tryPush(px - 1, py);
      tryPush(px, py + 1);
      tryPush(px, py - 1);
    }

    // Remove large enclosed white cutouts (e.g. hollow ring center on interceptor)
    if (removeInteriorWhite) {
      const seen = new Uint8Array(width * height);
      const comp = new Int32Array(width * height);
      for (let start = 0; start < width * height; start++) {
        if (visited[start] || seen[start]) continue;
        const sIdx = start * 4;
        if (data[sIdx + 3] === 0 || !isNeutralBright(sIdx, 242, 16)) continue;

        let cHead = 0;
        let cTail = 0;
        seen[start] = 1;
        comp[cTail++] = start;

        while (cHead < cTail) {
          const pos = comp[cHead++];
          const px = pos % width;
          const py = (pos - px) / width;
          const neighbors = [
            px + 1 < width ? pos + 1 : -1,
            px - 1 >= 0 ? pos - 1 : -1,
            py + 1 < height ? pos + width : -1,
            py - 1 >= 0 ? pos - width : -1,
          ];
          for (const nPos of neighbors) {
            if (nPos < 0 || visited[nPos] || seen[nPos]) continue;
            const nIdx = nPos * 4;
            if (data[nIdx + 3] > 0 && isNeutralBright(nIdx, 242, 16)) {
              seen[nPos] = 1;
              comp[cTail++] = nPos;
            }
          }
        }

        if (cTail >= 120) {
          for (let i = 0; i < cTail; i++) {
            data[comp[i] * 4 + 3] = 0;
          }
        }
      }
    }

    // Soften and despill 1px bright anti-aliased fringe bordering transparent pixels
    const alphaCopy = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      alphaCopy[i] = data[i * 4 + 3];
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const pos = y * width + x;
        if (alphaCopy[pos] === 0) continue;
        const hasTransparentNeighbor =
          alphaCopy[pos - 1] === 0 ||
          alphaCopy[pos + 1] === 0 ||
          alphaCopy[pos - width] === 0 ||
          alphaCopy[pos + width] === 0;

        if (!hasTransparentNeighbor) continue;
        const idx = pos * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const minC = Math.min(r, g, b);
        const maxC = Math.max(r, g, b);
        if (minC > 185 && maxC - minC < 32) {
          const avg = (r + g + b) / 3;
          const factor = Math.max(0.1, Math.min(1, (245 - avg) / 60));
          data[idx + 3] = Math.round(data[idx + 3] * factor);
          data[idx] = Math.round(r * 0.72);
          data[idx + 1] = Math.round(g * 0.72);
          data[idx + 2] = Math.round(b * 0.72);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

function makeFlashMask(source: HTMLCanvasElement): HTMLCanvasElement {
  const mask = document.createElement('canvas');
  mask.width = source.width;
  mask.height = source.height;
  const ctx = mask.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, mask.width, mask.height);
  return mask;
}

function measureOpaqueBounds(canvas: HTMLCanvasElement, alphaThreshold = 20): SpriteBounds {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, width, height };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function slicePlatformTiles(sheet: HTMLCanvasElement): HTMLCanvasElement[] {
  const bounds = measureOpaqueBounds(sheet, 15);
  const totalW = bounds.width;
  const tileH = bounds.height;
  const segmentCount = 4;
  const rawSliceW = totalW / segmentCount;
  const tiles: HTMLCanvasElement[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const sx = Math.round(bounds.minX + i * rawSliceW) + 2;
    const ex = Math.round(bounds.minX + (i + 1) * rawSliceW) - 2;
    const sw = Math.max(16, ex - sx);
    const tile = document.createElement('canvas');
    tile.width = sw;
    tile.height = tileH;
    const tctx = tile.getContext('2d')!;
    tctx.drawImage(sheet, sx, bounds.minY, sw, tileH, 0, 0, sw, tileH);
    tiles.push(tile);
  }

  return tiles;
}

async function loadEnemySprite(kind: EnemyKind): Promise<EnemySpriteAsset | null> {
  try {
    const img = await loadImage(ENEMY_ASSET_PATHS[kind]);
    const canvas = toCleanCanvas(img, kind === 'interceptor');
    const flashCanvas = makeFlashMask(canvas);
    const bounds = measureOpaqueBounds(canvas, 28);
    return { canvas, flashCanvas, bounds };
  } catch {
    return null;
  }
}

export async function loadGameSprites(): Promise<GameSprites> {
  const [idleImg, jumpImg, shieldImg, hoverImg, deckImg, drone, walker, heavy, interceptor] =
    await Promise.all([
      loadImage(ASSET_PATHS.heroIdle),
      loadImage(ASSET_PATHS.heroJump),
      loadImage(ASSET_PATHS.heroShield),
      loadImage(ASSET_PATHS.hoverPlatform),
      loadImage(ASSET_PATHS.platformComplete),
      loadEnemySprite('drone'),
      loadEnemySprite('walker'),
      loadEnemySprite('heavy'),
      loadEnemySprite('interceptor'),
    ]);

  const heroIdle = toCleanCanvas(idleImg);
  const heroJump = toCleanCanvas(jumpImg);
  const heroShield = toCleanCanvas(shieldImg);
  const hoverPlatform = toCleanCanvas(hoverImg);
  const deckSheet = toCleanCanvas(deckImg);

  const heroAnchor = measureOpaqueBounds(heroIdle, 24);
  const hoverBounds = measureOpaqueBounds(hoverPlatform, 24);
  const deckTiles = slicePlatformTiles(deckSheet);

  const enemies: Partial<Record<EnemyKind, EnemySpriteAsset>> = {};
  if (drone) enemies.drone = drone;
  if (walker) enemies.walker = walker;
  if (heavy) enemies.heavy = heavy;
  if (interceptor) enemies.interceptor = interceptor;

  return {
    heroIdle,
    heroJump,
    heroShield,
    hoverPlatform,
    deckTiles,
    heroAnchor,
    hoverBounds,
    enemies,
    ready: true,
  };
}
