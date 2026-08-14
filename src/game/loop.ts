import { createInput, type Direction, type InputState } from "./input";
import { createView, clear } from "../render/canvas";
import { BG_COLOR, computeCamera, renderRoom, renderBoxes, renderPlayer } from "../render/tiles";
import { renderEffectHUD, renderRoomLabels } from "../render/hud";
import { loadAssets, type Assets } from "../render/assets";
import {
  rooms,
  isWalkable,
  isWalkableWorld,
  findRoomContainingWorldPoint,
  getDoorAt,
  entryPointForDoor,
  worldBounds,
  getBoxAt,
  resolveBox,
  visibleRooms,
} from "../world/room";
import { createPlayer, isMoving, type Player } from "../world/player";
import { applyEffect, getEffect, removeEffectAt } from "../world/effect";
import { applyPersisted, loadPlayer, savePlayer } from "../world/persist";
import {
  addTaskToDefault,
  ensureDefaultQuest,
  findQuest,
  mergeWithSeeds,
  toggleQuestActive,
} from "../world/quest";
import {
  createMenuStack,
  isMenuOpen,
  openBoxMenu,
  renderMenu,
  updateMenu,
  type MenuHandlers,
  type MenuStack,
} from "../ui/menu";
import {
  createSidebar,
  renderSidebar,
  sidebarClick,
  toggleTab,
  type Sidebar,
} from "../ui/sidebar";
import { bindNowBox, type NowBox } from "../ui/now";

const MOVE_DURATION_MS = 140;
const DIR_VEC: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export interface Game {
  input: InputState;
  start(): void;
}

