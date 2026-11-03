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

/** Every leaf (number, string, or array of them) of an object, as a dotted path and its value. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  const isLeaf = typeof value !== 'object' || value === null || (Array.isArray(value) && value.every(v => typeof v !== 'object'));
  if (isLeaf) return [[path, value]];
  return Object.entries(value as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}
const lookup = (root: unknown, path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], root);

/**
 * The only variant-field leaves the dummy shares with Nox. Each is a value that is not part of a
 * look or feel: the sucker contact shadow colour, shapes and strengths of the glow (halo and grade
 * widths, strengths, cheek and underside), and the blink and micro-animation timings, which are
 * the shared personality (design 9.7) rather than the water feel.
 */
const INTENTIONALLY_EQUAL = [
  'palette.suckerShadow',
  'glow.center', 'glow.spreadX', 'glow.reachUp', 'glow.reachDown', 'glow.cheekWarmth', 'glow.underside',
  'glow.halo.headWidth', 'glow.halo.armWidth', 'glow.halo.strength', 'glow.halo.bandStrength',
  'glow.grade.radius', 'glow.grade.strength',
  'personality.blinkInterval', 'personality.doubleBlinkChance',
  'personality.swim.fill', 'personality.swim.squeeze',
  'personality.micro.blink.seconds', 'personality.micro.blink.doubleGap', 'personality.micro.tracking',
  'personality.micro.glance.first', 'personality.micro.glance.wait', 'personality.micro.glance.x', 'personality.micro.glance.y', 'personality.micro.glance.lift',
  'personality.micro.saccade.first', 'personality.micro.saccade.wait', 'personality.micro.saccade.x', 'personality.micro.saccade.y',
  'personality.micro.startle.duration', 'personality.micro.startle.lift', 'personality.micro.startle.armsIn', 'personality.micro.startle.eyes',
  'personality.micro.startle.speed', 'personality.micro.startle.near', 'personality.micro.startle.cooldown',
  'personality.micro.settle.duration', 'personality.micro.settle.amount', 'personality.micro.settle.cycles',
  'personality.micro.arrival.duration', 'personality.micro.arrival.roll', 'personality.micro.arrival.armWave',
];

describe('a variant is configuration only', () => {
  it('passes the same checks as Nox', () => {
    expect(() => clampCharacterConfig(DUMMY)).not.toThrow();
    expect(validateWorld(DUMMY_WORLD)).toEqual([]);
  });

  it('differs from Nox in every variant field', () => {
    expect(DUMMY.id).not.toBe(NOX.id);
    expect(DUMMY.headEffect).toBe('none');
    expect(NOX.headEffect).not.toBe('none');
    const same = leaves({ palette: DUMMY.palette, glow: DUMMY.glow, personality: DUMMY.personality })
      .filter(([path, value]) => JSON.stringify(value) === JSON.stringify(lookup(NOX, path)))
      .map(([path]) => path);
    expect(same.sort()).toEqual([...INTENTIONALLY_EQUAL].sort());
    // Heavier water feel and a slower stroke, by direction.
    const [d, n] = [DUMMY.personality, NOX.personality];
    expect(d.headOmega).toBeLessThan(n.headOmega);
    expect(d.gazeOmega).toBeLessThan(n.gazeOmega);
    expect(d.sway).toBeLessThan(n.sway);
    expect(d.float.period).toBeGreaterThan(n.float.period);
    expect(d.breathPeriod).toBeGreaterThan(n.breathPeriod);
    expect(d.swim.recovery + d.swim.power + d.swim.glide).toBeGreaterThan(n.swim.recovery + n.swim.power + n.swim.glide);
  });

  it('the world differs from the security world in palette and layout', () => {
    expect(DUMMY_WORLD.palette.waterFar).not.toBe('#071535');
    expect(DUMMY_WORLD.layout.pillars.length).not.toBe(14);
  });
});

// Slow (a full vite build, up to ~280 s on a loaded machine), so it runs only when asked:
//   NOX_BUILD_TEST=1 npx vitest run src/nox3d/config/variant.test.ts
describe.skipIf(!process.env.NOX_BUILD_TEST)('the production build has no fixtures', () => {
  // Builds into a scratch directory outside the repo, then greps every text file in it.
  it('leaves "dummy" out of every built asset', () => {
    const out = join(tmpdir(), `nox3d-variant-build-${process.pid}`);
    try {
      execSync(`npx vite build --outDir "${out}" --emptyOutDir`, { stdio: 'pipe', timeout: 280_000, env: { ...process.env, NODE_ENV: 'production' } });
      const dir = out;
      expect(existsSync(join(out, 'assets'))).toBe(true);
      // basis_transcoder is the vendored Basis Universal build, whose C++ glue names a `dummy` variable.
      const hits = (readdirSync(dir, { recursive: true }) as string[]).filter(f => !f.includes('basis_transcoder') && /\.(js|mjs|css|html|json|svg|txt|map)$/.test(f) && /dummy/i.test(readFileSync(join(dir, f), 'utf8')));
      expect(hits).toEqual([]);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 300_000);
});
