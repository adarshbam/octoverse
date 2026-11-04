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
  portal group places the arch, projected as above; pixels inside her silhouette are left out. A pixel's owners are
  the nodes whose hull holds it (the hulls overlap: the glyph's lies inside the membrane's, which lies inside the
  arch's). Anything drawn in front of the portal inside a hull lands in the region too (the bubbles and specks rising
  past it, the coral before its steps, her light on the stone).
- The portal's own light: the frozen world holds every glow at its mid level and the membrane's flow still, so the
  portal draws the same pixels in every frozen still (the entrance's eight and the intro), while the bubbles and
  specks move with each still's world time and her light moves with her. The per-pixel median over those nine stills
  (her silhouette, grown by HER_MARGIN px for her bloom, left out of each; at least five stills a pixel) is the
  portal's own frozen light. A frame's pixel more than TRANSIENT_DY above it is transient: not the portal's own.
- Her face glow: inside her silhouette, the largest connected patch of pink-white pixels (R >= 200, B >= 170,
  R - G >= 15), if it has at least FACE_MIN_PX pixels; its brightest pixel is the face glow's.
- Her face glow's trough: the engine (Octopus.tsx) scales the face glow by 1 + 0.06 sin(breath) + 0.025 sin(0.37 t +
  1.3) while she moves and holds it at 1 when frozen, so every frozen still shows it at its middle. face-NNN.png, the
  running intro clipped to her face for longer than the 17 s drift, gives its dimmest reading. In the intro her face
  glow's brightest pixel is clipped (Y 0.908, R and B at 255 over a thousand pixels) and holds through the swing, so
  the patch's FACE_LEVEL quantile, which is not clipped, stands for it (its dip is the larger: see face_trough). Those
  stills may miss the true trough (both terms at their lowest at once, between two stills) by at most `missed` of the
  glow's strength, so the measured drop below the frozen intro's level is scaled by swing / (swing - missed),
  swing = 0.085: the trough factor r is the frozen level's share left at that bound, and it scales every face glow
  that a portal at its own light or its pulse peak is compared with. Her rest (a further 15% after 40 s idle in the
  intro) never comes in the entrance; the face stills end before it (relic_capture.mjs).

What each comparison is (directory mode):
- The frames: frames.json names ENTRANCE_T; every entering-t<t>.png and -mask.png of that set must be there, none
  other, all written after the run's start (a stale frame from an older run fails). Her silhouette must hold at least
  FACE_MIN_PX in every frame.
