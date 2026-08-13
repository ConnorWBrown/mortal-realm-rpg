import type { View } from "../render/canvas";
import type { InputState } from "../game/input";
import { getBox, type Box, type BoxEntry } from "../world/box";
import { getEffect, type ActiveEffect } from "../world/effect";
import { formatDimension } from "../world/measure";
import type { Assets } from "../render/assets";
import { drawEffectIcon, ICON_SIZE } from "../render/effectIcons";

export type MenuFrame =
  | { kind: "box"; title: string; entries: BoxEntry[]; cursor: number; dimensions?: string }
  | { kind: "note"; title: string; text: string }
  | { kind: "stats"; title: string; cursor: number };

export interface MenuHandlers {
  applyPotion(effectId: string, detail?: string): void;
  getActiveEffects(): ActiveEffect[];
  dismissEffectAt(index: number): void;
}

export interface MenuStack {
  frames: MenuFrame[];
}

export function createMenuStack(): MenuStack {
  return { frames: [] };
}

export function isMenuOpen(stack: MenuStack): boolean {
  return stack.frames.length > 0;
}

export function openBoxMenu(stack: MenuStack, box: Box) {
  const dimensions = box.size
    ? `${formatDimension(box.size.width)} x ${formatDimension(box.size.depth)}`
    : undefined;
  stack.frames.push({ kind: "box", title: box.label, entries: box.contents, cursor: 0, dimensions });
}

export function openStatsMenu(stack: MenuStack) {
  stack.frames.push({ kind: "stats", title: "Status", cursor: 0 });
}

export function updateMenu(stack: MenuStack, input: InputState, handlers: MenuHandlers) {
  const top = stack.frames[stack.frames.length - 1];
  if (!top) return;

  if (input.consumePress("b")) {
    stack.frames.pop();
    return;
  }

  if (top.kind === "note") {
    if (input.consumePress("a")) stack.frames.pop();
    return;
  }

  const entryCount = top.kind === "box" ? top.entries.length : handlers.getActiveEffects().length;
  if (entryCount === 0) return;

  if (input.consumePress("up")) {
    top.cursor = (top.cursor - 1 + entryCount) % entryCount;
  }
  if (input.consumePress("down")) {
    top.cursor = (top.cursor + 1) % entryCount;
  }
  top.cursor = Math.min(top.cursor, entryCount - 1);

  if (input.consumePress("a")) {
    if (top.kind === "box") {
      const entry = top.entries[top.cursor];
      if (!entry) return;
      if (entry.type === "box") {
        openBoxMenu(stack, getBox(entry.boxId));
      } else if (entry.type === "note") {
        stack.frames.push({ kind: "note", title: entry.label, text: entry.text });
      } else if (entry.type === "potion") {
        handlers.applyPotion(entry.effectId, entry.detail);
      }
    } else if (top.kind === "stats") {
      handlers.dismissEffectAt(top.cursor);
      const newCount = handlers.getActiveEffects().length;
      if (newCount === 0) top.cursor = 0;
      else if (top.cursor >= newCount) top.cursor = newCount - 1;
    }
  }
}

const PANEL_BG = "#1a1420";
const PANEL_BORDER = "#c8a060";
const PANEL_BORDER_INNER = "#6b4a3a";
const TEXT = "#e8d8b0";
const TEXT_DIM = "#8a7a5a";
const CURSOR = "#e8d8b0";

