export interface SpriteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface GameSprites {
  heroIdle: HTMLCanvasElement;
  heroJump: HTMLCanvasElement;
  heroShield: HTMLCanvasElement;
  hoverPlatform: HTMLCanvasElement;
  deckTiles: HTMLCanvasElement[];
  heroAnchor: SpriteBounds;
  hoverBounds: SpriteBounds;
  ready: boolean;
}

const ASSET_PATHS = {
  heroIdle: './assets/aistudio/hero_78bebaf3.png',
  heroJump: './assets/aistudio/HeroJump_0dc99a97.png',
  heroShield: './assets/aistudio/heroShieldOn_aeaae261.png',
  hoverPlatform: './assets/aistudio/hovering-platform_7df7dccf.png',
  platformComplete: './assets/aistudio/platformcomplete_264ac81b.png',
} as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

function toCleanCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  // Check corner pixel; if opaque near-white matte exists, key out connected white exterior
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const isNearWhite = (idx: number) =>
    data[idx + 3] > 200 && data[idx] > 244 && data[idx + 1] > 244 && data[idx + 2] > 244;

  if (isNearWhite(0) || isNearWhite((width - 1) * 4)) {
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    const tryPush = (px: number, py: number) => {
      if (px < 0 || py < 0 || px >= width || py >= height) return;
      const pos = py * width + px;
      if (visited[pos]) return;
      const idx = pos * 4;
      if (data[idx + 3] === 0 || (data[idx] > 236 && data[idx + 1] > 236 && data[idx + 2] > 236)) {
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
      const idx = pos * 4;
      data[idx + 3] = 0;
      const px = pos % width;
      const py = (pos - px) / width;
      tryPush(px + 1, py);
      tryPush(px - 1, py);
      tryPush(px, py + 1);
      tryPush(px, py - 1);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
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
  // platformcomplete_264ac81b.png (282x80) contains 4 distinct sci-fi deck segments side-by-side.
  // Detect vertical seam splits or use even 4-way split, trimming 1px divider artifacts cleanly.
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

export async function loadGameSprites(): Promise<GameSprites> {
  const [idleImg, jumpImg, shieldImg, hoverImg, deckImg] = await Promise.all([
    loadImage(ASSET_PATHS.heroIdle),
    loadImage(ASSET_PATHS.heroJump),
    loadImage(ASSET_PATHS.heroShield),
    loadImage(ASSET_PATHS.hoverPlatform),
    loadImage(ASSET_PATHS.platformComplete),
  ]);

  const heroIdle = toCleanCanvas(idleImg);
  const heroJump = toCleanCanvas(jumpImg);
  const heroShield = toCleanCanvas(shieldImg);
  const hoverPlatform = toCleanCanvas(hoverImg);
  const deckSheet = toCleanCanvas(deckImg);

  const heroAnchor = measureOpaqueBounds(heroIdle, 24);
  const hoverBounds = measureOpaqueBounds(hoverPlatform, 24);
  const deckTiles = slicePlatformTiles(deckSheet);

  return {
    heroIdle,
    heroJump,
    heroShield,
    hoverPlatform,
    deckTiles,
    heroAnchor,
    hoverBounds,
    ready: true,
  };
}
