import { getBox, type Box } from "./box";

export type TileKind = "floor" | "wall" | "door";

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
}

interface RoomJson {
  id: string;
  name: string;
  legend: Record<string, TileKind>;
  grid: string[];
  spawn: { x: number; y: number };
  boxes?: BoxPlacement[];
}

function parseRoom(data: RoomJson): Room {
  const height = data.grid.length;
  const width = data.grid[0]?.length ?? 0;
  const tiles: TileKind[][] = [];
  for (let y = 0; y < height; y++) {
    const row = data.grid[y];
    if (row.length !== width) {
      throw new Error(`Room ${data.id} row ${y} has length ${row.length}, expected ${width}`);
    }
    const line: TileKind[] = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const kind = data.legend[ch];
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
