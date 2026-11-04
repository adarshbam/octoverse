"""Makes public/aether/ref/p2-mask.png: Aether's body (head and eight arms) on panel 2, white on black.
The mask excludes the title, nameplate, gold ring, seed beads, jellyfish and ruins (spec 2.1, global checks).
Run from the repo root: python src/worlds/aether/review/make_p2_mask.py [blue] [open]   (needs opencv-python, numpy)
Method: the jelly is B >= 180 on panel 2 (water B <= 100, ruins and seabed darker or warmer). Above y 300 within the head columns the test is B >= 195 (the halo). Opened by 7 px so the
thin ring and the beads come loose, then the largest connected piece inside the octopus box (below the subtitle,
above the nameplate), holes filled. Checked by eye beside the crop; see docs/superpowers/reviews/aether.md."""
import sys
import cv2
import numpy as np

SRC, OUT = 'public/aether/ref/p2.png', 'public/aether/ref/p2-mask.png'
BLUE = int(sys.argv[1]) if len(sys.argv) > 1 else 180
OPEN = int(sys.argv[2]) if len(sys.argv) > 2 else 7
img = cv2.imread(SRC, cv2.IMREAD_COLOR)
ell = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))
box = np.zeros(img.shape[:2], np.uint8)
box[232:440, 55:460] = 1
blue = img[..., 0]                                  # OpenCV order is BGR: channel 0 is blue
m = (blue >= BLUE).astype(np.uint8) & box
# The head's glow halo is lighter than the arms' edge: above y 300 inside the head columns the test is tighter.
head = np.zeros_like(box)
head[:300, 175:365] = 1
m = np.where(head > 0, (blue >= 195) & (box > 0), m).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, ell(5))
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, ell(OPEN))
n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
m = (lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
out = np.zeros_like(m)
cv2.drawContours(out, cnts, -1, 1, cv2.FILLED)
cv2.imwrite(OUT, out * 255)
ys, xs = np.nonzero(out)
print('mask px', int(out.sum()), 'x', xs.min(), xs.max(), 'y', ys.min(), ys.max())
