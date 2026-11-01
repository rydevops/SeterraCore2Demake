"""Slice tools/maya_sheet_source.png into assets/maya.png + assets/maya_atlas.js.

The sheet has transparent panels with a label bar above every direction group. We:
  * take each direction group's x-range from the opaque label bars,
  * count the real frames by counting blue-hair blobs in the sprite band,
  * snap the frame centres to the pixels (k-means) and split pixels between neighbours,
  * strip thin panel-border lines, and anchor every frame by torso centre / row ground line.

Atlas: one row per animation. Directional animations (idle, walk, run, melee, ranged) have 8 groups of
6 cells, order S, SW, W, NW, N, NE, E, SE. Single strips (special, hurt, death, turn) use cells 0..n-1.
Usage: python3 tools/slice_sprites.py
"""
from PIL import Image
from scipy import ndimage as ndi
import numpy as np, json, os, statistics
HERE = os.path.dirname(os.path.abspath(__file__))
CW, CH, FEET, GROUP = 80, 112, 104, 6
THR = 60
DIRS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se']
im = np.array(Image.open(os.path.join(HERE, 'maya_sheet_source.png')).convert('RGBA'))
alpha = im[..., 3].copy()

# (name, y0, y1): sprite band below each label bar. Label bars are at y = 48-72, 222-247, 375-399, 517-540, 651-674.
DIR_ROWS = [('idle', 76, 178, 60), ('walk', 251, 334, 235), ('run', 403, 478, 387), ('melee', 544, 613, 528), ('ranged', 678, 748, 663)]
# single strips: (name, panel x-range, frame centres measured from the sheet)
STRIPS = [('special', (14, 466), [46, 100, 160, 212, 270, 326, 382, 436]),
          ('hurt', (488, 757), [528, 590, 652, 718]),
          ('death', (780, 1244), [817, 873, 927, 983, 1048, 1120, 1195]),
          ('turn', (1268, 1759), [1312, 1370, 1426, 1483, 1538, 1594, 1652, 1712])]
STRIP_Y = (792, 880)
FPS = {'idle': 5, 'walk': 10, 'run': 12, 'melee': 10, 'ranged': 10, 'special': 12, 'hurt': 8, 'death': 8, 'turn': 8}

def runs(v):
    out, s = [], None
    for i, x in enumerate(list(v) + [False]):
        if x and s is None: s = i
        if not x and s is not None: out.append((s, i - 1)); s = None
    return out

def hair_blobs(y0, y1, x0, x1, gap=14):
    s = im[y0:y1, x0:x1].astype(int)
    m = (s[..., 3] >= 150) & (s[..., 2] > 100) & (s[..., 2] > s[..., 0] + 55) & (s[..., 2] > s[..., 1] + 25)
    cols = m.sum(0) > 2
    pts = [x0 + (a + b) / 2 for a, b in runs(cols) if b - a >= 2]
    groups = []
    for p in pts:                                   # ponytails can split a head into two blobs
        if groups and p - groups[-1][-1] < gap: groups[-1].append(p)
        else: groups.append([p])
    return [sum(g) / len(g) for g in groups]

def mask_for(y0, y1, x0, x1):
    m = alpha[y0:y1, x0:x1] >= THR
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    for i, sl in enumerate(ndi.find_objects(lab), 1):          # panel borders: long thin components
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if max(h, w) > 24 and min(h, w) <= 3: m[sl][lab[sl] == i] = False
    return m

def kmeans_x(centers, m, x0):
    w = m.sum(0).astype(float); xs = np.arange(x0, x0 + m.shape[1]); c = np.array(centers, float)
    for _ in range(8):
        own = np.abs(xs[:, None] - c[None, :]).argmin(1)
        for j in range(len(c)):
            k = own == j
            if w[k].sum() > 0: c[j] = (xs[k] * w[k]).sum() / w[k].sum()
    return c

rows = DIR_ROWS + [(n, None, None, None) for n, _, _ in STRIPS]
atlas = np.zeros((CH * len(rows), CW * 8 * GROUP, 4), np.uint8)
info = {}

