"""Build assets/maya.png + assets/maya_atlas.js from the pre-split frames in tools/maya_sprites/.

Input: tools/maya_sprites/<animation>/<DIR>/maya_<anim>_<dir>_frame_NN.png and metadata.json
(frame order, direction names, per-frame duration, source rect on the original sheet).

The frames were matted from a light speckled background, so we:
  * clean each frame (drop gray fringe / specks that touch the outside, keep enclosed light pixels like eye whites),
  * drop broken frames (cut-off slivers, effect-only frames) that are far smaller than their group,
  * anchor every frame by its torso, and keep each frame's vertical position relative to the animation's ground line,
  * assemble Death from its coherent frames (the sheet's death row is one chain that the split cut into pieces),
  * pack all animations/directions into a grid atlas (cells are row-major; `start` per group).
Usage: python3 tools/slice_sprites.py
"""
from PIL import Image
from scipy import ndimage as ndi
import numpy as np, json, os, statistics
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(HERE, 'maya_sprites')
CW, CH, FEET, COLS = 96, 120, 108, 40
DN = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
meta = json.load(open(os.path.join(SRC, 'metadata.json')))
ANIMS = [('idle', 'idle'), ('walk', 'walk'), ('run', 'run'), ('attack_melee', 'melee'), ('attack_ranged', 'ranged'),
         ('special', 'special'), ('hurt', 'hurt'), ('get_up', 'getup')]
# Death: the zip's death frames are truncated (legs cut off), so the fall is extracted from the full sheet
# (tools/maya_sheet_source.png): figures of the chained death row, left-facing, mirrored by the game for battle.
DEATH_ALL = [296, 353, 400, 438, 492, 546, 598, 658, 716, 777]   # x centre of every figure in the chain
DEATH_PICK = [0, 1, 2, 3, 4, 6, 8]
DEATH_Y = (782, 876)
SLIVER = .45          # a frame with less than this fraction of its group's median area or width is a cut-off sliver

