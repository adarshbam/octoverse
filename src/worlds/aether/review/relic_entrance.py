"""Spec 7.7 relic rule, the entrance half: "the portal's brightest pixel stays below her face glow during the entrance".

Usage (dev server running for the captures):

    NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/relic_capture.mjs <dir>
    python src/worlds/aether/review/relic_entrance.py <dir>

or, for one still with her and the portal in one frame (and its -mask.png beside it):

    python src/worlds/aether/review/relic_entrance.py capture.png "x0,y0,x1,y1"

Every still is a `view` window onto the unmoved stage camera (camera at (0, 0, 12) looking down -z, so a world point
(x, y, z) lands on the z = 0 plane at (x, y) * 12 / (12 - z), and the view box maps that plane onto the image): one
exposure, one tone mapping and one bloom for her and the portal, so the luminances compare directly. Luminance is the
relative luminance Y of the sRGB pixel (Rec. 709, linearised).
- The portal's region: the convex hull of each portal_* node's bounding box of kit.glb, placed as layout.json's
  portal group places the arch, projected as above; pixels inside her silhouette are left out. Its brightest pixel
  is the portal's. Anything drawn in front of the portal inside that hull counts too (the bubbles rising past it,
  the coral before its steps), so the test is, if anything, stricter than the portal alone.
- Her face glow: inside her silhouette, the largest connected patch of pink-white pixels (R >= 200, B >= 170,
  R - G >= 15), if it has at least FACE_MIN_PX pixels; its brightest pixel is the face glow's.

What each comparison is (directory mode):
- entering-t<t>.png, each frozen entrance moment: the portal's brightest pixel in that frame against her face glow in
  that same frame. Where no face glow is found in the frame (she is far in the murk, small, or turned away), the
  frame's portal is compared with her intro face glow (intro.png, the same window) instead, and the line says so.
  A frozen world holds the portal's glows at their mid level, so these frames do not show the pulse's peak.
- pulse-NNN.png, the running intro over more than one glyph period (clips at pulse-times.json's offset): the portal
  at its brightest over a whole pulse. A plain per-pixel maximum over the stills is not the portal's: the bubbles and
  specks rising past it are near white (Y 1.0) and, over 30-odd stills, sweep most of its pixels. So each pixel's
  reading is the maximum over time of its minimum over a window: the stills within HOLD s either side, and always the
  still before and the still after. Whatever stays lit on a pixel for the whole window counts (the glows pulse over
  4.3 s and more; the membrane's lines flow at 0.05 turns a second), a bubble or speck that crosses the pixel faster
  does not (a slower one stays in: the reading only rises). The still nearest a pulse's peak is at most half the
  widest gap from it, and its window reaches max(HOLD, gap) further, so the reading misses a sine pulse's peak by at
  most pulse / 2 * (1 - cos(2 pi d / period)) of the emission, d = max(HOLD, gap) + gap / 2 (config.ts's portal glows,
  read below; 4 to 7% for gaps of 0.3 to 0.6 s), and is raised by that share before it is compared: for these bright pixels, in the tone curve's
  shoulder, the shown luminance grows by less than the emission does, so the raised figure is an upper bound. The
  plain maximum is printed too, for the record. The peak is compared with the dimmest face glow found in any frame
  above (the strictest reference) and with the intro face glow.
  The frozen stills keep their bubbles and specks: there, anything in front of the portal counts.
The worst ratio (portal over face glow) over every comparison is printed last.
Exit 1, on a line starting FAIL, when any ratio is 1 or more, when a capture or mask is missing, when the portal's
region is empty in a frame, when no face glow is found where one is needed (the single still; the intro), when
config.ts's portal glows cannot be read, or when the pulse stills (less HOLD s at each end) do not cover the longest
portal pulse, leave a gap over 2 * HOLD s or do not hold the whole portal region.
"""
import json
import math
import pathlib
import re
import struct
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[4]
CAMERA_Z = 12.0
NORMALIZED_MAX = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}
# relic_capture.mjs's VIEW_BOX: the window every still of the directory mode is framed by.
VIEW_BOX = (-3, 4.165, 9.5, -4.165)
FACE_MIN_PX = 200
# Half the bubble filter's window, in seconds of world time (see the pulse comparison above).
HOLD = 0.45


def fail(message):
    print('FAIL ' + message)
    sys.exit(1)


def portal_pulses():
    """config.ts's portal glows: {node: (pulse, period)}, read from WORLD_MATERIALS' entries."""
    text = (ROOT / 'src/worlds/aether/place/config.ts').read_text(encoding='utf8')
    found = {m[1]: (float(m[2]), float(m[3])) for m in re.finditer(r"node: '(portal_\w+)', material: 'glow', params: \{[^}]*?pulse: ([\d.]+), period: ([\d.]+)", text)}
    if 'portal_glyph' not in found:
        fail('config.ts has no portal_glyph glow with a pulse and a period: the pulse comparison cannot be sized')
    return found


