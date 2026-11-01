# Maya – Seterra Core Demake

A 2D RPG PWA starring **Maya**. Explore an 8‑direction overworld, fight random turn‑based battles, shop, rest at the Inn, open chests, and take down the **Stone Guardian** in the ruins.

Built with plain HTML/CSS/JS + `<canvas>` (no build step). The game lives at the **root** of the repo so GitHub Pages can serve it directly.

## Play
- **GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
- **iPhone:** open the Pages URL in Safari → Share → **Add to Home Screen**, then launch it from the home screen. It is designed for **landscape** (a "rotate your device" screen shows in portrait).
- **Local:** `python3 -m http.server` and open `http://localhost:8000`.

## Controls
| Touch | Keyboard |
|---|---|
| Drag anywhere on the left half – floating 8‑way analog stick (push fully to run) | Arrow keys / WASD (Shift = run) |
| **A** – melee / ranged combo, or talk | Space, Enter, Z |
| **S** – Special (Tech) pose | X, C |
| **RUN** – toggle sprint | Shift |
| ☰ – menu (items, save, sound) | Esc, M |

In battle, tap the command buttons; tap an enemy (or its button) to target.

## How the sprite sheet is used
`tools/maya_sheet_source.png` (+ `tools/maya_sprite_atlas_metadata.json`) is sliced by `tools/slice_sprites.py` into `assets/maya.png` and `assets/maya_atlas.js`. The metadata is only approximate, so the script uses it for rows and ordering and then finds the real frames from the pixels (hair blobs, k-means, hand-measured death frames). Frame counts are per direction (e.g. Up walk has 4 frames, Down melee has 6, death has 7).

| Sheet strip | In game |
|---|---|
| Idle / Walk / Run (8 directions) | Overworld movement and idle in all 8 directions; Run is also how she dashes in and out of melee |
| Attack 1 – Melee (8 dir) | **Strike** in battle (dash in, hit, run back); **A** on the map |
| Attack 2 – Ranged (8 dir) | **Shoot** (2 shots) and **Barrage** (3 volleys, hits all) with bullet tracers; **A** on the map |
| Special | **Tech: Overdrive**, Guard aura, **S** on the map |
| Hit / Hurt | Taking damage |
| Death | Maya is defeated |
| Death (reversed) | Get Up – waking at the Inn / after a defeat |
| Turn | Victory twirl, using items, opening chests |

The title screen cycles through every strip and direction.

## PWA updates
`sw.js` is **network‑first**: every launch (and every resume from background) re-checks the server, installs a new version if found, swaps caches, and reloads the game at the next safe moment (never mid‑battle). Offline play falls back to the cache.

**To ship an update:** change `GAME_VERSION` in `version.js` (and merge). Installed copies pick it up the next time they are opened. The version is shown at the bottom‑right of the title screen.

## Files
`index.html`, `style.css`, `manifest.webmanifest`, `sw.js`, `version.js` · `core.js` (helpers/atlas/audio/input/save) · `art.js` (procedural enemies + effects) · `world.js` (map, overworld) · `battle.js` · `main.js` (loop, menus, update logic) · `assets/`, `icons/`, `tools/`
