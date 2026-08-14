import { getBox, type Box } from "./box";
import { blocksForDimension, blocksForDimensionFloor, toInches, INCHES_PER_BLOCK, type Dimension } from "./measure";

export type TileKind = "floor" | "wall" | "door";
export type Wall = "top" | "bottom" | "left" | "right";
export type DoorSide = Wall;

/** A resolved box footprint in room-grid coordinates (wall ring included in the grid). */
export interface BoxPlacement {
  boxId: string;
  /** Top-left grid cell of the footprint. */
  x: number;
  y: number;
  /** Footprint size in blocks (>= 1), floored from the box's real width/depth. */
  widthBlocks: number;
  depthBlocks: number;
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
  /**
   * This room's top-left corner in world-space blocks. Rooms are laid out
   * side by side in one shared coordinate space (with gaps of unwalkable
   * void between them) purely so doors can "teleport" the player between
   * rooms that are otherwise drawn as disconnected — see `doorTo` below.
   */
  worldOrigin: { x: number; y: number };
  /** Which wall this room's door sits on. Defaults to "bottom". */
  doorSide?: DoorSide;
  /** Room id this room's door leads to, if any. */
  doorTo?: string;
}

/**
 * Where a box's near edge sits, real-world, relative to one wall of the
 * room. `offset: {feet: 0, inches: 0}` means flush against that wall.
 */
export interface AxisOffsetJson {
  fromWall: Wall;
  offset: Dimension;
}

export interface BoxPlacementJson {
  boxId: string;
  /** Must reference "left" or "right". */
  x: AxisOffsetJson;
  /** Must reference "top" or "bottom". */
  y: AxisOffsetJson;
}

interface RoomJson {
  id: string;
  name: string;
  /**
   * Real-world side length of the square room's INTERIOR (floor area only —
   * walls are added on top of this, not counted in it). When present,
   * `grid`/`legend` are ignored (and may be omitted): a square room is
   * generated automatically. The interior is `blocksForDimension(size)`
   * floor blocks per side (each block approximating FEET_PER_BLOCK feet,
   * rounded up), surrounded by a one-block-thick wall — so a 16'0" room is
   * 6 floor blocks plus a wall block on each side, 8 blocks total. See
   * src/world/measure.ts.
   */
  size?: Dimension;
  /** Which perimeter wall gets the door for a `size`-generated room. Default "bottom". */
  doorSide?: DoorSide;
  /** Room id this room's door leads to, if any. */
  doorTo?: string;
  /** This room's top-left corner in world-space blocks. Defaults to {0,0}. */
  worldOrigin?: { x: number; y: number };
  legend?: Record<string, TileKind>;
  grid?: string[];
  spawn: { x: number; y: number };
  boxes?: BoxPlacementJson[];
}

