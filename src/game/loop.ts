import { createInput, type Direction, type InputState } from "./input";
import { createView, clear } from "../render/canvas";
import { BG_COLOR, computeCamera, renderRoom, renderBoxes, renderPlayer } from "../render/tiles";
import { renderEffectHUD } from "../render/hud";
import { loadAssets, type Assets } from "../render/assets";
import { rooms, isWalkable, getBoxAt, resolveBox, type Room } from "../world/room";
import { createPlayer, isMoving, type Player } from "../world/player";
import { applyEffect, getEffect, removeEffectAt } from "../world/effect";
import { applyPersisted, loadPlayer, savePlayer } from "../world/persist";
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
  sidebarHitTest,
  toggleTab,
  type Sidebar,
} from "../ui/sidebar";

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
  const room: Room = rooms.office;
  const player: Player = createPlayer(room.spawn);
  const saved = loadPlayer();
  if (saved && isWalkable(room, saved.x, saved.y)) {
    applyPersisted(player, saved);
  }
  const menus: MenuStack = createMenuStack();
  const sidebar: Sidebar = createSidebar();
  let assets: Assets | null = null;

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
        const hit = sidebarHitTest(view, click.x, click.y);
        if (hit) {
          toggleTab(sidebar, hit);
          return;
        }
      }
    }

    if (isMenuOpen(menus)) {
      updateMenu(menus, input, handlers);
      return;
    }
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
      const placement = getBoxAt(room, player.x + dx, player.y + dy);
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
    if (isWalkable(room, tx, ty)) {
      player.moveFrom = { x: player.x, y: player.y };
      player.x = tx;
      player.y = ty;
      player.moveProgress = 0;
      moveElapsed = 0;
    }
  }

  function render() {
    clear(view, BG_COLOR);
    const cam = computeCamera(room, player, view);
    renderRoom(view, room, cam, assets);
    renderBoxes(view, room, cam, assets);
    renderPlayer(view, player, cam);
    renderEffectHUD(view, player);
    // Sidebar is hidden while a modal menu (box/note) is open so the two UIs don't fight.
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
