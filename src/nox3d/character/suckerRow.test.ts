import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { ARM_IDS, type ArmId } from '../config/types';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, restFromCurve } from './armChain';
import { ArmTube, suckerTilt } from './armTube';
import { CUP_EMBED, CUP_FACE, SuckerRow, createCupShadow, createSuckerCup, cupBend } from './suckerRow';

const profile = { tipRadius: NOX.tipRadius, taperPower: NOX.taperPower, suckerTilt: NOX.suckers.tilt, curlTilt: NOX.suckers.curlTilt, twist: NOX.suckers.twist, flatten: NOX.armFlatten };
const rad = (d: number) => (d * Math.PI) / 180;

function arm(id: ArmId) {
  const index = NOX.arms.findIndex(spec => spec.id === id);
  const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[index], index);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const tube = new ArmTube(chain, NOX.arms[index], profile);
  return { chain, tube, row: new SuckerRow(chain, tube, NOX.suckers, index) };
}

/** Distance from p to the arm's skin within a few rings of ring k, over a fine mesh of the surface. */
function skinGap(chain: ArmChain, tube: ArmTube, k: number, p: THREE.Vector3) {
  const n = chain.segments;
  const dir = new THREE.Vector3();
  const q = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const ab = new THREE.Vector3();
  let best = Infinity;
  for (let a = -1.6; a <= 1.6; a += 0.003) {
    for (let j = Math.max(0, k - 8); j <= Math.min(n, k + 9); j++) {
      q.set(chain.px[j], chain.py[j], chain.pz[j]).addScaledVector(tube.suckerDirection(j, a, dir), tube.surfaceRadius(j / n, a));
      if (j > Math.max(0, k - 8)) {
        ab.subVectors(q, prev);
        const w = THREE.MathUtils.clamp(p.clone().sub(prev).dot(ab) / ab.lengthSq(), 0, 1);
        best = Math.min(best, prev.clone().addScaledVector(ab, w).distanceTo(p));
      }
      prev.copy(q);
    }
  }
  return best;
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

test('a sucker is a shallow cup opening along +z: a low rim round a dimpled centre, its edge sunk into the skin', () => {
  const p = createSuckerCup().attributes.position;
  let rimZ = -Infinity;
  let rimR = 0;
  let centreZ = Infinity;
  let edgeZ = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    const z = p.getZ(i);
    expect(r).toBeLessThanOrEqual(1.0001);
    if (z > rimZ) { rimZ = z; rimR = r; }
    if (r < 0.05) centreZ = Math.min(centreZ, z);
    if (r > 0.995) edgeZ = Math.max(edgeZ, z);
  }
  expect(rimR).toBeGreaterThan(0.6);
  expect(rimR).toBeLessThan(0.9);
  // A shallow dimple, not a deep bowl.
  expect(rimZ - centreZ).toBeGreaterThan(0.06);
  expect(rimZ - centreZ).toBeLessThan(0.2);
  // The skin lies CUP_EMBED above the cup's base: the rim rises only a little out of it,
  expect(rimZ - CUP_EMBED).toBeGreaterThan(0.05);
  expect(rimZ - CUP_EMBED).toBeLessThan(0.16);
  // and the outer edge sinks below it, so no outer wall shows.
  expect(edgeZ).toBeLessThan(CUP_EMBED);
  // The dimple stands a hair above the skin, so the two never fight for depth.
  expect(centreZ).toBeCloseTo(CUP_FACE, 6);
  expect(CUP_FACE - CUP_EMBED).toBeGreaterThan(0.01);
});

/**
 * How far each cup's edges, bent as the cup shaders bend them, lie off the skin (in cup radii),
 * with each cup's arc fraction. Across the arm the edges are at y = +-1, along it at x = +-1.
 */
