# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server at localhost:5173 (hot reload, no type checking)
npm run build    # tsc type check, then Vite production build → dist/
npm run preview  # Serve the production build locally
```

There are no tests or linters configured. TypeScript strict mode is the primary correctness check.

## Architecture

A personal life-tracking RPG built with vanilla TypeScript and Canvas 2D — no game engine. The game runs at 320×240 pixels, CSS-scaled by integer multiples to fill the viewport.

**Data flow:** JSON files → eagerly imported via Vite glob → validated at load time → drive all game state.

**Game loop** (`src/game/loop.ts`): each frame runs update then render. Update priority: menu input → sidebar click → player movement → A-button interaction → B-button stats toggle. Render order: clear → room tiles → boxes → player → effect HUD → sidebar → menu overlay.

**Input** (`src/game/input.ts`): abstracted as a set of held buttons plus a per-frame pressed set. Keyboard, touch D-pad, and canvas pointer events all feed the same `InputState`. Canvas clicks are scaled from browser coords back to 320×240 logical space.

**Movement** is tile-based but animated over 140ms using `easeOutQuad`. `player.moveProgress` (0→1) drives interpolation; `player.moveFrom` is the pre-move tile. `savePlayer` is called when a move completes.

**Camera** (`src/render/tiles.ts` → `computeCamera`): centers on the interpolated player pixel position, clamped to room bounds so no black edges show.

## Content: Rooms, Boxes, Effects

All defined in `src/data/` as JSON. References (box IDs, effect IDs) are validated at load time; invalid references throw.

**Rooms** (`src/data/rooms/*.json`): ASCII grid with a `legend` mapping characters to `"floor" | "wall" | "door"`, a `spawn` tile, and a `boxes` array of `{ x, y, boxId }` placements. Width/height are derived from the grid — no hardcoded dimensions.

**Boxes** (`src/data/boxes/*.json`): named containers with a `sprite: { col, row }` into the Kenney legacy tilesheet (32-col × 32-row, 16px tiles, 1px margin). Contents are typed entries: `"item"`, `"potion"` (applies an effect), `"note"` (read-only text), `"box"` (nested sub-box).

**Effects** (`src/data/effects/*.json`): have a `kind` (`"mode" | "mood" | "queued" | "need" | "buff"`) and optional `mutex` group. Non-stackable effects toggle off when re-applied; mutual mutex effects replace each other. `"queued"` kind is stackable and accumulates instances.

## UI

**Menu stack** (`src/ui/menu.ts`): modal menus pushed onto a stack; B pops. Types: `"box"` (item list), `"note"` (text), `"stats"` (active effects).

**Sidebar** (`src/ui/sidebar.ts`): RuneScape-style tab panel in bottom-right. Three tabs: inventory, stats, quests. Each tab icon and effect icon is a hand-coded 12×12 pixel-art bitmap in `src/render/tabIcons.ts` and `src/render/effectIcons.ts`.

Both the menu and sidebar use a hand-rolled 4×5 bitmap pixel font.

## Persistence

`src/world/persist.ts` saves player position, facing, active effects, inventory, and quests to `localStorage` under the key `"mortal-realm:player:v1"`. On load, unknown effect IDs are silently dropped (safe for forward compatibility) and an invalid position falls back to the room spawn.

## Deployment

`vite.config.ts` sets `base: "/mortal-realm-rpg/"`. The GitHub Actions workflow at `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to `main`. The app is a PWA (fullscreen display, service worker, installable).

## Dev Tools

- `/compare.html` — two iframes side-by-side, each pointing at a different dev server port (5173 / 5174). Useful for visual branch comparisons.
- `/tile-picker.html` — visual inspector for `tileset_legacy.png` with grid overlay and hover zoom. Use this to find `{ col, row }` sprite coordinates when adding new boxes.
