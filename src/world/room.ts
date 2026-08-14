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

/** Where a door leads: a specific door (by id) on a specific other room. */
export interface DoorTarget {
  room: string;
  door: string;
}

/** A resolved door: a grid position that teleports the player when walked onto. */
export interface Door {
  /** Unique within this room; referenced by other rooms' doors as a landing point. */
  id: string;
  x: number;
  y: number;
  /** Room + door id on the other side. Omitted for a stub door (e.g. an unmodeled exterior exit) that doesn't teleport. */
  to?: DoorTarget;
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
   * rooms that are otherwise drawn as disconnected — see `doors` below.
   */
  worldOrigin: { x: number; y: number };
  /** This room's doors — see `Door`. A room can have any number, including zero. */
  doors: Door[];
  /**
   * Box ids known to be in this room but not yet given a placement (size
   * and/or exact position). Pure capture for now — not rendered on the grid
   * or interactable in-game, just validated at load time.
   */
  unplaced: string[];
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

/**
 * A door on a `size`-generated square room: placed at the middle of the
 * given wall. For hand-authored `grid` rooms, use `x`/`y` instead — the
 * room's exact layout is already known, so there's no wall to compute a
 * midpoint from.
 */
export interface DoorJson {
  id: string;
  side?: DoorSide;
  x?: number;
  y?: number;
  /** Room + door id on the other side. Omit for a stub door that doesn't teleport (e.g. an unmodeled exterior exit). */
  to?: DoorTarget;
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
  /** This room's top-left corner in world-space blocks. Defaults to {0,0}. */
  worldOrigin?: { x: number; y: number };
  legend?: Record<string, TileKind>;
  grid?: string[];
  spawn: { x: number; y: number };
  boxes?: BoxPlacementJson[];
  /** This room's doors — see `DoorJson`. */
  doors?: DoorJson[];
  /**
   * Box ids known to be in this room but not yet given a placement (size
   * and/or exact position). Pure capture for now — see `Room.unplaced`.
   */
  unplaced?: string[];
}

/**
 * Places one door per requested side at the middle of that side (throws if
 * two doors share a side — hand-author a `grid` instead if that's needed).
 * Returns the grid/legend plus each door's resolved (x, y).
 */
function generateSquareRoom(
  roomId: string,
  interiorBlocks: number,
  doorSpecs: { id: string; side: DoorSide }[],
): { legend: Record<string, TileKind>; grid: string[]; positions: Record<string, { x: number; y: number }> } {
  // The measured size is the interior (floor) footprint; a one-block wall
  // ring goes around it, so a 16'0" / 6-block interior is 8 blocks total.
  const blocks = interiorBlocks + 2;
  const legend: Record<string, TileKind> = { "#": "wall", ".": "floor", D: "door" };
  const mid = Math.floor(blocks / 2);

  const positions: Record<string, { x: number; y: number }> = {};
  const bySide = new Map<DoorSide, string>();
  for (const spec of doorSpecs) {
    if (bySide.has(spec.side)) {
      throw new Error(
        `Room ${roomId}: doors '${bySide.get(spec.side)}' and '${spec.id}' both sit on the "${spec.side}" wall — a size-generated room only fits one door per wall (hand-author a 'grid' for more).`,
      );
    }
    bySide.set(spec.side, spec.id);
    const pos =
      spec.side === "top"
        ? { x: mid, y: 0 }
        : spec.side === "bottom"
          ? { x: mid, y: blocks - 1 }
          : spec.side === "left"
            ? { x: 0, y: mid }
            : { x: blocks - 1, y: mid };
    positions[spec.id] = pos;
  }

  const grid: string[] = [];
  for (let y = 0; y < blocks; y++) {
    let row = "";
    for (let x = 0; x < blocks; x++) {
      const border = x === 0 || y === 0 || x === blocks - 1 || y === blocks - 1;
      const isDoor = doorSpecs.some((s) => positions[s.id].x === x && positions[s.id].y === y);
      row += isDoor ? "D" : border ? "#" : ".";
    }
    grid.push(row);
  }
  return { legend, grid, positions };
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
  const doorsJson = data.doors ?? [];
  let sizeGeneratedPositions: Record<string, { x: number; y: number }> = {};

  if (data.size) {
    const interiorBlocks = blocksForDimension(data.size);
    for (const d of doorsJson) {
      if (!d.side) {
        throw new Error(`Room ${data.id}: door '${d.id}' needs a 'side' (size-generated rooms can't take explicit x/y)`);
      }
    }
    const generated = generateSquareRoom(
      data.id,
      interiorBlocks,
      doorsJson.map((d) => ({ id: d.id, side: d.side as DoorSide })),
    );
    legend = generated.legend;
    grid = generated.grid;
    sizeGeneratedPositions = generated.positions;
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

  const seenDoorIds = new Set<string>();
  const doors: Door[] = doorsJson.map((d) => {
    if (seenDoorIds.has(d.id)) {
      throw new Error(`Room ${data.id}: duplicate door id '${d.id}'`);
    }
    seenDoorIds.add(d.id);

    const pos = data.size ? sizeGeneratedPositions[d.id] : { x: d.x, y: d.y };
    if (pos.x === undefined || pos.y === undefined) {
      throw new Error(`Room ${data.id}: door '${d.id}' needs explicit 'x'/'y' (hand-authored 'grid' rooms can't derive a position from 'side')`);
    }
    if (pos.x < 0 || pos.y < 0 || pos.x >= width || pos.y >= height || tiles[pos.y][pos.x] !== "door") {
      throw new Error(`Room ${data.id}: door '${d.id}' at (${pos.x},${pos.y}) isn't a 'door' tile in the grid`);
    }
    return { id: d.id, x: pos.x, y: pos.y, to: d.to };
  });

  const boxes = resolvePlacements(data.id, data.boxes ?? [], width, height, realSize);

  const unplaced = data.unplaced ?? [];
  for (const boxId of unplaced) {
    getBox(boxId); // throws if missing
  }

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
    doors,
    unplaced,
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

export function getDoor(room: Room, doorId: string): Door | null {
  return room.doors.find((d) => d.id === doorId) ?? null;
}

export function getDoorAt(room: Room, x: number, y: number): Door | null {
  return room.doors.find((d) => d.x === x && d.y === y) ?? null;
}

/** World-space block a player should land on when entering `room` through its door `doorId`. */
export function entryPointForDoor(room: Room, doorId: string): { x: number; y: number } | null {
  const door = getDoor(room, doorId);
  if (!door) return null;
  return { x: room.worldOrigin.x + door.x, y: room.worldOrigin.y + door.y };
}

// Cross-room validation: every door's `to` must reference a real room and a
// real door on it. Deferred until every room has parsed (a room's doors can
// reference rooms that parse later in iteration order).
for (const room of allRoomsList) {
  for (const door of room.doors) {
    if (!door.to) continue;
    const target = rooms[door.to.room];
    if (!target) {
      throw new Error(`Room ${room.id}: door '${door.id}' leads to unknown room '${door.to.room}'`);
    }
    if (!getDoor(target, door.to.door)) {
      throw new Error(
        `Room ${room.id}: door '${door.id}' leads to '${door.to.room}'/'${door.to.door}', which has no door with that id`,
      );
    }
  }
}
