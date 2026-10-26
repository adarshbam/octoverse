"""Checks a stage capture against its storyboard panel. Exit 1 on any miss.
Usage: python scripts/check_stage.py render.png --panel N
Colour: mean of a small patch at each sample point, max channel delta. A panel whose samples
name an "hq" reference is read from that high-quality image instead, through its registration
(world (x, y) -> px (origin + pxPerUnit * (x, -y))), and from a capture of any size framing `frame`
world units (the stage camera fits the frame, centred). Patches cover the same world area in both.
A point given as [x, y, px, py] names its feature in both images: world (x, y) in the render and
pixel (px, py) in the high-quality image, for panels painted with different proportions.
Silhouette: head half-width per row; reference from its bright rim line,
render from <render>-mask.png (exact geometry) when present."""
import json, sys, pathlib
import numpy as np
from PIL import Image

PANELS = {1: (0, 0, 510, 504), 2: (512, 0, 1018, 504), 3: (1021, 0, 1536, 504), 4: (0, 506, 684, 1024), 5: (685, 506, 1536, 1024)}

def args():
    a = sys.argv[1:]
    panel = int(a[a.index('--panel') + 1]) if '--panel' in a else 2
    return a[0], panel

def to_px(wx, wy, w, h, s):
    return (w / 2 + wx * 100) * s, (h / 2 - wy * 100) * s

def patch(img, s, wx, wy, w, h, r=3):
    cx, cy = to_px(wx, wy, w, h, s)
    arr = np.asarray(img.crop((int(cx - r * s), int(cy - r * s), int(cx + r * s), int(cy + r * s))), dtype=float)
    return arr.reshape(-1, 3).mean(0)

def half_width(lum, s, wy, w, h, threshold):
    row = int(to_px(0, wy, w, h, s)[1])
    lo, hi = int((w / 2 - 95) * s), int((w / 2 + 95) * s)
    xs = [x for x in range(lo, hi) if lum[row, x] > threshold]
    if not xs: return None
    return ((xs[-1] - xs[0]) / s / 100) / 2

def main():
    render_path, panel = args()
    spec = json.loads(pathlib.Path('scripts/stage_samples.json').read_text())[str(panel)]
    x0, y0, x1, y1 = PANELS[panel]
    w, h = x1 - x0, y1 - y0
    ref = Image.open('public/spike/Nox.jpeg').convert('RGB').crop(PANELS[panel])
    ren = Image.open(render_path).convert('RGB')
    s = ren.width / w
    hx = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)
    hq = spec.get('hq')
    if hq:
        hq_img = Image.open(hq['image']).convert('RGB')
        fw, fh = hq['frame']
        # CSS px a unit in the standard 506 x 504 capture: it sets the patch size, in world units.
        unit = min(506 / fw, 504 / fh)
        ren_unit = min(ren.width / fw, ren.height / fh)
        def ref_patch(wx, wy, r=3, at=None):
            ox, oy = hq['origin']
            k = hq['pxPerUnit'] / unit
            cx, cy = at if at else (ox + hq['pxPerUnit'] * wx, oy - hq['pxPerUnit'] * wy)
            arr = np.asarray(hq_img.crop((int(cx - r * k), int(cy - r * k), int(cx + r * k), int(cy + r * k))), dtype=float)
            return arr.reshape(-1, 3).mean(0)
        def ren_patch(wx, wy, r=3):
            cx, cy = ren.width / 2 + ren_unit * wx, ren.height / 2 - ren_unit * wy
            k = ren_unit / unit
            arr = np.asarray(ren.crop((int(cx - r * k), int(cy - r * k), int(cx + r * k), int(cy + r * k))), dtype=float)
            return arr.reshape(-1, 3).mean(0)
    else:
        ref_patch = lambda wx, wy, at=None: patch(ref, 1, wx, wy, w, h)
        ren_patch = lambda wx, wy: patch(ren, s, wx, wy, w, h)
    misses = 0
    for name, point in spec['points'].items():
        wx, wy = point[:2]
        a, b = ref_patch(wx, wy, at=point[2:] or None), ren_patch(wx, wy)
        d = int(np.abs(b - a).max())
        ok = d <= spec['colorTolerance']
        misses += not ok
        print(f"{'ok ' if ok else 'MISS'} colour {name:18} ref {hx(a)} render {hx(b)} delta {d}")
    mask_path = pathlib.Path(render_path.replace('.png', '-mask.png'))
    ref_lum = np.asarray(ref, dtype=float).mean(2)
    if mask_path.exists():
        mask = Image.open(mask_path).convert('L'); ms = mask.width / w
        ren_lum, ren_s, threshold = np.asarray(mask, dtype=float), ms, 127
    else:
        ren_lum, ren_s, threshold = np.asarray(ren, dtype=float).mean(2), s, 85
    for wy in spec.get('silhouetteRows', []):
        a = half_width(ref_lum, 1, wy, w, h, 85)
        b = half_width(ren_lum, ren_s, wy, w, h, threshold)
        ok = a is not None and b is not None and abs(a - b) <= spec['widthTolerance']
        misses += not ok
        print(f"{'ok ' if ok else 'MISS'} width  y={wy:5.2f}  ref {a}  render {b}")
    print('PASS' if misses == 0 else f'FAIL ({misses} misses)')
    sys.exit(1 if misses else 0)

main()
