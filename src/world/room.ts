import { getBox, type Box } from "./box";
import { blocksForDimensionFloor, toInches, INCHES_PER_BLOCK, type Dimension } from "./measure";

export type TileKind = "floor" | "wall" | "door";
export type Wall = "top" | "bottom" | "left" | "right";
export type DoorSide = Wall;

/** A real-world rectangle: width along x, depth along y. */
export interface RectSize {
  width: Dimension;
  depth: Dimension;
}

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
  /** Real-world size this room was generated from, if it has exactly one lobe. See `size`/`lobes` below. */
  realSize?: RectSize;
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
 * room (or of `lobe`, for a multi-lobe room). `offset: {feet: 0, inches: 0}`
 * means flush against that wall.
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
  /** Which lobe's walls `x`/`y` are relative to. Required when the room has more than one lobe; defaults to the sole lobe otherwise. */
  lobe?: string;
}

/**
 * A door on a `size`/`lobes`-generated room: placed at the middle of the
 * given wall of the given lobe. For hand-authored `grid` rooms, use `x`/`y`
 * instead — the room's exact layout is already known, so there's no wall to
 * compute a midpoint from.
 */
export interface DoorJson {
  id: string;
  side?: DoorSide;
  /** Which lobe `side` is relative to. Required when the room has more than one lobe; defaults to the sole lobe otherwise. */
  lobe?: string;
  x?: number;
  y?: number;
  /** Room + door id on the other side. Omit for a stub door that doesn't teleport (e.g. an unmodeled exterior exit). */
  to?: DoorTarget;
}

/**
 * One real-world rectangle in a `lobes`-authored room. Several lobes union
 * together into one (possibly non-rectangular) room — e.g. a main rectangle
 * plus a smaller closet nook — each rounded outward to blocks independently
 * and never smaller than reality, same as `size` (see src/world/measure.ts).
 */
export interface LobeJson {
  id: string;
  size: RectSize;
  /** This lobe's top-left corner, real-world, relative to the room's shared origin. Defaults to {0,0} — exactly one lobe should normally anchor there; give every other lobe an explicit offset from it. */
  at?: { x: Dimension; y: Dimension };
}

