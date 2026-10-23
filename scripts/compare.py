"""Reference vs render: blend overlay, side-by-side crop and colour samples.
Usage: python scripts/compare.py render.png out_prefix
Render must be a 506x504 viewport capture (any device scale)."""
import sys
from PIL import Image, ImageDraw, ImageFont
import numpy as np
render_path, prefix = sys.argv[1], sys.argv[2]
ref = Image.open('public/spike/Nox.jpeg').convert('RGB').crop((512, 0, 1018, 504))
ren = Image.open(render_path).convert('RGB')
S = ren.width / 506
ref_up = ref.resize(ren.size, Image.LANCZOS)
Image.blend(ref_up, ren, 0.5).save(f'{prefix}-blend.png')
def world_box(x0, y0, x1, y1, img, s):
    return img.crop((int((253 + x0 * 100) * s), int((252 - y0 * 100) * s), int((253 + x1 * 100) * s), int((252 - y1 * 100) * s)))
box = (-2.35, 0.4, 2.45, -2.1)
a = world_box(*box, ref_up, S); b = world_box(*box, ren, S)
side = Image.new('RGB', (a.width * 2 + 8, a.height), (5, 6, 15))
side.paste(a, (0, 0)); side.paste(b, (a.width + 8, 0))
side.save(f'{prefix}-side.png')
SAMPLES = {
    'head top': (0.03, 0.08), 'head upper-left': (-0.45, -0.1), 'head side': (-0.62, -0.42),
    'forehead': (0.04, -0.42), 'between eyes low': (0.04, -0.72), 'chin glow': (0.05, -0.95),
    'cheek outer': (-0.64, -0.75), 'bg left': (-2.3, -0.2), 'bg upper-left': (-1.8, 1.3), 'T2 top': (-1.35, -0.6), 'T2 under': (-1.35, -0.77), 'T7 top': (1.33, -0.49), 'bg low right': (2.3, -2.3),
}
def sample(img, s, wx, wy, r=3):
    cx, cy = (253 + wx * 100) * s, (252 - wy * 100) * s
    arr = np.asarray(img.crop((int(cx - r * s), int(cy - r * s), int(cx + r * s), int(cy + r * s))), dtype=float)
    return arr.reshape(-1, 3).mean(0)
print(f'{"point":18} {"reference":>16} {"render":>16}  dRGB')
for name, (wx, wy) in SAMPLES.items():
    r0 = sample(ref, 1, wx, wy); r1 = sample(ren, S, wx, wy)
    hx = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)
    print(f'{name:18} {hx(r0):>16} {hx(r1):>16}  {np.round(r1 - r0).astype(int).tolist()}')
