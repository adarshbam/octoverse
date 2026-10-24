import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { ARM_IDS, type ArmId } from '../config/types';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, restFromCurve } from './armChain';
import { ArmTube, suckerTilt } from './armTube';
import { SuckerRow, createSuckerCup } from './suckerRow';

const profile = { tipRadius: NOX.tipRadius, taperPower: NOX.taperPower, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt };
const rad = (d: number) => (d * Math.PI) / 180;

function arm(id: ArmId) {
  const index = NOX.arms.findIndex(spec => spec.id === id);
  const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[index], index);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const tube = new ArmTube(chain, NOX.arms[index], profile);
  return { chain, tube, row: new SuckerRow(chain, tube, NOX.suckers, index) };
}

test('suckers start small next to the body', () => {
  for (const id of ARM_IDS) {
    const { chain, row } = arm(id);
    const length = chain.segmentLength * chain.segments;
    const full = Math.max(...row.suckers.filter(s => s.arc > 0.25 * length && s.arc < 0.45 * length).map(s => s.size));
    expect(row.suckers[0].size, id).toBeLessThan(full * 0.6);
  }
});

test('the first suckers of T4 and T5 do not run into each other at the top of the V', () => {
  const t4 = arm('T4');
  const t5 = arm('T5');
  const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, t4.row.count + t5.row.count);
  t4.row.write(mesh, 0);
  t5.row.write(mesh, t4.row.count);
  const a = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, 0));
  const b = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, t4.row.count * 16));
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(t4.row.suckers[0].size + t5.row.suckers[0].size);
});

test('suckers shrink toward the tip and never overlap neighbours', () => {
  for (const id of ARM_IDS) {
    const { chain, row } = arm(id);
    const length = chain.segmentLength * chain.segments;
    for (const r of [0, 1] as const) {
      const cups = row.suckers.filter(s => s.row === r);
      for (let i = 1; i < cups.length; i++) {
        if (cups[i - 1].arc / length >= 0.3) expect(cups[i].size, `${id} row ${r}`).toBeLessThanOrEqual(cups[i - 1].size + 1e-9);
        const gap = cups[i].arc - cups[i - 1].arc;
        // Cups are a little longer along the arm than across it.
        const along = NOX.suckers.elongation;
        expect(gap, `${id} row ${r} spacing`).toBeGreaterThanOrEqual(1.9 * along * cups[i - 1].size);
        expect(gap, `${id} row ${r} overlap`).toBeGreaterThanOrEqual(along * (cups[i - 1].size + cups[i].size));
      }
    }
  }
});

test('sucker size runs from largest near the body to about 0.4x at the tip', () => {
  for (const id of ARM_IDS) {
    const main = arm(id).row.suckers.filter(s => s.row === 0);
    const ratio = main[main.length - 1].size / Math.max(...main.map(s => s.size));
    expect(ratio, id).toBeGreaterThan(0.3);
    expect(ratio, id).toBeLessThan(0.5);
  }
});

test('two staggered rows where the arm is thick, one row toward the tip', () => {
  for (const id of ARM_IDS) {
    const { chain, tube, row } = arm(id);
    const length = chain.segmentLength * chain.segments;
    const main = row.suckers.filter(s => s.row === 0).map(s => s.arc);
    const second = row.suckers.filter(s => s.row === 1);
    expect(second.length, id).toBeGreaterThan(2);
    for (const s of second) {
      expect(tube.radiusAt(s.arc / length), id).toBeGreaterThan(NOX.suckers.rowRadius);
      const before = main.filter(a => a < s.arc).length;
      expect(before > 0 && before < main.length, `${id} staggered`).toBe(true);
    }
    expect(tube.radiusAt(main[main.length - 1] / length), id).toBeLessThan(NOX.suckers.rowRadius);
  }
});

test('suckers turn to face the viewer inside the curls', () => {
  expect(suckerTilt(0.4, profile)).toBeCloseTo(rad(NOX.suckers.tilt), 9);
  expect(suckerTilt(0.97, profile)).toBeGreaterThan(suckerTilt(0.4, profile) + rad(20));
});

test('a sucker is a cup: a raised rim around a recessed centre, opening along +z', () => {
  const p = createSuckerCup().attributes.position;
  let rimZ = -Infinity;
  let rimR = 0;
  let centreZ = Infinity;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    const z = p.getZ(i);
    expect(r).toBeLessThanOrEqual(1.0001);
    if (z > rimZ) { rimZ = z; rimR = r; }
    if (r < 0.05) centreZ = Math.min(centreZ, z);
  }
  expect(rimR).toBeGreaterThan(0.7);
  expect(rimR).toBeLessThan(0.95);
  expect(rimZ - centreZ).toBeGreaterThan(0.3);
});

test('cups lie along the arm: their long axis follows the arm', () => {
  const { chain, row } = arm('T2');
  const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, row.count);
  row.write(mesh, 0);
  const m = new THREE.Matrix4();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  const n = chain.segments;
  row.suckers.forEach((s, i) => {
    mesh.getMatrixAt(i, m);
    m.extractBasis(x, y, z);
    const k = Math.min(n - 1, Math.floor(s.arc / chain.segmentLength));
    const tangent = new THREE.Vector3(chain.px[k + 1] - chain.px[k], chain.py[k + 1] - chain.py[k], chain.pz[k + 1] - chain.pz[k]).normalize();
    expect(x.length() / y.length(), `cup ${i}`).toBeCloseTo(NOX.suckers.elongation, 5);
    expect(Math.abs(x.clone().normalize().dot(tangent)), `cup ${i}`).toBeGreaterThan(0.9);
  });
});
