"""High-quality panel 3 (the overview) in world units, registered on the character: the eye spacing
matches the approved face. world (x, y) -> HQ px (836 + 225.4 x, 470.5 - 225.4 y).
  python scripts/hq3.py grid x0 y0 x1 y1 out.png k        gridded HQ crop, k output px per HQ px
  python scripts/hq3.py strip out.png x0 y0 x1 y1 k label=render.png ...
      the HQ crop beside overview stage captures (506x504 css px, framing the overview's
      5.15 x 5.04 world units, so 506 / 5.15 px per unit, at any device scale)
"""
import math
import sys
from PIL import Image, ImageDraw, ImageFont

HQ = 'docs/design/references/Nox/Nox head expands on click or hover.png'
OX, OY, PU = 836.0, 470.5, 225.4


def hq_box(x0, y0, x1, y1):
    return (OX + PU * x0, OY - PU * y0, OX + PU * x1, OY - PU * y1)


def grid(img, x0, y0, x1, y1, step=0.1):
    d = ImageDraw.Draw(img, 'RGBA')
    font = ImageFont.load_default(13)
    w, h = img.size
    v = math.ceil(x0 / step) * step
    while v <= x1 + 1e-9:
        X = (v - x0) / (x1 - x0) * w
        major = abs(round(v * 10) % 5) == 0
        d.line([(X, 0), (X, h)], fill=(0, 255, 255, 110 if major else 40))
        if major:
            d.text((X + 2, 2), f'{v:.1f}', fill=(0, 255, 255, 230), font=font)
        v += step
    v = math.ceil(y1 / step) * step
    while v <= y0 + 1e-9:
        Y = (y0 - v) / (y0 - y1) * h
        major = abs(round(v * 10) % 5) == 0
        d.line([(0, Y), (w, Y)], fill=(255, 255, 0, 110 if major else 40))
        if major:
            d.text((2, Y + 2), f'{v:.1f}', fill=(255, 255, 0, 230), font=font)
        v += step


def crop(img, box, w, h):
    return img.transform((w, h), Image.EXTENT, box, resample=Image.BICUBIC)


if __name__ == '__main__':
    cmd = sys.argv[1]
    ref = Image.open(HQ).convert('RGB')
    if cmd == 'grid':
        x0, y0, x1, y1 = map(float, sys.argv[2:6])
        out = sys.argv[6]
        k = float(sys.argv[7])
        w, h = int((x1 - x0) * PU * k), int((y0 - y1) * PU * k)
        im = crop(ref, hq_box(x0, y0, x1, y1), w, h)
        grid(im, x0, y0, x1, y1)
        im.save(out)
        print('saved', out, im.size)
    elif cmd == 'strip':
        out = sys.argv[2]
        x0, y0, x1, y1, k = map(float, sys.argv[3:8])
        w, h = int((x1 - x0) * 100 * k), int((y0 - y1) * 100 * k)
        tiles = [('HQ reference', crop(ref, hq_box(x0, y0, x1, y1), w, h))]
        for arg in sys.argv[8:]:
            label, path = arg.split('=', 1)
            im = Image.open(path).convert('RGB')
            s = im.width / 506
            u = min(506 / 5.15, 504 / 5.04)
            box = ((253 + u * x0) * s, (252 - u * y0) * s, (253 + u * x1) * s, (252 - u * y1) * s)
            tiles.append((label, crop(im, box, w, h)))
        font = ImageFont.load_default(18)
        sheet = Image.new('RGB', (len(tiles) * (w + 8) - 8, h + 30), (8, 8, 16))
        d = ImageDraw.Draw(sheet)
        for i, (label, tile) in enumerate(tiles):
            sheet.paste(tile, (i * (w + 8), 30))
            d.text((i * (w + 8) + 6, 4), label, fill=(255, 255, 255), font=font)
        sheet.save(out)
        print('saved', out, sheet.size)
