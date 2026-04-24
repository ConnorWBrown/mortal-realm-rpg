/**
 * 12x12 pixel-art icons for the bottom-right HUD tabs (RuneScape style):
 *   - inventory → satchel/backpack
 *   - stats     → heart
 *   - quests    → scroll
 *
 * Same encoding convention as effectIcons.ts: each row is a 12-char string,
 * each character a palette key; "." is transparent.
 */

export type TabId = "inventory" | "stats" | "quests";

interface IconDef {
  palette: Record<string, string>;
  rows: string[];
}

const ICON_SIZE = 12;

function validate(def: IconDef, id: string) {
  if (def.rows.length !== ICON_SIZE) throw new Error(`Tab icon ${id}: expected ${ICON_SIZE} rows`);
  for (const row of def.rows) {
    if (row.length !== ICON_SIZE) throw new Error(`Tab icon ${id}: row length ${row.length} != ${ICON_SIZE}`);
  }
}

/* Satchel — brown bag with handle and centered buckle. */
const satchel: IconDef = {
  palette: {
    ".": "",
    "b": "#3a2515",
    "B": "#8a5a2a",
    "M": "#6b4a3a",
    "h": "#c8a060",
  },
  rows: [
    "............",
    "....bbbb....",
    "...b....b...",
    "..b......b..",
    ".bbbbbbbbbb.",
    ".bBBBhhBBBb.",
    ".bBBhhhhBBb.",
    ".bBBBhhBBBb.",
    ".bBBBBBBBBb.",
    ".bBMMMMMMBb.",
    ".bbbbbbbbbb.",
    "............",
  ],
};

/* Heart — classic two-lobe shape with soft highlight. */
const heart: IconDef = {
  palette: {
    ".": "",
    "r": "#901018",
    "R": "#ef4040",
    "h": "#ff9a9a",
  },
  rows: [
    "............",
    "..rr..rr....",
    ".rRRrrRRRr..",
    "rRhhRRRRRRr.",
    "rRhhRRRRRRr.",
    "rRRRRRRRRRr.",
    "rRRRRRRRRRr.",
    ".rRRRRRRRr..",
    "..rRRRRRr...",
    "...rRRRr....",
    "....rRr.....",
    ".....r......",
  ],
};

/* Scroll — parchment with top and bottom rolls and lines of text. */
const scroll: IconDef = {
  palette: {
    ".": "",
    "b": "#3a2515",
    "P": "#8a5a2a",
    "p": "#e8d8b0",
    "l": "#6b4a3a",
  },
  rows: [
    "............",
    "............",
    "..bbbbbbbb..",
    "..bPPPPPPb..",
    ".bpllllllpb.",
    ".bppppppppb.",
    ".bpllllllpb.",
    ".bppppppppb.",
    ".bpllllllpb.",
    "..bPPPPPPb..",
    "..bbbbbbbb..",
    "............",
  ],
};

const icons: Record<TabId, IconDef> = {
  inventory: satchel,
  stats: heart,
  quests: scroll,
};

for (const [id, def] of Object.entries(icons)) validate(def, id);

export function drawTabIcon(
  ctx: CanvasRenderingContext2D,
  tab: TabId,
  x: number,
  y: number,
) {
  const def = icons[tab];
  for (let r = 0; r < ICON_SIZE; r++) {
    const row = def.rows[r];
    for (let c = 0; c < ICON_SIZE; c++) {
      const color = def.palette[row[c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

export { ICON_SIZE };
