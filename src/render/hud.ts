import type { View } from "./canvas";
import type { Player } from "../world/player";
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