interface RoomJson {
  id: string;
  name: string;
  /**
   * Real-world size of the room's INTERIOR (floor area only — walls are
   * added on top of this, not counted in it). Shorthand for a single-lobe
   * `lobes: [{ id: "main", size }]` — see `lobes` below for non-rectangular
   * rooms. Mutually exclusive with `lobes` and with `grid`/`legend`.
   */
  size?: RectSize;
  /**
   * Real-world rectangles that union together into this room's floor plan —
   * use this instead of `size` for a non-rectangular room (an L-shape, a
   * rectangle with a nook, etc). See `LobeJson`. Mutually exclusive with
   * `size` and with `grid`/`legend`.
   */
  lobes?: LobeJson[];
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

/** A lobe, resolved to both its true (inches) rectangle and its block-grid rectangle within the room's shared grid. */
interface ResolvedLobe {
  id: string;
  /** True (real-world, inches) rectangle, in room-space (already includes this lobe's `at` offset). */
  trueLeft: number;
  trueTop: number;
  trueWidth: number;
  trueDepth: number;
  /** Block-grid rectangle (outward-rounded from the true rectangle, then translated into the room's shared, padded grid). */
  blockX: number;
  blockY: number;
  blockWidth: number;
  blockHeight: number;
}

interface ResolvedLobes {
  list: ResolvedLobe[];
  /** Shared room-wide translation from an un-padded true-inches-derived block coordinate into this room's grid space. */
  blockOffset: { x: number; y: number };
}

/**
 * Unions each lobe's outward-rounded (never-smaller-than-reality) block
 * rectangle into one room grid, padded by a one-block wall ring around the
 * tightest bounding box of the whole union. Any grid cell not covered by a
 * lobe's floor becomes wall — including "notch" cells inside the bounding
 * box but outside the union (e.g. the missing corner of an L-shape), same
 * as a hand-drawn grid would fill them.
 *
 * Each door is placed at the middle of its lobe's requested wall side; if
 * that position isn't actually an exterior wall in the unioned grid (e.g.
 * another lobe covers that side, or extends past it), this throws — pick a
 * different side, or hand-author a `grid` for finer control.
 */
function generateLobedRoom(
  roomId: string,
  lobeInputs: { id: string; trueLeft: number; trueTop: number; trueWidth: number; trueDepth: number }[],
  doorSpecs: { id: string; lobe: string; side: DoorSide }[],
): {
  legend: Record<string, TileKind>;
  grid: string[];
  positions: Record<string, { x: number; y: number }>;
  lobes: ResolvedLobes;
} {
  if (lobeInputs.length === 0) {
    throw new Error(`Room ${roomId}: needs at least one lobe`);
  }

  const spans = lobeInputs.map((l) => ({
    id: l.id,
    trueLeft: l.trueLeft,
    trueTop: l.trueTop,
    trueWidth: l.trueWidth,
    trueDepth: l.trueDepth,
    bx0: Math.floor(l.trueLeft / INCHES_PER_BLOCK),
    by0: Math.floor(l.trueTop / INCHES_PER_BLOCK),
    bx1: Math.ceil((l.trueLeft + l.trueWidth) / INCHES_PER_BLOCK),
    by1: Math.ceil((l.trueTop + l.trueDepth) / INCHES_PER_BLOCK),
  }));

  const minBX = Math.min(...spans.map((s) => s.bx0));
  const minBY = Math.min(...spans.map((s) => s.by0));
  const maxBX = Math.max(...spans.map((s) => s.bx1));
  const maxBY = Math.max(...spans.map((s) => s.by1));

  // One-block wall-ring margin around the tightest bounding box of the whole union.
  const blockOffset = { x: 1 - minBX, y: 1 - minBY };
  const width = maxBX - minBX + 2;
  const height = maxBY - minBY + 2;

  const lobes: ResolvedLobe[] = spans.map((s) => ({
    id: s.id,
    trueLeft: s.trueLeft,
    trueTop: s.trueTop,
    trueWidth: s.trueWidth,
    trueDepth: s.trueDepth,
    blockX: s.bx0 + blockOffset.x,
    blockY: s.by0 + blockOffset.y,
    blockWidth: s.bx1 - s.bx0,
    blockHeight: s.by1 - s.by0,
  }));
  const lobeById = new Map(lobes.map((l) => [l.id, l]));

  const floor = new Set<string>();
  for (const l of lobes) {
    for (let y = l.blockY; y < l.blockY + l.blockHeight; y++) {
      for (let x = l.blockX; x < l.blockX + l.blockWidth; x++) {
        floor.add(`${x},${y}`);
      }
    }
  }

  const legend: Record<string, TileKind> = { "#": "wall", ".": "floor", D: "door" };
  const gridRows: string[][] = [];
  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      row.push(floor.has(`${x},${y}`) ? "." : "#");
    }
    gridRows.push(row);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const spec of doorSpecs) {
    const lobe = lobeById.get(spec.lobe);
    if (!lobe) throw new Error(`Room ${roomId}: door '${spec.id}' references unknown lobe '${spec.lobe}'`);
    const midX = lobe.blockX + Math.floor(lobe.blockWidth / 2);
    const midY = lobe.blockY + Math.floor(lobe.blockHeight / 2);
    const pos =
      spec.side === "top"
        ? { x: midX, y: lobe.blockY - 1 }
        : spec.side === "bottom"
          ? { x: midX, y: lobe.blockY + lobe.blockHeight }
          : spec.side === "left"
            ? { x: lobe.blockX - 1, y: midY }
            : { x: lobe.blockX + lobe.blockWidth, y: midY };

    if (pos.x < 0 || pos.y < 0 || pos.x >= width || pos.y >= height || gridRows[pos.y][pos.x] !== "#") {
      throw new Error(
        `Room ${roomId}: door '${spec.id}' (lobe '${spec.lobe}', side "${spec.side}") doesn't land on an exterior wall — check for lobe overlap/adjacency on that side, or pick a different side (or hand-author a 'grid' for finer control)`,
      );
    }
    gridRows[pos.y][pos.x] = "D";
    positions[spec.id] = pos;
  }

  return {
    legend,
    grid: gridRows.map((r) => r.join("")),
    positions,
    lobes: { list: lobes, blockOffset },
  };
}

interface ResolvedFootprint {
  boxId: string;
  lobeId: string | undefined;
  /** True (real-world, inches) rectangle, in room-space — the source of truth for "does this actually fit". */
  trueLeft: number;
  trueTop: number;
  trueWidth: number;
  trueDepth: number;
  /** Block-grid rectangle (approximate, un-translated — see `ResolvedLobes.blockOffset`). */
  blockXRaw: number;
  blockYRaw: number;
  widthBlocks: number;
  depthBlocks: number;
}

