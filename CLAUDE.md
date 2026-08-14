# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mortal Realm — a personal, single-player retro RPG for life organization (quests = projects/tasks, potions = mood/state effects, boxes = furniture you open to see items/notes). Built with Vite + TypeScript + Canvas 2D, shipped as a PWA to GitHub Pages. All game content (rooms, boxes, effects, quests) is authored as JSON, not code.

## Commands

- `npm run dev` — start the Vite dev server (default port 5173).
- `npm run build` — type-check (`tsc`, no emit) then production build via Vite.
- `npm run preview` — serve the production build locally.

There is no test suite and no lint/format tooling configured — `npm run build`'s `tsc` step (strict mode) is the only automated check. There is no single-test-file command.

Deploys to GitHub Pages automatically on push to `main` via `.github/workflows/deploy.yml` (`npm ci && npm run build`, publishes `dist`). Vite's `base` is hardcoded to `/mortal-realm-rpg/` in `vite.config.ts`.

## Architecture

### Data-driven content, loaded via `import.meta.glob`

Every content type (rooms, boxes, effects, quests) lives as JSON under `src/data/<type>/` and is eagerly globbed at build time in the corresponding `src/world/*.ts` module (e.g. `src/world/room.ts` globs `src/data/rooms/*.json`). A bad reference (missing box id, unknown tile char, out-of-bounds placement) throws at load time and the app won't boot — check the browser console.

**User-local overrides**: `src/data/user/{rooms,boxes}/` is gitignored (see `src/data/user/README.md`) and also globbed; entries there replace default rooms/boxes with the same `id` entirely (no field-level merge). `src/data/user/box-contents/*.json` is different — it *appends* to a tracked box's `contents` by `boxId` rather than replacing the box, which is how a box's structure (id/sprite/size/nested sub-boxes) can be committed while its personal contents (items/notes/potions) stay local-only. Effects and quests are not user-overridable this way. Every loaded room is reachable via doors (`doors[]`, see below) — there's no separate "active room" concept, and all rooms across all houses currently load into one shared world simultaneously.

**Demo data vs. the user's real house(s)**: `src/data/rooms/office.json` + `bedroom.json` (and their boxes `desk`/`bookshelf`/drawers) are the original two-room demo/sample content, kept around but no longer the default spawn. Real houses the user is cataloguing are tracked under `src/data/rooms/<house>-<room>.json` with an id prefix per house (e.g. `eugene-*` for house 1, "Eugene") — room/box *structure* (existence, doors, dimensions, placement) is committed like any other content; personal *contents* still go through the `box-contents/` overlay above. A house's rooms may be scaffolded (doors wired up, placeholder sizes) well before real dimensions or furniture are filled in — check a room's `size`/`lobes` against reality before assuming it's accurate, and check for an `unplaced` list (boxes known to exist but not yet placed).

### Real-world measurement system (`src/world/measure.ts`)

Rooms and boxes are authored in feet/inches (`Dimension = {feet, inches}`), not grid blocks. `FEET_PER_BLOCK = 3`. Two rounding rules are used **deliberately** and must not be conflated:
- Room/wall sizes round **up** (`blocksForDimension`) so a generated room is never smaller than reality.
- Object footprints round **down**, minimum 1 block (`blocksForDimensionFloor`), so objects are less likely to visually overflow their rounded blocks.

Because of this, block counts alone can't prove a placement is valid. `src/world/room.ts`'s `resolvePlacements` computes true (inch-precision) rectangles for every box, validates fit/overlap against those, and only *then* derives the clamped block rectangle used for rendering/collision — violations are logged as `console.warn` but never thrown; the room still loads with the approximate layout.

A room's layout comes from `size` (a single real-world rectangle), `lobes` (several real-world rectangles unioned together, for a non-rectangular room — an L-shape, a rectangle with a nook, etc; each box/door then declares which `lobe` it belongs to), or a hand-authored `grid`/`legend` pair (full manual control, no real-world dimensions tracked). A room can have any number of `doors[]`, each independently targeting a specific door id on another room (or no target, for a stub door that doesn't teleport) — see field docs in `src/world/room.ts` and the schema writeup in `src/data/user/README.md`.

### Boxes, contents, and potions

`src/world/box.ts` defines `Box` (with optional `sprite`, optional `size` — only boxes placed directly in a room need `size`) and `BoxEntry` (`item` | `note` | `box` | `potion`). Boxes can nest other boxes (e.g. drawers) via `{ type: "box", boxId }`. A `potion` entry references an `effectId` from `src/data/effects/*.json` (`src/world/effect.ts`); effects have a `kind` (`mode`/`mood`/`queued`/`need`/`buff`) and an optional `mutex` group — applying an effect in an active mutex group replaces others in that group, `queued`-kind effects stack instead of toggling.

### Quests

`src/world/quest.ts`: quests are seeded from `src/data/quests/*.json` on first boot and thereafter live entirely in player state (`localStorage`, `src/world/persist.ts`, key `mortal-realm:player:v1`). `mergeWithSeeds` adds any newly-introduced seed quests without touching existing player data; a reserved `id: "default"` quest always exists and holds ad-hoc tasks typed into the top-left "Now" input.

### Game loop and rendering

`src/game/loop.ts`'s `createGame` wires everything together: input (`src/game/input.ts`) → world state (`src/world/*`) → rendering (`src/render/*`) → UI overlays (`src/ui/*`), driven by a single `requestAnimationFrame` tick that calls `update(dt)` then `render()`. Movement is grid-based with a fixed `MOVE_DURATION_MS` tween between tiles; walking onto a `door` tile teleports the player to that door's linked door on another room (`getDoorAt`/`entryPointForDoor` — a room can have several doors, see the Real-world measurement system section above) rather than actually moving there. A fresh player (no `localStorage` save) spawns in whichever room `homeRoom` in `createGame` points at — currently hardcoded to `rooms["eugene-livingroom"]`; update that constant if the default spawn should move (e.g. onto a second house). Player state is persisted to `localStorage` on most mutations (movement completion, quest edits, effect changes, "Now" edits).

Rendering is layered per frame in `render()`: clear → room tiles → boxes → player → effect HUD → room label → sidebar (quests/inventory/effects tabs, `src/ui/sidebar.ts`) → modal menu stack (`src/ui/menu.ts`, used for box contents/potion application). Sprites come from Kenney tilesets under `public/assets/`, loaded async by `src/render/assets.ts`; rendering must tolerate `assets` being `null` before load completes.

## Dev tools

- `public/tile-picker.html` (served at `/tile-picker.html`) — visual grid-overlay inspector for the tileset PNGs, used to hand-pick `(col, row)` sprite coordinates for boxes.
- `public/compare.html` — side-by-side iframe diff of two dev servers (e.g. two branches/worktrees) for visual comparison. Setup steps are in `DEV.md`.