def held_peak(lums, times, region):
    """Each pixel's maximum over time of its minimum over a window: the stills within HOLD s either side and always the
    one before and the one after; centres only where the window is whole. (luminance, pixel, centre time, centres' span)."""
    lums, times = np.asarray(lums), np.asarray(times)
    centres = [i for i, t in enumerate(times) if 0 < i < len(times) - 1 and t - HOLD >= times[0] - 1e-9 and t + HOLD <= times[-1] + 1e-9]
    if not centres:
        fail(f'the pulse stills span {times[-1] - times[0]:.2f} s: too short for a {2 * HOLD} s window')
    best = (-1.0, None, None)
    for i in centres:
        sel = (times >= times[i] - HOLD - 1e-9) & (times <= times[i] + HOLD + 1e-9)
        sel[i - 1] = sel[i + 1] = True
        held = np.where(region, lums[sel].min(0), -1.0)
        y, x = np.unravel_index(held.argmax(), held.shape)
        if held[y, x] > best[0]:
            best = (float(held[y, x]), (int(x), int(y)), float(times[i]))
    return best + (float(times[centres[-1]] - times[centres[0]]),)


def portal_boxes():
    data = (ROOT / 'public/aether/world/kit.glb').read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    boxes = []
    for node in doc['nodes']:
        name = node.get('name', '')
        if not name.startswith('portal_') or name.endswith('_lod1') or 'mesh' not in node:
            continue
        t = node.get('translation', [0, 0, 0])
        s = node.get('scale', [1, 1, 1])
        lo, hi = [math.inf] * 3, [-math.inf] * 3
        for prim in doc['meshes'][node['mesh']]['primitives']:
            a = doc['accessors'][prim['attributes']['POSITION']]
            unit = NORMALIZED_MAX[a['componentType']] if a.get('normalized') else 1
            for k in range(3):
                lo[k] = min(lo[k], t[k] + s[k] * a['min'][k] / unit)
                hi[k] = max(hi[k], t[k] + s[k] * a['max'][k] / unit)
        boxes.append((name, lo, hi))
    if not boxes:
        fail('kit.glb has no portal_* mesh node')
    return boxes


def placed(p, v):
    s = p.get('scale', 1)
    s = s if isinstance(s, list) else [s] * 3
    x, y, z = v[0] * s[0], v[1] * s[1], v[2] * s[2]
    a = p.get('rotY', 0)
    return (x * math.cos(a) + z * math.sin(a) + p['position'][0], y + p['position'][1], -x * math.sin(a) + z * math.cos(a) + p['position'][2])


def hull(points):
    pts = sorted(set(points))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for q in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0: lower.pop()
        lower.append(q)
    for q in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0: upper.pop()
        upper.append(q)
    return lower[:-1] + upper[:-1]


def inside_polygon(poly, w, h):
    yy, xx = np.mgrid[0:h, 0:w]
    xs, ys = xx + 0.5, yy + 0.5
    inside = np.ones((h, w), bool)
    n = len(poly)
    for i in range(n):  # convex, counter-clockwise in (x, y) with y down: one side of every edge
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
        inside &= (bx - ax) * (ys - ay) - (by - ay) * (xs - ax) >= 0
    return inside


def luminance(img):
    c = img / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return lin @ np.array([0.2126, 0.7152, 0.0722])


def largest_component(mask):
    seen = np.zeros_like(mask)
    best = []
    h, w = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]: continue
        comp, queue = [], deque([(y0, x0)])
        seen[y0, x0] = True
        while queue:
            y, x = queue.popleft()
            comp.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v, u = y + dy, x + dx
                if 0 <= v < h and 0 <= u < w and mask[v, u] and not seen[v, u]:
                    seen[v, u] = True
                    queue.append((v, u))
        if len(comp) > len(best): best = comp
    out = np.zeros_like(mask)
    for y, x in best: out[y, x] = True
    return out


def load(path):
    path = pathlib.Path(path)
    if not path.exists():
        fail(f'no capture at {path}')
    return np.asarray(Image.open(path).convert('RGB'), dtype=float)


def load_mask(path):
    path = pathlib.Path(path)
    if not path.exists():
        fail(f'no silhouette mask at {path}')
    return np.asarray(Image.open(path).convert('L')) > 127


