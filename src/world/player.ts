import type { Direction } from "../game/input";
import type { ActiveEffect } from "./effect";
import type { Quest } from "./quest";

export type { Quest } from "./quest";

export interface InventoryItem {
  id: string;
  label: string;
  count?: number;
}

export interface Player {
  x: number;
  y: number;
  facing: Direction;
  /** Tween state when moving between tiles (0..1). 0 = at (x,y), 1 = move complete. */
  moveProgress: number;
  moveFrom: { x: number; y: number };
  activeEffects: ActiveEffect[];
  inventory: InventoryItem[];
  quests: Quest[];
  /** Free-text "Now" field shown top-left. Populated by selecting a task/quest or typed directly. */
  now: string;
}

export function createPlayer(spawn: { x: number; y: number }): Player {
  return {
    x: spawn.x,
    y: spawn.y,
    facing: "down",
    moveProgress: 1,
    moveFrom: { ...spawn },
    activeEffects: [],
    inventory: [],
    quests: [],
    now: "",
  };
}

export function isMoving(p: Player): boolean {
  return p.moveProgress < 1;
}
