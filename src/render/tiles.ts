import type { View } from "./canvas";
import type { Room, TileKind } from "../world/room";
import type { Player } from "../world/player";
import { drawTileCoord, type Assets } from "./assets";
import { getBox } from "../world/box";

export const TILE_SIZE = 16;

const FLOOR_BASE = "#3b2a22";
const FLOOR_LIGHT = "#4a3a2a";
const FLOOR_SPECKLE = "#2a1d15";
const WALL_BASE = "#6b4a3a";
const WALL_TOP = "#8a6a4a";
const WALL_SHADOW = "#3a2820";
const WALL_GROUT = "#2a1d15";
const DOOR_FRAME = "#4a2a10";
const DOOR_WOOD = "#8a5a2a";
const DOOR_KNOB = "#efc040";
const PLAYER_BODY = "#e8d8b0";
const PLAYER_SHADE = "#a89060";

export interface Camera {
  x: number;
  y: number;
}

export function computeCamera(room: Room, player: Player, view: View): Camera {
  const px = lerpPx(player.moveFrom.x, player.x, player.moveProgress);
  const py = lerpPx(player.moveFrom.y, player.y, player.moveProgress);
  const halfW = view.width / 2 / TILE_SIZE;
  const halfH = view.height / 2 / TILE_SIZE;
  const maxCamX = room.width - view.width / TILE_SIZE;
  const maxCamY = room.height - view.height / TILE_SIZE;
  const camX = clamp(px + 0.5 - halfW, 0, Math.max(0, maxCamX));
  const camY = clamp(py + 0.5 - halfH, 0, Math.max(0, maxCamY));
  return { x: camX * TILE_SIZE, y: camY * TILE_SIZE };
}

export function renderRoom(view: View, room: Room, cam: Camera) {
  const { ctx } = view;
  const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE));
  const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE));
  const endX = Math.min(room.width, Math.ceil((cam.x + view.width) / TILE_SIZE));
  const endY = Math.min(room.height, Math.ceil((cam.y + view.height) / TILE_SIZE));

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const kind = room.tiles[y][x];
      const screenX = x * TILE_SIZE - cam.x;
      const screenY = y * TILE_SIZE - cam.y;
      drawTileKind(ctx, kind, screenX, screenY, x, y);
    }
  }
}

function drawTileKind(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  x: number,
  y: number,
  gx: number,
  gy: number,
) {
  if (kind === "floor") {
    drawFloor(ctx, x, y, gx, gy);
  } else if (kind === "wall") {
    drawWall(ctx, x, y, gx, gy);
  } else if (kind === "door") {
    drawFloor(ctx, x, y, gx, gy);
    drawDoor(ctx, x, y);
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, gx: number, gy: number) {
  ctx.fillStyle = FLOOR_BASE;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Subtle plank divisions every 4px horizontally.
  ctx.fillStyle = FLOOR_LIGHT;
  ctx.fillRect(x, y + 3, TILE_SIZE, 1);
  ctx.fillRect(x, y + 11, TILE_SIZE, 1);
  // Deterministic speckles per tile.
  const seed = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
  const pos = [seed & 15, (seed >> 4) & 15, (seed >> 8) & 15, (seed >> 12) & 15];
  ctx.fillStyle = FLOOR_SPECKLE;
  ctx.fillRect(x + pos[0], y + (pos[1] % 14) + 1, 1, 1);
  ctx.fillRect(x + pos[2], y + (pos[3] % 14) + 1, 1, 1);
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, gx: number, gy: number) {
  ctx.fillStyle = WALL_BASE;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Brick pattern: offset every other row.
  const rowOffset = (gy % 2) * 8;
  ctx.fillStyle = WALL_GROUT;
  // Horizontal grout lines
  ctx.fillRect(x, y + 4, TILE_SIZE, 1);
  ctx.fillRect(x, y + 11, TILE_SIZE, 1);
  // Vertical grout every 8px with staggered offset
  for (let gx2 = -8 + rowOffset; gx2 < TILE_SIZE; gx2 += 8) {
    if (gx2 >= 0 && gx2 < TILE_SIZE) ctx.fillRect(x + gx2, y, 1, 4);
    if (gx2 >= 0 && gx2 < TILE_SIZE) ctx.fillRect(x + gx2, y + 5, 1, 6);
    if (gx2 >= 0 && gx2 < TILE_SIZE) ctx.fillRect(x + gx2, y + 12, 1, 4);
  }
  // Top highlight
  ctx.fillStyle = WALL_TOP;
  ctx.fillRect(x, y, TILE_SIZE, 1);
  // Bottom shadow
  ctx.fillStyle = WALL_SHADOW;
  ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
  // Suppress unused param warning
  void gx;
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = DOOR_FRAME;
  ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 2);
  ctx.fillStyle = DOOR_WOOD;
  ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 4);
  ctx.fillStyle = DOOR_FRAME;
  ctx.fillRect(x + 7, y + 3, 1, TILE_SIZE - 4);
  ctx.fillStyle = DOOR_KNOB;
  ctx.fillRect(x + 10, y + 8, 2, 2);
}

export function renderBoxes(view: View, room: Room, cam: Camera, assets: Assets | null) {
  const { ctx } = view;
  for (const p of room.boxes) {
    const screenX = p.x * TILE_SIZE - cam.x;
    const screenY = p.y * TILE_SIZE - cam.y;
    if (
      screenX + TILE_SIZE < 0 ||
      screenY + TILE_SIZE < 0 ||
      screenX > view.width ||
      screenY > view.height
    ) continue;
    const box = getBox(p.boxId);
    if (assets && box.sprite) {
      drawTileCoord(ctx, assets.indoor, box.sprite.col, box.sprite.row, screenX, screenY);
    } else {
      drawPlaceholderBox(ctx, screenX, screenY);
    }
  }
}

function drawPlaceholderBox(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#4a2a10";
  ctx.fillRect(x + 1, y + 3, TILE_SIZE - 2, TILE_SIZE - 4);
  ctx.fillStyle = "#8a5a2a";
  ctx.fillRect(x + 2, y + 4, TILE_SIZE - 4, TILE_SIZE - 6);
  ctx.fillStyle = "#c8a060";
  ctx.fillRect(x + 1, y + 2, TILE_SIZE - 2, 4);
  ctx.fillStyle = "#f0d890";
  ctx.fillRect(x + 2, y + 3, TILE_SIZE - 4, 1);
  ctx.fillStyle = "#4a2a10";
  ctx.fillRect(x + 7, y + 6, 2, 3);
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
