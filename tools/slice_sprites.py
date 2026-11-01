"""Slice tools/maya_sheet_source.png into assets/maya.png + assets/maya_atlas.js.

This sheet has an opaque-ish light speckled background, so we:
  1. key the background out (sprite pixels are near-opaque with a dark outline; effects are saturated),
  2. read the 8 direction-group x-ranges from the header bars and the row y-bands from the content,
  3. count frames per group from blue-hair peaks, snap centres with k-means, split pixels between neighbours,
  4. pack every (animation, direction) into a grid atlas (cells are laid out row-major, 'start' per group).

Every animation except Death is directional (S, SW, W, NW, N, NE, E, SE). The Death row is one long chain of
figures that overflows its groups, so a left-facing fall sequence is hand-picked from it (the game mirrors it).
Usage: python3 tools/slice_sprites.py
"""
from PIL import Image
from scipy import ndimage as ndi
import numpy as np, json, os, statistics
HERE = os.path.dirname(os.path.abspath(__file__))
CW, CH, FEET, COLS = 96, 120, 108, 40
DIRS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se']
raw = np.array(Image.open(os.path.join(HERE, 'maya_sheet_source.png')).convert('RGBA')).astype(int)
R, G_, B, AL = [raw[..., i] for i in range(4)]
sat = raw[..., :3].max(2) - raw[..., :3].min(2)
lum = R * .3 + G_ * .6 + B * .1

# ---- 1. background keying
solid = AL >= 222
effect = (AL >= 140) & (sat > 70) & (lum > 90)           # blue slashes, muzzle flashes
gray = (sat < 35) & (lum > 115)                          # halo / speckle
core = (solid | effect) & ~gray
outside = ndi.binary_propagation(~core & ((np.indices(core.shape)[0] == 0) | (np.indices(core.shape)[0] == core.shape[0] - 1) |
                                           (np.indices(core.shape)[1] == 0) | (np.indices(core.shape)[1] == core.shape[1] - 1)), mask=~core)
keep = core | (solid & gray & ~outside)                   # enclosed light pixels (eye whites) stay
lab, n = ndi.label(keep, structure=np.ones((3, 3)))
sizes = ndi.sum(keep, lab, range(1, n + 1)); keep &= np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 10])
img = raw[..., :3].astype(np.uint8)
alpha = np.where(keep, np.where(solid, 255, AL), 0).astype(np.uint8)
mask = alpha > 0