def blit(r, col, m, x0, y0, base, own_cols, anchor):
    """copy the pixels of one frame into atlas cell (r, col)"""
    for ox in range(-CW // 2, CW // 2):
        x = anchor + ox
        if not (0 <= x - x0 < m.shape[1]) or not own_cols[x - x0]: continue
        for oy in range(CH):
            y = base - FEET + oy
            if 0 <= y - y0 < m.shape[0] and m[y - y0, x - x0]:
                atlas[r * CH + oy, col * CW + ox + CW // 2] = im[y, x]

# ---- directional rows
bar_runs = [(a, b) for a, b in runs(alpha[60] >= 200) if b - a > 150 and a > 170]
assert len(bar_runs) == 8, bar_runs
for r, (name, y0, y1, ly) in enumerate(DIR_ROWS):
    gr = [(a, b) for a, b in runs(alpha[ly] >= 200) if b - a > 150 and a > 170]
    assert len(gr) == 8
    cells = []                       # (dir, frame idx, centre, group x range)
    for d, (gx0, gx1) in zip(DIRS, gr):
        bl = hair_blobs(y0, y1, gx0, gx1 + 1)
        assert 3 <= len(bl) <= GROUP, (name, d, bl)
        cells.append((d, bl, gx0 - 3, gx1 + 4))
    # row ground line: median bottom of opaque pixels
    bottoms, work = [], []
    for d, bl, gx0, gx1 in cells:
        m = mask_for(y0, y1, gx0, gx1); cs = kmeans_x(bl, m, gx0)
        xs = np.arange(gx0, gx1); own = np.abs(xs[:, None] - cs[None, :]).argmin(1)
        work.append((d, m, cs, own, gx0))
        for j in range(len(cs)):
            ys = np.where(m[:, own == j].any(1))[0]
            if len(ys): bottoms.append(ys.max() + y0)
    base = int(statistics.median(bottoms)); counts = []
    for d, m, cs, own, gx0 in work:
        m = m.copy(); m[base + 4 - y0:] = False
        for j in range(len(cs)):
            k = own == j; sel = m[:, k]; ys = np.where(sel.any(1))[0]
            top = ys.min() if len(ys) else 0
            tb = m[top + 10: top + 45, :] & k[None, :]; cols = np.where(tb.any(0))[0]
            anchor = int(round(gx0 + cols.mean())) if len(cols) else int(round(cs[j]))
            blit(r, DIRS.index(d) * GROUP + j, m, gx0, y0, base, k, anchor)
        counts.append(len(cs))
    info[name] = {'row': r, 'dir': True, 'n': counts}

# ---- single strips
for si, (name, (px0, px1), centres) in enumerate(STRIPS):
    r = len(DIR_ROWS) + si
    y0, y1 = STRIP_Y; m = mask_for(y0, y1, px0, px1); xs = np.arange(px0, px1)
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    for i, sl in enumerate(ndi.find_objects(lab), 1):          # the rounded panel border spans the whole strip
        if sl[1].stop - sl[1].start > 0.8 * (px1 - px0): m[sl][lab[sl] == i] = False
    cs = np.array(centres, float); own = np.abs(xs[:, None] - cs[None, :]).argmin(1)
    bottoms = [np.where(m[:, own == j].any(1))[0].max() + y0 for j in range(len(cs))]
    base = int(statistics.median(bottoms)); m[base + 1 - y0:] = False
    for j in range(len(cs)): blit(r, j, m, px0, y0, base, own == j, int(cs[j]))
    info[name] = {'row': r, 'dir': False, 'n': len(cs)}

Image.fromarray(atlas).save(os.path.join(HERE, '..', 'assets', 'maya.png'), optimize=True)
js = 'window.MAYA_ATLAS=' + json.dumps({'cw': CW, 'ch': CH, 'feet': FEET, 'group': GROUP, 'anims': info, 'fps': FPS}, separators=(',', ':')) + ';\n'
open(os.path.join(HERE, '..', 'assets', 'maya_atlas.js'), 'w').write(js)
print(js); print(atlas.shape)