- entering-t<t>.png, each frozen moment (both at mid level): the frame's brightest region pixel, its owners and the
  portal's own light there, against her face glow in that same frame. A transient pixel at a ratio of 1 or more is
  printed as NOTE (not the portal's own) and not counted; the portal's own at 1 or more fails. Only a frame of FAR_T
  may lack a face glow (she is far in the murk): it is compared with the dimmest face glow measured in any frame and
  marked UNVERIFIED, with her own brightest pixel in that frame printed beside it.
- pulse-NNN.png, the running intro over more than one glyph period (clips at pulse-times.json's offset): the portal
  at its brightest over a whole pulse. A plain per-pixel maximum over the stills is not the portal's: the bubbles and
  specks rising past it are near white (Y 1.0) and sweep most of its pixels. So each pixel's reading is the maximum
  over time of its minimum over a window: the stills within HOLD s either side, and always the still before and the
  still after. Whatever stays lit on a pixel for the whole window counts (the glows pulse over 4.3 s and more; the
  membrane's lines flow at 0.05 turns a second), a bubble or speck that crosses the pixel faster does not (a slower
  one stays in: the reading only rises). The still nearest a pulse's peak is at most half the widest gap from it, and
  its window reaches max(HOLD, gap) further, so the reading misses a sine pulse's peak by at most
  pulse / 2 * (1 - cos(2 pi d / period)) of the emission, d = max(HOLD, gap) + gap / 2 (config.ts's portal glows),
  and is raised by that share: for these bright pixels, in the tone curve's shoulder, the shown luminance grows by
  less than the emission does, so the raised figure is an upper bound. LIMIT: the filter hides anything on the portal
  lit for less than about 2 * HOLD s (a membrane flash, if a sequence ever drives one); the plain (unfiltered)
  maximum is printed beside it, with its owners and the portal's own light there, for that reason.
  The peak is compared with the dimmest face glow measured in any frame times the trough factor r: the portal at its
  brightest while her face glow is at its lowest.
The worst counted ratio is printed last.
Exit 1, on a line starting FAIL, when a counted ratio is 1 or more, when a capture, mask, manifest or timing file is
missing, stale or unexpected, when her silhouette is under FACE_MIN_PX in a frame, when the portal's region is empty,
when no face glow is found where one is needed (any frame but FAR_T's, the intro, every face still), when config.ts's
portal glows or character.ts's breath cannot be read, when the pulse stills (less HOLD s at each end) do not cover
the longest portal pulse, leave a gap over 2 * HOLD s or do not hold the portal's region, or when the face stills do
not cover the drift, end after her rest could begin, or never dim below the frozen face glow.
"""
import json
import math
import pathlib
import re
import struct
import sys
import warnings
from collections import deque

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[4]
CAMERA_Z = 12.0
NORMALIZED_MAX = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}
# relic_capture.mjs's VIEW_BOX and ENTRANCE_T (as its file names spell them): the window and the frozen moments.
VIEW_BOX = (-3, 4.165, 9.5, -4.165)
ENTRANCE_T = ('1', '2', '3.2', '4.5', '5.5', '6.5', '7.5', '8.4')
# The moments where she is too far in the murk for a face glow to be found (placeholder entrance): UNVERIFIED there.
FAR_T = ('1',)
FACE_MIN_PX = 200
# The face patch's quantile whose dip stands for the face glow's (its brightest pixel is clipped: see face_trough).
FACE_LEVEL = 0.9
# Half the bubble filter's window, in seconds of world time (see the pulse comparison above).
HOLD = 0.45
# A frame's pixel this far above the portal's own frozen light is transient (a bubble, a speck, her light).
TRANSIENT_DY = 0.05
# The portal's stone: kit nodes with no kit material (config.ts WORLD_MATERIALS names only the membrane, glyph and lanterns).
STONE_NODES = ('portal_arch', 'portal_steps')
# Her silhouette grown by this many pixels when the portal's own light is taken (her bloom spills past it).
HER_MARGIN = 8
# The face glow's swing while she moves (Octopus.tsx: uGlowStrength = (1 + 0.06 b + 0.025 sin(0.37 t + 1.3)) ...).
BREATH_AMP, DRIFT_AMP, DRIFT_RATE = 0.06, 0.025, 0.37
# The face stills must end before her rest can begin (40 s idle in the intro), less a margin.
REST_BY = 39.0


def fail(message):
    print('FAIL ' + message)
    sys.exit(1)


def portal_pulses():
    """config.ts's portal glows: {node: (pulse, period)}, read from WORLD_MATERIALS' entries (either order in params)."""
    text = (ROOT / 'src/worlds/aether/place/config.ts').read_text(encoding='utf8')
    found = {}
    for m in re.finditer(r"node: '(portal_\w+)', material: 'glow', params: \{([^}]*)\}", text):
        pulse = re.search(r'\bpulse: ([\d.]+)', m[2])
        period = re.search(r'\bperiod: ([\d.]+)', m[2])
        if not pulse or not period:
            fail(f'config.ts\'s {m[1]} glow has no readable pulse and period ({m[2].strip()}): the pulse comparison cannot be sized')
        found[m[1]] = (float(pulse[1]), float(period[1]))
    if 'portal_glyph' not in found:
        fail('config.ts has no portal_glyph glow with a pulse and a period: the pulse comparison cannot be sized')
    return found


def breath_period():
    text = (ROOT / 'src/worlds/aether/character.ts').read_text(encoding='utf8')
    m = re.search(r'\bbreathPeriod: ([\d.]+)', text)
    if not m:
        fail('character.ts has no breathPeriod: the face glow\'s trough cannot be sized')
    return float(m[1])


def held_map(lums, times):
    """Each pixel's maximum over time of its minimum over a window: the stills within HOLD s either side and always the
    one before and the one after; centres only where the window is whole. (the map, each pixel's centre time, the centres' span)."""
    lums, times = np.asarray(lums), np.asarray(times)
    centres = [i for i, t in enumerate(times) if 0 < i < len(times) - 1 and t - HOLD >= times[0] - 1e-9 and t + HOLD <= times[-1] + 1e-9]
    if not centres:
        fail(f'the pulse stills span {times[-1] - times[0]:.2f} s: too short for a {2 * HOLD} s window')
    best = np.full(lums.shape[1:], -1.0)
    when = np.zeros(lums.shape[1:])
    for i in centres:
        sel = (times >= times[i] - HOLD - 1e-9) & (times <= times[i] + HOLD + 1e-9)
        sel[i - 1] = sel[i + 1] = True
        held = lums[sel].min(0)
        when = np.where(held > best, times[i], when)
        best = np.maximum(best, held)
    return best, when, float(times[centres[-1]] - times[centres[0]])


def peak_in(held, when, region):
    """The brightest held pixel of `region`: (luminance, (x, y) in the clip, centre time), or None for an empty region."""
    if not region.any():
        return None
    m = np.where(region, held, -1.0)
    y, x = np.unravel_index(m.argmax(), m.shape)
    return float(m[y, x]), (int(x), int(y)), float(when[y, x])


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


def grown(mask, r):
    """`mask` grown by `r` pixels (a square)."""
    out = mask.copy()
    h, w = mask.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] |= mask[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
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


def owners(nodes, at):
    """The portal nodes whose hull holds pixel `at` (x, y), smallest hull first."""
    x, y = at
    held = [(int(own.sum()), name) for name, own in nodes.items() if own[y, x]]
    return '/'.join(name.replace('portal_', '') for _, name in sorted(held)) or 'none'


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
    if her.sum() < FACE_MIN_PX:
        fail(f'her silhouette in {path} is {int(her.sum())} px (under {FACE_MIN_PX}): the mask is empty or wrong')
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
    print(f'portal brightest Y {portal[0]:.3f} at {portal[1]} ({owners(nodes, portal[1])}) {hx(portal[2])}; face glow ({face[3]} px) brightest Y {face[0]:.3f} at {face[1]} {hx(face[2])}')
    if ratio >= 1:
        fail(f'the portal\'s brightest pixel is not below the face glow\'s ({portal[0]:.3f} vs {face[0]:.3f}, ratio {ratio:.2f})')
    print(f'ok   the portal\'s brightest pixel is below the face glow\'s ({portal[0]:.3f} vs {face[0]:.3f}, ratio {ratio:.2f})')


def frames(folder):
    """This run's frozen frames: {t: (still path, mask path)} for ENTRANCE_T, checked against frames.json."""
    manifest = folder / 'frames.json'
    if not manifest.exists():
        fail(f'no frames.json in {folder}: run relic_capture.mjs (without --running-only) first')
    meta = json.loads(manifest.read_text())
    listed = tuple(f'{t:g}' if isinstance(t, (int, float)) else str(t) for t in meta.get('entranceT', []))
    if listed != ENTRANCE_T:
        fail(f'frames.json lists the moments {listed}, not {ENTRANCE_T}: relic_capture.mjs and relic_entrance.py disagree')
    started = meta.get('started')
    if not isinstance(started, (int, float)):
        fail('frames.json has no start time')
    found = {p.name for p in folder.glob('entering-t*.png')}
    expected = {f'entering-t{t}{s}.png' for t in ENTRANCE_T for s in ('', '-mask')}
    if found - expected:
        fail(f'unexpected entrance frames in {folder}: {sorted(found - expected)} (stale from another run?)')
    if expected - found:
        fail(f'missing entrance frames in {folder}: {sorted(expected - found)}')
    for name in sorted(expected | {'intro.png', 'intro-mask.png'}):
        p = folder / name
        if not p.exists():
            fail(f'no capture at {p}')
        if p.stat().st_mtime * 1000 < started - 2000:
            fail(f'{p} was written before this run started (frames.json): a stale frame')
    return {t: (folder / f'entering-t{t}.png', folder / f'entering-t{t}-mask.png') for t in ENTRANCE_T}


def face_level(img, her):
    """Her face patch's brightest luminance and its FACE_LEVEL quantile, or None (see face_glow)."""
    pink = her & (img[..., 0] >= 200) & (img[..., 2] >= 170) & (img[..., 0] - img[..., 1] >= 15)
    if not pink.any():
        return None
    face = largest_component(pink)
    if face.sum() < FACE_MIN_PX:
        return None
    v = np.sort(luminance(img)[face])
    return float(v[-1]), float(v[int(FACE_LEVEL * (len(v) - 1))])


def face_trough(folder, intro, intro_her):
    """The trough factor r: the share of the frozen face glow (intro, same window) left at her dimmest. Her face glow's
    brightest pixel is clipped in the intro (R and B at 255 over a thousand pixels and more), so it holds still through
    the swing and cannot show the trough; the FACE_LEVEL quantile of the patch is not clipped, and its dip is taken as the
    face glow's (a brighter pixel sits deeper in the tone curve's shoulder and dips less, so this is the larger dip; her
    sway and the patch's changing size dip it too, which only adds)."""
    reference = face_level(intro, intro_her)[1]
    timing = folder / 'face-times.json'
    if not timing.exists():
        fail(f'no face-times.json in {folder}: run relic_capture.mjs')
    meta = json.loads(timing.read_text())
    times, c = meta['times'], meta['clip']
    stills = sorted(folder.glob('face-[0-9][0-9][0-9].png'))
    if len(stills) != len(times):
        fail(f'{len(stills)} face stills against {len(times)} recorded times')
    drift = 2 * math.pi / DRIFT_RATE
    if times[-1] - times[0] < drift:
        fail(f'the face stills cover {times[-1] - times[0]:.2f} s, less than the face glow\'s drift ({drift:.1f} s)')
    if meta['pageAge'] > REST_BY:
        fail(f'the face stills ended {meta["pageAge"]:.1f} s after the page started: she may have begun to rest (40 s)')
    readings, tops = [], []
    for p in stills:
        img = load(p)
        if img.shape[:2] != (c['height'], c['width']):
            fail(f'{p.name} is not the face clip\'s size {c["width"]} x {c["height"]}')
        level = face_level(img, np.ones(img.shape[:2], bool))
        if level is None:
            fail(f'no face glow found in {p.name}: the face clip misses her')
        tops.append(level[0])
        readings.append(level[1])
    lo, hi = min(readings), max(readings)
    gap = max(b - a for a, b in zip(times, times[1:]))
    breath = breath_period()
    # Over a whole drift period one breath trough falls within breath / 2 of the drift's trough, and the nearest still
    # within gap / 2 of the breath's trough: the stills' dimmest may sit this much of the strength above the true trough.
    missed = DRIFT_AMP * (1 - math.cos(DRIFT_RATE * breath / 2)) + BREATH_AMP * (1 - math.cos(math.pi * gap / breath))
    swing = BREATH_AMP + DRIFT_AMP
    drop = reference - lo
    if drop <= 0:
        fail(f'the running face glow never dims below the frozen one ({lo:.3f} vs {reference:.3f}): the trough was not caught')
    bound = reference - drop * swing / (swing - missed)
    r = bound / reference
    print(f'face glow trough: {len(stills)} running stills over {times[-1] - times[0]:.2f} s (widest gap {gap:.2f} s, page age {meta["pageAge"]:.1f} s); '
          f'brightest pixel Y {min(tops):.3f} to {max(tops):.3f} (clipped: holds through the swing)')
    print(f'     the patch\'s {FACE_LEVEL:.0%} level Y {lo:.3f} to {hi:.3f} against {reference:.3f} frozen; the stills may miss {missed:.3f} of the {swing:.3f} swing, '
          f'so the trough is at most Y {bound:.3f}: r = {r:.3f}')
    return r


def directory(folder):
    folder = pathlib.Path(folder)
    stills = frames(folder)
    intro = load(folder / 'intro.png')
    intro_her = load_mask(folder / 'intro-mask.png')
    if intro_her.sum() < FACE_MIN_PX:
        fail(f'her silhouette in the frozen intro is {int(intro_her.sum())} px (under {FACE_MIN_PX}): the mask is empty or wrong')
    intro_face = face_glow(intro, intro_her)
    if intro_face is None:
        fail(f'no face glow found in the frozen intro {folder / "intro.png"}: the reference is missing')
    print(f'intro face glow (frozen intro, same window): Y {intro_face[0]:.3f} at {intro_face[1]} {hx(intro_face[2])} ({intro_face[3]} px)')

    # Every frozen frame, her silhouette checked, and the portal's own frozen light (the median over the nine stills).
    shots = []
    for t, (path, mask_path) in stills.items():
        img, her = load(path), load_mask(mask_path)
        if her.sum() < FACE_MIN_PX:
            fail(f'her silhouette in {path.name} is {int(her.sum())} px (under {FACE_MIN_PX}): the mask is empty or wrong')
        shots.append((t, img, her))
    lums = np.stack([np.where(grown(her, HER_MARGIN), np.nan, luminance(img)) for _, img, her in shots + [('intro', intro, intro_her)]])
    valid = np.sum(~np.isnan(lums), axis=0)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)  # a pixel she covers in every still has no median
        own_light = np.where(valid >= 5, np.nanmedian(lums, axis=0), np.nan)

    faces, measured = {}, []
    for t, img, her in shots:
        face = face_glow(img, her)
        faces[t] = face
        if face is not None:
            measured.append((face[0], t))
        elif t not in FAR_T:
            fail(f'no face glow found in entering-t{t}.png (her silhouette {int(her.sum())} px): only FAR_T {FAR_T} may lack one')
    if not measured:
        fail('no face glow found in any entrance frame')
    dimmest = min(measured)
    r = face_trough(folder, intro, intro_her)

    counted, area, unverified = [], [], []
    for t, img, her in shots:
        region, nodes = portal_region(img.shape[:2], VIEW_BOX, her)
        portal = brightest(img, region)
        if portal is None:
            fail(f'the portal\'s region is empty in entering-t{t}.png')
        x, y = portal[1]
        own = own_light[y, x]
        transient = not np.isnan(own) and portal[0] - own > TRANSIENT_DY
        what = (f'transient: the portal\'s own light there is Y {own:.3f} (a bubble, speck or her light, not the portal\'s own)' if transient
                else 'the portal\'s own light' if not np.isnan(own) else 'her silhouette covers it in most stills: counted as the portal\'s own')
        face = faces[t]
        if face is not None:
            ref, against = face[0], f'her face glow in this frame ({face[3]} px) Y {face[0]:.3f}'
        else:
            ref, against = dimmest[0], f'the dimmest face glow measured (t {dimmest[1]}) Y {dimmest[0]:.3f}'
        ratio = portal[0] / ref
        line = f'entrance t {t:>4}: brightest in the portal\'s area Y {portal[0]:.3f} at ({x}, {y}) {hx(portal[2])} in {owners(nodes, (x, y))}, {what}; vs {against}: ratio {ratio:.3f}'
        if face is None:
            her_max = luminance(img)[her].max()
            line += f'. UNVERIFIED: no face glow of {FACE_MIN_PX} px in this frame (silhouette {int(her.sum())} px); her own brightest pixel here is Y {her_max:.3f} (ratio {portal[0] / her_max:.3f})'
            unverified.append(t)
        if transient:
            # Not the portal's own: reported, never decides the verdict.
            area.append((ratio, f'entrance t {t}'))
            print(f'area {line}')
        else:
            counted.append((ratio, f'entrance t {t}, the portal\'s own pixel'))
            print(f'{"ok  " if ratio < 1 else "MISS"} {line}')
        # The portal's own frozen light in this frame (where she does not cover it) against her face glow's trough.
        mine = np.where(region & ~np.isnan(own_light), own_light, -1.0)
        oy, ox = np.unravel_index(mine.argmax(), mine.shape)
        if mine[oy, ox] < 0:
            fail(f'no pixel of the portal\'s own light is known in entering-t{t}.png')
        own_ratio = mine[oy, ox] / (ref * r)
        counted.append((own_ratio, f'the portal\'s own light at t {t} vs her trough'))
        print(f'{"ok  " if own_ratio < 1 else "MISS"}   the portal\'s own brightest here Y {mine[oy, ox]:.3f} at ({ox}, {oy}) in {owners(nodes, (ox, oy))}, '
              f'vs that face glow at its trough (x r {r:.3f}) Y {ref * r:.3f}: ratio {own_ratio:.3f}{" (UNVERIFIED)" if face is None else ""}')

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
    at = (int(px + c['x']), int(py + c['y']))
    print(f'pulse: {len(clips)} running stills over {span:.2f} s (widest gap {gap:.2f} s); portal glows {", ".join(f"{n} pulse {p} period {T} s" for n, (p, T) in pulses.items())}')
    print(f'     unfiltered per-pixel maximum Y {plain[py, px]:.3f} at {at} in {owners(nodes, at)}; the portal\'s own frozen light there Y {own_light[at[1], at[0]]:.3f} (not compared: the bubbles and specks rising past)')
    held, when, covered = held_map(lums, times)
    if covered < longest:
        fail(f'the filtered stills cover {covered:.2f} s of world time, less than the longest portal pulse ({longest} s): capture longer')
    # The still nearest a pulse's peak is at most gap / 2 from it, and its window reaches HOLD (or a gap, for the
    # neighbours it always takes) further.
    reach = max(HOLD, gap) + gap / 2
    loss = max(p / 2 * (1 - math.cos(2 * math.pi * reach / T)) for p, T in pulses.values())
    # The stone (a pixel only the arch's or the steps' hull holds) has no material of its own: no glow, no pulse, no
    # flow, so it draws its frozen light whenever the world runs. A held stone pixel above that by TRANSIENT_DY is a slow
    # bubble or speck. Every pixel a glowing node's hull holds (STONE_NODES aside) counts as held, however it got there.
    glowing = np.zeros_like(clip_region)
    for name, own in nodes.items():
        if name not in STONE_NODES:
            glowing |= own[window]
    own_clip = own_light[window]
    slow = clip_region & ~glowing & ~np.isnan(own_clip) & (held - np.nan_to_num(own_clip) > TRANSIENT_DY)
    def put(p):
        return (p[1][0] + c['x'], p[1][1] + c['y'])
    peak_px = peak_in(held, when, clip_region & ~slow)
    any_px = peak_in(held, when, clip_region)
    peak = peak_px[0] / (1 - loss)
    a = put(any_px)
    print(f'     filtered (held over each window), anything in the area: Y {any_px[0]:.3f} at {a} in {owners(nodes, a)} around {any_px[2]:.2f} s, '
          f'the portal\'s own frozen light there Y {own_light[a[1], a[0]]:.3f}{" (a slow bubble or speck on the stone)" if slow[any_px[1][1], any_px[1][0]] else ""}')
    p = put(peak_px)
    print(f'     filtered, the portal\'s own (the glowing nodes\' hulls, and the stone at its own light): Y {peak_px[0]:.3f} at {p} in {owners(nodes, p)} around {peak_px[2]:.2f} s; '
          f'over {covered:.2f} s of centres; raised by the most a pulse loses within {reach:.2f} s of its peak ({loss:.3f}): Y {peak:.3f}')
    for name, own in nodes.items():
        h = peak_in(held, when, own[window] & ~slow)
        if h:
            print(f'       {name:16} held Y {h[0]:.3f} at {put(h)} around {h[2]:.2f} s')
    trough = dimmest[0] * r
    ratio = peak / trough
    counted.append((ratio, 'the portal\'s pulse peak vs her face glow\'s trough'))
    area.append((any_px[0] / (1 - loss) / trough, 'pulse, anything in the area'))
    print(f'{"ok  " if ratio < 1 else "MISS"} pulse peak Y {peak:.3f} vs her face glow\'s trough: the dimmest measured (t {dimmest[1]}) Y {dimmest[0]:.3f} x r {r:.3f} = Y {trough:.3f}: ratio {ratio:.3f}')

    worst = max(counted)
    busiest = max(area) if area else None
    tail = (f'; UNVERIFIED at t {", ".join(unverified)} (no face glow found there)' if unverified else '') + \
           (f'; the bubbles and specks in the portal\'s area (not its own light, not counted) reach ratio {busiest[0]:.3f} ({busiest[1]})' if busiest else '')
    if worst[0] >= 1:
        fail(f'worst counted ratio {worst[0]:.3f} ({worst[1]}): the portal is not below her face glow there{tail}')
    print(f'ok   worst counted ratio {worst[0]:.3f} ({worst[1]}): the portal stays below her face glow{tail}')


def main():
    if len(sys.argv) == 2 and pathlib.Path(sys.argv[1]).is_dir():
        directory(sys.argv[1])
    elif len(sys.argv) == 3:
        single(sys.argv[1], [float(v) for v in sys.argv[2].split(',')])
    else:
        fail('usage: relic_entrance.py <dir from relic_capture.mjs>  |  relic_entrance.py capture.png "x0,y0,x1,y1"')


if __name__ == '__main__':
    main()
