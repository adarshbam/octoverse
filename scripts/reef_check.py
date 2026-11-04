"""The reef's rendered checks (platform spec 2.1 P1 samples, 7.7 the gate in the intro).
Usage:
  python scripts/reef_check.py intro <still.png> [--reference <reefless intro still>]
                                                     the gate's brightest pixel against the host's face glow's
  python scripts/reef_check.py entrance <still.png>  the P1 samples (membrane, floor path, mid water), CIE76 delta E
Stills are from scripts/platform-capture.mjs (P2's panel, 512 x 508 native px, at any whole scale); the intro
still's silhouette is <still>-mask.png.

Intro: "brightest" is the largest relative luminance (linear sRGB, Rec. 709 weights) after a median 2.5 native px wide, so a
bubble rim, mote or snow fleck does not count (a glyph stroke, 3 native px, does). The gate's pixels are the boxes its arch, membrane and
windows project to in the intro frame (layout.json's gate at the P2 camera: native x 290 to 512, y 34 to 401),
less the host's silhouette (grown by 8 native px, for its halo and rim glow), the title block above the head
(native y 92 to 212, x 90 to 420) and the pill (native y 440 up). The face glow's pixels are the column of the
face between the eyes down to the chin (native x 236 to 276, y 290 to 375). Exit 1 when the gate's brightest
reaches the face glow's. With --reference (the same frozen intro without the reef: Task 3's
docs/superpowers/evidence/platform/m1/task3-host-intro.png), pixels bright there (bubbles, shafts: the frozen
frame puts them in the same place) are left out, grown by 3 native px.
Entrance: each P1 sample is the mean of its window (as host_delta_e.py reads targets.json: native px
x - size // 2 to x - size // 2 + size). Exit 1 when one misses delta E 10."""
import json, pathlib, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from host_delta_e import TARGETS, NATIVE, area, delta_e  # noqa: E402

GATE_BOX = (290, 34, 512, 401)
TITLE = (90, 92, 420, 212)
PILL_TOP = 440
FACE_BOX = (236, 290, 276, 375)
HALO = 8
WATER_BRIGHT = 0.25  # in the reference still: a bubble or shaft, not the water's dark body
MEDIAN = 2.5  # native px: wider than a bubble rim or a mote, narrower than a glyph stroke (3 native px)


def luminance(rgb):
    c = rgb / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return lin @ np.array([0.2126, 0.7152, 0.0722])


def box(arr, b, s):
    x0, y0, x1, y1 = (round(v * s) for v in b)
    return arr[y0:y1, x0:x1]


def intro(path, reference=None):
    img = Image.open(path).convert('RGB')
    s = img.size[0] / NATIVE[0]
    smooth = np.asarray(img.filter(ImageFilter.MedianFilter(2 * round(MEDIAN * s / 2) + 1)), dtype=float)
    lum = luminance(smooth)
    mask = Image.open(str(path).replace('.png', '-mask.png')).convert('L')
    grown = np.asarray(mask.filter(ImageFilter.MaxFilter(2 * round(HALO * s) + 1))) > 127
    gate = np.zeros(lum.shape, bool)
    x0, y0, x1, y1 = (round(v * s) for v in GATE_BOX)
    gate[y0:y1, x0:x1] = True
    tx0, ty0, tx1, ty1 = (round(v * s) for v in TITLE)
    gate[ty0:ty1, tx0:tx1] = False
    gate[round(PILL_TOP * s):, :] = False
    gate &= ~grown
    if reference:
        # The frozen intro's bubbles and light shafts stand where they stood in the reef-less still (the
        # same frozen frame): what is bright there is the water's, not the gate's.
        ref = np.asarray(Image.open(reference).convert('RGB').filter(ImageFilter.MedianFilter(2 * round(MEDIAN * s / 2) + 1)), dtype=float)
        water = Image.fromarray((luminance(ref) > WATER_BRIGHT).astype(np.uint8) * 255)
        gate &= ~(np.asarray(water.filter(ImageFilter.MaxFilter(2 * round(3 * s) + 1))) > 127)
    g = np.where(gate, lum, -1)
    gy, gx = np.unravel_index(np.argmax(g), g.shape)
    face = box(lum, FACE_BOX, s)
    fy, fx = np.unravel_index(np.argmax(face), face.shape)
    out = {
        'gate_brightest': round(float(g[gy, gx]), 4),
        'gate_at_native': [round(gx / s), round(gy / s)],
        'gate_rgb': smooth[gy, gx].round().astype(int).tolist(),
        'face_brightest': round(float(face[fy, fx]), 4),
        'face_rgb': box(smooth, FACE_BOX, s)[fy, fx].round().astype(int).tolist(),
        'gate_pixels': int(gate.sum()),
    }
    out['ratio'] = round(out['gate_brightest'] / out['face_brightest'], 3)
    print(json.dumps(out))
    return out['gate_brightest'] < out['face_brightest']


def entrance(path):
    img = Image.open(path).convert('RGB')
    s = img.size[0] / NATIVE[0]
    ok = True
    for t in TARGETS['samples']:
        if t['panel'] != 'p1':
            continue
        r = area(img, s, t['x'], t['y'], t['size'])
        d = delta_e(r, t['rgb'])
        ok &= d <= 10
        print(f"{t['name']:22s} target {tuple(t['rgb'])!s:16s} render {tuple(int(v) for v in r.round())!s:16s} dE {d:5.1f}")
    return ok


if __name__ == '__main__':
    kind, still = sys.argv[1], pathlib.Path(sys.argv[2])
    reference = sys.argv[sys.argv.index('--reference') + 1] if '--reference' in sys.argv else None
    passed = intro(still, reference) if kind == 'intro' else entrance(still)
    sys.exit(0 if passed else 1)
