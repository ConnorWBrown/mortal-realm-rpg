import { getBox, type Box } from "./box";
import { blocksForDimension, type Dimension } from "./measure";

export type TileKind = "floor" | "wall" | "door";
export type DoorSide = "top" | "bottom" | "left" | "right";

export interface BoxPlacement {
  x: number;
  y: number;
  boxId: string;
}

export interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: TileKind[][];
  spawn: { x: number; y: number };
  boxes: BoxPlacement[];
  /** Real-world side length this room was generated from, if any. See `size` below. */
  realSize?: Dimension;
}

interface RoomJson {
  id: string;
  name: string;
  /**
   * Real-world side length of a square room, in feet + inches. When present,
   * `grid`/`legend` are ignored (and may be omitted): a square room is
   * generated automatically — perimeter walls, floor inside, one door — with
   * each grid block approximating FEET_PER_BLOCK feet of real space, rounded
   * up. See src/world/measure.ts.
   */
  size?: Dimension;
  /** Which perimeter wall gets the door for a `size`-generated room. Default "bottom". */
  doorSide?: DoorSide;
  legend?: Record<string, TileKind>;
  grid?: string[];
  spawn: { x: number; y: number };
  boxes?: BoxPlacement[];
}

function generateSquareRoom(
  blocks: number,
  doorSide: DoorSide,
): { legend: Record<string, TileKind>; grid: string[] } {
  const legend: Record<string, TileKind> = { "#": "wall", ".": "floor", D: "door" };
  const mid = Math.floor(blocks / 2);
  const grid: string[] = [];
  for (let y = 0; y < blocks; y++) {
    let row = "";
    for (let x = 0; x < blocks; x++) {
      const border = x === 0 || y === 0 || x === blocks - 1 || y === blocks - 1;
      const isDoor =
        (doorSide === "top" && y === 0 && x === mid) ||
        (doorSide === "bottom" && y === blocks - 1 && x === mid) ||
        (doorSide === "left" && x === 0 && y === mid) ||
        (doorSide === "right" && x === blocks - 1 && y === mid);
      row += isDoor ? "D" : border ? "#" : ".";
    }
    grid.push(row);
  }
  return { legend, grid };
}

function parseRoom(data: RoomJson): Room {
  let legend = data.legend;
  let grid = data.grid;
  let realSize: Dimension | undefined;

  if (data.size) {
    const blocks = blocksForDimension(data.size);
    if (blocks < 3) {
      throw new Error(
        `Room ${data.id}: size ${data.size.feet}'${data.size.inches}" is too small to fit walls + floor (${blocks} block(s))`,
      );
    }
    const generated = generateSquareRoom(blocks, data.doorSide ?? "bottom");
    legend = generated.legend;
    grid = generated.grid;
    realSize = data.size;
  }

  if (!grid || !legend) {
    throw new Error(`Room ${data.id}: must specify either 'size' or both 'grid' and 'legend'`);
  }

  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const tiles: TileKind[][] = [];
  for (let y = 0; y < height; y++) {
    const row = grid[y];
    if (row.length !== width) {
      throw new Error(`Room ${data.id} row ${y} has length ${row.length}, expected ${width}`);
    }
    const line: TileKind[] = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const kind = legend[ch];
      if (!kind) throw new Error(`Room ${data.id}: unknown tile '${ch}' at (${x},${y})`);
      line.push(kind);
    }
    tiles.push(line);
  }
  const placements = data.boxes ?? [];
  for (const p of placements) {
    getBox(p.boxId); // validate reference
    if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) {
      throw new Error(`Box placement '${p.boxId}' out of bounds in room ${data.id}`);
    }
  }
  return {
    id: data.id,
    name: data.name,
    width,
    height,
    tiles,
    spawn: data.spawn,
    boxes: placements,
    realSize,
  };
}

export function getBoxAt(room: Room, x: number, y: number): BoxPlacement | null {
  return room.boxes.find((b) => b.x === x && b.y === y) ?? null;
}

export function isWalkable(room: Room, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= room.width || y >= room.height) return false;
  if (room.tiles[y][x] === "wall") return false;
  if (getBoxAt(room, x, y)) return false;
  return true;
}

export function resolveBox(p: BoxPlacement): Box {
  return getBox(p.boxId);
}

const roomModules = import.meta.glob<RoomJson>("../data/rooms/*.json", {
  eager: true,
  import: "default",
});

// User-local overrides/additions, gitignored — see src/data/user/README.md.
// Files here win over default rooms with the same id.
const userRoomModules = import.meta.glob<RoomJson>("../data/user/rooms/*.json", {
  eager: true,
  import: "default",
});

const rawRooms: Record<string, RoomJson> = {};
for (const r of Object.values(roomModules)) rawRooms[r.id] = r;
for (const r of Object.values(userRoomModules)) rawRooms[r.id] = r;

export const rooms: Record<string, Room> = Object.fromEntries(
  Object.entries(rawRooms).map(([id, data]) => [id, parseRoom(data)]),
);