export function createGame(canvas: HTMLCanvasElement): Game {
  const input = createInput();
  const view = createView(canvas);
  const bounds = worldBounds();
  const homeRoom = rooms["eugene-livingroom"];
  const spawn = {
    x: homeRoom.worldOrigin.x + homeRoom.spawn.x,
    y: homeRoom.worldOrigin.y + homeRoom.spawn.y,
  };
  const player: Player = createPlayer(spawn);
  const saved = loadPlayer();
  if (saved && isWalkableWorld(saved.x, saved.y)) {
    applyPersisted(player, saved);
  }
  // Seed quests (merges any newly-added seed JSON files; always keeps a Default quest).
  player.quests = ensureDefaultQuest(mergeWithSeeds(player.quests));

  const menus: MenuStack = createMenuStack();
  const sidebar: Sidebar = createSidebar();
  let assets: Assets | null = null;

  const nowBox: NowBox = bindNowBox({
    initialText: player.now,
    onChange(text) {
      player.now = text;
      savePlayer(player);
    },
    onSubmit(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      player.quests = addTaskToDefault(player.quests, trimmed);
      player.now = trimmed;
      nowBox.setText(trimmed);
      savePlayer(player);
    },
  });

  loadAssets().then((loaded) => {
    assets = loaded;
  }).catch((err) => {
    console.error("Asset load failed, continuing with placeholders", err);
  });

  const handlers: MenuHandlers = {
    applyPotion(effectId, detail) {
      const effect = getEffect(effectId);
      player.activeEffects = applyEffect(player.activeEffects, effect, detail);
      savePlayer(player);
    },
    getActiveEffects() {
      return player.activeEffects;
    },
    dismissEffectAt(index) {
      player.activeEffects = removeEffectAt(player.activeEffects, index);
      savePlayer(player);
    },
  };

  let last = performance.now();
  let moveElapsed = 0;

  function tick(now: number) {
    const dt = Math.min(100, now - last);
    last = now;
    update(dt);
    render();
    input._endFrame();
    requestAnimationFrame(tick);
  }

  function update(dt: number) {
    // Sidebar clicks take priority over world input when no modal menu is open.
    if (!isMenuOpen(menus)) {
      const click = input.consumePointerClick();
      if (click) {
        const action = sidebarClick(view, sidebar, click.x, click.y);
        if (action) {
          dispatchSidebarAction(action);
          return;
        }
      }
    }

    if (isMenuOpen(menus)) {
      updateMenu(menus, input, handlers);
      return;
    }
    // Game input is suppressed while the Now input is focused.
    if (nowBox.isFocused()) return;

    if (isMoving(player)) {
      moveElapsed += dt;
      player.moveProgress = Math.min(1, moveElapsed / MOVE_DURATION_MS);
      if (player.moveProgress >= 1) {
        player.moveFrom = { x: player.x, y: player.y };
        savePlayer(player);
      }
      return;
    }
    if (input.consumePress("b")) {
      toggleTab(sidebar, "stats");
      return;
    }
    if (input.consumePress("a")) {
      const { dx, dy } = DIR_VEC[player.facing];
      const hit = findRoomContainingWorldPoint(player.x + dx, player.y + dy);
      const placement = hit ? getBoxAt(hit.room, hit.lx, hit.ly) : null;
      if (placement) {
        openBoxMenu(menus, resolveBox(placement));
        return;
      }
    }
    const dir = heldDirection(input);
    if (!dir) return;
    player.facing = dir;
    const { dx, dy } = DIR_VEC[dir];
    const tx = player.x + dx;
    const ty = player.y + dy;
    const hit = findRoomContainingWorldPoint(tx, ty);
    if (!hit || !isWalkable(hit.room, hit.lx, hit.ly)) return;

    // Doors teleport on contact: step onto the tile and land at the linked
    // door instead of actually moving into this one. A stub door (no `to`)
    // just sits there.
    if (hit.room.tiles[hit.ly][hit.lx] === "door") {
      const door = getDoorAt(hit.room, hit.lx, hit.ly);
      const target = door?.to ? rooms[door.to.room] : undefined;
      const entry = target && door?.to ? entryPointForDoor(target, door.to.door) : null;
      if (entry) {
        player.x = entry.x;
        player.y = entry.y;
        player.moveFrom = { ...entry };
        player.moveProgress = 1;
        moveElapsed = 0;
        savePlayer(player);
        return;
      }
    }

    player.moveFrom = { x: player.x, y: player.y };
    player.x = tx;
    player.y = ty;
    player.moveProgress = 0;
    moveElapsed = 0;
  }

  function dispatchSidebarAction(action: ReturnType<typeof sidebarClick> & {}): void {
    if (!action) return;
    switch (action.kind) {
      case "toggleTab":
        toggleTab(sidebar, action.tab);
        return;
      case "toggleQuestActive":
        player.quests = toggleQuestActive(player.quests, action.questId);
        savePlayer(player);
        return;
      case "openQuest":
        sidebar.questQuestId = action.questId;
        return;
      case "backToQuestList":
        sidebar.questQuestId = null;
        return;
      case "selectTask": {
        const q = findQuest(player.quests, action.questId);
        const t = q?.tasks.find((x) => x.id === action.taskId);
        if (t) {
          player.now = t.label;
          nowBox.setText(t.label);
          savePlayer(player);
        }
        return;
      }
      case "selectQuest": {
        const q = findQuest(player.quests, action.questId);
        if (q) {
          player.now = q.label;
          nowBox.setText(q.label);
          savePlayer(player);
        }
        return;
      }
    }
  }

  function render() {
    clear(view, BG_COLOR);
    const cam = computeCamera(bounds, player, view);
    const hit = findRoomContainingWorldPoint(player.x, player.y);
    const visible = hit ? visibleRooms(hit.room) : [];
    renderRoom(view, visible, cam, assets);
    renderBoxes(view, visible, cam, assets);
    renderPlayer(view, player, cam);
    renderEffectHUD(view, player);
    renderRoomLabels(view, visible, cam);
    if (!isMenuOpen(menus)) {
      renderSidebar(
        view,
        sidebar,
        {
          effects: player.activeEffects,
          inventory: player.inventory,
          quests: player.quests,
        },
        assets,
      );
    }
    renderMenu(view, menus, handlers, assets);
  }

  return {
    input,
    start() {
      requestAnimationFrame((t) => {
        last = t;
        tick(t);
      });
    },
  };
}

function heldDirection(input: InputState): Direction | null {
  for (const d of ["up", "down", "left", "right"] as Direction[]) {
    if (input.held.has(d)) return d;
  }
  return null;
}
