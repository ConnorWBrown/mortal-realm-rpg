# Dev tools

## Side-by-side branch comparison (`/compare.html`)

`public/compare.html` loads the current dev server and a second dev server in
two iframes, so you can eyeball visual diffs between branches without tabbing
back and forth.

### Setup

1. Start the main dev server as usual on port **5173**:

   ```sh
   npm run dev
   ```

2. Spin up a worktree for the branch you want to compare against. Symlink
   `node_modules` so you don't have to reinstall:

   ```sh
   git worktree add ../life-rpg-other <branch>
   ln -s "$PWD/node_modules" ../life-rpg-other/node_modules
   ```

3. Start a second Vite on port **5174** from that worktree:

   ```sh
   (cd ../life-rpg-other && npx vite --port 5174 --strictPort)
   ```

4. Open `http://localhost:5173/compare.html` — left pane is `:5173`
   (your current branch), right pane is `:5174` (the other branch).

### Cleanup

```sh
# stop the second vite (Ctrl-C, or kill the backgrounded process)
git worktree remove ../life-rpg-other
```

## Tile picker (`/tile-picker.html`)

Visual inspector for `tileset_legacy.png` — 32-col grid overlay, per-tile
index labels, hover zoom. Used to hand-pick `(col, row)` coordinates for
walls, doors, and box sprites. Open `http://localhost:5173/tile-picker.html`.
