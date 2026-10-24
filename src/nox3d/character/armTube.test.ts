import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { armRadius } from './armTube';

const profile = { tipRadius: NOX.tipRadius, taperPower: NOX.taperPower };
const samples = (spec = NOX.arms[0]) => Array.from({ length: 201 }, (_, i) => armRadius(i / 200, spec, profile));

test('every arm is fullest at its base and never swells toward the tip', () => {
  for (const spec of NOX.arms) {
    const r = samples(spec);
    for (let i = 1; i < r.length; i++) expect(r[i], `${spec.id} at u ${(i / 200).toFixed(3)}`).toBeLessThanOrEqual(r[i - 1] + 1e-9);
  }
});

test('arms keep most of their thickness through the middle, as in the high-quality panel', () => {
  for (const spec of NOX.arms) {
    expect(armRadius(0.5, spec, profile), spec.id).toBeGreaterThan(0.66 * armRadius(0, spec, profile));
    expect(armRadius(0.75, spec, profile), spec.id).toBeGreaterThan(0.5 * armRadius(0, spec, profile));
  }
});

test('arms taper smoothly, with no bulge or kink along their length', () => {
  for (const spec of NOX.arms) {
    const r = samples(spec);
    for (let i = 2; i < r.length; i++) {
      const bend = Math.abs(r[i] - 2 * r[i - 1] + r[i - 2]);
      expect(bend, `${spec.id} at u ${(i / 200).toFixed(3)}`).toBeLessThan(0.0006);
    }
  }
});

test('arms are thick and the tips stay rounded', () => {
  for (const spec of NOX.arms) {
    expect(armRadius(0, spec, profile), spec.id).toBeGreaterThanOrEqual(0.18);
    expect(armRadius(1, spec, profile), spec.id).toBeGreaterThanOrEqual(0.04);
  }
});
