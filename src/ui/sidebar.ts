/**
 * RuneScape-style bottom-right tab HUD.
 *
 * Three tabs (inventory / stats / quests). When no tab is selected, only the
 * three icons are visible. Clicking a tab opens a panel above it; clicking the
 * same tab again collapses back to icons.
 *
 * Click handling uses a "hotspot" list rebuilt on every render, so the loop
 * can dispatch clicks to semantic actions (toggle a quest, select a task,
 * drill into a quest, …) instead of reinventing hit tests.
 */

import type { View } from "../render/canvas";
import type { Assets } from "../render/assets";
import type { ActiveEffect } from "../world/effect";
import type { InventoryItem } from "../world/player";
import type { Quest } from "../world/quest";
import { getEffect } from "../world/effect";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  findQuest,
  groupQuests,
} from "../world/quest";
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

const PANEL_SMALL = { w: 116, h: 108 };
const PANEL_LARGE = { w: 184, h: 168 };
const PANEL_GAP = 2;

// Colors (match the modal menu palette)
const PANEL_BG = "#1a1420";
const PANEL_BORDER = "#c8a060";
const PANEL_BORDER_INNER = "#6b4a3a";
const TAB_BG_IDLE = "#2a1f30";
const TAB_BG_ACTIVE = "#3e2731";
const TEXT = "#e8d8b0";
const TEXT_DIM = "#8a7a5a";
const TEXT_ACCENT = "#ffef99";
const SLOT_BG = "#2a1f30";
const SLOT_BORDER = "#4a3a4a";

interface Rect { x: number; y: number; w: number; h: number }

export type SidebarAction =
  | { kind: "toggleTab"; tab: TabId }
  | { kind: "toggleQuestActive"; questId: string }
  | { kind: "openQuest"; questId: string }
  | { kind: "backToQuestList" }
  | { kind: "selectTask"; questId: string; taskId: string }
  | { kind: "selectQuest"; questId: string };

interface Hotspot {
  rect: Rect;
  action: SidebarAction;
}

export interface Sidebar {
  tab: TabId | null;
  /** When quest tab is open, the current drilled-into quest id (null = top-level list). */
  questQuestId: string | null;
  /** Clickable regions rebuilt on every render. */
  hotspots: Hotspot[];
}

export function createSidebar(): Sidebar {
  return { tab: null, questQuestId: null, hotspots: [] };
}

export interface SidebarData {
  effects: ActiveEffect[];
  inventory: InventoryItem[];
  quests: Quest[];
}

function tabRect(view: View, i: number): Rect {
  const tabsW = TAB_ORDER.length * TAB_W + (TAB_ORDER.length - 1) * TAB_GAP;
  const startX = view.width - EDGE_MARGIN - tabsW;
  const y = view.height - EDGE_MARGIN - TAB_H;
  return { x: startX + i * (TAB_W + TAB_GAP), y, w: TAB_W, h: TAB_H };
}

function panelDims(tab: TabId) {
  return tab === "quests" ? PANEL_LARGE : PANEL_SMALL;
}

function panelRect(view: View, tab: TabId): Rect {
  const dims = panelDims(tab);
  const last = tabRect(view, TAB_ORDER.length - 1);
  const x = last.x + last.w - dims.w;
  const y = last.y - PANEL_GAP - dims.h;
  return { x, y, w: dims.w, h: dims.h };
}

function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Dispatch a click. Returns the action to be handled by the game loop, or null. */
export function sidebarClick(
  view: View,
  sidebar: Sidebar,
  mx: number,
  my: number,
): SidebarAction | null {
  // Tabs take priority (always clickable even when another panel is open).
  for (let i = 0; i < TAB_ORDER.length; i++) {
    if (pointInRect(mx, my, tabRect(view, i))) {
      return { kind: "toggleTab", tab: TAB_ORDER[i] };
    }
  }
  if (sidebar.tab) {
    for (const h of sidebar.hotspots) {
      if (pointInRect(mx, my, h.rect)) return h.action;
    }
  }
  return null;
}

export function sidebarConsumesClick(
  view: View,
  sidebar: Sidebar,
  mx: number,
  my: number,
): boolean {
  for (let i = 0; i < TAB_ORDER.length; i++) {
    if (pointInRect(mx, my, tabRect(view, i))) return true;
  }
  if (sidebar.tab && pointInRect(mx, my, panelRect(view, sidebar.tab))) return true;
  return false;
}

