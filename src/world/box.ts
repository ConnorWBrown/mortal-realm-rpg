import type { Dimension } from "./measure";

export type BoxEntry =
  | { type: "item"; label: string; note?: string }
  | { type: "box"; boxId: string }
  | { type: "note"; label: string; text: string }
  | { type: "potion"; effectId: string; label?: string; detail?: string };

/** Real-world footprint: `width` runs along a placement's x-axis, `depth` along its y-axis. */
export interface BoxSize {
  width: Dimension;
  depth: Dimension;
}

export interface Box {
  id: string;
  label: string;
  /** Tilesheet coords (col, row) in roguelikeIndoor_transparent.png. Optional for sub-boxes. */
  sprite?: { col: number; row: number };
  /**
   * Real-world size. Required for any box a room places directly (see
   * `src/world/room.ts`), since placement/footprint math is derived from it.
   * Omit for boxes that only ever live nested inside another box's
   * `contents` (drawers, sub-boxes) and are never placed in a room.
   */
  size?: BoxSize;
  contents: BoxEntry[];
}

interface BoxJson extends Box {}

const boxModules = import.meta.glob<BoxJson>("../data/boxes/*.json", {
  eager: true,
  import: "default",
});

// User-local overrides/additions, gitignored — see src/data/user/README.md.
// Files here win over default boxes with the same id.
const userBoxModules = import.meta.glob<BoxJson>("../data/user/boxes/*.json", {
  eager: true,
  import: "default",
});

export const boxes: Record<string, Box> = {};
for (const b of Object.values(boxModules)) boxes[b.id] = b;
for (const b of Object.values(userBoxModules)) boxes[b.id] = b;

for (const b of Object.values(boxes)) {
  for (const entry of b.contents) {
    if (entry.type === "box" && !boxes[entry.boxId]) {
      throw new Error(`Box ${b.id} references missing sub-box '${entry.boxId}'`);
    }
  }
}

export function getBox(id: string): Box {
  const b = boxes[id];
  if (!b) throw new Error(`Unknown box id: ${id}`);
  return b;
}