export function renderMenu(view: View, stack: MenuStack, handlers: MenuHandlers, assets: Assets | null) {
  const top = stack.frames[stack.frames.length - 1];
  if (!top) return;

  const { ctx } = view;
  const pad = 6;
  const margin = 8;
  const w = view.width - margin * 2;
  const lineH = 10;
  const hintH = lineH + 2;
  const innerW = w - pad * 2;

  const hasDimensions = top.kind === "box" && !!top.dimensions;
  const titleLines = hasDimensions ? 2 : 1;
  const titleBlockH = titleLines * lineH + 4;
  const rowCount = rowCountFor(top, handlers);
  const bodyLineCount = top.kind === "note" ? wrapText(top.text, innerW, 6).length : Math.max(1, rowCount);
  const bodyH = bodyLineCount * lineH;
  const h = pad * 2 + titleBlockH + bodyH + hintH + 4;
  const x = margin;
  const y = view.height - h - margin;

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 2, y + 2, w, h);

  void assets;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  drawDoubleBorder(ctx, x, y, w, h);

  ctx.fillStyle = TEXT;
  drawText(ctx, top.title, x + pad, y + pad);
  if (hasDimensions && top.kind === "box" && top.dimensions) {
    ctx.fillStyle = TEXT_DIM;
    drawText(ctx, top.dimensions, x + pad, y + pad + lineH);
  }
  ctx.fillStyle = PANEL_BORDER_INNER;
  ctx.fillRect(x + pad, y + pad + titleLines * lineH + 1, innerW, 1);

  const bodyY = y + pad + titleBlockH;

  if (top.kind === "note") {
    ctx.fillStyle = TEXT;
    wrapText(top.text, innerW, 6).forEach((line, i) => drawText(ctx, line, x + pad, bodyY + i * lineH));
  } else if (top.kind === "box") {
    if (top.entries.length === 0) {
      ctx.fillStyle = TEXT_DIM;
      drawText(ctx, "(empty)", x + pad, bodyY);
    } else {
      top.entries.forEach((entry, i) => {
        drawListCursor(ctx, i === top.cursor, x + pad, bodyY + i * lineH);
        ctx.fillStyle = i === top.cursor ? TEXT : TEXT_DIM;
        drawText(ctx, boxEntryLabel(entry), x + pad + 8, bodyY + i * lineH);
      });
    }
  } else {
    const effects = handlers.getActiveEffects();
    if (effects.length === 0) {
      ctx.fillStyle = TEXT_DIM;
      drawText(ctx, "No active effects.", x + pad, bodyY);
    } else {
      effects.forEach((active, i) => {
        const rowY = bodyY + i * lineH;
        drawListCursor(ctx, i === top.cursor, x + pad, rowY);
        const def = getEffect(active.effectId);
        drawEffectIcon(ctx, active.effectId, x + pad + 8, rowY - 2);
        ctx.fillStyle = i === top.cursor ? TEXT : TEXT_DIM;
        const label = active.detail ? `${def.label}: ${active.detail}` : def.label;
        drawText(ctx, truncate(label, 26), x + pad + 8 + ICON_SIZE + 2, rowY);
      });
    }
  }

  ctx.fillStyle = TEXT_DIM;
  drawText(ctx, hintFor(top), x + pad, y + h - pad - lineH + 2);
}

function rowCountFor(frame: MenuFrame, handlers: MenuHandlers): number {
  if (frame.kind === "box") return frame.entries.length;
  if (frame.kind === "stats") return handlers.getActiveEffects().length;
  return 0;
}

function drawListCursor(ctx: CanvasRenderingContext2D, selected: boolean, x: number, y: number) {
  if (!selected) return;
  ctx.fillStyle = CURSOR;
  drawText(ctx, ">", x, y);
}

function boxEntryLabel(entry: BoxEntry): string {
  if (entry.type === "item") return `- ${entry.label}`;
  if (entry.type === "box") return `> ${getBox(entry.boxId).label}`;
  if (entry.type === "note") return `* ${entry.label}`;
  const effect = getEffect(entry.effectId);
  return `+ ${entry.label ?? effect.label}`;
}

function hintFor(frame: MenuFrame): string {
  if (frame.kind === "note") return "A/B: close";
  if (frame.kind === "stats") return "A: clear   B: close";
  return "A: open   B: back";
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + ".";
}

function drawDoubleBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = PANEL_BORDER;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = PANEL_BORDER_INNER;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, h - 4);
  ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
}

/* --- Pixel font --- */