export function toggleTab(sidebar: Sidebar, tab: TabId) {
  if (sidebar.tab === tab) {
    sidebar.tab = null;
  } else {
    sidebar.tab = tab;
    // Reset drill state each time the quest tab opens.
    if (tab === "quests") sidebar.questQuestId = null;
  }
}

export function renderSidebar(
  view: View,
  sidebar: Sidebar,
  data: SidebarData,
  assets: Assets | null,
) {
  void assets;
  const { ctx } = view;
  sidebar.hotspots = [];

  if (sidebar.tab) {
    const p = panelRect(view, sidebar.tab);
    // drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    drawDoubleBorder(ctx, p.x, p.y, p.w, p.h);

    const title =
      sidebar.tab === "quests" && sidebar.questQuestId
        ? findQuest(data.quests, sidebar.questQuestId)?.label ?? "Quest"
        : TAB_LABEL[sidebar.tab];
    const titleX = p.x + 6;
    const titleY = p.y + 6;
    if (sidebar.tab === "quests" && sidebar.questQuestId) {
      // Back arrow area on the left of the title.
      const backRect: Rect = { x: p.x + 3, y: p.y + 3, w: 10, h: 11 };
      ctx.fillStyle = TEXT_ACCENT;
      drawText(ctx, "<", p.x + 5, titleY);
      ctx.fillStyle = TEXT;
      drawText(ctx, truncate(title, maxChars(p.w - 20)), titleX + 8, titleY);
      sidebar.hotspots.push({ rect: backRect, action: { kind: "backToQuestList" } });
    } else {
      ctx.fillStyle = TEXT;
      drawText(ctx, title, titleX, titleY);
    }
    ctx.fillStyle = PANEL_BORDER_INNER;
    ctx.fillRect(p.x + 6, p.y + 14, p.w - 12, 1);

    const bodyX = p.x + 6;
    const bodyY = p.y + 18;
    const bodyW = p.w - 12;
    const bodyH = p.h - 24;

    if (sidebar.tab === "stats") renderStatsBody(ctx, data.effects, bodyX, bodyY, bodyW);
    else if (sidebar.tab === "inventory") renderInventoryBody(ctx, data.inventory, bodyX, bodyY, bodyW, bodyH);
    else if (sidebar.tab === "quests") {
      if (sidebar.questQuestId) {
        const q = findQuest(data.quests, sidebar.questQuestId);
        if (q) renderTaskList(ctx, sidebar, q, bodyX, bodyY, bodyW);
      } else {
        renderQuestList(ctx, sidebar, data.quests, bodyX, bodyY, bodyW);
      }
    }
  }

  // Tabs
  for (let i = 0; i < TAB_ORDER.length; i++) {
    const id = TAB_ORDER[i];
    const r = tabRect(view, i);
    const active = sidebar.tab === id;
    ctx.fillStyle = active ? TAB_BG_ACTIVE : TAB_BG_IDLE;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = active ? PANEL_BORDER : PANEL_BORDER_INNER;
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    if (!active) ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    drawTabIcon(ctx, id, r.x + TAB_PAD, r.y + TAB_PAD);
  }
}

/* ── Stats body (unchanged) ────────────────────────────────────────────────── */

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
  const counts = new Map<string, number>();
  for (const a of effects) counts.set(a.effectId, (counts.get(a.effectId) ?? 0) + 1);
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

/* ── Inventory body (unchanged) ────────────────────────────────────────────── */

