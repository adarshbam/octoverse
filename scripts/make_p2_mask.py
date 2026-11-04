"""Makes the silhouette mask of the host octopus on native panel 2: public/octoverse/ref/p2-mask.png.
Usage: python scripts/make_p2_mask.py [panel.png] [mask.png] [--check]
(defaults: public/octoverse/ref/p2.png -> public/octoverse/ref/p2-mask.png; --check writes nothing and
exits 1 if the existing mask differs from the one made.)
Needs numpy, Pillow and opencv-python (cv2). cv2 is NOT a repo dependency: install it for your own Python
to run this; the committed mask is the output, so nothing else needs it.
scripts/silhouette.py only prints head half-widths from the Nox storyboard, so this is its method (the
bright rim line, luminance > 85) grown into a mask: the 4-connected bright region that holds the head
(256, 300), holes filled. Rows above y 205 (title, text) and from y 455 (the pill) are cleared first, a
3 x 3 opening drops specks, and the one bubble that touches the left arm (x 68..95, y 275..312) is erased.
The cards and the other bubbles are separate components, so they fall out."""
import sys
import cv2
import numpy as np
from PIL import Image

THRESHOLD, HEAD, TOP, BOTTOM, BUBBLE = 85, (256, 300), 205, 455, (slice(275, 313), slice(68, 96))

def make(panel):
    lum = np.asarray(panel.convert('RGB'), dtype=float).mean(2)
    m = lum > THRESHOLD
    m[:TOP] = False
    m[BOTTOM:] = False
    m[BUBBLE] = False
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    _, lab = cv2.connectedComponents(m, connectivity=4)
    comp = (lab == lab[HEAD[1], HEAD[0]]).astype(np.uint8)
    _, holes = cv2.connectedComponents(1 - comp, connectivity=4)
    return ((holes != holes[0, 0]) * 255).astype(np.uint8)

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src = args[0] if args else 'public/octoverse/ref/p2.png'
    dst = args[1] if len(args) > 1 else 'public/octoverse/ref/p2-mask.png'
    mask = make(Image.open(src))
    print(f'{int((mask > 0).sum())} px inside')
    if '--check' in sys.argv:
        same = np.array_equal(np.asarray(Image.open(dst).convert('L')), mask)
        print('identical' if same else 'DIFFERENT')
        sys.exit(0 if same else 1)
    Image.fromarray(mask).save(dst)
