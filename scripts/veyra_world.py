"""Veyra's vault world against P1 (Task 11; src/worlds/veyra/review/world_samples.json `p1`).

Usage, from the worktree root, on the intro at the owner's desktop size (1536 x 1024, tier high, frozen):
  node .tmp/... or any capture of /?world=veyra&stage=intro&freeze&tier=high at 1536 x 1024 (scale 1)
  python scripts/veyra_world.py <capture.png>

Each sample is the median of its boxes in P1's native panel (the colour truth; regenerated panels are never
used) and in the capture ('without' boxes left out; stat top25: the median of the brightest quarter, for small
glowing sprigs over dark ground), compared by delta E (CIE76) against the sample's limit or the file's `deltaE`. A sample marked `capped` (with its
reason) is out of reach by a rule that wins over the painting, such as the relic rule: printed, not held.
Then two rules on the pixels:
  - relic (spec 7.7): the portal's brightest (99.5th percentile, linear luminance) stays below the face's;
  - no clip: no pixel of the membrane's body (the `noClip` boxes) is drawn white (R, G and B all 250 or more):
    the bloom and the membrane's bright edge must not burn the cyan out. Its brightest channels are printed.
Exit 0 when every sample and both rules pass, 1 otherwise.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPEC = json.loads((ROOT / 'src/worlds/veyra/review/world_samples.json').read_text(encoding='utf-8'))['p1']


def lab(rgb):
    c = np.asarray(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = m @ c / np.array([0.95047, 1, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def region(img, boxes, without=()):
    keep = np.zeros(img.shape[:2], bool)
    for x0, y0, x1, y1 in boxes:
        keep[y0:y1, x0:x1] = True
    for x0, y0, x1, y1 in without:
        keep[y0:y1, x0:x1] = False
    return img[keep].reshape(-1, 3).astype(float)


def pick(img, s):
    p = region(img, s['boxes'], s.get('without', []))
    if s.get('stat') == 'top25':
        lum = p @ [0.2126, 0.7152, 0.0722]
        p = p[lum >= np.percentile(lum, 75)]
    return np.median(p, 0).round().astype(int)


def luminance(p):
    p = p / 255
    p = np.where(p > 0.04045, ((p + 0.055) / 1.055) ** 2.4, p / 12.92)
    return p @ [0.2126, 0.7152, 0.0722]


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: veyra_world.py <capture.png>  (the intro at 1536 x 1024, tier high, frozen)')
    render = np.asarray(Image.open(sys.argv[1]).convert('RGB'))
    if render.shape[:2] != (1024, 1536):
        sys.exit(f'the capture is {render.shape[1]} x {render.shape[0]}; the boxes are for 1536 x 1024')
    p1 = np.asarray(Image.open(ROOT.parent.parent / SPEC['panel']).convert('RGB')) if (ROOT.parent.parent / SPEC['panel']).exists() else None
    if p1 is None:
        sys.exit(f"P1's native panel not found at {ROOT.parent.parent / SPEC['panel']} (the main checkout's references, read only)")
    misses = 0
    for name, s in SPEC['samples'].items():
        a, b = pick(p1, s['p1']), pick(render, s['render'])
        de = float(np.linalg.norm(lab(a) - lab(b)))
        limit = s.get('deltaE', SPEC['deltaE'])
        ok = de <= limit
        if 'capped' in s:
            # Out of reach by a rule that wins (the reason is in the file): printed, not held.
            print(f"cap  {name:14s} P1 {tuple(int(v) for v in a)}  render {tuple(int(v) for v in b)}  delta E {de:5.1f} (not held: {s['capped'][:60]}...)")
            continue
        misses += not ok
        print(f"{'ok  ' if ok else 'MISS'} {name:14s} P1 {tuple(int(v) for v in a)}  render {tuple(int(v) for v in b)}  delta E {de:5.1f} (max {limit})")
    face = np.percentile(luminance(region(render, [SPEC['relic']['face']])), 99.5)
    portal = np.percentile(luminance(region(render, [SPEC['relic']['portal']])), 99.5)
    ok = portal < face
    misses += not ok
    print(f"{'ok  ' if ok else 'MISS'} relic: the portal's brightest {portal:.3f} below the face's {face:.3f} (linear luminance, 99.5th percentile)")
    body = region(render, SPEC['noClip']['boxes'])
    white = int((body.min(axis=1) >= 250).sum())
    ok = white == 0
    misses += not ok
    print(f"{'ok  ' if ok else 'MISS'} no clip: {white} white pixels on the membrane; its brightest channels {tuple(int(v) for v in body.max(axis=0))}")
    print('PASS' if misses == 0 else f'FAIL ({misses})')
    sys.exit(0 if misses == 0 else 1)


if __name__ == '__main__':
    main()
