"""Checks a stage capture against its storyboard panel. Exit 1 on any miss.
Usage: python scripts/check_stage.py render.png --panel N
       python scripts/check_stage.py capture.png --world [--stage intro] [--mask mask.png]
Colour: mean of a small patch at each sample point, max channel delta. A panel whose samples
name an "hq" reference is read from that high-quality image instead, through its registration
(world (x, y) -> px (origin + pxPerUnit * (x, -y))), and from a capture of any size framing `frame`
world units (the stage camera fits the frame, centred). Patches cover the same world area in both.
A point given as [x, y, px, py] names its feature in both images: world (x, y) in the render and
pixel (px, py) in the high-quality image, for panels painted with different proportions.
Silhouette: head half-width per row; reference from its bright rim line,
render from <render>-mask.png (exact geometry) when present.
World mode (--world): the capture comes from scripts/world-capture.mjs, which frames exactly the
high-quality panel 2 (1536 x 1024), so a capture pixel is a panel pixel. Inside the silhouette mask
(<capture>-mask.png) it measures the mean colour and the mean per-pixel HSV saturation and value
against the targets in scripts/world_samples.json, and prints the same measures for panel 2.
--mask names a capture's mask for an image that is not a capture (panel 2 itself): the capture
mask is used exactly as captured, because the view box registers it to the painting (render px = panel px).
Registered, panel 2 reads (118, 26, 89), saturation 0.867, brightness 0.538. The spec's (119, 23, 79) came
from a mask misregistered by (16, -14) px; the targets are kept as approved and panel 2 passes them.
With --stage intro it also compares 7 x 7 px patches at the named world points with panel 2 by
CIE76 delta E."""
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

WORLD_SAMPLES = 'scripts/world_samples.json'
WORLD_HQ = {'image': 'public/spike/nox-panel2-hq.jpg', 'origin': (783.6, 495.4), 'pxPerUnit': 204.5}
WORLD_PATCH = 3  # radius: 7 x 7 px

def option(name):
    a = sys.argv[1:]
    return a[a.index(name) + 1] if name in a else None

def silhouette_stats(img, mask):
    """Mean RGB, mean per-pixel HSV saturation and mean per-pixel HSV value over the mask pixels."""
    px = np.asarray(img, dtype=float)[mask]
    mx, mn = px.max(1), px.min(1)
    sat = np.divide(mx - mn, mx, out=np.zeros_like(mx), where=mx > 0)
    return px.mean(0), float(sat.mean()), float((mx / 255).mean())

def srgb_to_lab(rgb):
    """sRGB (0-255, D65) to CIE L*a*b*."""
    c = np.asarray(rgb, dtype=float) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    f = m @ lin / np.array([0.95047, 1.0, 1.08883])
    f = np.where(f > 216 / 24389, np.cbrt(f), (24389 / 27 * f + 16) / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])

def world_patch(img, wx, wy, r=WORLD_PATCH):
    ox, oy = WORLD_HQ['origin']
    cx, cy = round(ox + WORLD_HQ['pxPerUnit'] * wx), round(oy - WORLD_HQ['pxPerUnit'] * wy)
    return np.asarray(img.crop((cx - r, cy - r, cx + r + 1, cy + r + 1)), dtype=float).reshape(-1, 3).mean(0)

def world():
    spec = json.loads(pathlib.Path(WORLD_SAMPLES).read_text())
    target = spec['target']
    render_path = sys.argv[1]
    mask_path = pathlib.Path(option('--mask') or render_path.replace('.png', '-mask.png'))
    if not mask_path.exists():
        print(f'no silhouette mask at {mask_path}: capture with scripts/world-capture.mjs, or pass --mask')
        sys.exit(1)
    hq = Image.open(WORLD_HQ['image']).convert('RGB')
    ren = Image.open(render_path).convert('RGB')
    mask_img = Image.open(mask_path).convert('L')
    if not ren.size == mask_img.size == hq.size:
        print(f'size mismatch: image {ren.size}, mask {mask_img.size}, panel 2 {hq.size}')
        sys.exit(1)
    mask = np.asarray(mask_img) > 127
    # Panel 2 and the image are both measured through the same capture mask, exactly as captured.
    is_capture = option('--mask') is None
    misses = 0
    for label, img in (('panel 2', hq), ('capture' if is_capture else 'image', ren)):
        mean, sat, val = silhouette_stats(img, mask)
        print(f"{label:8} mean ({mean[0]:.0f}, {mean[1]:.0f}, {mean[2]:.0f})  saturation {sat:.3f}  brightness {val:.3f}  ({int(mask.sum())} px)")
        if img is hq and is_capture: continue
        # The mean colour is checked as the whole 8-bit colour it prints as, like the integer targets.
        checks = [
            ('mean', bool(np.abs(np.round(mean) - target['mean']).max() <= target['meanTolerance']), f"target {tuple(target['mean'])} +-{target['meanTolerance']}"),
            ('saturation', target['saturation'][0] <= sat <= target['saturation'][1], f"target {target['saturation'][0]} to {target['saturation'][1]}"),
            ('brightness', target['brightness'][0] <= val <= target['brightness'][1], f"target {target['brightness'][0]} to {target['brightness'][1]}"),
        ]
        for name, ok, note in checks:
            misses += not ok
            print(f"{'ok ' if ok else 'MISS'} {name:11} {note}")
    if option('--stage') == 'intro':
        for name, (wx, wy) in spec['regions'].items():
            a, b = world_patch(hq, wx, wy), world_patch(ren, wx, wy)
            de = float(np.linalg.norm(srgb_to_lab(a) - srgb_to_lab(b)))
            ok = de <= target['deltaE']
            misses += not ok
            hx = lambda c: '#%02x%02x%02x' % tuple(int(round(v)) for v in c)
            print(f"{'ok ' if ok else 'MISS'} region {name:18} panel 2 {hx(a)} capture {hx(b)} deltaE {de:5.1f}  (max {target['deltaE']})")
    print('PASS' if misses == 0 else f'FAIL ({misses} misses)')
    sys.exit(1 if misses else 0)

def main():
    if '--world' in sys.argv:
        world()
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
