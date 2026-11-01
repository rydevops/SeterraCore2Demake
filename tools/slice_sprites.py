"""Slice tools/maya_sheet_source.png into assets/maya.png + assets/maya_atlas.js.

The metadata JSON (approximate, not pixel validated) gives each frame's rough position.
We use it for frame ordering / row positions, then assign the *actual* sprite pixels to the
nearest refined frame centre so wide poses and effects are not clipped.

Atlas: one row per animation. Directional animations (idle, walk, run, melee, ranged) have
8 groups of 5 cells, order S, SW, W, NW, N, NE, E, SE. Non-directional strips (special, hurt,
death, turn) use cells 0..n-1.
Usage: python3 tools/slice_sprites.py
"""
from PIL import Image
import numpy as np, json, re, os, statistics
HERE = os.path.dirname(os.path.abspath(__file__))
CW, CH, FEET, GROUP = 80, 112, 104, 6
DIRS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se']
meta = json.load(open(os.path.join(HERE, 'maya_sprite_atlas_metadata.json')))
im = np.array(Image.open(os.path.join(HERE, 'maya_sheet_source.png')).convert('RGBA'))
alpha = im[..., 3]
from scipy import ndimage as ndi
_lab, _n = ndi.label(alpha >= THR if False else alpha >= 30, structure=np.ones((3, 3)))
for _i, _sl in enumerate(ndi.find_objects(_lab), 1):      # panel borders / label-bar edges: long thin components
    h, w = _sl[0].stop - _sl[0].start, _sl[1].stop - _sl[1].start
    if (max(h, w) > 28 and min(h, w) <= 3):
        alpha[_sl][_lab[_sl] == _i] = 0
THR = 30
DEATH_CENTERS = [736, 781, 822, 866, 914, 972, 1037]   # metadata lists 8 frames; the sheet has 7   # death really has 7 frames (metadata says 8)
ROWS = ['idle', 'walk', 'run', 'attack_melee', 'attack_ranged', 'special', 'hurt', 'death', 'turn']
NAME = {'attack_melee': 'melee', 'attack_ranged': 'ranged'}
DIRECTIONAL = ROWS[:5]

# collect rough frames per animation row
anim = {a: {} for a in ROWS}
for k, v in meta['frames'].items():
    m = re.match(r'(.+?)_(s|sw|w|nw|n|ne|e|se)_(\d+)$', k)
    if m and m.group(1) in anim: a, d, i = m.group(1), m.group(2), int(m.group(3))
    else:
        m = re.match(r'([a-z]+)_(\d+)$', k); a, d, i = m.group(1), None, int(m.group(2))
    anim[a].setdefault(d, []).append((i, v['frame']))
for a in anim:
    for d in anim[a]: anim[a][d].sort(key=lambda t: t[0])

def hair_blobs(y0, y1, x0, x1):
    """Centres of blue-hair blobs (one per figure) in the head band y0..y1, columns x0..x1."""
    p = im[y0:y1, x0:x1].astype(int)
    m = (p[..., 3] >= 100) & (p[..., 2] > 90) & (p[..., 2] > p[..., 0] + 50) & (p[..., 2] > p[..., 1] + 30)
    cols = m.sum(0) > 0
    blobs, start = [], None
    for i, v in enumerate(list(cols) + [False]):
        if v and start is None: start = i
        if not v and start is not None:
            if i - start >= 4: blobs.append(x0 + (start + i - 1) / 2)
            start = None
    merged = []                       # ponytails can split a head into 2 blobs: merge close ones
    for c in blobs:
        if merged and c - merged[-1][-1] < 17: merged[-1].append(c)
        else: merged.append([c])
    return [sum(g) / len(g) for g in merged]

def refine(centers, y0, y1, x0, x1):
    """k-means on pixel x positions (weighted by mask) to snap rough centres to real sprites."""
    sub = alpha[y0:y1, x0:x1] >= THR
    xs = np.arange(x0, x1)
    w = sub.sum(0).astype(float)
    c = np.array(centers, float)
    for _ in range(8):
        own = np.abs(xs[:, None] - c[None, :]).argmin(1)
        for j in range(len(c)):
            m = own == j
            if w[m].sum() > 0: c[j] = (xs[m] * w[m]).sum() / w[m].sum()
    return c

