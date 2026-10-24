import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, restFromCurve } from './armChain';
import { ArmTube, armRadius } from './armTube';

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

test('arm tips end in a rounded cap that closes to a point, not a flat cut', () => {
  const spec = NOX.arms[1];
  const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[spec.id]), spec, 1);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const tube = new ArmTube(chain, spec, { ...profile, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt });
  const p = tube.geometry.attributes.position.array as Float32Array;
  const n = chain.segments;
  const ring = tube.radial + 1;
  const rings = p.length / 3 / ring;
  expect(rings).toBeGreaterThanOrEqual(n + 1 + 4);
  const tip = [chain.px[n], chain.py[n], chain.pz[n]];
  const t = [chain.px[n] - chain.px[n - 1], chain.py[n] - chain.py[n - 1], chain.pz[n] - chain.pz[n - 1]];
  const tl = Math.hypot(t[0], t[1], t[2]);
  const r = tube.radiusAt(1);
  const end = tip.map((v, i) => v + (t[i] / tl) * r);
  // The last ring closes to a single point one tip radius beyond the end of the chain.
  for (let j = 0; j < ring; j++) {
    const o = ((rings - 1) * ring + j) * 3;
    expect(Math.hypot(p[o] - end[0], p[o + 1] - end[1], p[o + 2] - end[2])).toBeLessThan(1e-5);
  }
  // Every cap vertex lies on the hemisphere round the tip.
  for (let v = (n + 1) * ring; v < rings * ring; v++) {
    const d = Math.hypot(p[v * 3] - tip[0], p[v * 3 + 1] - tip[1], p[v * 3 + 2] - tip[2]);
    expect(d).toBeCloseTo(r, 4);
  }
});
