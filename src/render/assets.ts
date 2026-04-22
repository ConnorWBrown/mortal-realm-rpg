/**
 * Asset loader. Images are loaded once at boot; callers reuse the HTMLImageElement.
 * For the indoor tilesheet, tiles are 16x16 with 1px margin between them.
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
  panel: HTMLImageElement;
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
  const [indoorImg, panelImg] = await Promise.all([
    loadImage("/assets/roguelike-indoors/Tilesheets/roguelikeIndoor_transparent.png"),
    loadImage("/assets/fantasy-ui-borders/PNG/Default/Panel/panel-003.png"),
  ]);
  const tile = 16;
  const margin = 1;
  const step = tile + margin;
  const cols = Math.floor((indoorImg.width + margin) / step);
  return {
    indoor: { img: indoorImg, tile, margin, step, cols },
    panel: panelImg,
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

/**
 * Render a 9-slice panel. Assumes the source image is square and split
 * evenly into 3×3 regions: corners are preserved, edges stretch along
 * their axis, center fills the interior.
 */
export function draw9Slice(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sw = img.width;
  const sh = img.height;
  const s3w = Math.floor(sw / 3);
  const s3h = Math.floor(sh / 3);
  // Destination corner size — keep at source corner size for crisp borders.
  const c = s3w; // assume square corners

  // Corners
  ctx.drawImage(img, 0, 0, s3w, s3h, dx, dy, c, c);
  ctx.drawImage(img, sw - s3w, 0, s3w, s3h, dx + dw - c, dy, c, c);
  ctx.drawImage(img, 0, sh - s3h, s3w, s3h, dx, dy + dh - c, c, c);
  ctx.drawImage(img, sw - s3w, sh - s3h, s3w, s3h, dx + dw - c, dy + dh - c, c, c);
  // Edges
  if (dw > 2 * c) {
    ctx.drawImage(img, s3w, 0, sw - 2 * s3w, s3h, dx + c, dy, dw - 2 * c, c);
    ctx.drawImage(img, s3w, sh - s3h, sw - 2 * s3w, s3h, dx + c, dy + dh - c, dw - 2 * c, c);
  }
  if (dh > 2 * c) {
    ctx.drawImage(img, 0, s3h, s3w, sh - 2 * s3h, dx, dy + c, c, dh - 2 * c);
    ctx.drawImage(img, sw - s3w, s3h, s3w, sh - 2 * s3h, dx + dw - c, dy + c, c, dh - 2 * c);
  }
  // Center
  if (dw > 2 * c && dh > 2 * c) {
    ctx.drawImage(img, s3w, s3h, sw - 2 * s3w, sh - 2 * s3h, dx + c, dy + c, dw - 2 * c, dh - 2 * c);
  }
}
