"""The host's look against P2 (platform spec 2.1, 2.2): CIE76 delta E per colour sample, the global checks,
the silhouette's IoU with the P2 mask, the mean colour inside it, and the head, eyes, mouth and arm span.
Usage: python scripts/host_delta_e.py <still.png> [--overlay out.png] [--json]
The still is a frozen intro from scripts/platform-capture.mjs: P2's panel (512 x 508 native px) at any whole
scale (default capture: 1024 x 1016), with its silhouette at <still>-mask.png. Every sample is the mean of the
window targets.json's values were read with: native px x0 = x - floor(size / 2) to x0 + size (exclusive), and
the same in y, scaled by the still's scale; the same window on P2 itself (public/octoverse/ref/p2.png) is a
sanity column that reads delta E 0.0.
Shape: from the mask, in stage units (origin native (256, 254), 100 px a unit, +y up). Eyes and mouth are
located in the still: each eye as its opening (iris, pupil, sclera, lash line) in its half of the face, the
mouth as its opening (dark plum inside and tongue). Exit 1 when any P2 sample misses delta E 10, a global
check fails, or IoU is under the target.
--overlay writes the two masks over each other: white both, red P2 only, cyan render only."""
import json, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGETS = json.loads((ROOT / 'src/worlds/octoverse/review/targets.json').read_text())
P2 = ROOT / 'public/octoverse/ref/p2.png'
P2_MASK = ROOT / 'public/octoverse/ref/p2-mask.png'
NATIVE = (512, 508)
ORIGIN = (256, 254)


