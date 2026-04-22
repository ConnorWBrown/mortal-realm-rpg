import type { View } from "./canvas";
import type { Player } from "../world/player";
import { getEffect } from "../world/effect";
import { drawText, textWidth } from "../ui/menu";

const BADGE_SIZE = 14;
const BADGE_PAD = 2;
const HUD_MARGIN = 4;

export function renderEffectHUD(view: View, player: Player) {
  const { ctx } = view;
  if (player.activeEffects.length === 0) return;

  // Group consecutive identical effect ids to show counts for stackables.
  const counts = new Map<string, number>();
  for (const a of player.activeEffects) {
    counts.set(a.effectId, (counts.get(a.effectId) ?? 0) + 1);
  }

  let x = view.width - HUD_MARGIN;
  const y = HUD_MARGIN;

  // Render right-to-left so leftmost = oldest.
  const entries = Array.from(counts.entries()).reverse();
  for (const [effectId, count] of entries) {
    const effect = getEffect(effectId);
    const countStr = count > 1 ? `x${count}` : "";
    const labelWidth = countStr ? textWidth(countStr) + 2 : 0;
    const bx = x - BADGE_SIZE - labelWidth;

    // Badge background
    ctx.fillStyle = "rgba(26, 20, 32, 0.8)";
    ctx.fillRect(bx - BADGE_PAD, y, BADGE_SIZE + labelWidth + BADGE_PAD * 2, BADGE_SIZE);
    ctx.fillStyle = "#c8a060";
    // Thin border on top/bottom only — looks cleaner small.
    ctx.fillRect(bx - BADGE_PAD, y, BADGE_SIZE + labelWidth + BADGE_PAD * 2, 1);
    ctx.fillRect(bx - BADGE_PAD, y + BADGE_SIZE - 1, BADGE_SIZE + labelWidth + BADGE_PAD * 2, 1);

    // Emoji
    ctx.save();
    ctx.textBaseline = "top";
    ctx.font = '11px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
    ctx.fillText(effect.emoji, bx, y + 1);
    ctx.restore();

    if (countStr) {
      ctx.fillStyle = "#e8d8b0";
      drawText(ctx, countStr, bx + BADGE_SIZE, y + 4);
    }

    x = bx - BADGE_PAD * 2 - 2;
  }
}