# ---- 2. layout
header = [(109, 252), (293, 446), (484, 607), (650, 786), (826, 947), (990, 1124), (1168, 1289), (1319, 1439)]
bounds = [92] + [(header[i][1] + header[i + 1][0]) // 2 for i in range(7)] + [raw.shape[1]]
ROWS = [('idle', 54, 144), ('walk', 165, 250), ('run', 272, 354), ('melee', 375, 455), ('ranged', 474, 557),
        ('special', 577, 659), ('hurt', 681, 765), ('death', 786, 872), ('getup', 899, 986)]
FPS = {'idle': 5, 'walk': 10, 'run': 12, 'melee': 10, 'ranged': 10, 'special': 12, 'hurt': 8, 'death': 8, 'getup': 8}
# Frames per direction group (S, SW, W, NW, N, NE, E, SE), counted by eye: the AI-drawn rows vary and
# automatic counting (hair peaks / leg gaps) was unreliable around ponytails.
COUNTS = {'idle': [4, 4, 3, 3, 3, 3, 3, 3], 'walk': [5, 5, 4, 5, 4, 5, 4, 4], 'run': [5, 5, 4, 5, 4, 5, 4, 4],
          'melee': [5, 4, 4, 4, 4, 4, 4, 4], 'ranged': [5, 4, 4, 4, 4, 4, 4, 4], 'special': [5, 5, 4, 5, 4, 5, 4, 4],
          'hurt': [4, 4, 3, 3, 3, 3, 3, 3], 'getup': [4, 4, 3, 4, 4, 4, 4, 3]}
# Death: left-facing fall sequence picked from the chained figures (centres measured from the sheet)
DEATH_ALL = [296, 353, 400, 438, 492, 546, 598, 658, 716, 777]   # every figure in the chain (for the pixel split)
DEATH_PICK = [0, 1, 2, 3, 4, 6, 8]                                # frames of the sequence we keep

def hair_columns(y0, y1, x0, x1):
    s = raw[y0:y1, x0:x1]
    m = (s[..., 3] >= 120) & (s[..., 2] > 90) & (s[..., 0] < 80) & (s[..., 1] < 120) & (s[..., 2] > s[..., 0] + 55)
    return np.convolve(m.sum(0).astype(float), np.ones(5) / 5, 'same')

def peaks(h, x0, sep=22, rel=.3):
    top = h.max(); out = []
    for i in range(2, len(h) - 2):
        if h[i] >= max(4, rel * top) and h[i] >= h[i - 1] and h[i] > h[i + 1]:
            if out and i - out[-1][0] < sep:
                if h[i] > out[-1][1]: out[-1] = (i, h[i])
            else: out.append((i, h[i]))
    return [x0 + p for p, _ in out]

def kmeans_x(centres, m, x0):
    w = m.sum(0).astype(float); xs = np.arange(x0, x0 + m.shape[1]); c = np.array(centres, float)
    for _ in range(8):
        own = np.abs(xs[:, None] - c[None, :]).argmin(1)
        for j in range(len(c)):
            k = own == j
            if w[k].sum() > 0: c[j] = (xs[k] * w[k]).sum() / w[k].sum()
    return c

frames = []          # (anim, dir, index, RGBA cell array)
info = {}

def make_cell(m_crop, x_off, y_off, own_cols, anchor, base):
    cell = np.zeros((CH, CW, 4), np.uint8)
    for ox in range(-CW // 2, CW // 2):
        x = anchor + ox - x_off
        if not (0 <= x < m_crop.shape[1]) or not own_cols[x]: continue
        for oy in range(CH):
            y = base - FEET + oy - y_off
            if 0 <= y < m_crop.shape[0] and m_crop[y, x]:
                cell[oy, ox + CW // 2, :3] = img[y + y_off, x + x_off]; cell[oy, ox + CW // 2, 3] = alpha[y + y_off, x + x_off]
    return cell

for name, ry0, ry1 in ROWS:
    y0, y1 = ry0 - 4, ry1 + 4
    if name == 'death':          # single left-facing strip
        x0, x1 = 277, 760; m = mask[y0:y1, x0:x1]
        cs = np.array(DEATH_ALL, float); xs = np.arange(x0, x1); own = np.abs(xs[:, None] - cs[None, :]).argmin(1)
        base = int(statistics.median([np.where(m[:, own == j].any(1))[0].max() + y0 for j in DEATH_PICK]))
        cells = []
        for j in DEATH_PICK:
            k = own == j; sel = m[:, k]; cols = np.where(sel.any(0))[0]
            anchor = int(round(x0 + np.where(k)[0][cols].mean())) if len(cols) else int(cs[j])
            cells.append(make_cell(m, x0, y0, k, anchor, base))
        info[name] = {'dir': False, 'n': len(cells), 'face': 'left'}
        frames.append((name, None, cells)); continue
    counts, groups = [], []
    work = []
    for d in range(8):
        x0, x1 = bounds[d], bounds[d + 1]
        m = mask[y0:y1, x0:x1]; n_f = COUNTS[name][d]
        cols = np.where(m.any(0))[0]; lo, hi = cols.min(), cols.max() + 1
        init = [x0 + lo + (i + .5) * (hi - lo) / n_f for i in range(n_f)]
        cs = kmeans_x(init, m, x0)
        xs = np.arange(x0, x1); own = np.abs(xs[:, None] - cs[None, :]).argmin(1)
        work.append((m, x0, cs, own))
    bottoms = [np.where(m[:, own == j].any(1))[0].max() + y0 for m, x0, cs, own in work for j in range(len(cs)) if m[:, own == j].any()]
    base = int(statistics.median(bottoms))
    for d, (m, x0, cs, own) in enumerate(work):
        cells = []
        for j in range(len(cs)):
            k = own == j; sel = m[:, k]; ys = np.where(sel.any(1))[0]
            top = ys.min() if len(ys) else 0
            tb = m[top + 18: top + 60, :] & k[None, :]; cols = np.where(tb.any(0))[0]
            anchor = int(round(x0 + cols.mean())) if len(cols) else int(round(cs[j]))
            cells.append(make_cell(m, x0, y0, k, anchor, base))
        groups.append(cells)
    frames.append((name, 'dir', groups))

# ---- 3. pack
cells_all, idx = [], 0
for name, kind, data in frames:
    if kind == 'dir':
        starts, ns = [], []
        for cells in data:
            starts.append(idx); ns.append(len(cells)); cells_all += cells; idx += len(cells)
        info[name] = {'dir': True, 'n': ns, 'start': starts}
    else:
        info[name]['start'] = idx; cells_all += data; idx += len(data)
rows = (len(cells_all) + COLS - 1) // COLS
atlas = np.zeros((rows * CH, COLS * CW, 4), np.uint8)
for i, c in enumerate(cells_all): atlas[(i // COLS) * CH:(i // COLS + 1) * CH, (i % COLS) * CW:(i % COLS + 1) * CW] = c
Image.fromarray(atlas).save(os.path.join(HERE, '..', 'assets', 'maya.png'), optimize=True)
js = 'window.MAYA_ATLAS=' + json.dumps({'cw': CW, 'ch': CH, 'feet': FEET, 'cols': COLS, 'anims': info, 'fps': FPS}, separators=(',', ':')) + ';\n'
open(os.path.join(HERE, '..', 'assets', 'maya_atlas.js'), 'w').write(js)
print(js); print(atlas.shape, len(cells_all), 'cells')
