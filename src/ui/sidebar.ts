/**
 * RuneScape-style bottom-right tab HUD.
 *
 * Three tabs (inventory / stats / quests). When no tab is selected, only the
 * three icons are visible. Clicking a tab opens a panel above it; clicking the
 * same tab again collapses back to icons.
 */

import type { View } from "../render/canvas";
import type { Assets } from "../render/assets";
import type { ActiveEffect } from "../world/effect";
import type { InventoryItem, Quest } from "../world/player";
import { getEffect } from "../world/effect";
import { drawTabIcon, ICON_SIZE, type TabId } from "../render/tabIcons";
import { drawEffectIcon } from "../render/effectIcons";
import { drawText, textWidth } from "./menu";

const TAB_ORDER: TabId[] = ["inventory", "stats", "quests"];
const TAB_LABEL: Record<TabId, string> = {
  inventory: "Inventory",
  stats: "Status",
  quests: "Quests",
};

// Layout constants
const TAB_PAD = 2;
const TAB_W = ICON_SIZE + TAB_PAD * 2; // 16
const TAB_H = ICON_SIZE + TAB_PAD * 2; // 16
const TAB_GAP = 1;
const EDGE_MARGIN = 3;

const PANEL_W = 116;
const PANEL_H = 108;
const PANEL_GAP = 2; // distance between panel bottom and tabs top

// Colors (match the modal menu palette)
const PANEL_BG = "#1a1420";
const PANEL_BORDER = "#c8a060";
const PANEL_BORDER_INNER = "#6b4a3a";
const TAB_BG_IDLE = "#2a1f30";
const TAB_BG_ACTIVE = "#3e2731";
const TEXT = "#e8d8b0";
const TEXT_DIM = "#8a7a5a";
const SLOT_BG = "#2a1f30";
const SLOT_BORDER = "#4a3a4a";

export interface Sidebar {
  tab: TabId | null;
}

export function createSidebar(): Sidebar {
  return { tab: null };
}

export function toggleTab(sidebar: Sidebar, tab: TabId) {
  sidebar.tab = sidebar.tab === tab ? null : tab;
}

export interface SidebarData {
  effects: ActiveEffect[];
  inventory: InventoryItem[];
  quests: Quest[];
}

function tabRect(view: View, i: number) {
  const tabsW = TAB_ORDER.length * TAB_W + (TAB_ORDER.length - 1) * TAB_GAP;
  const startX = view.width - EDGE_MARGIN - tabsW;
  const y = view.height - EDGE_MARGIN - TAB_H;
  return { x: startX + i * (TAB_W + TAB_GAP), y, w: TAB_W, h: TAB_H };
}

function panelRect(view: View) {
  const last = tabRect(view, TAB_ORDER.length - 1);
  const x = last.x + last.w - PANEL_W;
  const y = last.y - PANEL_GAP - PANEL_H;
  return { x, y, w: PANEL_W, h: PANEL_H };
}

/** Returns the tab id hit by (mx, my) in canvas-space, or null. */
export function sidebarHitTest(view: View, mx: number, my: number): TabId | null {
  for (let i = 0; i < TAB_ORDER.length; i++) {
    const r = tabRect(view, i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
      return TAB_ORDER[i];
    }
  }
  return null;
}

/** True if the click should be "consumed" by the sidebar (tabs or open panel). */
export function sidebarConsumesClick(view: View, sidebar: Sidebar, mx: number, my: number): boolean {
  if (sidebarHitTest(view, mx, my)) return true;
  if (sidebar.tab) {
    const p = panelRect(view);
    if (mx >= p.x && mx < p.x + p.w && my >= p.y && my < p.y + p.h) return true;
  }
  return false;
}

export function renderSidebar(
  view: View,
  sidebar: Sidebar,
  data: SidebarData,
  assets: Assets | null,
) {
  void assets;
  const { ctx } = view;

  // Panel (if a tab is open)
  if (sidebar.tab) {
    const p = panelRect(view);
    // drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    drawDoubleBorder(ctx, p.x, p.y, p.w, p.h);

    // Title bar
    const title = TAB_LABEL[sidebar.tab];
    ctx.fillStyle = TEXT;
    drawText(ctx, title, p.x + 6, p.y + 6);
    ctx.fillStyle = PANEL_BORDER_INNER;
    ctx.fillRect(p.x + 6, p.y + 14, p.w - 12, 1);

    const bodyX = p.x + 6;
    const bodyY = p.y + 18;
    const bodyW = p.w - 12;
    const bodyH = p.h - 24;

    if (sidebar.tab === "stats") renderStatsBody(ctx, data.effects, bodyX, bodyY, bodyW);
    else if (sidebar.tab === "inventory") renderInventoryBody(ctx, data.inventory, bodyX, bodyY, bodyW, bodyH);
    else if (sidebar.tab === "quests") renderQuestsBody(ctx, data.quests, bodyX, bodyY, bodyW);
  }

  // Tabs
  for (let i = 0; i < TAB_ORDER.length; i++) {
    const id = TAB_ORDER[i];
    const r = tabRect(view, i);
    const active = sidebar.tab === id;
    ctx.fillStyle = active ? TAB_BG_ACTIVE : TAB_BG_IDLE;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Border — full for idle, top/left/right only for active (so it "merges" with panel edge)
    ctx.fillStyle = active ? PANEL_BORDER : PANEL_BORDER_INNER;
    ctx.fillRect(r.x, r.y, r.w, 1);                 // top
    ctx.fillRect(r.x, r.y, 1, r.h);                 // left
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);       // right
    if (!active) ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1); // bottom (idle only)
    drawTabIcon(ctx, id, r.x + TAB_PAD, r.y + TAB_PAD);
  }
}

