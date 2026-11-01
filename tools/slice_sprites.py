"""Slice the Maya source sheet into a uniform 24x11 atlas (assets/maya.png).

Atlas layout: column = direction*3 + frame, row = animation.
Directions: Down, Down-Left, Left, Up-Left, Up, Up-Right, Right, Down-Right.
Animations: Idle, Walk, Run, Attack1, Attack2, Attack3, Damage, Fall, GetUp, Victory, Special.
Usage: python3 tools/slice_sprites.py
"""
from PIL import Image
import numpy as np, statistics, os
HERE = os.path.dirname(os.path.abspath(__file__))
CELL = 128
FEET = 112           # feet baseline inside a cell
CENTERS = [142,190,239, 300,346,392, 467,516,569, 637,686,736,
           809,862,912, 984,1028,1075, 1156,1209,1264, 1345,1396,1447]
ROWS = [(36,143),(143,245),(245,343),(343,436),(436,532),(532,622),
        (622,716),(716,776),(776,850),(850,935),(935,1024)]
im = np.array(Image.open(os.path.join(HERE, 'maya_sheet_source.png')).convert('RGBA'))
im[..., 3] = np.where(im[..., 3] < 30, 0, im[..., 3])   # drop background haze
atlas = np.zeros((CELL * len(ROWS), CELL * 24, 4), np.uint8)
cs = np.array(CENTERS)
for r, (y0, y1) in enumerate(ROWS):
    band = im[y0:y1, 100:]
    xs = np.arange(100, 100 + band.shape[1])
    owner = np.abs(xs[:, None] - cs[None, :]).argmin(1)    # nearest frame centre
    solid = band[..., 3] > 200
    bottoms = []
    for f in range(24):
        ys = np.where(solid[:, owner == f].any(1))[0]
        if len(ys): bottoms.append(ys.max() + y0)
    base = int(statistics.median(bottoms))                  # shared ground line for the row
    for f in range(24):
        cx = CENTERS[f]
        for ox in range(-CELL // 2, CELL // 2):
            x = cx + ox
            if x < 100 or x >= im.shape[1] or owner[x - 100] != f: continue
            for oy in range(CELL):
                y = base - FEET + oy
                if y < y0 - 4 or y >= min(y1 + 4, im.shape[0]): continue
                if y < 36: continue
                atlas[r * CELL + oy, f * CELL + ox + CELL // 2] = im[y, x]
Image.fromarray(atlas).save(os.path.join(HERE, '..', 'assets', 'maya.png'), optimize=True)
print('ok', atlas.shape)
