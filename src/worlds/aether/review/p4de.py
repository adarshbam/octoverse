"""P4 samples (spec 2.1) on Aether's tech-focus render. Same sRGB->Lab and CIE76 as scripts/check_stage.py.

Usage (from the repo root): python src/worlds/aether/review/p4de.py <face3x.png> <tf509.png>
  face3x: a capture of view=-0.57,-0.17,0.63,-1.07 at 360x270 (300 px a unit)
  tf509:  the tech focus at view=-2.545,2.52,2.545,-2.52, 509x504 (100 px a unit)
Both captures are frozen tech focus stills with the expression forced (expression=curious in the URL).
A real tech focus shows the overview's face (happy, WorldHost draws the returnTo pose), so these samples
describe the curious face Task 19's arm lift will show, not anything a visitor sees today.
The three ways read very differently on the same capture (Task 13: inside 7.5 at the centroid, 15.0 by
region mean, 64.7 eye-registered); only the most favourable registration passes.
Mouth samples, two ways:
  (a) feature-matched: the mean over the rendered mouth-inside region and the rendered tongue region
      (classified by colour inside the mouth's box on the 3x capture), and a 15x15 (5x5 native) patch at each centroid;
  (b) eye-registered: P4's sample point carried by the similarity that maps P4's eye centres onto the render's
      (found on the 3x capture), a 15x15 patch there.
Focused orb rim: printed by p4rim.py (the orb is found on the 509 capture)."""
import sys, json
import numpy as np
from PIL import Image

def lab(rgb):
    c = np.asarray(rgb, float) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    f = m @ lin / np.array([0.95047, 1.0, 1.08883])
    f = np.where(f > 216 / 24389, np.cbrt(f), (24389 / 27 * f + 16) / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])

de = lambda a, b: float(np.linalg.norm(lab(a) - lab(b)))
T = {s['name']: s for s in json.load(open('src/worlds/aether/review/targets.json'))['samples'] if s['panel'] == 4}
face = np.asarray(Image.open(sys.argv[1]).convert('RGB'), float)
H, W, _ = face.shape

def patch(img, x, y, r):
    x, y = int(round(x)), int(round(y))
    return img[y - r:y + r + 1, x - r:x + r + 1].reshape(-1, 3).mean(0)

# The mouth's box on the 3x capture: dark-ish, saturated pixels below the eyes and above the chin.
r, g, b = face[..., 0], face[..., 1], face[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
yy, xx = np.mgrid[0:H, 0:W]
band = (yy > 110) & (yy < 200) & (xx > 100) & (xx < 250)
inside = band & (lum < 110) & (r > g + 20)
tongue = band & (r > 200) & (r - g > 60) & (r - b > 40) & (g < 175)
print(f'mouth-inside region {int(inside.sum())} px, tongue region {int(tongue.sum())} px (3x)')
for name, mask in [('Open-mouth inside', inside), ('Open-mouth tongue', tongue)]:
    s = T[name]
    if not mask.any():
        print(f'  {name}: region not found')
        continue
    mean = face[mask].mean(0)
    cy, cx = (yy[mask].mean(), xx[mask].mean())
    p = patch(face, cx, cy, 7)
    print(f"  {name:18} target {tuple(s['rgb'])}  region mean {tuple(int(round(v)) for v in mean)} dE {de(mean, s['rgb']):5.1f} | centroid ({cx:.0f},{cy:.0f}) 15x15 {tuple(int(round(v)) for v in p)} dE {de(p, s['rgb']):5.1f}")

# Eye centres on the render: the two darkest blobs (pupils) in the upper band.
pupil = (yy < 120) & (lum < 60)
eyes = [(xx[pupil & (xx < W / 2)].mean(), yy[pupil & (xx < W / 2)].mean()), (xx[pupil & (xx >= W / 2)].mean(), yy[pupil & (xx >= W / 2)].mean())]
print('render eyes (3x px):', [tuple(round(v, 1) for v in e) for e in eyes])
P4_EYES = [(247.5, 215.0), (320.0, 194.0)]
src = np.subtract(P4_EYES[1], P4_EYES[0]); dst = np.subtract(eyes[1], eyes[0])
k = np.hypot(*dst) / np.hypot(*src)
ang = np.arctan2(dst[1], dst[0]) - np.arctan2(src[1], src[0])
R = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
print(f'P4 -> render: scale {k:.3f} (3x px per P4 px), turn {np.degrees(ang):.1f} deg')
for name in ['Open-mouth inside', 'Open-mouth tongue']:
    s = T[name]
    x, y = np.asarray(eyes[0]) + k * (R @ (np.array([s['x'], s['y']]) - P4_EYES[0]))
    p = patch(face, x, y, 7)
    print(f"  {name:18} eye-registered at 3x ({x:.0f},{y:.0f})  {tuple(int(round(v)) for v in p)}  dE {de(p, s['rgb']):5.1f}")