function renderStatsBody(
  ctx: CanvasRenderingContext2D,
  effects: ActiveEffect[],
  x: number,
  y: number,
  w: number,
) {
  if (effects.length === 0) {
    ctx.fillStyle = TEXT_DIM;
    drawText(ctx, "No active effects.", x, y);
    return;
  }
  const lineH = 14;
  // Aggregate duplicates for a tidier view.
  const counts = new Map<string, number>();
  for (const a of effects) {
    counts.set(a.effectId, (counts.get(a.effectId) ?? 0) + 1);
  }
  let row = 0;
  for (const [effectId, count] of counts.entries()) {
    const def = getEffect(effectId);
    const rowY = y + row * lineH;
    drawEffectIcon(ctx, effectId, x, rowY - 1);
    const label = count > 1 ? `${def.label} x${count}` : def.label;
    ctx.fillStyle = TEXT;
    drawText(ctx, truncate(label, maxChars(w - ICON_SIZE - 3)), x + ICON_SIZE + 3, rowY + 3);
    row++;
  }
}

function renderInventoryBody(
  ctx: CanvasRenderingContext2D,
  inventory: InventoryItem[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // 4 × 5 slot grid (RuneScape-style) filling the body area.
  const cols = 4;
  const rows = 5;
  const slotSize = 14;
  const gapX = Math.max(1, Math.floor((w - cols * slotSize) / (cols - 1)));
  const gapY = 2;
  const startX = x + Math.max(0, Math.floor((w - (cols * slotSize + (cols - 1) * gapX)) / 2));
  const startY = y;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const sx = startX + c * (slotSize + gapX);
      const sy = startY + r * (slotSize + gapY);
      ctx.fillStyle = SLOT_BG;
      ctx.fillRect(sx, sy, slotSize, slotSize);
      ctx.fillStyle = SLOT_BORDER;
      ctx.fillRect(sx, sy, slotSize, 1);
      ctx.fillRect(sx, sy + slotSize - 1, slotSize, 1);
      ctx.fillRect(sx, sy, 1, slotSize);
      ctx.fillRect(sx + slotSize - 1, sy, 1, slotSize);

      const item = inventory[i];
      if (item) {
        // Placeholder: first letter of the label, centered.
        const ch = item.label[0]?.toUpperCase() ?? "?";
        ctx.fillStyle = TEXT;
        drawText(ctx, ch, sx + 5, sy + 5);
        if (item.count && item.count > 1) {
          ctx.fillStyle = "#ffef99";
          drawText(ctx, String(item.count), sx + 1, sy + slotSize - 6);
        }
      }
    }
  }

  if (inventory.length === 0) {
    ctx.fillStyle = TEXT_DIM;
    const msg = "empty";
    drawText(ctx, msg, startX + (cols * (slotSize + gapX) - gapX) / 2 - textWidth(msg) / 2, y + h - 8);
  }
}

function renderQuestsBody(
  ctx: CanvasRenderingContext2D,
  quests: Quest[],
  x: number,
  y: number,
  w: number,
) {
  if (quests.length === 0) {
    ctx.fillStyle = TEXT_DIM;
    drawText(ctx, "No quests yet.", x, y);
    return;
  }
  const lineH = 8;
  quests.forEach((q, i) => {
    const rowY = y + i * lineH;
    ctx.fillStyle = q.state === "complete" ? TEXT_DIM : TEXT;
    const prefix = q.state === "complete" ? "x " : "- ";
    drawText(ctx, truncate(prefix + q.label, maxChars(w)), x, rowY);
  });
}

function drawDoubleBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
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

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, Math.max(1, n - 1)) + ".";
}

function maxChars(widthPx: number): number {
  // Pixel font is 4 wide + 1 gap per char.
  return Math.max(1, Math.floor((widthPx + 1) / 5));
}
