"""Builds a silhouette mask for a storyboard panel painting (Flux P2, P3) by colour threshold.
Usage: python scripts/ref_mask.py public/flux/ref/p2.png public/flux/ref/p2-mask.png [overlay.png]
       python scripts/ref_mask.py public/flux/ref/p3.png public/flux/ref/p3-mask.png [overlay.png] --panel 3
Keeps the brightest blue-violet pixels, the largest connected blob, holes filled. 255 inside, 0
outside, same size as the painting.
P2 (the default) excludes by box (x0, y0, x1, y1): the title block (y < 222), the nameplate
(178..340, 440..500), the strip below, and the bubble that touches the left arm's curl. Racks and
loose bubbles are separate blobs, so the largest-blob rule drops them.
P3 (--panel 3) keeps the arms and the face: it excludes the caption (y < 100), the dome and its rim
above the head top (the superellipse fitted in src/worlds/flux/review/p3_targets.json, grown by 0.05
units, above stage y -0.2), and the twelve orbs (circles, native px), which touch the arm tips."""
import sys
import cv2
import numpy as np

EXCLUDE = [(0, 0, 511, 222), (178, 440, 340, 500), (0, 500, 511, 510), (100, 268, 124, 292)]

# P3: (x0, y0, x1, y1) boxes, the dome (stage centre, half-axes, power; world (x, y) -> px
# (257.5 + 100 x, 255 - 100 y)) and the orbs (cx, cy, r) in native px.
P3_EXCLUDE = [(0, 0, 515, 100)]
P3_DOME = (0.02, 0.53, 1.5, 0.96, 2.6)
P3_DOME_GROW, P3_HEAD_TOP = 0.05, -0.2
P3_ORBS = [(80, 210, 30), (58, 270, 31), (55, 337, 31), (93, 392, 31), (143, 437, 31), (225, 457, 33),
           (307, 457, 33), (393, 437, 31), (468, 410, 31), (425, 358, 31), (466, 290, 31), (450, 217, 31)]

def build(src, panel=2):
    im = cv2.imread(src)
    rgb = im[:, :, ::-1].astype(int)
    lum = rgb.mean(2)
    m = ((lum > 82) & (rgb[..., 2] >= rgb[..., 0] - 10) & (rgb[..., 2] > 140)).astype(np.uint8)
    if panel == 3:
        for x0, y0, x1, y1 in P3_EXCLUDE:
            m[y0:y1, x0:x1] = 0
        h, w = m.shape
        yy, xx = np.mgrid[0:h, 0:w]
        wx, wy = (xx - 257.5) / 100, (255 - yy) / 100
        cx, cy, hw, hh, p = P3_DOME
        g = P3_DOME_GROW
        dome = (np.abs((wx - cx) / (hw + g)) ** p + np.abs((wy - cy) / (hh + g)) ** p) <= 1
        m[dome & (wy > P3_HEAD_TOP)] = 0
        for ox, oy, r in P3_ORBS:
            cv2.circle(m, (ox, oy), r + 2, 0, -1)
    else:
        for x0, y0, x1, y1 in EXCLUDE:
            m[y0:y1, x0:x1] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    m = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    ff = m.copy()
    cv2.floodFill(ff, np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8), (0, 0), 1)
    return im, m | (1 - ff)

if __name__ == '__main__':
    args = sys.argv[1:]
    panel = 2
    if '--panel' in args:
        i = args.index('--panel')
        panel = int(args[i + 1])
        del args[i:i + 2]
    im, m = build(args[0], panel)
    cv2.imwrite(args[1], m * 255)
    if len(args) > 2:
        ov = im.copy()
        ov[m == 1] = (0.5 * ov[m == 1] + 0.5 * np.array([0, 255, 0])).astype(np.uint8)
        cv2.imwrite(args[2], np.hstack([im, ov]))
    print('mask px', int(m.sum()))
