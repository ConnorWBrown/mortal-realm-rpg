import type { View } from "./canvas";
import type { Player } from "../world/player";
import type { Room } from "../world/room";
import { rooms, interiorOffset } from "../world/room";
import type { Camera } from "./tiles";
import { TILE_SIZE } from "./tiles";
import { formatDimension } from "../world/measure";
import { getEffect } from "../world/effect";
import { drawText, textWidth } from "../ui/menu";
import { drawEffectIcon, ICON_SIZE } from "./effectIcons";

const BADGE_PAD = 2;
const HUD_MARGIN = 4;

export function renderEffectHUD(view: View, player: Player) {
  const { ctx } = view;
  if (player.activeEffects.length === 0) return;

  const counts = new Map<string, number>();
  for (const a of player.activeEffects) {
    counts.set(a.effectId, (counts.get(a.effectId) ?? 0) + 1);
  }

  let x = view.width - HUD_MARGIN;
  const y = HUD_MARGIN;
  const entries = Array.from(counts.entries()).reverse();

  for (const [effectId, count] of entries) {
    getEffect(effectId); // validate
    const countStr = count > 1 ? `x${count}` : "";
    const labelWidth = countStr ? textWidth(countStr) + 2 : 0;
    const boxW = ICON_SIZE + labelWidth + BADGE_PAD * 2;
    const boxH = ICON_SIZE + 2;
    const bx = x - ICON_SIZE - labelWidth - BADGE_PAD;

    ctx.fillStyle = "rgba(26, 20, 32, 0.8)";
    ctx.fillRect(bx - BADGE_PAD, y, boxW, boxH);
    ctx.fillStyle = "#c8a060";
    ctx.fillRect(bx - BADGE_PAD, y, boxW, 1);
    ctx.fillRect(bx - BADGE_PAD, y + boxH - 1, boxW, 1);

    drawEffectIcon(ctx, effectId, bx, y + 1);

    if (countStr) {
      ctx.fillStyle = "#e8d8b0";
      drawText(ctx, countStr, bx + ICON_SIZE, y + 4);
    }

    x = bx - BADGE_PAD * 2 - 2;
  }
}

/** Nameplate badge drawn inside a room's own top-left corner, in world space,
 * so it pans/scrolls with that room rather than following the player.
 * Shows real-world size (e.g. `16'0"x12'0"`) for single-lobe rooms — see
 * src/world/measure.ts and room.ts. */
export function renderRoomLabels(view: View, rooms: Room[], cam: Camera) {
  const { ctx } = view;
  for (const room of rooms) {
    const label = room.realSize
      ? `${room.name} ${formatDimension(room.realSize.width)}x${formatDimension(room.realSize.depth)}`
      : room.name;
    const w = textWidth(label);
    const x = room.worldOrigin.x * TILE_SIZE - cam.x + HUD_MARGIN;
    const y = room.worldOrigin.y * TILE_SIZE - cam.y + HUD_MARGIN;
    if (x + w < 0 || y < 0 || x > view.width || y > view.height) continue;

    ctx.fillStyle = "rgba(26, 20, 32, 0.8)";
    ctx.fillRect(x - BADGE_PAD, y - 1, w + BADGE_PAD * 2, 8);
    ctx.fillStyle = "#e8d8b0";
    drawText(ctx, label, x, y);
  }
}

/** Badge showing where a door leads, shown only while the player is standing
 * next to that door. Stub doors (no `to`, e.g. an unmodeled exterior exit)
 * aren't labelled at all. Anchored one tile beyond the door on its exterior
 * side — outside the wall rather than on the door tile itself — so it never
 * paints over the door sprite; it's fine for it to land on whatever's out
 * there (another room's tiles, void, grass). */
export function renderDoorLabels(view: View, visible: Room[], cam: Camera, player: Player) {
  const { ctx } = view;
  for (const room of visible) {
    for (const door of room.doors) {
      if (!door.to) continue;
      const worldX = room.worldOrigin.x + door.x;
      const worldY = room.worldOrigin.y + door.y;
      if (Math.max(Math.abs(worldX - player.x), Math.abs(worldY - player.y)) > 1) continue;

      const label = rooms[door.to.room]?.name ?? door.to.room;
      const inward = interiorOffset(room, door.x, door.y);
      const anchorX = worldX - inward.dx;
      const anchorY = worldY - inward.dy;

      const w = textWidth(label);
      const x = Math.round(anchorX * TILE_SIZE - cam.x + (TILE_SIZE - w) / 2);
      const y = Math.round(anchorY * TILE_SIZE - cam.y + (TILE_SIZE - 5) / 2);
      if (x + w < 0 || y < 0 || x > view.width || y > view.height) continue;

      ctx.fillStyle = "rgba(26, 20, 32, 0.8)";
      ctx.fillRect(x - BADGE_PAD, y - 1, w + BADGE_PAD * 2, 8);
      ctx.fillStyle = "#e8d8b0";
      drawText(ctx, label, x, y);
    }
  }
}