/**
 * Converts each `fromWall`+`offset`-authored placement into both a true
 * (inches) rectangle, in room-space, and a block-grid rectangle, then
 * validates the true rectangles: does each box actually fit inside its lobe,
 * and do any two boxes actually overlap? Violations are logged as warnings,
 * never thrown — the room still loads and renders the (approximate) block
 * rectangles regardless. See src/world/measure.ts for why block counts alone
 * can't be trusted for this check.
 *
 * A room with no lobes (a hand-drawn `grid` without `size`/`lobes`) falls
 * back to the legacy behavior: only `fromWall: "left"/"top"` is allowed (no
 * room size to measure "right"/"bottom" from), and there's no fit/overlap
 * validation — just block placement, assuming a one-block wall ring.
 */
function resolvePlacements(
  roomId: string,
  raw: BoxPlacementJson[],
  gridWidth: number,
  gridHeight: number,
  lobes: ResolvedLobes | undefined,
): BoxPlacement[] {
  const lobeById = new Map((lobes?.list ?? []).map((l) => [l.id, l]));
  const singleLobeId = lobes && lobes.list.length === 1 ? lobes.list[0].id : undefined;
  const blockOffset = lobes ? lobes.blockOffset : { x: 1, y: 1 };
  const fallbackInteriorWidth = gridWidth - 2;
  const fallbackInteriorHeight = gridHeight - 2;

  const resolved: ResolvedFootprint[] = raw.map((p) => {
    const box = getBox(p.boxId); // throws if missing
    if (!box.size) {
      throw new Error(`Room ${roomId}: box '${p.boxId}' has no 'size' (width/depth) and can't be placed`);
    }
    if (p.x.fromWall !== "left" && p.x.fromWall !== "right") {
      throw new Error(`Room ${roomId}: box '${p.boxId}' x.fromWall must be "left" or "right"`);
    }
    if (p.y.fromWall !== "top" && p.y.fromWall !== "bottom") {
      throw new Error(`Room ${roomId}: box '${p.boxId}' y.fromWall must be "top" or "bottom"`);
    }

    const lobeId = p.lobe ?? singleLobeId;
    const lobe = lobeId ? lobeById.get(lobeId) : undefined;
    if (lobes && lobes.list.length > 1 && !lobe) {
      throw new Error(`Room ${roomId}: box '${p.boxId}' needs a 'lobe' (room has more than one)`);
    }
    if (!lobe && (p.x.fromWall === "right" || p.y.fromWall === "bottom")) {
      throw new Error(
        `Room ${roomId}: box '${p.boxId}' is offset from the ${p.x.fromWall === "right" ? "right" : "bottom"} wall, which requires the room to declare a real-world 'size'/'lobes'`,
      );
    }

    const trueWidth = toInches(box.size.width);
    const trueDepth = toInches(box.size.depth);
    const widthBlocks = blocksForDimensionFloor(box.size.width);
    const depthBlocks = blocksForDimensionFloor(box.size.depth);

    const offsetX = toInches(p.x.offset);
    const offsetY = toInches(p.y.offset);
    const localLeft = p.x.fromWall === "left" ? offsetX : (lobe as ResolvedLobe).trueWidth - offsetX - trueWidth;
    const localTop = p.y.fromWall === "top" ? offsetY : (lobe as ResolvedLobe).trueDepth - offsetY - trueDepth;
    const trueLeft = (lobe?.trueLeft ?? 0) + localLeft;
    const trueTop = (lobe?.trueTop ?? 0) + localTop;

    return {
      boxId: p.boxId,
      lobeId: lobe?.id,
      trueLeft,
      trueTop,
      trueWidth,
      trueDepth,
      blockXRaw: Math.floor(trueLeft / INCHES_PER_BLOCK),
      blockYRaw: Math.floor(trueTop / INCHES_PER_BLOCK),
      widthBlocks,
      depthBlocks,
    };
  });

  // True-dimension fit check — only meaningful for a box placed in a known lobe.
  for (const r of resolved) {
    const lobe = r.lobeId ? lobeById.get(r.lobeId) : undefined;
    if (!lobe) continue;
    const localLeft = r.trueLeft - lobe.trueLeft;
    const localTop = r.trueTop - lobe.trueTop;
    if (localLeft < 0 || localLeft + r.trueWidth > lobe.trueWidth) {
      console.warn(
        `[room:${roomId}] '${r.boxId}' is ${r.trueWidth}" wide but doesn't fit at its placed offset within lobe '${lobe.id}'s ${lobe.trueWidth}" true width — loading the approximate block layout anyway.`,
      );
    }
    if (localTop < 0 || localTop + r.trueDepth > lobe.trueDepth) {
      console.warn(
        `[room:${roomId}] '${r.boxId}' is ${r.trueDepth}" deep but doesn't fit at its placed offset within lobe '${lobe.id}'s ${lobe.trueDepth}" true depth — loading the approximate block layout anyway.`,
      );
    }
  }
  // True-dimension overlap check — meaningful room-wide regardless of lobe.
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

  // Translate into grid space and clamp to the owning lobe (or, with no
  // lobe, the whole grid's interior) so nothing can index outside the tiles
  // array, even when the true dimensions above didn't actually fit.
  return resolved.map((r) => {
    const lobe = r.lobeId ? lobeById.get(r.lobeId) : undefined;
    const boundX = lobe ? lobe.blockX : 1;
    const boundY = lobe ? lobe.blockY : 1;
    const boundWidth = lobe ? lobe.blockWidth : fallbackInteriorWidth;
    const boundHeight = lobe ? lobe.blockHeight : fallbackInteriorHeight;

    const widthBlocks = Math.min(r.widthBlocks, boundWidth);
    const depthBlocks = Math.min(r.depthBlocks, boundHeight);
    const translatedX = r.blockXRaw + blockOffset.x;
    const translatedY = r.blockYRaw + blockOffset.y;
    const blockX = Math.max(boundX, Math.min(translatedX, boundX + boundWidth - widthBlocks));
    const blockY = Math.max(boundY, Math.min(translatedY, boundY + boundHeight - depthBlocks));
    return { boxId: r.boxId, x: blockX, y: blockY, widthBlocks, depthBlocks };
  });
}

