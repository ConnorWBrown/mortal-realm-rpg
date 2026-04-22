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

export const boxes: Record<string, Box> = Object.fromEntries(
  Object.values(boxModules).map((b) => [b.id, b]),
);

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