function generateSquareRoom(
  interiorBlocks: number,
  doorSide: DoorSide,
): { legend: Record<string, TileKind>; grid: string[] } {
  // The measured size is the interior (floor) footprint; a one-block wall
  // ring goes around it, so a 16'0" / 6-block interior is 8 blocks total.
  const blocks = interiorBlocks + 2;
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

interface ResolvedFootprint {
  boxId: string;
  /** True (real-world, inches) rectangle — the source of truth for "does this actually fit". */
  trueLeft: number;
  trueTop: number;
  trueWidth: number;
  trueDepth: number;
  /** Block-grid rectangle (approximate) — the source of truth for rendering/collision. */
  blockX: number;
  blockY: number;
  widthBlocks: number;
  depthBlocks: number;
}

/**
 * Converts each `size`/`fromWall`+`offset`-authored placement into both a
 * true (inches) rectangle and a block-grid rectangle, then validates the
 * true rectangles: does each box actually fit inside the room, and do any
 * two boxes actually overlap? Violations are logged as warnings, never
 * thrown — the room still loads and renders the (approximate) block
 * rectangles regardless. See src/world/measure.ts for why block counts
 * alone can't be trusted for this check.
 *
 * Assumes a room with a one-block wall ring around a rectangular interior
 * (true of every `size`-generated room, and of hand-drawn `grid` rooms that
 * follow the same convention).
 */
function resolvePlacements(
  roomId: string,
  raw: BoxPlacementJson[],
  gridWidth: number,
  gridHeight: number,
  realSize: Dimension | undefined,
): BoxPlacement[] {
  const interiorWidthBlocks = gridWidth - 2;
  const interiorDepthBlocks = gridHeight - 2;
  const roomTrueWidthIn = realSize ? toInches(realSize) : undefined;
  const roomTrueDepthIn = roomTrueWidthIn; // square rooms only, for now

  const resolved: ResolvedFootprint[] = raw.map((p) => {
    const box = getBox(p.boxId); // throws if missing
    if (!box.size) {
      throw new Error(`Room ${roomId}: box '${p.boxId}' has no 'size' (width/depth) and can't be placed`);
    }
    if ((p.x.fromWall === "right" || p.y.fromWall === "bottom") && roomTrueWidthIn === undefined) {
      throw new Error(
        `Room ${roomId}: box '${p.boxId}' is offset from the ${p.x.fromWall === "right" ? "right" : "bottom"} wall, which requires the room to declare a real-world 'size'`,
      );
    }
    if (p.x.fromWall !== "left" && p.x.fromWall !== "right") {
      throw new Error(`Room ${roomId}: box '${p.boxId}' x.fromWall must be "left" or "right"`);
    }
    if (p.y.fromWall !== "top" && p.y.fromWall !== "bottom") {
      throw new Error(`Room ${roomId}: box '${p.boxId}' y.fromWall must be "top" or "bottom"`);
    }

    const trueWidth = toInches(box.size.width);
    const trueDepth = toInches(box.size.depth);
    const widthBlocks = blocksForDimensionFloor(box.size.width);
    const depthBlocks = blocksForDimensionFloor(box.size.depth);

    const offsetX = toInches(p.x.offset);
    const offsetY = toInches(p.y.offset);
    const trueLeft = p.x.fromWall === "left" ? offsetX : (roomTrueWidthIn as number) - offsetX - trueWidth;
    const trueTop = p.y.fromWall === "top" ? offsetY : (roomTrueDepthIn as number) - offsetY - trueDepth;

    const blockX = Math.max(0, Math.floor(trueLeft / INCHES_PER_BLOCK));
    const blockY = Math.max(0, Math.floor(trueTop / INCHES_PER_BLOCK));

    return {
      boxId: p.boxId,
      trueLeft,
      trueTop,
      trueWidth,
      trueDepth,
      blockX,
      blockY,
      widthBlocks,
      depthBlocks,
    };
  });

  // True-dimension validation — only meaningful once we know the room's real size.
  if (roomTrueWidthIn !== undefined && roomTrueDepthIn !== undefined) {
    for (const r of resolved) {
      if (r.trueLeft < 0 || r.trueLeft + r.trueWidth > roomTrueWidthIn) {
        console.warn(
          `[room:${roomId}] '${r.boxId}' is ${r.trueWidth}" wide but doesn't fit at its placed offset within the room's ${roomTrueWidthIn}" true width — loading the approximate block layout anyway.`,
        );
      }
      if (r.trueTop < 0 || r.trueTop + r.trueDepth > roomTrueDepthIn) {
        console.warn(
          `[room:${roomId}] '${r.boxId}' is ${r.trueDepth}" deep but doesn't fit at its placed offset within the room's ${roomTrueDepthIn}" true depth — loading the approximate block layout anyway.`,
        );
      }
    }
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i];
        const b = resolved[j];
        const overlapX = a.trueLeft < b.trueLeft + b.trueWidth && b.trueLeft < a.trueLeft + a.trueWidth;
        const overlapY = a.trueTop < b.trueTop + b.trueDepth && b.trueTop < a.trueTop + a.trueDepth;
        if (overlapX && overlapY) {
          console.warn(
            `[room:${roomId}] '${a.boxId}' and '${b.boxId}' overlap at their true dimensions — loading the approximate block layout anyway.`,
          );
        }
      }
    }
  }

  // Clamp block rectangles to the interior so nothing can index outside the
  // tile grid, even when the true dimensions above didn't actually fit.
  return resolved.map((r) => {
    const widthBlocks = Math.min(r.widthBlocks, interiorWidthBlocks);
    const depthBlocks = Math.min(r.depthBlocks, interiorDepthBlocks);
    const blockX = Math.max(0, Math.min(r.blockX, interiorWidthBlocks - widthBlocks));
    const blockY = Math.max(0, Math.min(r.blockY, interiorDepthBlocks - depthBlocks));
    return {
      boxId: r.boxId,
      x: 1 + blockX,
      y: 1 + blockY,
      widthBlocks,
      depthBlocks,
    };
  });
}