def portal_region(shape, box, her):
    """The portal's pixels in a still of `shape` framed by `box` (her silhouette left out), and each node's own."""
    h, w = shape
    x0, y0, x1, y1 = box
    ppu = min(w / (x1 - x0), h / (y0 - y1))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    to_px = lambda p: (w / 2 + ppu * (p[0] * CAMERA_Z / (CAMERA_Z - p[2]) - cx), h / 2 - ppu * (p[1] * CAMERA_Z / (CAMERA_Z - p[2]) - cy))
    layout = json.loads((ROOT / 'src/worlds/aether/place/layout.json').read_text())
    arch = layout['groups']['portal'][0]
    region = np.zeros((h, w), bool)
    nodes = {}
    for name, lo, hi in portal_boxes():
        corners = [placed(arch, (a, b, c)) for a in (lo[0], hi[0]) for b in (lo[1], hi[1]) for c in (lo[2], hi[2])]
        own = inside_polygon(hull([to_px(p) for p in corners]), w, h) & ~her
        nodes[name] = own
        region |= own
    return region, nodes


def face_glow(img, her):
    """Her face glow: (brightest luminance, its pixel, its colour, patch size), or None when no pink-white patch of FACE_MIN_PX is found."""
    pink = her & (img[..., 0] >= 200) & (img[..., 2] >= 170) & (img[..., 0] - img[..., 1] >= 15)
    if not pink.any():
        return None
    face = largest_component(pink)
    if face.sum() < FACE_MIN_PX:
        return None
    lum = luminance(img)
    y, x = np.unravel_index(np.where(face, lum, -1).argmax(), lum.shape)
    return lum[y, x], (int(x), int(y)), img[y, x], int(face.sum())


def brightest(img, region):
    """The brightest pixel of `region`: (luminance, pixel, colour), or None for an empty region."""
    if not region.any():
        return None
    lum = luminance(img)
    y, x = np.unravel_index(np.where(region, lum, -1).argmax(), lum.shape)
    return lum[y, x], (int(x), int(y)), img[y, x]


def hx(c):
    return '#%02x%02x%02x' % tuple(int(v) for v in c)


def single(path, box):
    """One still with her and the portal in one frame."""
    img = load(path)
    her = load_mask(path.replace('.png', '-mask.png'))
    region, nodes = portal_region(img.shape[:2], box, her)
    portal = brightest(img, region)
    if portal is None:
        fail(f'the portal\'s region is empty in {path}: frame her and the portal together')
    for name, own in nodes.items():
        b = brightest(img, own)
        if b: print(f'  {name:16} box region {int(own.sum()):6d} px, brightest Y {b[0]:.3f} at {b[1]} {hx(b[2])}')
    face = face_glow(img, her)
    if face is None:
        fail(f'no face glow found in {path} (no pink-white patch of {FACE_MIN_PX} px inside her silhouette): nothing to compare with')
    ratio = portal[0] / face[0]
    print(f'portal brightest Y {portal[0]:.3f} at {portal[1]} {hx(portal[2])}; face glow ({face[3]} px) brightest Y {face[0]:.3f} at {face[1]} {hx(face[2])}')
    if ratio >= 1:
        fail(f'the portal\'s brightest pixel is not below the face glow\'s ({portal[0]:.3f} vs {face[0]:.3f}, ratio {ratio:.2f})')
    print(f'ok   the portal\'s brightest pixel is below the face glow\'s ({portal[0]:.3f} vs {face[0]:.3f}, ratio {ratio:.2f})')


