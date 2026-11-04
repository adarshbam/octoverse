"""Spec 7.7 relic rule, the entrance half: "the portal's brightest pixel stays below her face glow during the entrance".

Usage: python src/worlds/aether/review/relic_entrance.py capture.png "x0,y0,x1,y1"

The capture is the entrance still with her and the portal in one frame, taken through a `view` window onto the
unmoved stage camera (camera at (0, 0, 12) looking down -z, so a world point (x, y, z) lands on the z = 0 plane at
(x, y) * 12 / (12 - z), and the view box maps that plane onto the image), for example (dev server running):

    WORLD=aether VIEW=1250x833 SCALE=1 node scripts/stage-capture.mjs entering out.png \
        "t=3.2&view=-3,4.165,9.5,-4.165&tier=high&kitwait=90000"

which also writes out-mask.png (her silhouette). One exposure, one tone mapping and one bloom for both, so the two
luminances compare directly. Luminance is the relative luminance Y of the sRGB pixel (Rec. 709, linearised).
- The portal's region: the convex hull of each portal_* node's bounding box of kit.glb, placed as layout.json's
  portal group places the arch, projected as above; pixels inside her silhouette are left out. Its brightest pixel
  is the portal's. Anything drawn in front of the portal inside that hull counts too (the bubbles rising past it,
  the coral before its steps), so the test is, if anything, stricter than the portal alone. Each node's own
  brightest pixel is printed as well.
- Her face glow: inside her silhouette, the largest connected patch of pink-white pixels (R >= 200, B >= 170,
  R - G >= 15); its brightest pixel is the face glow's.
Exit 1 when the portal's brightest pixel is not below the face glow's.
"""
import json
import math
import pathlib
import struct
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[4]
CAMERA_Z = 12.0
NORMALIZED_MAX = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}


def portal_boxes():
    data = (ROOT / 'public/aether/world/kit.glb').read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    boxes = []
    for node in doc['nodes']:
        name = node.get('name', '')
        if not name.startswith('portal_') or name.endswith('_lod1') or 'mesh' not in node:
            continue
        t = node.get('translation', [0, 0, 0])
        s = node.get('scale', [1, 1, 1])
        lo, hi = [math.inf] * 3, [-math.inf] * 3
        for prim in doc['meshes'][node['mesh']]['primitives']:
            a = doc['accessors'][prim['attributes']['POSITION']]
            unit = NORMALIZED_MAX[a['componentType']] if a.get('normalized') else 1
            for k in range(3):
                lo[k] = min(lo[k], t[k] + s[k] * a['min'][k] / unit)
                hi[k] = max(hi[k], t[k] + s[k] * a['max'][k] / unit)
        boxes.append((name, lo, hi))
    return boxes


def placed(p, v):
    s = p.get('scale', 1)
    s = s if isinstance(s, list) else [s] * 3
    x, y, z = v[0] * s[0], v[1] * s[1], v[2] * s[2]
    a = p.get('rotY', 0)
    return (x * math.cos(a) + z * math.sin(a) + p['position'][0], y + p['position'][1], -x * math.sin(a) + z * math.cos(a) + p['position'][2])


def hull(points):
    pts = sorted(set(points))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for q in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0: lower.pop()
        lower.append(q)
    for q in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0: upper.pop()
        upper.append(q)
    return lower[:-1] + upper[:-1]


def inside_polygon(poly, w, h):
    yy, xx = np.mgrid[0:h, 0:w]
    xs, ys = xx + 0.5, yy + 0.5
    inside = np.ones((h, w), bool)
    n = len(poly)
    for i in range(n):  # convex, counter-clockwise in (x, y) with y down: one side of every edge
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
        inside &= (bx - ax) * (ys - ay) - (by - ay) * (xs - ax) >= 0
    return inside


def luminance(img):
    c = img / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return lin @ np.array([0.2126, 0.7152, 0.0722])


def largest_component(mask):
    seen = np.zeros_like(mask)
    best = []
    h, w = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]: continue
        comp, queue = [], deque([(y0, x0)])
        seen[y0, x0] = True
        while queue:
            y, x = queue.popleft()
            comp.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v, u = y + dy, x + dx
                if 0 <= v < h and 0 <= u < w and mask[v, u] and not seen[v, u]:
                    seen[v, u] = True
                    queue.append((v, u))
        if len(comp) > len(best): best = comp
    out = np.zeros_like(mask)
    for y, x in best: out[y, x] = True
    return out


def main():
    path, box = sys.argv[1], [float(v) for v in sys.argv[2].split(',')]
    x0, y0, x1, y1 = box
    img = np.asarray(Image.open(path).convert('RGB'), dtype=float)
    her = np.asarray(Image.open(path.replace('.png', '-mask.png')).convert('L')) > 127
    h, w = img.shape[:2]
    ppu = min(w / (x1 - x0), h / (y0 - y1))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    to_px = lambda p: (w / 2 + ppu * (p[0] * CAMERA_Z / (CAMERA_Z - p[2]) - cx), h / 2 - ppu * (p[1] * CAMERA_Z / (CAMERA_Z - p[2]) - cy))
    layout = json.loads((ROOT / 'src/worlds/aether/place/layout.json').read_text())
    arch = layout['groups']['portal'][0]
    region = np.zeros((h, w), bool)
    lum = luminance(img)
    for name, lo, hi in portal_boxes():
        corners = [placed(arch, (a, b, c)) for a in (lo[0], hi[0]) for b in (lo[1], hi[1]) for c in (lo[2], hi[2])]
        own = inside_polygon(hull([to_px(p) for p in corners]), w, h) & ~her
        region |= own
        if own.any():
            y, x = np.unravel_index(np.where(own, lum, -1).argmax(), lum.shape)
            print(f'  {name:16} box region {int(own.sum()):6d} px, brightest Y {lum[y, x]:.3f} at ({x}, {y}) #%02x%02x%02x' % tuple(int(v) for v in img[y, x]))
    if not region.any():
        print('the portal is not in this frame: frame her and the portal together (see the usage)')
        sys.exit(1)
    py, px = np.unravel_index(np.where(region, lum, -1).argmax(), lum.shape)
    pink = her & (img[..., 0] >= 200) & (img[..., 2] >= 170) & (img[..., 0] - img[..., 1] >= 15)
    face = largest_component(pink)
    fy, fx = np.unravel_index(np.where(face, lum, -1).argmax(), lum.shape)
    hx = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)
    print(f'portal region {int(region.sum())} px (her silhouette left out)')
    print(f'portal brightest  Y {lum[py, px]:.3f}  at ({px}, {py}) {hx(img[py, px])}')
    print(f'face glow ({int(face.sum())} px) brightest  Y {lum[fy, fx]:.3f}  at ({fx}, {fy}) {hx(img[fy, fx])}; her whole silhouette brightest Y {lum[her].max():.3f}')
    ok = lum[py, px] < lum[fy, fx]
    print(('ok  ' if ok else 'MISS') + f' the portal\'s brightest pixel is {"below" if ok else "not below"} the face glow\'s ({lum[py, px]:.3f} vs {lum[fy, fx]:.3f}, ratio {lum[py, px] / lum[fy, fx]:.2f})')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
