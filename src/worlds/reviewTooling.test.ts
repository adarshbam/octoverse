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
