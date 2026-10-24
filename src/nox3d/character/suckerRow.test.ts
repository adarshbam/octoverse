import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { ARM_IDS, type ArmId } from '../config/types';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, restFromCurve } from './armChain';
import { ArmTube } from './armTube';
import { SuckerRow } from './suckerRow';

const profile = { tipRadius: NOX.tipRadius, taperPower: NOX.taperPower, suckerTilt: NOX.suckers.tilt };

function arm(id: ArmId) {
  const index = NOX.arms.findIndex(spec => spec.id === id);
  const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[index], index);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const tube = new ArmTube(chain, NOX.arms[index], profile);
  return { chain, row: new SuckerRow(chain, tube, NOX.suckers, index) };
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