function edgeGaps(id: ArmId, curl: number, edges: (bend: THREE.InstancedBufferAttribute, i: number) => THREE.Vector3[]) {
  const index = NOX.arms.findIndex(spec => spec.id === id);
  const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[index], index);
  chain.solve({ time: 0, sway: 0, curl, droop: 0 });
  const tube = new ArmTube(chain, NOX.arms[index], profile);
  const row = new SuckerRow(chain, tube, NOX.suckers, index);
  const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, row.count);
  const bend = new THREE.InstancedBufferAttribute(new Float32Array(row.count * 2), 2);
  row.write(mesh, 0, bend);
  const m = new THREE.Matrix4();
  const n = chain.segments;
  return row.suckers.map((s, i) => {
    mesh.getMatrixAt(i, m);
    const k = Math.min(n - 1, Math.floor(s.arc / chain.segmentLength));
    const gap = Math.max(...edges(bend, i).map(p => skinGap(chain, tube, k, p.applyMatrix4(m)) / s.size));
    return { gap, u: s.arc / (chain.segmentLength * n) };
  });
}

/**
 * Nearly every cup hugs the skin; none away from the tip stands clear of it. The last cups sit on
 * the rounded tips, where they can hang past the end of the arm. Unbent, cups miss by about 0.22.
 */
function expectHugging(id: ArmId, gaps: { gap: number; u: number }[]) {
  const sorted = gaps.map(g => g.gap).sort((a, b) => a - b);
  expect(sorted[Math.floor(sorted.length * 0.9)], `${id} 90th percentile`).toBeLessThan(0.045);
  for (const { gap, u } of gaps) if (u < 0.95) expect(gap, `${id} cup at u ${u.toFixed(2)}`).toBeLessThan(0.13);
}

test('cups bend across the arm to hug its curved oral side', () => {
  for (const id of ARM_IDS) {
    // The cup shaders bend cup space by cupBend; the skin lies CUP_EMBED above the cup's base.
    expectHugging(id, edgeGaps(id, 0, (bend, i) => [-1, 1].map(y => new THREE.Vector3(0, y, CUP_EMBED - cupBend(bend.getX(i), y)))));
  }
});

test('cups bend along the arm with its curls, so their ends stay on the skin', () => {
  for (const id of ARM_IDS) {
    expectHugging(id, edgeGaps(id, 1, (bend, i) => [-1, 1].map(x => new THREE.Vector3(x, 0, CUP_EMBED - cupBend(bend.getY(i), x)))));
  }
});

test('inside tight curls, where the skin is squeezed, cups shrink so they never overlap', () => {
  for (const id of ARM_IDS) {
    const index = NOX.arms.findIndex(spec => spec.id === id);
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 1, droop: 0 });
    const tube = new ArmTube(chain, NOX.arms[index], profile);
    const row = new SuckerRow(chain, tube, NOX.suckers, index);
    const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, row.count);
    row.write(mesh, 0);
    const m = new THREE.Matrix4();
    const n = chain.segments;
    const dir = new THREE.Vector3();
    // The skin at arc fraction f (in segments), `angle` round from the oral midline.
    const skin = (f: number, angle: number) => {
      const k = Math.min(n - 1, Math.floor(f));
      const w = f - k;
      const at = (j: number) => new THREE.Vector3(chain.px[j], chain.py[j], chain.pz[j]).addScaledVector(tube.suckerDirection(j, angle, dir), tube.surfaceRadius(j / n, angle));
      return at(k).lerp(at(k + 1), w);
    };
    // Distance between two cups measured along the skin, as the bent cups lie on it.
    const along = (a: number, b: number, angle: number) => {
      let length = 0;
      for (let f = a; f < b; f += 0.05) length += skin(f, angle).distanceTo(skin(Math.min(b, f + 0.05), angle));
      return length;
    };
    const reach = (i: number) => {
      mesh.getMatrixAt(i, m);
      const x = new THREE.Vector3();
      m.extractBasis(x, new THREE.Vector3(), new THREE.Vector3());
      return x.length();
    };
    for (const r of [0, 1]) {
      const line = row.suckers.map((s, i) => ({ s, i })).filter(c => c.s.row === r);
      for (let c = 1; c < line.length; c++) {
        const [a, b] = [line[c - 1], line[c]];
        const gap = along(a.s.arc / chain.segmentLength, b.s.arc / chain.segmentLength, b.s.angle);
        expect(gap, `${id} row ${r} cup ${c}`).toBeGreaterThanOrEqual(reach(a.i) + reach(b.i));
      }
    }
  }
});

