"""Usage: python scripts/side_by_side.py <scene.png> <out.png> [label]

Puts panel 2 (the reference painting) and a capture of the spike scene side by side at the
same size, each with a caption bar, for judging the environment and lighting together.
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
    scene, out = sys.argv[1], sys.argv[2]
    label = sys.argv[3] if len(sys.argv) > 3 else "Live 3D test scene (Option 2)"
    width = 1152
    left = captioned(Image.open(REF), "Panel 2 - reference painting", width)
    right = captioned(Image.open(scene), label, width)
    gap = 12
    sheet = Image.new("RGB", (left.width + right.width + gap, max(left.height, right.height)), (8, 10, 20))
    sheet.paste(left, (0, 0))
    sheet.paste(right, (left.width + gap, 0))
    sheet.save(out, quality=92)
    print("saved", out, sheet.size)


main()