out_rows = []        # list of (animName, [(cellsX list of np arrays...)])
atlas = np.zeros((CH * len(ROWS), CW * 8 * GROUP, 4), np.uint8)
info = {}
for r, a in enumerate(ROWS):
    groups = anim[a]
    allf = [f for d in groups for _, f in groups[d]]
    y0 = min(f['y'] for f in allf) - 2; y1 = max(f['y'] + f['h'] for f in allf) + 6
    # row-wide frame list (centres), refined together so neighbours split properly
    entries = []   # (dir, idx, rough centre)
    if a in DIRECTIONAL:
        # frame counts vary per group (the metadata is approximate): count real figures by hair blobs
        hy = min(f['y'] for f in allf)
        blobs = hair_blobs(hy - 2, hy + 24, 137, 1536)
        firsts = [groups[d][0][1]['x'] + groups[d][0][1]['w'] / 2 for d in DIRS]
        lasts = [groups[d][-1][1]['x'] + groups[d][-1][1]['w'] / 2 for d in DIRS]
        bounds = [(lasts[g] + firsts[g + 1]) / 2 for g in range(7)] + [9999]
        gi = 0; per = {d: [] for d in DIRS}
        for c in blobs:
            while c > bounds[gi]: gi += 1
            per[DIRS[gi]].append(c)
        for d in DIRS:
            assert 3 <= len(per[d]) <= GROUP, (a, d, per[d])
            for i, c in enumerate(per[d]): entries.append((d, i, c))
    elif a == 'death':      # 7 real frames, wide lying poses: centres measured by hand from the sheet
        for i, c in enumerate(DEATH_CENTERS): entries.append((None, i, c))
    else:
        for i, f in groups[None]: entries.append((None, i, f['x'] + f['w'] / 2))
    entries.sort(key=lambda e: e[2])
    x0 = int(max(137 if a in DIRECTIONAL else 0, entries[0][2] - 40)); x1 = int(min(im.shape[1], entries[-1][2] + 40))
    cs = refine([e[2] for e in entries], y0, y1, x0, x1) if a != 'death' else np.array([e[2] for e in entries], float)
    xs = np.arange(x0, x1)
    own = np.abs(xs[:, None] - cs[None, :]).argmin(1)
    band = (alpha[y0:y1, x0:x1] >= THR)
    # ground line for the whole row = median bottom of opaque pixels
    bottoms = []
    for j in range(len(cs)):
        sel = band[:, own == j]
        ys = np.where(sel.any(1))[0]
        if len(ys): bottoms.append(ys.max() + y0)
    base = int(statistics.median(bottoms)); y1 = min(y1, base + 4)
    band = band[:y1 - y0]
    counts = {}
    for j, (d, i, _) in enumerate(entries):
        counts[d] = counts.get(d, 0) + 1
        # torso anchor: centroid of pixels in the middle band of the sprite
        sel = band[:, own == j]; ys = np.where(sel.any(1))[0]
        top = ys.min() + y0 if len(ys) else y0
        tb = band[(top - y0 + 12):(top - y0 + 50), :] & (own == j)[None, :]
        cols = np.where(tb.any(0))[0]
        anchor = int(round(xs[cols].mean())) if len(cols) and a in DIRECTIONAL else int(round(cs[j]))
        col0 = (DIRS.index(d) * GROUP if d else 0) + i
        for ox in range(-CW // 2, CW // 2):
            x = anchor + ox
            if x < x0 or x >= x1 or own[x - x0] != j: continue
            for oy in range(CH):
                y = base - FEET + oy
                if y < y0 or y >= y1: continue
                if alpha[y, x] >= THR: atlas[r * CH + oy, col0 * CW + ox + CW // 2] = im[y, x]
    key = NAME.get(a, a)
    info[key] = {'row': r, 'dir': a in DIRECTIONAL,
                 'n': [counts.get(d, 0) for d in DIRS] if a in DIRECTIONAL else counts[None]}
Image.fromarray(atlas).save(os.path.join(HERE, '..', 'assets', 'maya.png'), optimize=True)
fps = meta.get('suggestedFps', {})
js = 'window.MAYA_ATLAS=' + json.dumps({'cw': CW, 'ch': CH, 'feet': FEET, 'group': GROUP, 'anims': info,
        'fps': {NAME.get(k, k): v for k, v in fps.items()}}, separators=(',', ':')) + ';\n'
open(os.path.join(HERE, '..', 'assets', 'maya_atlas.js'), 'w').write(js)
print(js[:600]); print(atlas.shape)
