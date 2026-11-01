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
| **A** – combo (Fight 1→2→3) / talk | Space, Enter, Z |
| **S** – Special (Tech) pose | X, C |
| **RUN** – toggle sprint | Shift |
| ☰ – menu (items, save, sound) | Esc, M |

In battle, tap the command buttons; tap an enemy (or its button) to target.

## How the sprite sheet is used
`tools/maya_sheet_source.png` is sliced by `tools/slice_sprites.py` into `assets/maya.png` (24 columns = 8 directions × 3 frames, 11 rows = animations). Every animation and direction is used:

| Sheet row | In game |
|---|---|
| Idle / Walk / Run | Overworld movement in all 8 directions; Run also used to dash in/out of melee |
| Fight 1 / 2 / 3 | Jab, Kick, Arc Burst in battle (and the **A** combo on the map) |
| Special (Tech) | Overdrive tech in battle, **S** on the map |
| Damage | Taking a hit; Guard brace |
| Fall | Maya is defeated |
| Get Up | Waking at the Inn / after a defeat |
| Victory | Battle won, opening chests, using items |

The title screen cycles through every animation and direction.

## PWA updates
`sw.js` is **network‑first**: every launch (and every resume from background) re-checks the server, installs a new version if found, swaps caches, and reloads the game at the next safe moment (never mid‑battle). Offline play falls back to the cache.

**To ship an update:** change `GAME_VERSION` in `version.js` (and merge). Installed copies pick it up the next time they are opened. The version is shown at the bottom‑right of the title screen.

## Files
`index.html`, `style.css`, `manifest.webmanifest`, `sw.js`, `version.js` · `core.js` (helpers/audio/input/save) · `art.js` (procedural enemies + effects) · `world.js` (map, overworld) · `battle.js` · `main.js` (loop, menus, update logic) · `assets/`, `icons/`, `tools/`
