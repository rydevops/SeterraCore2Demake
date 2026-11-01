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
`tools/maya_sprites/` holds the pre-split frames and `metadata.json` (frame order, directions, per-frame duration). `tools/slice_sprites.py` cleans them (gray matte fringe, specks), drops cut-off or split frames, anchors each frame by its torso, and packs everything into `assets/maya.png` (a grid of 96×120 cells) plus `assets/maya_atlas.js` (start index and frame count per animation/direction, and fps from the metadata durations). The split Death frames are truncated, so the fall is extracted from the full sheet (`tools/maya_sheet_source.png`) instead.

| Sheet row | In game |
|---|---|
| Idle / Walk / Run (8 dir) | Overworld movement and idle; Run is also the dash in/out of melee |
| Attack 1 – Melee (8 dir) | **Strike** in battle; **A** on the map |
| Attack 2 – Ranged (8 dir) | **Shoot** (2 shots) and **Barrage** (3 volleys, hits all) with tracers; **A** on the map |
| Special (8 dir) | **Tech: Overdrive** in battle, **S** on the map |
| Hurt (8 dir) | Taking damage; the Guard brace |
| Death | Maya is defeated (the sheet's death chain is left-facing, so it is mirrored for the battle view) |
| Death reversed + Get Up (8 dir) | Waking at the Inn / after a defeat |
| Idle spun through all 8 directions | Victory twirl, using items, opening chests |

The title screen cycles through every animation and direction.

## PWA updates
`sw.js` is **network‑first**: every launch (and every resume from background) re-checks the server, installs a new version if found, swaps caches, and reloads the game at the next safe moment (never mid‑battle). Offline play falls back to the cache.

**To ship an update:** change `GAME_VERSION` in `version.js` (and merge). Installed copies pick it up the next time they are opened. The version is shown at the bottom‑right of the title screen.

## Files
`index.html`, `style.css`, `manifest.webmanifest`, `sw.js`, `version.js` · `core.js` (helpers/atlas/audio/input/save) · `art.js` (procedural enemies + effects) · `world.js` (map, overworld) · `battle.js` · `main.js` (loop, menus, update logic) · `assets/`, `icons/`, `tools/`