def lab(rgb):
    c = np.asarray(rgb, dtype=float) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    f = m @ lin / np.array([0.95047, 1.0, 1.08883])
    f = np.where(f > 216 / 24389, np.cbrt(f), (24389 / 27 * f + 16) / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def delta_e(a, b):
    return float(np.linalg.norm(lab(a) - lab(b)))


def area(img, s, x, y, size):
    """Mean of targets.json's sample window, native px [x - size // 2, x - size // 2 + size) in x and y, in an image at scale s."""
    x0, y0 = x - size // 2, y - size // 2
    box = (round(x0 * s), round(y0 * s), round((x0 + size) * s), round((y0 + size) * s))
    return np.asarray(img.crop(box), dtype=float).reshape(-1, 3).mean(0)


def stage(px, py, s):
    return (px / s - ORIGIN[0]) / 100, (ORIGIN[1] - py / s) / 100


def label(mask):
    """4-neighbour connected components: (labels, count), labels 1..count."""
    from collections import deque
    out = np.zeros(mask.shape, dtype=np.int32)
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if out[y0, x0]: continue
        n += 1; out[y0, x0] = n; q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not out[ny, nx]:
                    out[ny, nx] = n; q.append((ny, nx))
    return out, n


def main():
    a = sys.argv[1:]
    still = pathlib.Path(a[0])
    img = Image.open(still).convert('RGB')
    s = img.size[0] / NATIVE[0]
    ref = Image.open(P2).convert('RGB')
    report = {'samples': [], 'checks': {}, 'shape': {}}
    misses = []

    print(f'{"sample":28s} {"target":>15s} {"render":>15s} {"dE":>6s}  {"P2 reads":>15s} {"dE":>6s}')
    got = {}
    for t in TARGETS['samples']:
        if t['panel'] != 'p2': continue
        r = area(img, s, t['x'], t['y'], t['size'])
        p = area(ref, 1, t['x'], t['y'], t['size']).round()  # targets.json holds rounded means
        d, dp = delta_e(r, t['rgb']), delta_e(p, t['rgb'])
        got[t['name']] = r
        ok = d <= TARGETS['deltaE']
        if not ok: misses.append(t['name'])
        print(f'{t["name"]:28s} {str(tuple(t["rgb"])):>15s} {str(tuple(int(round(v)) for v in r)):>15s} {d:6.1f}  {str(tuple(int(round(v)) for v in p)):>15s} {dp:6.1f} {"" if ok else "MISS"}')
        report['samples'].append({'name': t['name'], 'target': t['rgb'], 'render': [round(float(v)) for v in r], 'deltaE': round(d, 1)})

    c = TARGETS['checks']
    faces = [got[n] for n in ('between the eyes', 'face glow beside mouth', 'chin')]
    checks = {
        'face B-G <= %d' % c['faceBminusGmax']: (max(f[2] - f[1] for f in faces), lambda v: v <= c['faceBminusGmax']),
        'face R-B >= %d' % c['faceRminusBmin']: (min(f[0] - f[2] for f in faces), lambda v: v >= c['faceRminusBmin']),
        'crown B-R >= %d' % c['crownBminusRmin']: (got['crown'][2] - got['crown'][0], lambda v: v >= c['crownBminusRmin']),
        'upper head R-G >= %d' % c['upperHeadRminusGmin']: (got['upper head'][0] - got['upper head'][1], lambda v: v >= c['upperHeadRminusGmin']),
        'core R - upper head R >= %d' % c['coreOverHeadRmin']: (got['between the eyes'][0] - got['upper head'][0], lambda v: v >= c['coreOverHeadRmin']),
        'cup R-B >= %d' % c['cupRminusBmin']: (got['cup rim'][0] - got['cup rim'][2], lambda v: v >= c['cupRminusBmin']),
        'mid water B >= %d' % c['midWaterBmin']: (got['mid water'][2], lambda v: v >= c['midWaterBmin']),
        'mid water B-R >= %d' % c['midWaterBminusRmin']: (got['mid water'][2] - got['mid water'][0], lambda v: v >= c['midWaterBminusRmin']),
    }
    print()
    for name, (v, ok) in checks.items():
        passed = bool(ok(v))
        if not passed: misses.append(name)
        report['checks'][name] = {'value': round(float(v), 1), 'pass': passed}
        print(f'{name:32s} {v:7.1f} {"ok" if passed else "FAIL"}')

    # Silhouette: the render's mask at native size against P2's.
    mpath = still.with_name(still.stem + '-mask.png')
    if mpath.exists():
        rm = np.asarray(Image.open(mpath).convert('L').resize(NATIVE, Image.BILINEAR)) > 127
        pm = np.asarray(Image.open(P2_MASK).convert('L')) > 127
        iou = float((rm & pm).sum() / (rm | pm).sum())
        print(f'\nIoU vs p2-mask: {iou:.3f} (target >= {TARGETS["iou"]})')
        if iou < TARGETS['iou']: misses.append('iou')
        # Mean colour inside P2's silhouette, as spec 2.1's last global check.
        px = np.asarray(img.resize(NATIVE, Image.BOX), dtype=float)[pm]
        mx, mn = px.max(1), px.min(1)
        sat = float(np.divide(mx - mn, mx, out=np.zeros_like(mx), where=mx > 0).mean())
        mean = px.mean(0)
        mi = TARGETS['meanInside']
        mean_ok = bool(np.all(np.abs(mean - mi['rgb']) <= mi['tolerance']) and abs(sat - mi['saturation']) <= mi['satTolerance'])
        print(f'mean inside P2 mask: {tuple(int(round(v)) for v in mean)} sat {sat:.3f} (target {tuple(mi["rgb"])} ± {mi["tolerance"]}, sat {mi["saturation"]} ± {mi["satTolerance"]}) {"ok" if mean_ok else "FAIL"}')
        if not mean_ok: misses.append('mean inside')
        # Arm span and head from the render's mask.
        cols = np.nonzero(rm.any(0))[0]
        span = (cols[-1] - cols[0] + 1) / 100
        rows = np.nonzero(rm.any(1))[0]
        top = (ORIGIN[1] - rows[0]) / 100
        # Head half-width: the widest mask run through x = 0 from the top down to y -0.1 (above the arms' rise).
        hw = 0
        for py in range(rows[0], ORIGIN[1] + 30):
            row = rm[py]; x0 = x1 = ORIGIN[0]
            if not row[x0]: continue
            while x0 > 0 and row[x0 - 1]: x0 -= 1
            while x1 < NATIVE[0] - 1 and row[x1 + 1]: x1 += 1
            if py < ORIGIN[1] + 10: hw = max(hw, (x1 - x0 + 1) / 200)
        print(f'arm span {span:.2f} (target {TARGETS["armSpan"]}), head top {top:.2f} (target {TARGETS["head"]["top"]}), head half-width above y -0.1: {hw:.2f} (target {TARGETS["head"]["halfWidth"]})')
        report['shape'].update({'iou': round(iou, 3), 'span': span, 'top': top, 'headHalfWidth': hw, 'meanInside': [round(float(v)) for v in mean], 'saturation': round(sat, 3)})
        if '--overlay' in a:
            o = np.zeros(pm.shape + (3,), dtype=np.uint8)
            o[pm & rm] = (255, 255, 255); o[pm & ~rm] = (255, 60, 60); o[rm & ~pm] = (60, 220, 255)
            Image.fromarray(o).save(a[a.index('--overlay') + 1])

    # Face: each eye is the largest blob of eye pixels (dark iris, pupil and lash line, or white sclera
    # and catchlights) in its half of the face box, its centre the middle of the blob's box (the lash line
    # on top raises it by about 1 native px). The mouth is its opening (dark plum inside and coral tongue),
    # its centre the middle of its box.
    arr = np.asarray(img, dtype=float)
    x0, y0, x1, y1 = 176, 285, 336, 385
    face = arr[round(y0 * s):round(y1 * s), round(x0 * s):round(x1 * s)]
    lum = face.mean(2)
    chroma = (face.max(2) - face.min(2)) / np.maximum(face.max(2), 1)
    eyeish = (lum < 80) | ((lum > 225) & (chroma < 0.15))

    def largest_box_centre(m):
        lab_, n = label(m)
        if n == 0: return None
        sizes = np.bincount(lab_.ravel())[1:]
        ys, xs = np.nonzero(lab_ == 1 + int(sizes.argmax()))
        return (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2

    eyes = []
    half = face.shape[1] // 2
    upper = round(55 * s)  # eyes above native y 340, the mouth below
    for off, part in ((0, eyeish[:upper, :half]), (half, eyeish[:upper, half:])):
        c = largest_box_centre(part)
        if c: eyes.append(tuple(round(float(v), 3) for v in stage(c[0] + off + x0 * s, c[1] + y0 * s, s)))
    r_, g_, b_ = face[..., 0], face[..., 1], face[..., 2]
    plum = (r_ > 60) & (r_ < 200) & (g_ < 80) & (b_ < 120) & (r_ > b_)
    tongue = (r_ > 200) & (g_ > 70) & (g_ < 150) & (b_ < 140)
    opening = (plum | tongue)
    opening[:round(40 * s)] = False
    c = largest_box_centre(opening)
    mouth = tuple(round(float(v), 3) for v in stage(c[0] + x0 * s, c[1] + y0 * s, s)) if c else None
    print(f'eyes (opening centres) {eyes} (target y {TARGETS["eyes"]["y"]}, |x| {TARGETS["eyes"]["x"]}); mouth opening centre {mouth} (target y {TARGETS["mouthY"]})')
    report['shape'].update({'eyes': eyes, 'mouth': mouth})

    # Sparkle specks (spec 2.3: at least 30 on the front of the head, 50 across the arms, at P2 size):
    # small lavender-white blobs (1 to 16 still px, blue >= red) at least 35 brighter than the 9 x 9
    # median round them, inside the render's silhouette. The head is the part inside |x| <= 0.84 and
    # above y -1.0, the arms the rest.
    if mpath.exists():
        from PIL import ImageFilter
        lum = np.asarray(img.convert('L'), dtype=float)
        med = np.asarray(img.convert('L').filter(ImageFilter.MedianFilter(9)), dtype=float)
        full = np.asarray(Image.open(mpath).convert('L').resize(img.size, Image.NEAREST)) > 127
        rgb = np.asarray(img, dtype=float)
        # Specks are lavender-white (the wet colour): blue at least red, which leaves out the amber cup glints.
        bright = (lum - med > 35) & full & (rgb[..., 2] >= rgb[..., 0])
        lab_, n = label(bright)
        head_n = arm_n = 0
        if n:
            sizes = np.bincount(lab_.ravel())
            for i in range(1, n + 1):
                if not 1 <= sizes[i] <= 16: continue
                ys, xs = np.nonzero(lab_ == i)
                sx, sy = stage(xs.mean(), ys.mean(), s)
                if abs(sx) <= 0.84 and sy > -1.0: head_n += 1
                else: arm_n += 1
        ok = head_n >= 30 and arm_n >= 50
        print(f'sparkle specks: head {head_n} (>= 30), arms {arm_n} (>= 50) {"ok" if ok else "FAIL"}')
        if not ok: misses.append('specks')
        report['shape'].update({'specksHead': head_n, 'specksArms': arm_n})

    print('\nMISSES: ' + (', '.join(misses) if misses else 'none'))
    if '--json' in a: print(json.dumps(report))
    sys.exit(1 if misses else 0)


if __name__ == '__main__':
    main()