def clean(path):
    """-> (RGBA array tight-cropped, area) with the fringe removed"""
    a = np.array(Image.open(path).convert('RGBA')).astype(int)
    a = np.pad(a, ((2, 2), (2, 2), (0, 0)))
    al = a[..., 3]; sat = a[..., :3].max(2) - a[..., :3].min(2); lum = a[..., 0] * .3 + a[..., 1] * .6 + a[..., 2] * .1
    solid = al >= 200; effect = (al >= 110) & (sat > 70) & (lum > 90); gray = (sat < 35) & (lum > 115)
    core = (solid | effect) & ~gray
    seed = np.zeros_like(core); seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
    outside = ndi.binary_propagation(seed & ~core, mask=~core)
    keep = core | (solid & gray & ~outside)
    lab, n = ndi.label(keep, structure=np.ones((3, 3)))
    if n:
        sizes = ndi.sum(keep, lab, range(1, n + 1)); keep &= np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= max(6, .012 * sizes.max())])
    out = np.zeros(a.shape, np.uint8); out[..., :3] = a[..., :3]; out[..., 3] = np.where(keep, np.where(solid, 255, al), 0)
    # keep only what is near the main figure (removes specks / matte lines far away from it, keeps slash arcs)
    lab, n = ndi.label(out[..., 3] > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndi.sum(out[..., 3] > 0, lab, range(1, n + 1)); big = lab == (int(np.argmax(sizes)) + 1)
        near = ndi.binary_dilation(big, iterations=10)
        out[..., 3] = np.where(np.isin(lab, np.unique(lab[near & (lab > 0)])), out[..., 3], 0)
    ys, xs = np.where(out[..., 3] > 0)
    crop = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return crop, int((crop[..., 3] > 0).sum()), int(ys.min()) - 2      # offset of the crop inside the original frame

def col_gap(img):
    occ = (img[..., 3] > 0).any(0); xs = np.where(occ)[0]; inner = occ[xs.min():xs.max() + 1]; g = best = 0
    for v in inner:
        if not v: g += 1; best = max(best, g)
        else: g = 0
    return best

def load_group(anim, d):
    out = []
    for fn in meta['animations'][anim][d]:
        e = meta['frames'][fn]; img, area, oy = clean(os.path.join(SRC, e['file']))
        r = e['source_rect']
        out.append({'img': img, 'area': area, 'w': img.shape[1], 'bottom': r['y'] + oy + img.shape[0]})   # sheet y below the last row
    return out

def to_cell(f, base):
    img = f['img']; h, w = img.shape[:2]
    ys = np.where(img[..., 3] > 0)[0]; top = ys.min()
    mid = img[top + 18: top + 60, :, 3] > 0; cols = np.where(mid.any(0))[0]
    cx = int(round(cols.mean())) if len(cols) else w // 2           # torso anchor
    cell = np.zeros((CH, CW, 4), np.uint8)
    y0 = FEET - (base - f['bottom']) - h                      # keep the frame's height relative to the ground line
    x0 = CW // 2 - cx
    for yy in range(h):
        for xx in range(w):
            ty, tx = y0 + yy, x0 + xx
            if 0 <= ty < CH and 0 <= tx < CW and img[yy, xx, 3]: cell[ty, tx] = img[yy, xx]
    return cell

atlas_info, cells, report = {}, [], []
FPS = {}
for anim, key in ANIMS:
    groups = {d: load_group(anim, d) for d in DN}
    med = statistics.median(f['area'] for g in groups.values() for f in g)
    base = int(statistics.median(f['bottom'] for g in groups.values() for f in g))
    starts, ns = [], []
    for d in DN:
        g = groups[d]; gm = statistics.median(f['area'] for f in g); gw = statistics.median(f['w'] for f in g)
        gh = statistics.median(f['img'].shape[0] for f in g)
        # integrity: cut-off figures (too narrow/short/small) and figures split in two by a gap are dropped
        kept = [f for f in g if f['area'] >= SLIVER * gm and .7 * gw <= f['w'] <= 1.3 * gw and f['img'].shape[0] >= .85 * gh and col_gap(f['img']) < 2]
        if len(kept) < 3:      # small group: keep the best available (still no split / sliver frames)
            kept = [f for f in g if f['area'] >= SLIVER * gm and f['w'] >= .5 * gw and col_gap(f['img']) < 2][:5]
        if len(kept) < len(g): report.append(f'{key} {d}: dropped {len(g) - len(kept)} cut-off frame(s)')
        starts.append(len(cells)); ns.append(len(kept)); cells += [to_cell(f, base) for f in kept]
    atlas_info[key] = {'dir': True, 'n': ns, 'start': starts}
    dur = [meta['frames'][fn]['duration_ms'] for d in DN for fn in meta['animations'][anim][d]]
    FPS[key] = round(1000 / (sum(dur) / len(dur)), 1)

def death_frames():
    """left-facing fall from the full sheet: key the background, split the chain between figures"""
    raw = np.array(Image.open(os.path.join(HERE, 'maya_sheet_source.png')).convert('RGBA')).astype(int)
    y0, y1 = DEATH_Y; x0, x1 = 277, 800
    sub = raw[y0:y1, x0:x1]
    sub = np.pad(sub, ((2, 2), (2, 2), (0, 0)))
    al = sub[..., 3]; sat = sub[..., :3].max(2) - sub[..., :3].min(2); lum = sub[..., 0] * .3 + sub[..., 1] * .6 + sub[..., 2] * .1
    solid = al >= 222; effect = (al >= 140) & (sat > 70) & (lum > 90); gray = (sat < 35) & (lum > 115)
    core = (solid | effect) & ~gray
    seed = np.zeros_like(core); seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
    outside = ndi.binary_propagation(seed & ~core, mask=~core)
    keep = core | (solid & gray & ~outside)
    lab, n = ndi.label(keep, structure=np.ones((3, 3)))
    sizes = ndi.sum(keep, lab, range(1, n + 1)); keep &= np.isin(lab, [i + 1 for i, s_ in enumerate(sizes) if s_ >= 10])
    rgba = np.zeros(sub.shape, np.uint8); rgba[..., :3] = sub[..., :3]; rgba[..., 3] = np.where(keep, np.where(solid, 255, al), 0)
    xs = np.arange(x0 - 2, x1 + 2); cs = np.array(DEATH_ALL, float); own = np.abs(xs[:, None] - cs[None, :]).argmin(1)
    out = []
    for j in DEATH_PICK:
        part = rgba.copy(); part[:, own != j, 3] = 0
        ys, xx = np.where(part[..., 3] > 0)
        out.append({'img': part[ys.min():ys.max() + 1, xx.min():xx.max() + 1], 'bottom': y0 - 2 + int(ys.max()) + 1})
    return out

frames = death_frames()
base = int(statistics.median(f['bottom'] for f in frames))
atlas_info['death'] = {'dir': False, 'n': len(frames), 'start': len(cells), 'face': 'left'}
cells += [to_cell(f, base) for f in frames]
FPS['death'] = round(1000 / meta['frames'][meta['animations']['death']['SW'][0]]['duration_ms'], 1)

rows = (len(cells) + COLS - 1) // COLS
atlas = np.zeros((rows * CH, COLS * CW, 4), np.uint8)
for i, c in enumerate(cells): atlas[(i // COLS) * CH:(i // COLS + 1) * CH, (i % COLS) * CW:(i % COLS + 1) * CW] = c
Image.fromarray(atlas).save(os.path.join(HERE, '..', 'assets', 'maya.png'), optimize=True)
js = 'window.MAYA_ATLAS=' + json.dumps({'cw': CW, 'ch': CH, 'feet': FEET, 'cols': COLS, 'anims': atlas_info, 'fps': FPS}, separators=(',', ':')) + ';\n'
open(os.path.join(HERE, '..', 'assets', 'maya_atlas.js'), 'w').write(js)
print('\n'.join(report)); print(js); print(atlas.shape, len(cells), 'cells')
