"""Colour along a vertical line x (world) from y0 to y1, reference vs render."""
import sys
from PIL import Image
import numpy as np
render_path, x, y0, y1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
ref = Image.open('public/spike/Nox.jpeg').convert('RGB').crop((512, 0, 1018, 504))
ren = Image.open(render_path).convert('RGB'); S = ren.width / 506
def at(img, s, wx, wy):
    cx, cy = (253 + wx * 100) * s, (252 - wy * 100) * s
    r = max(1, int(1.5 * s))
    return np.asarray(img.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))), dtype=float).reshape(-1, 3).mean(0)
hx = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)
n = int(round(abs(y1 - y0) / 0.03)) + 1
for i in range(n):
    y = y0 + (y1 - y0) * i / (n - 1)
    a, b = at(ref, 1, x, y), at(ren, S, x, y)
    print(f'y={y:6.2f}  ref {hx(a)} {"#"*int(a.mean()/12):22}  ren {hx(b)} {"#"*int(b.mean()/12)}')
