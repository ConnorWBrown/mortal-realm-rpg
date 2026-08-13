/**
 * Real-world room measurements, converted to grid blocks for display.
 *
 * Rooms are approximated on a coarse grid: each block represents
 * FEET_PER_BLOCK feet of real-world space. A room's block count is its
 * real-world side length rounded UP to the next whole block, so a 16'0"
 * wall (16 * 12 = 192 inches) becomes ceil(192 / 36) = 6 blocks.
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

/** Blocks needed to cover `totalInches`, rounded up, minimum 1. */
export function blocksForInches(totalInches: number): number {
  return Math.max(1, Math.ceil(totalInches / INCHES_PER_BLOCK));
}

export function blocksForDimension(d: Dimension): number {
  return blocksForInches(toInches(d));
}

/** e.g. { feet: 16, inches: 0 } -> `16'0"` */
export function formatDimension(d: Dimension): string {
  return `${d.feet}'${d.inches}"`;
}