function parseRoom(data: RoomJson): Room {
  let legend = data.legend;
  let grid = data.grid;
  let realSize: RectSize | undefined;
  const doorsJson = data.doors ?? [];
  let generatedPositions: Record<string, { x: number; y: number }> = {};
  let resolvedLobes: ResolvedLobes | undefined;

  if (data.size && data.lobes) {
    throw new Error(`Room ${data.id}: specify either 'size' or 'lobes', not both`);
  }
  const lobeSpecsJson: LobeJson[] | undefined = data.size ? [{ id: "main", size: data.size }] : data.lobes;

  if (lobeSpecsJson) {
    const lobeIds = new Set<string>();
    const lobeInputs = lobeSpecsJson.map((l) => {
      if (lobeIds.has(l.id)) throw new Error(`Room ${data.id}: duplicate lobe id '${l.id}'`);
      lobeIds.add(l.id);
      return {
        id: l.id,
        trueLeft: l.at ? toInches(l.at.x) : 0,
        trueTop: l.at ? toInches(l.at.y) : 0,
        trueWidth: toInches(l.size.width),
        trueDepth: toInches(l.size.depth),
      };
    });
    const singleLobeId = lobeInputs.length === 1 ? lobeInputs[0].id : undefined;

    const seenDoorSides = new Set<string>();
    const doorSpecs = doorsJson.map((d) => {
      if (!d.side) {
        throw new Error(`Room ${data.id}: door '${d.id}' needs a 'side' ('size'/'lobes' rooms can't take explicit x/y)`);
      }
      const lobeId = d.lobe ?? singleLobeId;
      if (!lobeId) {
        throw new Error(`Room ${data.id}: door '${d.id}' needs a 'lobe' (room has more than one)`);
      }
      const key = `${lobeId}|${d.side}`;
      if (seenDoorSides.has(key)) {
        throw new Error(
          `Room ${data.id}: more than one door on lobe '${lobeId}' side "${d.side}" — a generated room only fits one door per wall per lobe (hand-author a 'grid' for more)`,
        );
      }
      seenDoorSides.add(key);
      return { id: d.id, lobe: lobeId, side: d.side as DoorSide };
    });

    const generated = generateLobedRoom(data.id, lobeInputs, doorSpecs);
    legend = generated.legend;
    grid = generated.grid;
    generatedPositions = generated.positions;
    resolvedLobes = generated.lobes;
    if (lobeInputs.length === 1) {
      realSize = lobeSpecsJson[0].size;
    }
  }

  if (!grid || !legend) {
    throw new Error(`Room ${data.id}: must specify 'size', 'lobes', or both 'grid' and 'legend'`);
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

    const pos = resolvedLobes ? generatedPositions[d.id] : { x: d.x, y: d.y };
    if (pos.x === undefined || pos.y === undefined) {
      throw new Error(`Room ${data.id}: door '${d.id}' needs explicit 'x'/'y' (hand-authored 'grid' rooms can't derive a position from 'side')`);
    }
    if (pos.x < 0 || pos.y < 0 || pos.x >= width || pos.y >= height || tiles[pos.y][pos.x] !== "door") {
      throw new Error(`Room ${data.id}: door '${d.id}' at (${pos.x},${pos.y}) isn't a 'door' tile in the grid`);
    }
    return { id: d.id, x: pos.x, y: pos.y, to: d.to };
  });

  const boxes = resolvePlacements(data.id, data.boxes ?? [], width, height, resolvedLobes);

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
