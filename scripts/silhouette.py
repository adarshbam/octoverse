"""Head silhouette half-widths per row from the bright rim line (reference and optional render)."""
import sys
from PIL import Image
import numpy as np
from panels import take_panel_arg
PANEL_RECT, PANEL_W, PANEL_H = take_panel_arg()
def edges(img, s, label):
    a = np.asarray(img.convert('RGB'), dtype=float); lum = a.mean(2)
    print(label)
    for wy in [0.24, 0.2, 0.15, 0.1, 0.05, 0.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6]:
        row = int((PANEL_H / 2 - wy * 100) * s)
        xs = [x for x in range(int((PANEL_W / 2 - 95) * s), int((PANEL_W / 2 + 95) * s)) if lum[row, x] > 85]
        if not xs: print(f'  y={wy:5.2f}  none'); continue
        l, r = (xs[0] / s - PANEL_W / 2) / 100, (xs[-1] / s - PANEL_W / 2) / 100
        print(f'  y={wy:5.2f}  left {l:6.3f}  right {r:6.3f}  half {(r - l) / 2:5.3f}  centre {(r + l) / 2:6.3f}')
edges(Image.open('public/spike/Nox.jpeg').crop(PANEL_RECT), 1, 'reference')
if len(sys.argv) > 1:
    im = Image.open(sys.argv[1]); edges(im, im.width / PANEL_W, 'render')
