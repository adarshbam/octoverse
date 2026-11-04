"""Compares two directories of stills: the equivalence gate for the engine extraction.
Usage: python scripts/still_compare.py <dirA> <dirB> [--floor floor.json] [--boxes face-boxes.json]
For each same-named PNG in both directories it prints one line: the mean absolute difference per
channel (R, G, B and their mean, 0 to 255) and the fraction of pixels whose largest channel
difference exceeds 8. With --boxes (a JSON map of file name to [x0, y0, x1, y1]) it also prints a
second line for that box (the face box): mean, fraction over 8 and the maximum difference.
Exit 1 if any file (or box) exceeds its tolerance, if a PNG is missing from one directory or if
sizes differ. Tolerance: the entry in --floor (file name -> {"mean", "frac", "box": {"mean", "frac"}}),
or, with no floor file or no entry, a mean difference of 0.5 and a pixel fraction of 0.2% (box
defaults are the same). A file without a floor entry falls back to those defaults.
Make a floor from captures of one build: still_compare.py --make-floor A B [C ...] [--boxes b.json]
prints floor JSON from the largest difference over every pair of the directories:
max(measured * 2, 0.05) mean and max(measured * 2, 0.0005) fraction. Noise comes in two levels
(some captures differ by ~0.3% of pixels, some by ~0.05%), so use three or more captures."""
import json, sys, pathlib
import numpy as np
from PIL import Image

DEFAULT_MEAN, DEFAULT_FRAC, THRESHOLD = 0.5, 0.002, 8


def load(path):
    return np.asarray(Image.open(path).convert('RGB'), dtype=np.int16)


def measure(a, b):
    d = np.abs(a - b)
    per_channel = d.reshape(-1, 3).mean(0)
    return {
        'channels': [float(c) for c in per_channel],
        'mean': float(per_channel.mean()),
        'frac': float((d.max(axis=2) > THRESHOLD).mean()),
        'max': int(d.max()),
    }


def compare_dirs(dir_a, dir_b, boxes):
    """Returns {name: {'whole': m, 'box': m or None}} and a list of problems (missing files, size)."""
    names_a = {p.name for p in pathlib.Path(dir_a).glob('*.png')}
    names_b = {p.name for p in pathlib.Path(dir_b).glob('*.png')}
    problems = [f'only in {dir_a}: {n}' for n in sorted(names_a - names_b)] + [f'only in {dir_b}: {n}' for n in sorted(names_b - names_a)]
    results = {}
    for name in sorted(names_a & names_b):
        a, b = load(pathlib.Path(dir_a) / name), load(pathlib.Path(dir_b) / name)
        if a.shape != b.shape:
            problems.append(f'{name}: size {a.shape[1]}x{a.shape[0]} vs {b.shape[1]}x{b.shape[0]}')
            continue
        box = None
        if name in boxes:
            x0, y0, x1, y1 = boxes[name]
            box = measure(a[y0:y1, x0:x1], b[y0:y1, x0:x1])
        results[name] = {'whole': measure(a, b), 'box': box}
    return results, problems


def tolerance(floor, name, part):
    entry = floor.get(name, {})
    if part == 'box':
        entry = entry.get('box', {})
    return entry.get('mean', DEFAULT_MEAN), entry.get('frac', DEFAULT_FRAC)


def main():
    args = sys.argv[1:]
    make_floor = '--make-floor' in args
    if make_floor:
        args.remove('--make-floor')

    def option(name):
        if name in args:
            i = args.index(name)
            value = args[i + 1]
            del args[i:i + 2]
            return value
        return None

    floor_path, boxes_path = option('--floor'), option('--boxes')
    boxes = {k: v for k, v in json.load(open(boxes_path)).items() if not k.startswith('_')} if boxes_path else {}

    if make_floor:
        if len(args) < 2:
            print(__doc__)
            return 2
        worst = {}
        for i in range(len(args)):
            for j in range(i + 1, len(args)):
                results, problems = compare_dirs(args[i], args[j], boxes)
                if problems:
                    print('PROBLEM', problems, file=sys.stderr)
                    return 1
                for name, r in results.items():
                    for part in ('whole', 'box'):
                        if r[part]:
                            w = worst.setdefault((name, part), {'mean': 0.0, 'frac': 0.0})
                            w['mean'], w['frac'] = max(w['mean'], r[part]['mean']), max(w['frac'], r[part]['frac'])
        floor = {}
        for (name, part), w in sorted(worst.items()):
            entry = {'mean': round(max(w['mean'] * 2, 0.05), 5), 'frac': round(max(w['frac'] * 2, 0.0005), 6)}
            if part == 'whole':
                floor.setdefault(name, {}).update(entry)
            else:
                floor.setdefault(name, {})['box'] = entry
        json.dump(floor, sys.stdout, indent=2)
        print()
        return 0

    if len(args) != 2:
        print(__doc__)
        return 2
    dir_a, dir_b = args
    results, problems = compare_dirs(dir_a, dir_b, boxes)

    floor = json.load(open(floor_path)) if floor_path else {}
    failed = bool(problems)
    for p in problems:
        print('PROBLEM', p)
    for name, r in results.items():
        for part in ('whole', 'box'):
            m = r[part]
            if m is None:
                continue
            tol_mean, tol_frac = tolerance(floor, name, part)
            over = m['mean'] > tol_mean or m['frac'] > tol_frac
            failed |= over
            label = name if part == 'whole' else f'{name} [face box]'
            print(f"{'FAIL' if over else 'ok  '} {label}: mean {m['mean']:.4f} (R {m['channels'][0]:.4f} G {m['channels'][1]:.4f} B {m['channels'][2]:.4f})"
                  f" over8 {m['frac'] * 100:.4f}% max {m['max']}  tol mean {tol_mean:.4f} frac {tol_frac * 100:.4f}%")
    print('FAIL' if failed else 'PASS')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