function renderInventoryBody(
  ctx: CanvasRenderingContext2D,
  inventory: InventoryItem[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
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
        const ch = item.label[0]?.toUpperCase() ?? "?";
        ctx.fillStyle = TEXT;
        drawText(ctx, ch, sx + 5, sy + 5);
        if (item.count && item.count > 1) {
          ctx.fillStyle = TEXT_ACCENT;
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

/* ── Quests: top-level list ────────────────────────────────────────────────── */

function renderQuestList(
  ctx: CanvasRenderingContext2D,
  sidebar: Sidebar,
  quests: Quest[],
  x: number,
  y: number,
  w: number,
) {
  const rowH = 9;
  const headerH = 9;
  const sectionGap = 2;
  let cy = y;
  const { active, inactive } = groupQuests(quests);

  for (const cat of CATEGORIES) {
    // Category header
    ctx.fillStyle = TEXT_ACCENT;
    drawText(ctx, CATEGORY_LABEL[cat], x, cy);
    cy += headerH;
    const list = active[cat];
    if (list.length === 0) {
      ctx.fillStyle = TEXT_DIM;
      drawText(ctx, "  (none)", x + 4, cy);
      cy += rowH;
    } else {
      for (const q of list) {
        cy += drawQuestRow(ctx, sidebar, q, x, cy, w, true);
      }
    }
    cy += sectionGap;
  }

  // Inactive section
  ctx.fillStyle = PANEL_BORDER_INNER;
  ctx.fillRect(x, cy, w, 1);
  cy += 3;
  ctx.fillStyle = TEXT_DIM;
  drawText(ctx, "Inactive", x, cy);
  cy += headerH;
  if (inactive.length === 0) {
    ctx.fillStyle = TEXT_DIM;
    drawText(ctx, "  (none)", x + 4, cy);
  } else {
    for (const q of inactive) {
      cy += drawQuestRow(ctx, sidebar, q, x, cy, w, false);
    }
  }
}

function drawQuestRow(
  ctx: CanvasRenderingContext2D,
  sidebar: Sidebar,
  q: Quest,
  x: number,
  y: number,
  w: number,
  activeSection: boolean,
): number {
  const indent = 4;
  const dotSize = 4;
  const dotX = x + indent;
  const dotY = y + 2;
  // Dot toggle (filled = active, hollow = inactive)
  if (q.active) {
    ctx.fillStyle = TEXT_ACCENT;
    ctx.fillRect(dotX, dotY, dotSize, dotSize);
  } else {
    ctx.fillStyle = TEXT_DIM;
    ctx.fillRect(dotX, dotY, dotSize, 1);
    ctx.fillRect(dotX, dotY + dotSize - 1, dotSize, 1);
    ctx.fillRect(dotX, dotY, 1, dotSize);
    ctx.fillRect(dotX + dotSize - 1, dotY, 1, dotSize);
  }

  const labelX = dotX + dotSize + 3;
  const labelW = w - (labelX - x) - 2;
  ctx.fillStyle = activeSection ? TEXT : TEXT_DIM;
  const taskSuffix = q.tasks.length > 0 ? `  (${q.tasks.length})` : "";
  drawText(ctx, truncate(q.label + taskSuffix, maxChars(labelW)), labelX, y);

  // Hotspots: toggle on the dot, open on the label
  sidebar.hotspots.push({
    rect: { x: dotX - 1, y: y - 1, w: dotSize + 3, h: 9 },
    action: { kind: "toggleQuestActive", questId: q.id },
  });
  sidebar.hotspots.push({
    rect: { x: labelX - 1, y: y - 1, w: labelW + 2, h: 9 },
    action: activeSection
      ? { kind: "openQuest", questId: q.id }
      : { kind: "toggleQuestActive", questId: q.id },
  });
  return 9;
}

/* ── Quests: task view ─────────────────────────────────────────────────────── */

function renderTaskList(
  ctx: CanvasRenderingContext2D,
  sidebar: Sidebar,
  quest: Quest,
  x: number,
  y: number,
  w: number,
) {
  const rowH = 9;
  if (quest.tasks.length === 0) {
    ctx.fillStyle = TEXT_DIM;
    drawText(ctx, "No tasks yet.", x, y);
    // Allow selecting the quest itself as Now.
    sidebar.hotspots.push({
      rect: { x, y: y - 1, w, h: rowH },
      action: { kind: "selectQuest", questId: quest.id },
    });
    return;
  }
  quest.tasks.forEach((t, i) => {
    const rowY = y + i * rowH;
    ctx.fillStyle = t.done ? TEXT_DIM : TEXT;
    const prefix = t.done ? "x " : "- ";
    drawText(ctx, truncate(prefix + t.label, maxChars(w)), x, rowY);
    sidebar.hotspots.push({
      rect: { x, y: rowY - 1, w, h: rowH },
      action: { kind: "selectTask", questId: quest.id, taskId: t.id },
    });
  });
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

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
  return Math.max(1, Math.floor((widthPx + 1) / 5));
}
