# Local room/box overrides

This directory is gitignored (except this file) — it's where you can define
your own room layout and objects without touching the tracked demo data in
`src/data/rooms/` and `src/data/boxes/`. Nothing you put here gets committed
or shipped to the GitHub Pages build; it only exists on your machine and only
takes effect via `npm run dev` / a local `npm run build`.

## How it works

At build/dev time, `src/world/room.ts` and `src/world/box.ts` load both the
tracked default JSON and anything in this directory, then merge them by `id`.
A file here with the same `id` as a default one **replaces it entirely**
(no field-level merging); a new `id` just adds a new room or box. There's no
UI for any of this — you write the JSON by hand and reload the page.

## Layout

```
src/data/user/
  rooms/
    office.json     # overrides the default "office" room
  boxes/
    desk.json        # overrides the default "desk" box
    my-nightstand.json  # a new box, id "my-nightstand"
```

## Room schema

Copy `src/data/rooms/office.json` as a starting point. Fields:

- `id` — string. Match an existing id to override it, or pick a new one.
  Note: the game currently only ever loads the room with id `"office"` (there's
  no multi-room navigation yet), so to change what you actually see, your
  room's `id` must be `"office"`.
- `name` — display name.
- A room's layout comes from **either** `size` **or** `grid`/`legend` — pick one:
  - `size` — `{ "feet": number, "inches": number }`, the real-world side
    length of the room's **interior** (floor area — walls are added on top,
    not counted in this measurement). The game generates a square layout for
    you: a one-block wall ring around a floor of `blocksForDimension(size)`
    blocks per side, plus one door. Each block is an approximation of
    `FEET_PER_BLOCK` (3) real-world feet, rounded **up** — so a 16'0" interior
    becomes `ceil(16*12 / 36) = 6` floor blocks, plus a wall block on each
    side, 8 blocks total. See `src/world/measure.ts` for the conversion and
    `src/world/room.ts` for the generator. Only square rooms are supported
    this way for now.
  - `doorSide` — optional, one of `"top"`, `"bottom"`, `"left"`, `"right"`
    (default `"bottom"`). Only used with `size`; picks which wall the door
    sits in the middle of.
  - `legend` — maps single characters used in `grid` to a tile kind: one of
    `"floor"`, `"wall"`, `"door"`. Required if you hand-author `grid`.
  - `grid` — array of equal-length strings, one per row, using only
    characters defined in `legend`. Use this instead of `size` when you want
    a hand-drawn, non-square, or irregular layout.
- `spawn` — `{ "x": number, "y": number }`, must land on a floor tile. For a
  `size`-generated room, floor tiles are the inner `blocksForDimension(size)`
  square, i.e. `x` and `y` in `[1, blocksForDimension(size)]` (index 0 and
  the last index are the wall ring).
- `boxes` — array of `{ "x": number, "y": number, "boxId": string }` placing a
  box (see below) on a floor tile. `boxId` must reference a real box id
  (default or user-defined) or the game will fail to load.

## Box schema

Copy a file from `src/data/boxes/` as a starting point (`desk.json` shows
every entry type). Fields:

- `id` — string, referenced by a room's `boxes[].boxId` or by another box's
  `contents[].boxId` (for drawers/sub-boxes).
- `label` — display name shown in the UI.
- `sprite` — optional `{ "col": number, "row": number }` tile coordinates in
  the roguelike-indoors tileset. Omit for boxes that are only ever nested
  inside another box (never placed directly in a room).
- `contents` — array of entries, each one of:
  - `{ "type": "item", "label": string, "note"?: string }`
  - `{ "type": "note", "label": string, "text": string }`
  - `{ "type": "box", "boxId": string }` — nests another box (e.g. a drawer);
    `boxId` must exist.
  - `{ "type": "potion", "effectId": string, "label"?: string, "detail"?: string }`
    — `effectId` must match one of the ids in `src/data/effects/` (effects
    aren't user-overridable yet).

## Gotchas

- Both files load eagerly at startup; a bad reference (missing `boxId`, an
  out-of-bounds placement, an unknown legend character) throws immediately
  and the app won't boot. Check the console.
- After adding/editing files here, restart `npm run dev` if hot-reload
  doesn't pick up a brand-new file (Vite's glob import sometimes needs a
  restart to notice new files, not just edits to existing ones).
