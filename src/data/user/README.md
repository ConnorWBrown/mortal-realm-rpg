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

`box-contents/` is different: it doesn't override a box, it **appends** to
one's `contents` array (see "Box contents overlay" below). This is how a
box's structure (id, sprite, size, nested sub-boxes) can live in tracked
data while its personal contents (items/notes/potions) stay local-only.

## Layout

```
src/data/user/
  rooms/
    my-house-kitchen.json   # a new room, id "my-house-kitchen"
  boxes/
    desk.json                # overrides the default "desk" box
    my-nightstand.json       # a new box, id "my-nightstand"
  box-contents/
    my-nightstand.json       # appends personal contents to "my-nightstand"
```

## Room schema

Copy `src/data/rooms/office.json` as a starting point. Fields:

- `id` — string. Match an existing id to override it, or pick a new one. Every
  loaded room is reachable via doors (`doorTo`, see below) — there's no
  separate "active room" concept.
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
- `boxes` — array of real-world-anchored placements:
  ```json
  {
    "boxId": "desk",
    "x": { "fromWall": "left", "offset": { "feet": 1, "inches": 0 } },
    "y": { "fromWall": "top", "offset": { "feet": 0, "inches": 0 } }
  }
  ```
  `boxId` must reference a real box id (default or user-defined) with a
  `size` (see Box schema below) or the game will fail to load. `x.fromWall`
  is `"left"` or `"right"`; `y.fromWall` is `"top"` or `"bottom"`; `offset`
  is the real-world distance from that wall to the box's near edge —
  `{ "feet": 0, "inches": 0 }` means flush against it. `fromWall: "right"`
  or `"bottom"` requires the room to have a `size` (there's no far wall to
  measure from otherwise).

  The box's `size` is floored to blocks (minimum 1) for its footprint, and
  its offset floored the same way for its position — see
  `src/world/measure.ts` for why objects round down while rooms round up.
  At load time the room checks the box's *true* (unrounded) rectangle
  against the room's true interior and against every other box's true
  rectangle; if something doesn't actually fit or two boxes actually
  overlap, it's logged as a console warning but the room still loads and
  renders the approximate block layout regardless. This assumes a room with
  a one-block wall ring around a rectangular interior — true of every
  `size`-generated room.
- `unplaced` — optional array of box ids known to be in this room but not
  yet given a placement (no size and/or no exact position figured out yet).
  Each id must reference a real box (default or user-defined) or the game
  will fail to load, but otherwise this is pure capture: nothing renders on
  the grid and nothing is interactable in-game yet. Move an id from here into
  `boxes` (and give its box a `size`) once you know where it actually goes.
- `worldOrigin` — optional `{ "x": number, "y": number }`, this room's
  top-left corner in shared world-space blocks (default `{0,0}`). Rooms are
  laid out side by side purely so a door's teleport has a "from" and "to";
  physical adjacency doesn't matter for gameplay (walking through a door
  jumps the player to the target room's entry point, it doesn't require the
  rooms to actually touch). Give each room in a house a distinct origin so
  they don't visually overlap; origins across different houses can be
  anything since they're never shown on screen together.
- `doorTo` — optional room id this room's one door leads to. Pair it with a
  `doorTo` back on the target room if you want the door to work both ways.

## Box schema

Copy a file from `src/data/boxes/` as a starting point (`desk.json` shows
every entry type). Fields:

- `id` — string, referenced by a room's `boxes[].boxId` or by another box's
  `contents[].boxId` (for drawers/sub-boxes).
- `label` — display name shown in the UI.
- `sprite` — optional `{ "col": number, "row": number }` tile coordinates in
  the roguelike-indoors tileset. Omit for boxes that are only ever nested
  inside another box (never placed directly in a room).
- `size` — `{ "width": {feet, inches}, "depth": {feet, inches} }`, the
  box's real-world footprint (`width` runs along its placement's x-axis,
  `depth` along its y-axis). Required for any box a room places directly
  (see `boxes` above); optional for boxes that only ever live nested inside
  another box's `contents` (drawers, sub-boxes). Also shown as a subtitle
  under the title when the box is opened in-game.
- `contents` — array of entries, each one of:
  - `{ "type": "item", "label": string, "note"?: string }`
  - `{ "type": "note", "label": string, "text": string }`
  - `{ "type": "box", "boxId": string }` — nests another box (e.g. a drawer);
    `boxId` must exist.
  - `{ "type": "potion", "effectId": string, "label"?: string, "detail"?: string }`
    — `effectId` must match one of the ids in `src/data/effects/` (effects
    aren't user-overridable yet).

## Box contents overlay

If you want a box's *structure* tracked (so it's committed — e.g. "there's a
6ft bookshelf against the window") but its *contents* private (the actual
books), put the structure in `src/data/boxes/<id>.json` as normal, keeping
`contents` limited to `{ "type": "box", ... }` entries for any nested
sub-boxes (or `contents: []` if none), and put the personal entries in
`src/data/user/box-contents/<id>.json`:

```json
{
  "boxId": "bookshelf",
  "contents": [
    { "type": "item", "label": "Framed photo" }
  ]
}
```

At load time these entries are appended to the tracked box's `contents`
(tracked entries first, then overlay entries) — `boxId` must reference a real
box or the game will fail to load. This is a one-way append, not a
field-by-field merge, and unlike `rooms/`/`boxes/` overrides, the filename
doesn't have to match anything — only the `boxId` field inside matters.

## Gotchas

- Both files load eagerly at startup; a bad reference (missing `boxId`, an
  out-of-bounds placement, an unknown legend character) throws immediately
  and the app won't boot. Check the console.
- After adding/editing files here, restart `npm run dev` if hot-reload
  doesn't pick up a brand-new file (Vite's glob import sometimes needs a
  restart to notice new files, not just edits to existing ones).
