"""Veyra's vault world against P1 (Task 11; src/worlds/veyra/review/world_samples.json `p1`).

Usage, from the worktree root, on the intro at the owner's desktop size (1536 x 1024, tier high, frozen), with the dev
server up:
  node scripts/veyra-world-capture.mjs .tmp/veyra-world.png      (also writes .tmp/veyra-world-mask.png, her silhouette)
  python scripts/veyra_world.py .tmp/veyra-world.png

Each sample is the median of its boxes in P1's native panel (the colour truth; regenerated panels are never
used) and in the capture ('without' boxes left out; stat top25: the median of the brightest quarter, for small
glowing sprigs over dark ground), compared by delta E (CIE76) against the sample's limit or the file's `deltaE`. A sample marked `capped` (with its
reason) is printed, not held. The held samples that would miss at the file's `tighterLimit` (Task 7's 10) are named
(the reason for the wider limit is `deltaEReason`).
Then three rules on the pixels:
  - relic (spec 7.7): the portal's brightest (99.5th percentile, linear luminance) stays below the face's;
  - no clip: no pixel of the membrane's rim (the `noClip` boxes: thin strips along its two sides and its top, where the
    edge glow is brightest) is drawn white (R, G and B all 250 or more): the bloom and the bright edge must not burn
    the cyan out. Their brightest channels are printed;
  - no red (`noRed`): outside her silhouette (the capture's <capture>-mask.png, dilated by `herPx`), the coral boxes,
    near-black dither (every channel below `darkBelow`) and the technology pendants, no pixel has R > G and R > B.
    Every class is counted. The pendants (Task 15 fix round 1) are content in brand colours, not the world: a pixel is
    on a pendant when it lies within `pendantPx` of a pendant's centre (<capture>-pendants.json, the orb buttons'
    centres) AND the pendants change it (it differs by more than `pendantDiff` in some channel from <capture>-solo.png,
    the same frozen frame with the pendants hidden). So world red near an orb, which both frames show, still counts.
Exit 0 when every held sample and the three rules pass, 1 otherwise.
"""
import json
import sys
from pathlib import Path

import cv2
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


def red_classes(render, her_mask, rule, solo=None, pendants=()):
    """The no-red rule's pixel classes: (world red mask, counts by class). `her_mask` is her silhouette (bool), `solo` the
    same frame with the pendants hidden (or None), `pendants` their centres [(x, y), ...] in capture pixels."""
    size = 2 * rule['herPx'] + 1
    her = cv2.dilate(her_mask.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))).astype(bool)
    px = render.astype(int)
    red = (px[..., 0] > px[..., 1]) & (px[..., 0] > px[..., 2])
    coral = np.zeros_like(red)
    for x0, y0, x1, y1 in rule['coral']:
        coral[y0:y1, x0:x1] = True
    dark = px.max(axis=2) < rule['darkBelow']
    pendant = np.zeros_like(red)
    if solo is not None and len(pendants):
        changed = np.abs(px - solo.astype(int)).max(axis=2) > rule['pendantDiff']
        near = np.zeros(red.shape, np.uint8)
        for x, y in pendants:
            cv2.circle(near, (int(round(x)), int(round(y))), int(rule['pendantPx']), 1, -1)
        pendant = changed & near.astype(bool)
    rest = red & ~her & ~coral & ~dark & ~pendant
    counts = {
        'world': int(rest.sum()),
        'her': int((red & her).sum()),
        'coral': int((red & coral & ~her).sum()),
        'dark': int((red & dark & ~her & ~coral).sum()),
        'pendants': int((red & pendant & ~her & ~coral & ~dark).sum()),
    }
    return rest, counts


def no_red(render, capture):
    rule = SPEC['noRed']
    need = {
        'her silhouette': capture.with_name(capture.stem + '-mask.png'),
        'pendant-free frame': capture.with_name(capture.stem + '-solo.png'),
        'pendant places': capture.with_name(capture.stem + '-pendants.json'),
    }
    for what, path in need.items():
        if not path.exists():
            print(f'MISS no red: needs the {what} at {path} (scripts/veyra-world-capture.mjs writes it)')
            return False
    mask = np.asarray(Image.open(need['her silhouette']).convert('L')) > 127
    solo = np.asarray(Image.open(need['pendant-free frame']).convert('RGB'))
    pendants = [(p['x'], p['y']) for p in json.loads(need['pendant places'].read_text(encoding='utf-8'))]
    rest, counts = red_classes(render, mask, rule, solo, pendants)
    count = counts['world']
    where = ''
    if count:
        ys, xs = np.nonzero(rest)
        where = f' (first at x {xs[0]}, y {ys[0]}: {tuple(int(v) for v in render[ys[0], xs[0]])})'
    print(f"{'ok  ' if count == 0 else 'MISS'} no red: {count} pixels with R > G and R > B in the world{where}; left out: "
          f"{counts['her']} on her, {counts['pendants']} on the {len(pendants)} technology pendants, {counts['coral']} on the coral, {counts['dark']} near-black")
    return count == 0


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
    wider = []
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
        if de > SPEC['tighterLimit']:
            wider.append(f'{name} {de:.1f}')
        print(f"{'ok  ' if ok else 'MISS'} {name:14s} P1 {tuple(int(v) for v in a)}  render {tuple(int(v) for v in b)}  delta E {de:5.1f} (max {limit})")
    print(f"would miss at {SPEC['tighterLimit']}: {', '.join(wider) or 'none'}")
    face = np.percentile(luminance(region(render, [SPEC['relic']['face']])), 99.5)
    portal = np.percentile(luminance(region(render, [SPEC['relic']['portal']])), 99.5)
    ok = portal < face
    misses += not ok
    print(f"{'ok  ' if ok else 'MISS'} relic: the portal's brightest {portal:.3f} below the face's {face:.3f} (linear luminance, 99.5th percentile)")
    body = region(render, SPEC['noClip']['boxes'])
    white = int((body.min(axis=1) >= 250).sum())
    ok = white == 0
    misses += not ok
    print(f"{'ok  ' if ok else 'MISS'} no clip: {white} white pixels on the membrane's rim; its brightest channels {tuple(int(v) for v in body.max(axis=0))}")
    misses += not no_red(render, Path(sys.argv[1]))
    print('PASS' if misses == 0 else f'FAIL ({misses})')
    sys.exit(0 if misses == 0 else 1)


if __name__ == '__main__':
    main()
