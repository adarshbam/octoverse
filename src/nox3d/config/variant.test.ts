import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { DUMMY_WORLD } from '../world/fixtures/dummy.world';
import { validateWorld } from '../world/validateWorld';
import { DUMMY } from './fixtures/dummy.character';
import { NOX } from './nox.character';
import { clampCharacterConfig } from './validate';

describe('a variant is configuration only', () => {
  it('passes the same checks as Nox', () => {
    expect(() => clampCharacterConfig(DUMMY)).not.toThrow();
    expect(validateWorld(DUMMY_WORLD)).toEqual([]);
  });

  it('differs from Nox in every variant field', () => {
    expect(DUMMY.id).not.toBe(NOX.id);
    expect(DUMMY.glow.ramp).not.toEqual(NOX.glow.ramp);
    expect(DUMMY.glow.aura.inner).not.toBe(NOX.glow.aura.inner);
    expect(DUMMY.glow.aura.low).not.toBe(NOX.glow.aura.low);
    expect(DUMMY.glow.halo.color).not.toBe(NOX.glow.halo.color);
    for (const key of Object.keys(NOX.palette) as (keyof typeof NOX.palette)[]) {
      if (['headEdge', 'cheek', 'rimTop', 'armBody', 'suckerBody', 'domeRim'].includes(key)) expect(DUMMY.palette[key], key).not.toBe(NOX.palette[key]);
    }
    // Heavier water feel: slower and more damped.
    const [d, n] = [DUMMY.personality, NOX.personality];
    expect(d.headOmega).toBeLessThan(n.headOmega);
    expect(d.gazeOmega).toBeLessThan(n.gazeOmega);
    expect(d.sway).toBeLessThan(n.sway);
    expect(d.float.period).toBeGreaterThan(n.float.period);
    expect(d.breathPeriod).toBeGreaterThan(n.breathPeriod);
    // A slower stroke.
    expect(d.swim.recovery + d.swim.power + d.swim.glide).toBeGreaterThan(n.swim.recovery + n.swim.power + n.swim.glide);
    expect(DUMMY.headEffect).toBe('none');
    expect(NOX.headEffect).not.toBe('none');
  });

  it('the world differs from the security world in palette and layout', () => {
    expect(DUMMY_WORLD.palette.waterFar).not.toBe('#071535');
    expect(DUMMY_WORLD.layout.pillars.length).not.toBe(14);
  });
});

describe('the production build has no fixtures', () => {
  // Builds into a scratch directory outside the repo (a few seconds to a minute), then greps it.
  it('leaves "dummy" out of every built asset', () => {
    const out = join(tmpdir(), `nox3d-variant-build-${process.pid}`);
    try {
      execSync(`npx vite build --outDir "${out}" --emptyOutDir`, { stdio: 'pipe', timeout: 280_000, env: { ...process.env, NODE_ENV: 'production' } });
      const dir = join(out, 'assets');
      expect(existsSync(dir)).toBe(true);
      // basis_transcoder is the vendored Basis Universal build, whose C++ glue names a `dummy` variable.
      const hits = readdirSync(dir).filter(f => !f.startsWith('basis_transcoder') && /\.(js|css|html)$/.test(f) && /dummy/i.test(readFileSync(join(dir, f), 'utf8')));
      expect(hits).toEqual([]);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 300_000);
});
