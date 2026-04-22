import type { View } from "./canvas";
import type { Room, TileKind } from "../world/room";
import type { Player } from "../world/player";

export const TILE_SIZE = 16;

const TILE_COLORS: Record<TileKind, string> = {
  floor: "#3b2a2a",
  wall: "#6b4a3a",
  door: "#c8a060",
};

const FLOOR_DETAIL = "#2f2020";
const WALL_HIGHLIGHT = "#8a6a4a";
const PLAYER_BODY = "#e8d8b0";
const PLAYER_SHADE = "#a89060";
const BOX_BODY = "#8a5a2a";
const BOX_TOP = "#c8a060";
const BOX_SHADE = "#4a2a10";
const BOX_HIGHLIGHT = "#f0d890";

export interface Camera {
  x: number;
  y: number;
}

export function computeCamera(room: Room, player: Player, view: View): Camera {
  // Center camera on player, clamp to room bounds.
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
      ctx.fillStyle = TILE_COLORS[kind];
      ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
      if (kind === "floor") {
        ctx.fillStyle = FLOOR_DETAIL;
        ctx.fillRect(screenX + 2, screenY + 2, 1, 1);
        ctx.fillRect(screenX + 10, screenY + 8, 1, 1);
      } else if (kind === "wall") {
        ctx.fillStyle = WALL_HIGHLIGHT;
        ctx.fillRect(screenX, screenY, TILE_SIZE, 2);
      }
    }
  }
}

export function renderBoxes(view: View, room: Room, cam: Camera) {
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
    // Chest body
    ctx.fillStyle = BOX_SHADE;
    ctx.fillRect(screenX + 1, screenY + 3, TILE_SIZE - 2, TILE_SIZE - 4);
    ctx.fillStyle = BOX_BODY;
    ctx.fillRect(screenX + 2, screenY + 4, TILE_SIZE - 4, TILE_SIZE - 6);
    // Lid
    ctx.fillStyle = BOX_TOP;
    ctx.fillRect(screenX + 1, screenY + 2, TILE_SIZE - 2, 4);
    ctx.fillStyle = BOX_HIGHLIGHT;
    ctx.fillRect(screenX + 2, screenY + 3, TILE_SIZE - 4, 1);
    // Clasp
    ctx.fillStyle = BOX_SHADE;
    ctx.fillRect(screenX + 7, screenY + 6, 2, 3);
  }
}

export function renderPlayer(view: View, player: Player, cam: Camera) {
  const { ctx } = view;
  const px = lerpPx(player.moveFrom.x, player.x, player.moveProgress) * TILE_SIZE - cam.x;
  const py = lerpPx(player.moveFrom.y, player.y, player.moveProgress) * TILE_SIZE - cam.y;
  // Body
  ctx.fillStyle = PLAYER_SHADE;
  ctx.fillRect(px + 3, py + 4, 10, 11);
  ctx.fillStyle = PLAYER_BODY;
  ctx.fillRect(px + 4, py + 3, 8, 10);
  // Eyes depending on facing
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