def directory(folder):
    folder = pathlib.Path(folder)
    intro = load(folder / 'intro.png')
    intro_her = load_mask(folder / 'intro-mask.png')
    intro_face = face_glow(intro, intro_her)
    if intro_face is None:
        fail(f'no face glow found in the frozen intro {folder / "intro.png"}: the reference is missing')
    print(f'intro face glow (frozen intro, same window): Y {intro_face[0]:.3f} at {intro_face[1]} {hx(intro_face[2])} ({intro_face[3]} px)')
    ratios, faces = [], [(intro_face[0], 'intro')]
    stills = [p for p in folder.glob('entering-t*.png') if not p.stem.endswith('-mask')]
    stills.sort(key=lambda p: float(p.stem[len('entering-t'):]))
    if not stills:
        fail(f'no entering-t*.png in {folder}: run relic_capture.mjs')
    for p in stills:
        t = p.stem[len('entering-t'):]
        img = load(p)
        her = load_mask(p.with_name(p.stem + '-mask.png'))
        region, _ = portal_region(img.shape[:2], VIEW_BOX, her)
        portal = brightest(img, region)
        if portal is None:
            fail(f'the portal\'s region is empty in {p.name}')
        face = face_glow(img, her)
        if face is not None:
            faces.append((face[0], f'entrance t {t}'))
            ref, against = face[0], f'her face glow in this frame ({face[3]} px) Y {face[0]:.3f}'
        else:
            ref, against = intro_face[0], f'her INTRO face glow Y {intro_face[0]:.3f} (no face glow of {FACE_MIN_PX} px in this frame; her silhouette is {int(her.sum())} px)'
        ratio = portal[0] / ref
        ratios.append((ratio, f'entrance t {t}'))
        print(f'{"ok  " if ratio < 1 else "MISS"} entrance t {t:>4}: portal brightest Y {portal[0]:.3f} at {portal[1]} {hx(portal[2])} vs {against}: ratio {ratio:.2f}')
    timing = folder / 'pulse-times.json'
    if not timing.exists():
        fail(f'no pulse-times.json in {folder}: run relic_capture.mjs')
    meta = json.loads(timing.read_text())
    times = meta['times']
    span = times[-1] - times[0]
    pulses = portal_pulses()
    longest = max(period for _, period in pulses.values())
    clips = sorted(folder.glob('pulse-[0-9][0-9][0-9].png'))
    if len(clips) != len(times):
        fail(f'{len(clips)} pulse stills against {len(times)} recorded times')
    gap = max(b - a for a, b in zip(times, times[1:]))
    if gap > 2 * HOLD:
        fail(f'a gap of {gap:.2f} s between pulse stills (at most {2 * HOLD} s): the filter window would hold a single still')
    c = meta['clip']
    window = (slice(c['y'], c['y'] + c['height']), slice(c['x'], c['x'] + c['width']))
    region, nodes = portal_region(intro.shape[:2], VIEW_BOX, intro_her)
    inside = np.zeros_like(region)
    inside[window] = True
    if not region.any():
        fail('the portal\'s region is empty in the intro window')
    if (region & ~inside).any():
        fail(f'{int((region & ~inside).sum())} px of the portal\'s region lie outside the pulse clip {c}: widen PULSE_CLIP')
    lums = [luminance(load(p)) for p in clips]
    if any(l.shape != (c['height'], c['width']) for l in lums):
        fail(f'a pulse still is not the clip\'s size {c["width"]} x {c["height"]}')
    clip_region = region[window]
    plain = np.where(clip_region, np.max(lums, axis=0), -1.0)
    py, px = np.unravel_index(plain.argmax(), plain.shape)
    print(f'pulse: {len(clips)} running stills over {span:.2f} s (widest gap {meta["widestGap"]:.2f} s); portal glows {", ".join(f"{n} pulse {p} period {T} s" for n, (p, T) in pulses.items())}')
    print(f'     plain per-pixel maximum Y {plain[py, px]:.3f} at ({px + c["x"]}, {py + c["y"]}): the bubbles and specks rising past the portal (not compared)')
    held, at, centre, covered = held_peak(lums, times, clip_region)
    if covered < longest:
        fail(f'the filtered stills cover {covered:.2f} s of world time, less than the longest portal pulse ({longest} s): capture longer')
    # The still nearest a pulse's peak is at most gap / 2 from it, and its window reaches HOLD (or a gap, for the
    # neighbours it always takes) further.
    reach = max(HOLD, gap) + gap / 2
    loss = max(p / 2 * (1 - math.cos(2 * math.pi * reach / T)) for p, T in pulses.values())
    peak = held / (1 - loss)
    print(f'     held over each window: Y {held:.3f} at ({at[0] + c["x"]}, {at[1] + c["y"]}) around {centre:.2f} s, over {covered:.2f} s of centres; '
          f'raised by the most a pulse loses within {reach:.2f} s of its peak ({loss:.3f}): Y {peak:.3f}')
    for name, own in nodes.items():
        h = held_peak(lums, times, own[window])
        print(f'       {name:16} held Y {h[0]:.3f} at ({h[1][0] + c["x"]}, {h[1][1] + c["y"]}) around {h[2]:.2f} s')
    dimmest = min(faces)
    for ref, name in ((dimmest[0], f'the dimmest face glow found ({dimmest[1]})'), (intro_face[0], 'her intro face glow')):
        ratio = peak / ref
        ratios.append((ratio, f'pulse peak vs {name}'))
        print(f'{"ok  " if ratio < 1 else "MISS"} pulse peak vs {name} Y {ref:.3f}: ratio {ratio:.2f}')
    worst = max(ratios)
    if worst[0] >= 1:
        fail(f'worst ratio {worst[0]:.2f} ({worst[1]}): the portal is not below her face glow there')
    print(f'ok   worst ratio {worst[0]:.2f} ({worst[1]}): the portal stays below her face glow')


def main():
    if len(sys.argv) == 2 and pathlib.Path(sys.argv[1]).is_dir():
        directory(sys.argv[1])
    elif len(sys.argv) == 3:
        single(sys.argv[1], [float(v) for v in sys.argv[2].split(',')])
    else:
        fail('usage: relic_entrance.py <dir from relic_capture.mjs>  |  relic_entrance.py capture.png "x0,y0,x1,y1"')


if __name__ == '__main__':
    main()
