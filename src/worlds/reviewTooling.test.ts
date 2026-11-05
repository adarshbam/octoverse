import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// scripts/check_stage.py reads a world's review files by id (src/worlds/<id>/review/): an id with no
// files, or an option without its value, is refused by name (exit 2), never a traceback or a Nox default.
const ROOT = join(import.meta.dirname, '..', '..');
const python = (args: string[], env: Record<string, string> = {}) =>
  spawnSync('python', ['scripts/check_stage.py', 'capture.png', ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, OCTO_WORLD: '', WORLD: '', ...env } });
const available = !python(['--world-id', 'nope']).error;

describe.skipIf(!available)('check_stage.py world options', () => {
  test('a world with no review files is refused by name', () => {
    const run = python(['--world', '--world-id', 'nope']);
    expect(run.status).toBe(2);
    expect(run.stdout).toMatch(/no world_samples\.json for world 'nope'/);
  });

  test('--world-id with no value is refused, last on the line or before another option', () => {
    for (const args of [['--world', '--world-id'], ['--world-id', '--world']]) {
      const run = python(args);
      expect(run.status, args.join(' ')).toBe(2);
      expect(run.stdout).toMatch(/--world-id needs a value/);
      expect(run.stderr).not.toMatch(/Traceback|IndexError/);
    }
  });

  test('OCTO_WORLD and WORLD name the world when --world-id is not given (OCTO_WORLD wins)', () => {
    expect(python(['--world'], { WORLD: 'from-world' }).stdout).toMatch(/for world 'from-world'/);
    expect(python(['--world'], { OCTO_WORLD: 'from-octo', WORLD: 'from-world' }).stdout).toMatch(/for world 'from-octo'/);
  });
});

// scripts/veyra_world.py's no-red rule (Task 15 fix round 1) leaves out the technology pendants (brand colours, content)
// but still holds for the world: a pendant pixel is one near a pendant's centre AND changed by the pendant (it differs
// from the pendant-free frame). Synthetic 120 x 120 frames: teal water, no silhouette, one pendant at (60, 60).
const NO_RED_CASES = String.raw`
import json, sys
import numpy as np
sys.path.insert(0, 'scripts')
from veyra_world import red_classes
rule = {'herPx': 4, 'darkBelow': 16, 'coral': [], 'pendantPx': 30, 'pendantDiff': 8}
water = np.zeros((120, 120, 3), np.uint8); water[...] = (10, 90, 110)
her = np.zeros((120, 120), bool)
def run(render, solo):
    return red_classes(render, her, rule, solo, [(60, 60)])[1]
out = {}
render = water.copy(); render[56:64, 56:64] = (200, 40, 40)                  # a red logo on the orb: 64 px
out['logo'] = run(render, water)
world = water.copy(); world[5:10, 5:10] = (200, 40, 40)                      # red on far rock, in both frames: 25 px
world[78:81, 60:63] = (200, 40, 40)                                          # red 18 px under the orb, in both frames: 9 px
render = world.copy(); render[56:64, 56:64] = (200, 40, 40)
render[110:112, 110:112] = (200, 40, 40)                                     # changed but far from any pendant: 4 px
out['world'] = run(render, world)
out['old'] = red_classes(render, her, rule)[1]                               # no pendant frame: nothing left out
print(json.dumps(out))
`;

describe.skipIf(!available)('veyra_world.py no-red rule', () => {
  test('leaves out the pendants only, and still counts world red near and far from them', () => {
    const run = spawnSync('python', ['-c', NO_RED_CASES], { cwd: ROOT, encoding: 'utf8' });
    expect(run.stderr).toBe('');
    const out = JSON.parse(run.stdout);
    expect(out.logo).toMatchObject({ world: 0, pendants: 64 });
    expect(out.world).toMatchObject({ world: 25 + 9 + 4, pendants: 64 });
    expect(out.old).toMatchObject({ world: 25 + 9 + 4 + 64, pendants: 0 });
  });
});
