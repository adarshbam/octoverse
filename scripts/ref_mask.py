"""Builds a silhouette mask for a storyboard panel painting (Flux P2) by colour threshold.
Usage: python scripts/ref_mask.py public/flux/ref/p2.png public/flux/ref/p2-mask.png [overlay.png]
Keeps the brightest blue-violet pixels, the largest connected blob, holes filled. Excludes by box
(x0, y0, x1, y1): the title block (y < 222), the nameplate (178..340, 440..500), the strip below,
and the bubble that touches the left arm's curl. Racks and loose bubbles are separate blobs, so the
largest-blob rule drops them. 255 inside, 0 outside, same size as the painting."""
import sys
import cv2
import numpy as np

EXCLUDE = [(0, 0, 511, 222), (178, 440, 340, 500), (0, 500, 511, 510), (100, 268, 124, 292)]

def build(src):
    im = cv2.imread(src)
    rgb = im[:, :, ::-1].astype(int)
    lum = rgb.mean(2)
    m = ((lum > 82) & (rgb[..., 2] >= rgb[..., 0] - 10) & (rgb[..., 2] > 140)).astype(np.uint8)
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
    im, m = build(sys.argv[1])
    cv2.imwrite(sys.argv[2], m * 255)
    if len(sys.argv) > 3:
        ov = im.copy()
        ov[m == 1] = (0.5 * ov[m == 1] + 0.5 * np.array([0, 255, 0])).astype(np.uint8)
        cv2.imwrite(sys.argv[3], np.hstack([im, ov]))
    print('mask px', int(m.sum()))