function parseRoom(data: RoomJson): Room {
  let legend = data.legend;
  let grid = data.grid;
  let realSize: Dimension | undefined;

  if (data.size) {
    const interiorBlocks = blocksForDimension(data.size);
    const generated = generateSquareRoom(interiorBlocks, data.doorSide ?? "bottom");
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

  const boxes = resolvePlacements(data.id, data.boxes ?? [], width, height, realSize);

  return {
    id: data.id,
    name: data.name,
    width,
    height,
    tiles,
    spawn: data.spawn,
    boxes,
    realSize,
    worldOrigin: data.worldOrigin ?? { x: 0, y: 0 },
    doorSide: data.doorSide,
    doorTo: data.doorTo,
  };
}

export function getBoxAt(room: Room, x: number, y: number): BoxPlacement | null {
  return (
    room.boxes.find(
      (b) => x >= b.x && x < b.x + b.widthBlocks && y >= b.y && y < b.y + b.depthBlocks,
    ) ?? null
  );
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

const allRoomsList: Room[] = Object.values(rooms);

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The union of every room's footprint in world-space blocks. Used to clamp the camera. */
export function worldBounds(): WorldBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of allRoomsList) {
    minX = Math.min(minX, r.worldOrigin.x);
    minY = Math.min(minY, r.worldOrigin.y);
    maxX = Math.max(maxX, r.worldOrigin.x + r.width);
    maxY = Math.max(maxY, r.worldOrigin.y + r.height);
  }
  return { minX, minY, maxX, maxY };
}

/** Which room (if any) occupies a world-space block, and the equivalent room-local coords. */
export function findRoomContainingWorldPoint(
  wx: number,
  wy: number,
): { room: Room; lx: number; ly: number } | null {
  for (const r of allRoomsList) {
    const lx = wx - r.worldOrigin.x;
    const ly = wy - r.worldOrigin.y;
    if (lx >= 0 && ly >= 0 && lx < r.width && ly < r.height) return { room: r, lx, ly };
  }
  return null;
}

export function isWalkableWorld(wx: number, wy: number): boolean {
  const hit = findRoomContainingWorldPoint(wx, wy);
  return hit !== null && isWalkable(hit.room, hit.lx, hit.ly);
}

function findDoorTileLocal(room: Room): { x: number; y: number } | null {
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      if (room.tiles[y][x] === "door") return { x, y };
    }
  }
  return null;
}

const INWARD_FROM_WALL: Record<DoorSide, { dx: number; dy: number }> = {
  top: { dx: 0, dy: 1 },
  bottom: { dx: 0, dy: -1 },
  left: { dx: 1, dy: 0 },
  right: { dx: -1, dy: 0 },
};

/**
 * World-space block a player should land on when entering `room` through its
 * door — the door tile itself, stepped one block inward from its wall.
 */
export function entryPointForRoom(room: Room): { x: number; y: number } | null {
  const doorLocal = findDoorTileLocal(room);
  if (!doorLocal) return null;
  const inward = INWARD_FROM_WALL[room.doorSide ?? "bottom"];
  return {
    x: room.worldOrigin.x + doorLocal.x + inward.dx,
    y: room.worldOrigin.y + doorLocal.y + inward.dy,
  };
}
