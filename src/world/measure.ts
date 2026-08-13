/**
 * Real-world measurements, converted to grid blocks for display.
 *
 * Two different rounding rules are used, deliberately:
 *  - Room/wall sizes round UP (`blocksForInches` / `blocksForDimension`), so
 *    the generated room is never smaller than reality.
 *  - Object footprints round DOWN, with a 1-block minimum
 *    (`blocksForInchesFloor` / `blocksForDimensionFloor`), so a set of
 *    objects that truly fits against a wall is less likely to visually
 *    overflow the rounded blocks.
 *
 * Neither rounding direction is a correctness guarantee on its own — e.g.
 * two 5ft objects floor to 1 block each against a 6ft (2-block) wall and
 * "fit" by block math while genuinely overflowing in reality. Anything that
 * needs to know whether a placement *actually* fits should compare true
 * inches (via `toInches`), not block counts. See `src/world/room.ts` for
 * where that validation happens.
 */

export const FEET_PER_BLOCK = 3;
export const INCHES_PER_FOOT = 12;
export const INCHES_PER_BLOCK = FEET_PER_BLOCK * INCHES_PER_FOOT;

/** A real-world length: whole feet plus a remainder in inches (0-11). */
export interface Dimension {
  feet: number;
  inches: number;
}

export function toInches(d: Dimension): number {
  return d.feet * INCHES_PER_FOOT + d.inches;
}

/** Blocks needed to cover `totalInches`, rounded up, minimum 1. Used for room/wall sizing. */
export function blocksForInches(totalInches: number): number {
  return Math.max(1, Math.ceil(totalInches / INCHES_PER_BLOCK));
}

export function blocksForDimension(d: Dimension): number {
  return blocksForInches(toInches(d));
}

/** Blocks needed to approximate `totalInches` without overstating it, rounded down, minimum 1. Used for object footprints. */
export function blocksForInchesFloor(totalInches: number): number {
  return Math.max(1, Math.floor(totalInches / INCHES_PER_BLOCK));
}

export function blocksForDimensionFloor(d: Dimension): number {
  return blocksForInchesFloor(toInches(d));
}

/** e.g. { feet: 16, inches: 0 } -> `16'0"` */
export function formatDimension(d: Dimension): string {
  return `${d.feet}'${d.inches}"`;
}
