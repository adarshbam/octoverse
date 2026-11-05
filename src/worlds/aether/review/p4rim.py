"""P4's focused orb rim sample (385,110) on a 509x504 tech-focus capture (100 px a unit).
Usage (from the repo root): python src/worlds/aether/review/p4rim.py <tf509.png> <cx> <cy> <r>
  (the held orb's centre and glass radius in capture px; Task 13's capture: 157.5 306 31)
P4's orb: centre (428,122), radius 42; the sample sits 1.07 radii out, 12.8 degrees above the orb's left.
Prints 5x5 patches at that place on the render's orb, as painted (left) and mirrored (right: Aether's
OpenAI hangs from T1, her left, so P4's right-hand lift is mirrored), and the best patch on the ring 0.95 to 1.1 radii out."""
import sys, json, math
import numpy as np
from PIL import Image
def lab(rgb):
    c = np.asarray(rgb, float) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    f = m @ lin / np.array([0.95047, 1.0, 1.08883])
    f = np.where(f > 216 / 24389, np.cbrt(f), (24389 / 27 * f + 16) / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])
de = lambda a, b: float(np.linalg.norm(lab(a) - lab(b)))
T = [s for s in json.load(open('src/worlds/aether/review/targets.json'))['samples'] if s['name'] == 'Focused orb rim'][0]
img = np.asarray(Image.open(sys.argv[1]).convert('RGB'), float)
cx, cy, r = map(float, sys.argv[2:5])
patch = lambda x, y: img[int(round(y)) - 2:int(round(y)) + 3, int(round(x)) - 2:int(round(x)) + 3].reshape(-1, 3).mean(0)
dx, dy = (385 - 428) / 42, (110 - 122) / 42
for name, sx in [('as painted (left)', 1), ('mirrored (right)', -1)]:
    x, y = cx + sx * dx * r, cy + dy * r
    p = patch(x, y)
    print(f"{name:18} at ({x:.0f},{y:.0f}) {tuple(int(round(v)) for v in p)} dE {de(p, T['rgb']):5.1f}  (target {tuple(T['rgb'])})")
best = None
for k in range(72):
    a = 2 * math.pi * k / 72
    for f in (0.95, 1.0, 1.05, 1.1):
        x, y = cx + f * r * math.cos(a), cy + f * r * math.sin(a)
        p = patch(x, y)
        d = de(p, T['rgb'])
        if best is None or d < best[0]: best = (d, x, y, p)
d, x, y, p = best
print(f"best on the ring    at ({x:.0f},{y:.0f}) {tuple(int(round(v)) for v in p)} dE {d:5.1f}")
