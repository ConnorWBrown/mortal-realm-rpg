import type { View } from "./canvas";
import type { Room, TileKind, WorldBounds } from "../world/room";
import type { Player } from "../world/player";
import { drawTileCoord, type Assets } from "./assets";
import { getBox } from "../world/box";

export const TILE_SIZE = 16;
export const BG_COLOR = "#3e2731";

// Kenney 1-bit pack tile coords (col, row). Legacy sheet is 32 cols.
// Hand-picked from tile-picker.html visual inspection:
//   wall  → col 0,  row 13  (brick pattern)
//   door  → col 20, row 12
//   grass → col 5,  row 0   (grass tufts on ground)
const WALL_CR = { col: 0, row: 13 };
const DOOR_CR = { col: 20, row: 12 };
const GRASS_CR = { col: 5, row: 0 };

const PLAYER_BODY = "#e8d8b0";
const PLAYER_SHADE = "#a89060";

export interface Camera {
  x: number;
  y: number;
}

export function computeCamera(bounds: WorldBounds, player: Player, view: View): Camera {
  const px = lerpPx(player.moveFrom.x, player.x, player.moveProgress);
  const py = lerpPx(player.moveFrom.y, player.y, player.moveProgress);
  const halfW = view.width / 2 / TILE_SIZE;
  const halfH = view.height / 2 / TILE_SIZE;
  const maxCamX = bounds.maxX - view.width / TILE_SIZE;
  const maxCamY = bounds.maxY - view.height / TILE_SIZE;
  const camX = clamp(px + 0.5 - halfW, bounds.minX, Math.max(bounds.minX, maxCamX));
  const camY = clamp(py + 0.5 - halfH, bounds.minY, Math.max(bounds.minY, maxCamY));
  return { x: camX * TILE_SIZE, y: camY * TILE_SIZE };
}

/** Rooms are drawn independently at their `worldOrigin` — the gap between them is
 * simply never painted, so two adjacent rooms read as disconnected blocks. */
export function renderRoom(view: View, rooms: Room[], cam: Camera, assets: Assets | null) {
  const { ctx } = view;
  for (const room of rooms) {
    const { x: ox, y: oy } = room.worldOrigin;
    const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE - ox));
    const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE - oy));
    const endX = Math.min(room.width, Math.ceil((cam.x + view.width) / TILE_SIZE - ox));
    const endY = Math.min(room.height, Math.ceil((cam.y + view.height) / TILE_SIZE - oy));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const kind = room.tiles[y][x];
        const sx = (x + ox) * TILE_SIZE - cam.x;
        const sy = (y + oy) * TILE_SIZE - cam.y;
        drawTileKind(ctx, kind, sx, sy, assets);
      }
    }
  }
}

function drawTileKind(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  x: number,
  y: number,
  assets: Assets | null,
) {
  if (kind === "floor" || kind === "void") {
    // Floor and void are both just the background colour — no sprite. Void
    // differs only in that it's unwalkable (see isWalkable).
    return;
  }
  if (!assets) {
    // Fallback before assets load: solid block so walls/doors/grass are visible.
    ctx.fillStyle = kind === "wall" ? "#6b4a3a" : kind === "grass" ? "#3a6b3a" : "#8a5a2a";
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    return;
  }
  if (kind === "wall") {
    drawTileCoord(ctx, assets.indoor, WALL_CR.col, WALL_CR.row, x, y);
  } else if (kind === "door") {
    drawTileCoord(ctx, assets.indoor, DOOR_CR.col, DOOR_CR.row, x, y);
  } else if (kind === "grass") {
    drawTileCoord(ctx, assets.indoor, GRASS_CR.col, GRASS_CR.row, x, y);
  }
}

export function renderBoxes(view: View, rooms: Room[], cam: Camera, assets: Assets | null) {
  const { ctx } = view;
  for (const room of rooms) {
    const { x: ox, y: oy } = room.worldOrigin;
    for (const p of room.boxes) {
      const box = getBox(p.boxId);
      // Multi-block footprints don't have bespoke art yet, so tile the single
      // sprite/fallback across every cell — same approach as wall tiling.
      for (let dy = 0; dy < p.depthBlocks; dy++) {
        for (let dx = 0; dx < p.widthBlocks; dx++) {
          const sx = (p.x + dx + ox) * TILE_SIZE - cam.x;
          const sy = (p.y + dy + oy) * TILE_SIZE - cam.y;
          if (sx + TILE_SIZE < 0 || sy + TILE_SIZE < 0 || sx > view.width || sy > view.height) continue;
          if (assets && box.sprite) {
            drawTileCoord(ctx, assets.indoor, box.sprite.col, box.sprite.row, sx, sy);
          } else {
            ctx.fillStyle = "#8a5a2a";
            ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
        }
      }
    }
  }
}

export function renderPlayer(view: View, player: Player, cam: Camera) {
  const { ctx } = view;
  const px = lerpPx(player.moveFrom.x, player.x, player.moveProgress) * TILE_SIZE - cam.x;
  const py = lerpPx(player.moveFrom.y, player.y, player.moveProgress) * TILE_SIZE - cam.y;
  ctx.fillStyle = PLAYER_SHADE;
  ctx.fillRect(px + 3, py + 4, 10, 11);
  ctx.fillStyle = PLAYER_BODY;
  ctx.fillRect(px + 4, py + 3, 8, 10);
  ctx.fillStyle = "#1a1420";
  if (player.facing === "down") {
    ctx.fillRect(px + 6, py + 7, 1, 2);
    ctx.fillRect(px + 9, py + 7, 1, 2);
  } else if (player.facing === "up") {
    ctx.fillRect(px + 6, py + 5, 1, 1);
    ctx.fillRect(px + 9, py + 5, 1, 1);
  } else if (player.facing === "left") {
    ctx.fillRect(px + 5, py + 7, 2, 2);
  } else {
    ctx.fillRect(px + 9, py + 7, 2, 2);
  }
}

function lerpPx(a: number, b: number, t: number): number {
  return a + (b - a) * easeOutQuad(t);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
