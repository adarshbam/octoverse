"""Side-by-side zoom of a world-space box: reference | render. Usage: zoom.py render.png x0 y0 x1 y1 out [scale]"""
import sys
from PIL import Image
from panels import take_panel_arg
PANEL_RECT, PANEL_W, PANEL_H = take_panel_arg()
render_path, x0, y0, x1, y1, out = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
k = float(sys.argv[7]) if len(sys.argv) > 7 else 4
ref = Image.open('public/spike/Nox.jpeg').convert('RGB').crop(PANEL_RECT)
ren = Image.open(render_path).convert('RGB'); S = ren.width / PANEL_W
def crop(img, s):
    return img.crop((int((PANEL_W / 2 + x0 * 100) * s), int((PANEL_H / 2 - y0 * 100) * s), int((PANEL_W / 2 + x1 * 100) * s), int((PANEL_H / 2 - y1 * 100) * s)))
w, h = int((x1 - x0) * 100 * k), int((y0 - y1) * 100 * k)
a = crop(ref, 1).resize((w, h), Image.LANCZOS); b = crop(ren, S).resize((w, h), Image.LANCZOS)
side = Image.new('RGB', (w * 2 + 6, h), (5, 6, 15)); side.paste(a, (0, 0)); side.paste(b, (w + 6, 0)); side.save(out); print('saved', out, side.size)
