"""Usage: python scripts/side_by_side.py <scene.png> <out.png> [label] [<scene2.png> <label2> ...] [--crop x0,y0,x1,y1]

Puts panel 2 (the reference painting) and one or more captures side by side at the same size, each
with a caption bar, for judging the environment and lighting together. --crop cuts the same pixel
box from every image first: world captures (scripts/world-capture.mjs) frame exactly the panel, so
a box in panel 2's pixels is the same box in each capture.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

REF = "public/spike/nox-panel2-hq.jpg"


def captioned(img, text, width):
    img = img.convert("RGB").resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    bar = 44
    out = Image.new("RGB", (img.width, img.height + bar), (8, 10, 20))
    out.paste(img, (0, bar))
    draw = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype("segoeui.ttf", 24)
    except OSError:
        font = ImageFont.load_default()
    draw.text((16, 8), text, fill=(214, 222, 245), font=font)
    return out


def main():
    args = sys.argv[1:]
    crop = None
    if "--crop" in args:
        i = args.index("--crop")
        crop = tuple(int(v) for v in args[i + 1].split(","))
        del args[i : i + 2]
    scene, out = args[0], args[1]
    label = args[2] if len(args) > 2 else "Live 3D test scene (Option 2)"
    scenes = [(scene, label)] + list(zip(args[3::2], args[4::2]))
    width = 1152
    cut = (lambda img: img.crop(crop)) if crop else (lambda img: img)
    tiles = [captioned(cut(Image.open(REF)), "Panel 2 - reference painting", width)]
    tiles += [captioned(cut(Image.open(path)), text, width) for path, text in scenes]
    gap = 12
    sheet = Image.new("RGB", (sum(t.width for t in tiles) + gap * (len(tiles) - 1), max(t.height for t in tiles)), (8, 10, 20))
    x = 0
    for tile in tiles:
        sheet.paste(tile, (x, 0))
        x += tile.width + gap
    sheet.save(out, quality=92)
    print("saved", out, sheet.size)


main()
