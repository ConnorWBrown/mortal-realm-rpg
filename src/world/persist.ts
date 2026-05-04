import type { InventoryItem, Player } from "./player";
import type { Direction } from "../game/input";
import { effects, type ActiveEffect } from "./effect";
import { ensureDefaultQuest, mergeWithSeeds, type Quest } from "./quest";

const STORAGE_KEY = "mortal-realm:player:v1";

interface PersistedPlayer {
  x: number;
  y: number;
  facing: Direction;
  activeEffects: ActiveEffect[];
  inventory?: InventoryItem[];
  quests?: Quest[];
  now?: string;
}

export function loadPlayer(): PersistedPlayer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedPlayer;
    if (typeof data.x !== "number" || typeof data.y !== "number") return null;
    // Drop any active effects whose definition no longer exists.
    data.activeEffects = (data.activeEffects ?? []).filter((a) => !!effects[a.effectId]);
    data.inventory = Array.isArray(data.inventory) ? data.inventory : [];
    data.quests = ensureDefaultQuest(mergeWithSeeds(Array.isArray(data.quests) ? data.quests : []));
    data.now = typeof data.now === "string" ? data.now : "";
    return data;
  } catch {
    return null;
  }
}

export function savePlayer(p: Player) {
  const data: PersistedPlayer = {
    x: p.x,
    y: p.y,
    facing: p.facing,
    activeEffects: p.activeEffects,
    inventory: p.inventory,
    quests: p.quests,
    now: p.now,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota or disabled storage — ignore.
  }
}

export function applyPersisted(p: Player, saved: PersistedPlayer) {
  p.x = saved.x;
  p.y = saved.y;
  p.facing = saved.facing;
  p.moveFrom = { x: saved.x, y: saved.y };
  p.moveProgress = 1;
  p.activeEffects = saved.activeEffects;
  p.inventory = saved.inventory ?? [];
  p.quests = saved.quests ?? [];
  p.now = saved.now ?? "";
}
