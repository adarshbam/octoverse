"""Veyra's shape numbers against P2, measured like for like (Task 7; src/worlds/veyra/review/targets.json `measured`).

Usage, from the worktree root, on a world capture (488 x 495, P2's frame) and its engine mask:
  WORLD=veyra node scripts/world-capture.mjs intro .tmp/veyra-intro.png
  python scripts/veyra_shape.py .tmp/veyra-intro.png

The render is segmented by the same colour recipe that made public/veyra/ref/p2-mask.png (Task 1):
candidates G >= 95 and G - R >= 40 and B >= 0.7 G, or R > 150 and G > 150; rows 192 to 428 kept; the bubble
circle (r 17 at 432, 392) removed; a 3 x 3 close; the largest 8-connected component; holes filled. Measured on
rows 196 to 427 (`measured.visibleHalfWidth.rows`):
  - the visible head half-width at each `atY` (the run of the mask through column 250, (right - left) / 200),
    held to `tolerance` of P2's;
  - the head top and the arm span (world units, 100 px a unit, origin 244, 247.5), the span held to
    `armSpan.tolerance` of `armSpan.p2Segmented`;
  - IoU with p2-mask.png, raw and with `iouExcluding.boxes` (x0, y0, x1, y1, inclusive) left out of both, the
    latter held to `iou`.
It also reports the recipe's IoU on P2 itself against p2-mask.png, and the engine mask (<capture>-mask.png) beside
the segmented render. Exit 0 when every held number passes, 1 otherwise.

In the vault world (Task 10 on), the recipe also picks up the world's green plants and seagrass where they stand
near her arm tips, which P2's backdrop does not have there. The held numbers are then taken on the "her" row:
the recipe's pixels within `measured.nearHer.px` of the engine mask (her own silhouette, dilated), which keeps her
halo as the recipe sees it on P2 and leaves out the world beyond it. The plain recipe row ("render") is printed
beside it. On a capture with no engine mask the plain row is held, as before.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TARGETS = json.loads((ROOT / 'src/worlds/veyra/review/targets.json').read_text(encoding='utf-8'))
MEASURED = TARGETS['measured']
ORIGIN_X, ORIGIN_Y, PX = 244, 247.5, 100
Y0, Y1 = MEASURED['visibleHalfWidth']['rows']
CENTRE_COLUMN = 250


def segment(img):
    a = np.asarray(img.convert('RGB'), dtype=np.int32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    cand = ((G >= 95) & (G - R >= 40) & (B >= 0.7 * G)) | ((R > 150) & (G > 150))
    cand[:192] = False
    cand[429:] = False
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    cand &= ~(((xx - 432) ** 2 + (yy - 392) ** 2) <= 17 ** 2)
    m = cv2.morphologyEx(cand.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    _, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    m = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    n, lab, _, _ = cv2.connectedComponentsWithStats(1 - m, 4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    for i in range(1, n):
        if i not in border:
            m[lab == i] = 1
    return m.astype(bool)


def clip(m):
    m = m.copy()
    m[:Y0] = False
    m[Y1 + 1:] = False
    return m


def run_through(row, x):
    if not row[x]:
        return None
    left = x
    while left > 0 and row[left - 1]:
        left -= 1
    right = x
    while right < len(row) - 1 and row[right + 1]:
        right += 1
    return left, right


def shape(m):
    ys, xs = np.nonzero(m)
    widths = []
    for wy in MEASURED['visibleHalfWidth']['atY']:
        run = run_through(m[int(round(ORIGIN_Y - wy * PX))], CENTRE_COLUMN)
        widths.append(None if run is None else round((run[1] - run[0]) / (2 * PX), 3))
    return {'top': (ORIGIN_Y - ys.min()) / PX, 'span': (xs.max() - xs.min()) / PX, 'halfWidth': widths}


def iou(a, b, boxes=()):
    keep = np.ones_like(a)
    for x0, y0, x1, y1 in boxes:
        keep[y0:y1 + 1, x0:x1 + 1] = False
    a, b = a & keep, b & keep
    return (a & b).sum() / (a | b).sum()


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: veyra_shape.py <capture.png>  (its engine mask: <capture>-mask.png)')
    capture = Path(sys.argv[1])
    p2 = Image.open(ROOT / 'public/veyra/ref/p2.png')
    p2_mask = clip(np.asarray(Image.open(ROOT / 'public/veyra/ref/p2-mask.png').convert('L')) > 127)
    render = clip(segment(Image.open(capture)))
    engine_path = capture.with_name(capture.stem + '-mask.png')
    engine = clip(np.asarray(Image.open(engine_path).convert('L')) > 127) if engine_path.exists() else None
    near = MEASURED['nearHer']['px']
    her = None if engine is None else render & cv2.dilate(engine.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * near + 1, 2 * near + 1))).astype(bool)
    boxes = MEASURED['iouExcluding']['boxes']

    print(f"recipe on P2 vs p2-mask.png: IoU {iou(clip(segment(p2)), p2_mask):.3f}")
    ref = shape(p2_mask)
    rows = [('p2 mask', p2_mask), ('render', render)] + ([('her', her), ('engine', engine)] if engine is not None else [])
    for name, m in rows:
        s = shape(m)
        line = f"{name:8} top {s['top']:.3f} span {s['span']:.2f} halfwidth@y{MEASURED['visibleHalfWidth']['atY']} {s['halfWidth']}"
        if m is not p2_mask:
            line += f"  IoU {iou(m, p2_mask):.3f}, excluding the extra arms {iou(m, p2_mask, boxes):.3f}"
        print(line)

    held = render if her is None else her
    print(f"held: the {'render' if her is None else 'her'} row")
    s = shape(held)
    tol = MEASURED['visibleHalfWidth']['tolerance']
    p2_widths = MEASURED['visibleHalfWidth']['p2']
    checks = [
        ('p2 half-widths are the recorded ones', all(abs(a - b) < 1e-9 for a, b in zip(ref['halfWidth'], p2_widths))),
        (f'visible half-width within {tol}', all(w is not None and abs(w - p) <= tol + 1e-9 for w, p in zip(s['halfWidth'], p2_widths))),
        (f"span within {MEASURED['armSpan']['tolerance']} of {MEASURED['armSpan']['p2Segmented']}",
         abs(s['span'] - MEASURED['armSpan']['p2Segmented']) <= MEASURED['armSpan']['tolerance'] + 1e-9),
        (f"IoU excluding the extra arms >= {TARGETS['iou']}", iou(held, p2_mask, boxes) >= TARGETS['iou']),
    ]
    for name, ok in checks:
        print(f"{'ok  ' if ok else 'MISS'} {name}")
    passed = all(ok for _, ok in checks)
    print('PASS' if passed else 'FAIL')
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()
