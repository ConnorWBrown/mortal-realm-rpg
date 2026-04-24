import type { Direction } from "../game/input";
import type { ActiveEffect } from "./effect";

export interface InventoryItem {
  id: string;
  label: string;
  count?: number;
}

export type QuestState = "active" | "complete";

export interface Quest {
  id: string;
  label: string;
  state: QuestState;
  detail?: string;
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
  };
}

export function isMoving(p: Player): boolean {
  return p.moveProgress < 1;
}
