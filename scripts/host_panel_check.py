"""The host against P3 (How It Works) or P1 (entering) (platform spec 2.1, 2.2): CIE76 delta E for that panel's
samples in targets.json, and the head's place and size measured on the still's silhouette.
Usage: python scripts/host_panel_check.py p3|p1 <still.png> [--json]
The still is a frozen capture of the panel's own frame (P3 511 x 508, P1 510 x 508 native px) at any whole
scale, with its silhouette at <still>-mask.png. Samples use host_delta_e.py's window (native px
x0 = x - size // 2 to x0 + size, exclusive, the same in y, scaled), and the same window on the panel itself is
a sanity column that reads delta E 0.0. Stage units: origin at the panel's centre, 100 px a unit, +y up.
Head (P3): on the mask, the run of silhouette through the head's middle column on each row from the top of
the dome down 0.7 units (the rising arms beside it are separate runs): the top, the widest row's half-width
and its middle. Eye line (P3): the two pupils (the darkest blobs inside the head's run, above the mouth), their
centroids and the line's fall to the right in degrees. Head (P1): the silhouette's widest run above the arms'
bundle is not separable on a mask, so P1 reports the samples only, and the still's mask bounds.
Exit 1 when a sample misses delta E 10."""
import json, pathlib, sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from host_delta_e import area, delta_e  # noqa: E402  (the same sample window and colour difference)

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGETS = json.loads((ROOT / 'src/worlds/octoverse/review/targets.json').read_text())
PANELS = {
    'p3': {'native': (511, 508), 'origin': (255.5, 254), 'image': ROOT / 'public/octoverse/ref/p3.png'},
    'p1': {'native': (510, 508), 'origin': (255, 254), 'image': ROOT / 'public/octoverse/ref/p1.png'},
}


def head_p3(mask, s, origin, centre_x=0.03):
    """The head's top, widest half-width and middle on the mask (stage units), and the rows' runs."""
    h, w = mask.shape
    col = int(round((origin[0] + 100 * centre_x) * s))
    rows = np.nonzero(mask[:, col])[0]
    if len(rows) == 0: return None
    top_row = rows[0]
    best = None
    prev = None
    for r in range(top_row, min(h, top_row + int(70 * s))):
        if not mask[r, col]: continue
        left = col
        while left > 0 and mask[r, left - 1]: left -= 1
        right = col
        while right < w - 1 and mask[r, right + 1]: right += 1
        # A rising arm touching the head's side joins its run: below the dome's round top (the run over a
        # unit wide), the run jumps wider by more than 0.05 in one row. Stop there.
        wide = prev is not None and prev[1] - prev[0] > 100 * s
        if wide and (prev[0] - left > 5 * s or right - prev[1] > 5 * s): break
        prev = (left, right)
        if best is None or right - left > best[2] - best[1]: best = (r, left, right)
    r, left, right = best
    to_x = lambda px: (px / s - origin[0]) / 100
    to_y = lambda py: (origin[1] - py / s) / 100
    return {'top': to_y(top_row), 'halfWidth': (right + 1 - left) / s / 200, 'centreX': (to_x(left) + to_x(right + 1)) / 2, 'widestY': to_y(r),
            'rows': (top_row, best)}


def pupils(img, mask, s, origin, head):
    """The two pupils: pixels darker than 70 (channel sum) inside the head's widest run, between 0.3 and 1.1
    below the top; split at the run's middle; centroids in stage units and the eye line's fall to the right."""
    a = np.asarray(img, dtype=float)
    top_row, (r, left, right) = head['rows']
    y0, y1 = top_row + int(30 * s), top_row + int(110 * s)
    dark = (a[y0:y1, left:right + 1].sum(2) < 70) & mask[y0:y1, left:right + 1]
    ys, xs = np.nonzero(dark)
    if len(xs) < 20: return None
    mid = (right - left) / 2
    out = []
    for side in (xs < mid, xs >= mid):
        if side.sum() < 10: return None
        px, py = xs[side].mean() + left, ys[side].mean() + y0
        out.append(((px / s - origin[0]) / 100, (origin[1] - py / s) / 100))
    (lx, ly), (rx, ry) = out
    return {'left': out[0], 'right': out[1], 'fallRight': float(np.degrees(np.arctan2(ly - ry, rx - lx)))}


def main():
    a = sys.argv[1:]
    panel, still = a[0], pathlib.Path(a[1])
    p = PANELS[panel]
    img = Image.open(still).convert('RGB')
    s = img.size[0] / p['native'][0]
    ref = Image.open(p['image']).convert('RGB')
    report = {'samples': [], 'head': None}
    misses = []
    print(f'{"sample":24s} {"target":>15s} {"render":>15s} {"dE":>6s}  {"panel reads":>15s} {"dE":>6s}')
    for t in TARGETS['samples']:
        if t['panel'] != panel: continue
        r = area(img, s, t['x'], t['y'], t['size'])
        q = area(ref, 1, t['x'], t['y'], t['size']).round()
        d, dq = delta_e(r, t['rgb']), delta_e(q, t['rgb'])
        if d > TARGETS['deltaE']: misses.append(t['name'])
        report['samples'].append({'name': t['name'], 'target': t['rgb'], 'render': [round(v) for v in r], 'dE': round(d, 1)})
        print(f'{t["name"]:24s} {str(tuple(t["rgb"])):>15s} {str(tuple(int(round(v)) for v in r)):>15s} {d:6.1f}  {str(tuple(int(v) for v in q)):>15s} {dq:6.1f}')
    mask_path = still.with_name(still.stem + '-mask.png')
    if mask_path.exists():
        mask = np.asarray(Image.open(mask_path).convert('L')) > 127
        if panel == 'p3':
            head = head_p3(mask, s, p['origin'])
            if head:
                eyes = pupils(img, mask, s, p['origin'], head)
                report['head'] = {k: round(v, 3) for k, v in head.items() if k != 'rows'}
                print(f"head: top {head['top']:.3f} (spec -0.24 +- 0.05), half-width {head['halfWidth']:.3f} (0.81 +- 0.05), centre x {head['centreX']:.3f} (+0.03 +- 0.05), widest at y {head['widestY']:.3f}")
                if eyes:
                    report['eyes'] = eyes
                    print(f"pupils: left ({eyes['left'][0]:.3f}, {eyes['left'][1]:.3f}), right ({eyes['right'][0]:.3f}, {eyes['right'][1]:.3f}); eye line falls {eyes['fallRight']:.1f} deg to the right (spec: turned 8 to 15)")
        ys, xs = np.nonzero(mask)
        if len(xs):
            to = lambda px, py: ((px / s - p['origin'][0]) / 100, (p['origin'][1] - py / s) / 100)
            (x0, y0), (x1, y1) = to(xs.min(), ys.min()), to(xs.max() + 1, ys.max() + 1)
            report['maskBounds'] = [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)]
            print(f'silhouette bounds: x {x0:.2f} to {x1:.2f}, y {y1:.2f} to {y0:.2f}')
    print(f"{len(report['samples']) - len(misses)} of {len(report['samples'])} samples within delta E {TARGETS['deltaE']}")
    if '--json' in a: print(json.dumps(report))
    sys.exit(1 if misses else 0)


if __name__ == '__main__':
    main()