test('a cup casts its contact shadow in a ring from under its edge out to about 1.5 radii', () => {
  const p = createCupShadow().attributes.position;
  let inner = Infinity;
  let outer = 0;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    inner = Math.min(inner, r);
    outer = Math.max(outer, r);
    expect(p.getZ(i)).toBe(0);
  }
  expect(inner).toBeGreaterThan(0.8);
  expect(inner).toBeLessThan(0.98);
  expect(outer).toBeGreaterThan(1.4);
  expect(outer).toBeLessThan(1.8);
});

test('cups lie along the arm: their long axis follows it, squashed only where curls squeeze the skin', () => {
  const { chain, row } = arm('T2');
  const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, row.count);
  row.write(mesh, 0);
  const m = new THREE.Matrix4();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  const n = chain.segments;
  const ratios: number[] = [];
  row.suckers.forEach((s, i) => {
    mesh.getMatrixAt(i, m);
    m.extractBasis(x, y, z);
    const k = Math.min(n - 1, Math.floor(s.arc / chain.segmentLength));
    const tangent = new THREE.Vector3(chain.px[k + 1] - chain.px[k], chain.py[k + 1] - chain.py[k], chain.pz[k + 1] - chain.pz[k]).normalize();
    ratios.push(x.length() / y.length());
    expect(Math.abs(x.clone().normalize().dot(tangent)), `cup ${i}`).toBeGreaterThan(0.9);
  });
  ratios.sort((a, b) => a - b);
  expect(ratios[ratios.length - 1]).toBeLessThanOrEqual(NOX.suckers.elongation + 1e-6);
  expect(ratios[0]).toBeGreaterThan(NOX.suckers.elongation * 0.6);
  expect(ratios[Math.floor(ratios.length / 2)]).toBeCloseTo(NOX.suckers.elongation, 2);
});

test('cups sit a little into the skin, so their rims rise out of the arm', () => {
  const { chain, tube, row } = arm('T2');
  const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, row.count);
  row.write(mesh, 0);
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const n = chain.segments;
  row.suckers.forEach((s, i) => {
    mesh.getMatrixAt(i, m);
    pos.setFromMatrixPosition(m);
    const f = s.arc / chain.segmentLength;
    const k = Math.min(n - 1, Math.floor(f));
    const w = f - k;
    const centre = new THREE.Vector3(chain.px[k] * (1 - w) + chain.px[k + 1] * w, chain.py[k] * (1 - w) + chain.py[k + 1] * w, chain.pz[k] * (1 - w) + chain.pz[k + 1] * w);
    const surface = tube.surfaceRadius(f / n, s.angle);
    const depth = surface - pos.distanceTo(centre);
    expect(depth, `cup ${i}`).toBeGreaterThan(0);
    expect(depth, `cup ${i}`).toBeLessThan(0.3 * s.size);
  });
});

test('cup spacing and size vary a little, like living suckers, never regular', () => {
  for (const id of ARM_IDS) {
    const { chain, row } = arm(id);
    const length = chain.segmentLength * chain.segments;
    const main = row.suckers.filter(s => s.row === 0 && s.arc > 0.3 * length && s.arc < 0.85 * length);
    const gaps = main.slice(1).map((s, i) => (s.arc - main[i].arc) / main[i].size);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const spread = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / mean;
    expect(spread, id).toBeGreaterThan(0.025);
    expect(spread, id).toBeLessThan(0.2);
  }
});
