/**
 * Hand-coded 12x12 pixel-art icons for each effect.
 * Each row is a 12-char string; each char is a palette index key.
 *
 * Palette keys: a short alphabet per icon, defined alongside. "." is transparent.
 * Rendered with 1 canvas fillRect per opaque pixel.
 */

export interface IconDef {
  palette: Record<string, string>;
  rows: string[]; // length 12, each string length 12
}

const ICON_SIZE = 12;

function validate(def: IconDef, id: string) {
  if (def.rows.length !== ICON_SIZE) throw new Error(`Icon ${id}: expected ${ICON_SIZE} rows`);
  for (const row of def.rows) {
    if (row.length !== ICON_SIZE) throw new Error(`Icon ${id}: row length ${row.length} != ${ICON_SIZE}`);
  }
}

/*  ⌨️ Heads-down working — a dark keyboard seen top-down with lit keys. */
const headsDown: IconDef = {
  palette: { ".": "", "k": "#2a2028", "K": "#4a4050", "w": "#e8d8b0", "s": "#1a1420" },
  rows: [
    "............",
    "............",
    ".kkkkkkkkkk.",
    ".kwwwwwwwwk.",
    ".kKKKKKKKKk.",
    ".kwwwwwwwwk.",
    ".kKKKKKKKKk.",
    ".kwwwwwwwwk.",
    ".kKKwwwwwKk.",
    ".kKKKKKKKKk.",
    ".kkkkkkkkkk.",
    "...ssss.....",
  ],
};

/*  🛠️ Big-project energy — hammer + wrench crossed. */
const bigProject: IconDef = {
  palette: { ".": "", "b": "#6b4a3a", "B": "#8a5a2a", "g": "#a8a8b0", "G": "#c8c8d0", "s": "#2a2028" },
  rows: [
    "........GG..",
    ".......GGGs.",
    "......GGgs..",
    "..s..Ggg.s..",
    ".sBs.gg..s..",
    "sBBBsg...s..",
    ".sBs..b..s..",
    "..s...bb....",
    ".....bb.....",
    "....bb......",
    "...bb.......",
    "..bb........",
  ],
};

/*  🧑‍🔧 Task queued — clipboard with a check. */
const taskQueued: IconDef = {
  palette: { ".": "", "b": "#4a3a2a", "p": "#e8d8b0", "l": "#8a7a5a", "g": "#3aaa3a", "s": "#2a2028" },
  rows: [
    "....bbbb....",
    "...b....b...",
    "..bppppppb..",
    "..bpllllpb..",
    "..bpllllpb..",
    "..bp....pb..",
    "..bp...gpb..",
    "..bp..ggpb..",
    "..bpg.g.pb..",
    "..bpgg..pb..",
    "..bppppppb..",
    "...bbbbbbs..",
  ],
};

/*  🔵 Adderall — blue capsule with highlight. */
const adderall: IconDef = {
  palette: { ".": "", "b": "#2060c0", "B": "#4080e0", "h": "#9acbf0", "s": "#102048" },
  rows: [
    "............",
    "....bBBb....",
    "...bBhhBb...",
    "..bBhhhhBs..",
    ".bBhhhhhhBs.",
    ".bBhhhhhhBs.",
    ".bBhhhhhhBs.",
    ".bBhhhhhhBs.",
    "..bBhhhhBs..",
    "...bBBBbs...",
    "....bbbs....",
    "............",
  ],
};

/*  🎉 Stoked — starburst / confetti. */
const stoked: IconDef = {
  palette: { ".": "", "y": "#ffdc4a", "Y": "#ffb020", "r": "#ef4040", "g": "#2aaa2a", "c": "#3a9ad0" },
  rows: [
    "...y...y....",
    ".r.y...y.g..",
    "..r.y.y.g...",
    "....yYy.....",
    "yyyyYYYyyyy.",
    "....yYy.....",
    "...y.Y.y....",
    "..c..Y..c...",
    ".c...y...r..",
    "c....y....r.",
    ".....y......",
    "............",
  ],
};

/*  🍎 Hungry — red apple with leaf. */
const hungry: IconDef = {
  palette: { ".": "", "r": "#d02a2a", "R": "#ef4040", "h": "#ff8a8a", "g": "#3aaa3a", "s": "#2a1010", "b": "#6b4a3a" },
  rows: [
    ".....b......",
    "...g.b......",
    "..gg.b......",
    ".rRRRrrRR...",
    "rRhRRRRRRr..",
    "rRhRRRRRRr..",
    "rRhRRRRRRr..",
    "rRRRRRRRRr..",
    ".rRRRRRRr...",
    "..rRRRRr....",
    "...rRRr.....",
    "....ss......",
  ],
};

/*  💬 Spiel queued — speech bubble with dots. */
const spielQueued: IconDef = {
  palette: { ".": "", "b": "#6b4a3a", "w": "#e8d8b0", "d": "#4a3a2a", "s": "#2a2028" },
  rows: [
    "............",
    ".bbbbbbbbbb.",
    ".bwwwwwwwwb.",
    ".bwwwwwwwwb.",
    ".bwdwdwdwwb.",
    ".bwwwwwwwwb.",
    ".bwwwwwwwwb.",
    ".bbbbbbbbbs.",
    "...bb.s.....",
    "....bbs.....",
    ".....bs.....",
    "............",
  ],
};

/*  😕 Irritated — frown face. */
const irritated: IconDef = {
  palette: { ".": "", "y": "#efc040", "Y": "#d08a1a", "s": "#2a2028", "h": "#ffd870" },
  rows: [
    "...yyyyyy...",
    "..yyhyyyyy..",
    ".yyhyyyyyYy.",
    ".yhyyssyssyY",
    ".yyyyssyssyY",
    ".yyyyyyyyyY.",
    ".yyyyyyyyyY.",
    ".yysssyyyyY.",
    ".yyyysssyyY.",
    ".yyyyyyysyY.",
    "..yYYYYYYy..",
    "...YYYYYY...",
  ],
};

export const icons: Record<string, IconDef> = {
  "heads-down": headsDown,
  "big-project-energy": bigProject,
  "task-queued": taskQueued,
  "adderall": adderall,
  "stoked": stoked,
  "hungry": hungry,
  "spiel-queued": spielQueued,
  "irritated": irritated,
};

for (const [id, def] of Object.entries(icons)) validate(def, id);

export function drawEffectIcon(
  ctx: CanvasRenderingContext2D,
  effectId: string,
  x: number,
  y: number,
) {
  const def = icons[effectId];
  if (!def) return;
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
