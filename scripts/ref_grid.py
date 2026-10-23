"""Gridded zoom of Nox panel 2 in world units (1 unit = 100 panel px, origin panel centre, +y up)."""
import sys
from PIL import Image, ImageDraw, ImageFont
SRC = 'public/spike/Nox.jpeg'
S = 3
x0, y0, x1, y1 = [float(v) for v in sys.argv[1:5]] if len(sys.argv) > 4 else (-2.35, 0.4, 2.45, -2.05)
out = sys.argv[5] if len(sys.argv) > 5 else 'spike-out/ref-grid.png'
panel = Image.open(SRC).convert('RGB').crop((512, 0, 1018, 504))
def to_px(wx, wy): return (253 + wx * 100, 252 - wy * 100)
l, t = to_px(x0, y0); r, b = to_px(x1, y1)
crop = panel.crop((int(l), int(t), int(r), int(b))).resize((int((r - l) * S), int((b - t) * S)), Image.LANCZOS)
d = ImageDraw.Draw(crop, 'RGBA')
font = ImageFont.load_default(14)
def cx(wx): return (to_px(wx, 0)[0] - int(l)) * S
def cy(wy): return (to_px(0, wy)[1] - int(t)) * S
import math
v = math.floor(x0 * 10) / 10
while v <= x1 + 1e-6:
    major = abs(round(v * 10) % 5) == 0
    d.line([(cx(v), 0), (cx(v), crop.height)], fill=(0, 255, 255, 110 if major else 40), width=1)
    if major: d.text((cx(v) + 2, 2), f'{v:.1f}', fill=(0, 255, 255, 255), font=font)
    v += 0.1
v = math.floor(y1 * 10) / 10
while v <= y0 + 1e-6:
    major = abs(round(v * 10) % 5) == 0
    d.line([(0, cy(v)), (crop.width, cy(v))], fill=(255, 255, 0, 110 if major else 40), width=1)
    if major: d.text((2, cy(v) + 2), f'{v:.1f}', fill=(255, 255, 0, 255), font=font)
    v += 0.1
crop.save(out)
print('saved', out, crop.size)
