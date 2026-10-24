import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, restFromCurve } from './armChain';
import { ArmTube, armRadius, suckerTilt } from './armTube';

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
  const tube = new ArmTube(chain, spec, { ...profile, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt, twist: NOX.suckers.twist, flatten: NOX.armFlatten });
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

test('the oral side rolls toward and away from the viewer along the arm, then faces it in the curl', () => {
  const tubeProfile = { ...profile, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt, twist: NOX.suckers.twist, flatten: NOX.armFlatten };
  for (const [i, spec] of NOX.arms.entries()) {
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[spec.id]), spec, i);
    const tube = new ArmTube(chain, spec, tubeProfile);
    const n = chain.segments;
    const middle = Array.from(tube.tilt.slice(Math.floor(0.15 * n), Math.floor(0.6 * n)));
    const twist = (NOX.suckers.twist * Math.PI) / 180;
    expect(Math.max(...middle) - Math.min(...middle), spec.id).toBeGreaterThan(1.2 * twist);
    expect(tube.tilt[n], spec.id).toBeCloseTo(suckerTilt(1, tubeProfile), 6);
  }
});

test('the arm is flatter on its sucker side and round on its back, as a real octopus arm is', () => {
  const spec = NOX.arms[2];
  const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[spec.id]), spec, 2);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const tube = new ArmTube(chain, spec, { ...profile, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt, twist: NOX.suckers.twist, flatten: NOX.armFlatten });
  const p = tube.geometry.attributes.position.array as Float32Array;
  const n = chain.segments;
  const k = Math.floor(n * 0.4);
  const ring = tube.radial + 1;
  const r = tube.radiusAt(k / n);
  const oral = new THREE.Vector3();
  tube.suckerDirection(k, 0, oral);
  let near = Infinity;
  let far = 0;
  for (let j = 0; j < tube.radial; j++) {
    const o = (k * ring + j) * 3;
    const d = new THREE.Vector3(p[o] - chain.px[k], p[o + 1] - chain.py[k], p[o + 2] - chain.pz[k]);
    const along = d.dot(oral);
    near = Math.min(near, along > 0 ? d.length() : Infinity);
    far = Math.max(far, d.length());
  }
  expect(far).toBeCloseTo(r, 3);
  expect(near / r).toBeGreaterThan(NOX.armFlatten - 0.03);
  expect(near / r).toBeLessThan(NOX.armFlatten + 0.03);
  expect(tube.surfaceRadius(0.4, 0)).toBeCloseTo(r * NOX.armFlatten, 3);
  expect(tube.surfaceRadius(0.4, Math.PI)).toBeCloseTo(r, 3);
});

test('heightAbove says how far a point lies outside the skin, round a ring', () => {
  const spec = NOX.arms[2];
  const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[spec.id]), spec, 2);
  chain.solve({ time: 0, sway: 0, curl: 1, droop: 0 });
  const tube = new ArmTube(chain, spec, { ...profile, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt, twist: NOX.suckers.twist, flatten: NOX.armFlatten });
  const n = chain.segments;
  const dir = new THREE.Vector3();
  for (const k of [20, 64, 120]) {
    for (const a of [-2.5, -1, 0, 0.4, 1.7, 3]) {
      tube.suckerDirection(k, a, dir);
      const on = new THREE.Vector3(chain.px[k], chain.py[k], chain.pz[k]).addScaledVector(dir, tube.surfaceRadius(k / n, a));
      expect(tube.heightAbove(k, on), `ring ${k} angle ${a}`).toBeCloseTo(0, 6);
      expect(tube.heightAbove(k, on.clone().addScaledVector(dir, 0.01)), `ring ${k} angle ${a}`).toBeCloseTo(0.01, 6);
      expect(tube.heightAbove(k, on.clone().addScaledVector(dir, -0.01)), `ring ${k} angle ${a}`).toBeCloseTo(-0.01, 6);
    }
  }
});