const FONT_W = 4;
const FONT_H = 5;
const GLYPHS: Record<string, number[]> = {
  " ": [0,0,0,0,0],
  "A": [0b0110,0b1001,0b1111,0b1001,0b1001],
  "B": [0b1110,0b1001,0b1110,0b1001,0b1110],
  "C": [0b0111,0b1000,0b1000,0b1000,0b0111],
  "D": [0b1110,0b1001,0b1001,0b1001,0b1110],
  "E": [0b1111,0b1000,0b1110,0b1000,0b1111],
  "F": [0b1111,0b1000,0b1110,0b1000,0b1000],
  "G": [0b0111,0b1000,0b1011,0b1001,0b0111],
  "H": [0b1001,0b1001,0b1111,0b1001,0b1001],
  "I": [0b1110,0b0100,0b0100,0b0100,0b1110],
  "J": [0b0111,0b0010,0b0010,0b1010,0b0100],
  "K": [0b1001,0b1010,0b1100,0b1010,0b1001],
  "L": [0b1000,0b1000,0b1000,0b1000,0b1111],
  "M": [0b1001,0b1111,0b1111,0b1001,0b1001],
  "N": [0b1001,0b1101,0b1111,0b1011,0b1001],
  "O": [0b0110,0b1001,0b1001,0b1001,0b0110],
  "P": [0b1110,0b1001,0b1110,0b1000,0b1000],
  "Q": [0b0110,0b1001,0b1001,0b1011,0b0111],
  "R": [0b1110,0b1001,0b1110,0b1010,0b1001],
  "S": [0b0111,0b1000,0b0110,0b0001,0b1110],
  "T": [0b1111,0b0100,0b0100,0b0100,0b0100],
  "U": [0b1001,0b1001,0b1001,0b1001,0b0110],
  "V": [0b1001,0b1001,0b1001,0b0110,0b0110],
  "W": [0b1001,0b1001,0b1111,0b1111,0b1001],
  "X": [0b1001,0b0110,0b0110,0b0110,0b1001],
  "Y": [0b1001,0b1001,0b0110,0b0100,0b0100],
  "Z": [0b1111,0b0010,0b0100,0b1000,0b1111],
  "0": [0b0110,0b1011,0b1101,0b1001,0b0110],
  "1": [0b0100,0b1100,0b0100,0b0100,0b1110],
  "2": [0b0110,0b1001,0b0010,0b0100,0b1111],
  "3": [0b1110,0b0001,0b0110,0b0001,0b1110],
  "4": [0b1001,0b1001,0b1111,0b0001,0b0001],
  "5": [0b1111,0b1000,0b1110,0b0001,0b1110],
  "6": [0b0111,0b1000,0b1110,0b1001,0b0110],
  "7": [0b1111,0b0001,0b0010,0b0100,0b0100],
  "8": [0b0110,0b1001,0b0110,0b1001,0b0110],
  "9": [0b0110,0b1001,0b0111,0b0001,0b1110],
  ".": [0,0,0,0,0b0100],
  ",": [0,0,0,0b0100,0b1000],
  "!": [0b0100,0b0100,0b0100,0,0b0100],
  "?": [0b1110,0b0001,0b0010,0,0b0100],
  ":": [0,0b0100,0,0b0100,0],
  "-": [0,0,0b1110,0,0],
  "'": [0b0100,0b0100,0,0,0],
  "\"": [0b1010,0b1010,0,0,0],
  "(": [0b0010,0b0100,0b0100,0b0100,0b0010],
  ")": [0b0100,0b0010,0b0010,0b0010,0b0100],
  "/": [0b0001,0b0010,0b0100,0b1000,0b0000],
  "+": [0,0b0100,0b1110,0b0100,0],
  "x": [0,0b1010,0b0100,0b1010,0],
  ">": [0b1000,0b0100,0b0010,0b0100,0b1000],
  "<": [0b0010,0b0100,0b1000,0b0100,0b0010],
  "*": [0,0b1010,0b0100,0b1010,0],
};

function glyphFor(ch: string): number[] | null {
  const up = ch.toUpperCase();
  return GLYPHS[up] ?? GLYPHS[ch] ?? null;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  for (let i = 0; i < text.length; i++) {
    const g = glyphFor(text[i]);
    const cx = x + i * (FONT_W + 1);
    if (!g) continue;
    for (let row = 0; row < FONT_H; row++) {
      const bits = g[row];
      for (let col = 0; col < FONT_W; col++) {
        if (bits & (1 << (FONT_W - 1 - col))) {
          ctx.fillRect(cx + col, y + row, 1, 1);
        }
      }
    }
  }
}

export function textWidth(text: string): number {
  return text.length * (FONT_W + 1) - 1;
}

function wrapText(text: string, maxWidthPx: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (textWidth(candidate) <= maxWidthPx) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
