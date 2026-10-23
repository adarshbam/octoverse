"""Panel 2 as a 1024 square, plus an edit mask: transparent over Nox (dilated render silhouette) and text."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
N = 1024
panel = Image.open('public/spike/Nox.jpeg').convert('RGB').crop((512, 0, 1018, 504)).resize((N, N), Image.LANCZOS)
panel.save('spike-out/plates/panel2-1024.png')
sil = Image.open('spike-out/silhouette.png').convert('L').resize((N, N), Image.LANCZOS)
keep = np.asarray(sil) < 40
# Grow the silhouette ~0.15 units so Nox's glow and suckers are repainted too.
grown = Image.fromarray((~keep * 255).astype('uint8')).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MaxFilter(31))
edit = np.asarray(grown) > 127
mask = Image.new('L', (N, N), 255)
d = ImageDraw.Draw(mask)
sx, sy = N / 506, N / 504
for x0, y0, x1, y1 in [(0, 0, 432, 96), (100, 86, 410, 222), (168, 428, 342, 502)]:
    d.rectangle((x0 * sx, y0 * sy, x1 * sx, y1 * sy), fill=0)
m = np.asarray(mask).copy(); m[edit] = 0
rgba = panel.convert('RGBA'); rgba.putalpha(Image.fromarray(m))
rgba.save('spike-out/plates/panel2-mask.png')
preview = panel.copy(); preview.paste((255, 0, 255), mask=Image.fromarray(255 - m)); preview.save('spike-out/plates/mask-preview.png')
print('edit coverage', round((m == 0).mean() * 100, 1), '%')
