import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, restFromCurve } from './armChain';
import { ArmTube, CAP_RINGS, ROOT_RINGS, armRadius, suckerTilt } from './armTube';
import { mantleRadius } from './headGeometry';

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
  // The tip cap's rings follow the arm's own; the root cap's come after them.
  const rings = n + 1 + CAP_RINGS;
  expect(CAP_RINGS).toBeGreaterThanOrEqual(4);
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

test('arm roots close in a rounded cap tucked into the body, never a flat cut seen from behind', () => {
  const head = NOX.head;
  const tubeProfile = { ...profile, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt, twist: NOX.suckers.twist, flatten: NOX.armFlatten };
  for (const [i, spec] of NOX.arms.entries()) {
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[spec.id]), spec, i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const tube = new ArmTube(chain, spec, tubeProfile, 24, head.centerX);
    const p = tube.geometry.attributes.position.array as Float32Array;
    const ring = tube.radial + 1;
    const first = chain.segments + 1 + CAP_RINGS;
    expect(p.length / 3 / ring, spec.id).toBe(first + ROOT_RINGS);
    // The last root ring closes to a single point...
    const end = (first + ROOT_RINGS - 1) * ring * 3;
    for (let j = 1; j < ring; j++) {
      const o = end + j * 3;
      expect(Math.hypot(p[o] - p[end], p[o + 1] - p[end + 1], p[o + 2] - p[end + 2]), spec.id).toBeLessThan(1e-5);
    }
    // ...inside the mantle, on (or within half a root radius of) the body's upright axis.
    const inward = (x: number, z: number) => Math.hypot(x - head.centerX, z / head.depth);
    const [x, y, z] = [p[end], p[end + 1], p[end + 2]];
    expect(inward(x, z), spec.id).toBeLessThan(mantleRadius(head, y));
    expect(Math.hypot(x - head.centerX, z), spec.id).toBeLessThanOrEqual(0.5 * tube.radiusAt(0) + 1e-6);
    // The root cap is closed off, not hollow: every one of its triangles exists in the index.
    expect(tube.geometry.index!.count, spec.id).toBe((chain.segments + CAP_RINGS + ROOT_RINGS) * tube.radial * 6);
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
