/**
 * Asset loader. Images are loaded once at boot; callers reuse the HTMLImageElement.
 * We use the Kenney 1-bit pack's *legacy* tilesheet (tileset_legacy.png, 32 cols × 32 rows)
 * because its tile gids match the sample TMX files in the pack, which lets us pull
 * known-good indices directly from those samples.
 */

export interface Tilesheet {
  img: HTMLImageElement;
  tile: number;
  margin: number;
  step: number;
  cols: number;
}

export interface Assets {
  indoor: Tilesheet;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadAssets(): Promise<Assets> {
  const indoorImg = await loadImage(
    "/assets/kenney_1-bit-pack/Tilemap/tileset_legacy.png",
  );
  const tile = 16;
  const margin = 1;
  const step = tile + margin;
  const cols = Math.floor((indoorImg.width + margin) / step);
  return {
    indoor: { img: indoorImg, tile, margin, step, cols },
  };
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  sheet: Tilesheet,
  index: number,
  dx: number,
  dy: number,
) {
  const col = index % sheet.cols;
  const row = Math.floor(index / sheet.cols);
  ctx.drawImage(sheet.img, col * sheet.step, row * sheet.step, sheet.tile, sheet.tile, dx, dy, sheet.tile, sheet.tile);
}

export function drawTileCoord(
  ctx: CanvasRenderingContext2D,
  sheet: Tilesheet,
  col: number,
  row: number,
  dx: number,
  dy: number,
) {
  ctx.drawImage(sheet.img, col * sheet.step, row * sheet.step, sheet.tile, sheet.tile, dx, dy, sheet.tile, sheet.tile);
}
