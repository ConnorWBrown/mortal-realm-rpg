export type BoxEntry =
  | { type: "item"; label: string; note?: string }
  | { type: "box"; boxId: string }
  | { type: "note"; label: string; text: string }
  | { type: "potion"; effectId: string; label?: string; detail?: string };

export interface Box {
  id: string;
  label: string;
  /** Tilesheet coords (col, row) in roguelikeIndoor_transparent.png. Optional for sub-boxes. */
  sprite?: { col: number; row: number };
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
