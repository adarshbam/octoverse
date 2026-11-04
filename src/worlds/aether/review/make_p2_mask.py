"""Makes public/aether/ref/p2-mask.png: Aether's body (head and eight arms) on panel 2, white on black.
The mask excludes the title, nameplate, gold ring, seed beads, jellyfish and ruins (spec 2.1, global checks).
Run from the repo root: python src/worlds/aether/review/make_p2_mask.py [blue] [open]   (needs opencv-python, numpy)
Method: the jelly is B >= 180 on panel 2 (water B <= 100, ruins and seabed darker or warmer). Above y 300 within the head columns the test is B >= 195 (the halo). Opened by 7 px so the
thin ring and the beads come loose, then the largest connected piece inside the octopus box (below the subtitle,
above the nameplate).
Hand corrections (Task 6, checked at 4x to 8x beside the panel):
- Arm tips: the box ends at y 440 (the nameplate's top) except in two columns where tips hang lower beside the
  nameplate: the lower-left arm (x 140 to 183) and the lower-right tip spiral (x 345 to 409), both to y 465.
  The nameplate itself (x 183 to 339 from y 440) stays out.
- Spur: a column of ruin glow stood on the outer-left arm (x 100 to 140, y 305 to 320). Above the arm's top edge,
  traced by eye at 8x between x 70 and 154, the mask is cleared.
- Holes: the eyes and the small curl pockets are filled (part of her body). Two water pockets enclosed by arm
  loops (area at least 500 px and mean blue at least 140: lower left x 121 to 151, lower right x 376 to 429)
  stay open, as a render's silhouette leaves them.
Checked by eye beside the crop; see docs/superpowers/reviews/aether.md (Task 6)."""
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
# The two tips that hang below the nameplate's top, beside it (hand correction).
box[438:466, 140:184] = 1
box[438:466, 345:410] = 1
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
# Fill the holes, except the water pockets enclosed by arm loops (large and blue).
out = m.copy()
n, lab, stats, _ = cv2.connectedComponentsWithStats((1 - m).astype(np.uint8), connectivity=4)
H, W = m.shape
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if x == 0 or y == 0 or x + w == W or y + h == H: continue      # the outside
    if area >= 500 and blue[lab == i].mean() >= 140: continue        # open water inside an arm loop
    out[lab == i] = 1
# The spur: the arm's top edge between x 70 and 154, traced by eye at 8x; nothing above it is her.
xs = [70, 76, 80, 90, 100, 110, 120, 130, 140, 150, 154]
ys = [340, 334, 328, 322, 320, 320, 321, 325, 330, 335, 337]
for x in range(70, 155):
    out[:int(round(np.interp(x, xs, ys))), x] = 0
cv2.imwrite(OUT, out * 255)
ys_, xs_ = np.nonzero(out)
print('mask px', int(out.sum()), 'x', xs_.min(), xs_.max(), 'y', ys_.min(), ys_.max())
