import * as THREE from 'three';
import type { ArmChain } from './armChain';
import type { ArmTube } from './armTube';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpDir = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

/** Default arc fraction where a row begins, just past the webbed root. */
const ROW_START = 0.14;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Glowing suckers spaced along an arm's sucker side, written into a shared instanced mesh. */
export class SuckerRow {
  readonly suckers: { arc: number; size: number }[] = [];
  private readonly chain: ArmChain;
  private readonly tube: ArmTube;

  constructor(chain: ArmChain, tube: ArmTube, settings: { sizeRatio: number; spacing: number }, index: number) {
    this.chain = chain;
    this.tube = tube;
    const length = chain.segmentLength * chain.segments;
    const start = chain.spec.suckerStart ?? ROW_START;
    let arc = length * start;
    while (arc < length * 0.975) {
      const jitter = 0.85 + 0.3 * Math.abs(Math.sin(arc * 91.7 + index * 3.1));
      // Each row starts small at its body end and reaches full size 16% of the arm later.
      const grow = 0.35 + 0.65 * smoothstep(start, start + 0.16, arc / length);
      const size = tube.radiusAt(arc / length) * settings.sizeRatio * jitter * grow;
      this.suckers.push({ arc, size });
      arc += Math.max(size * settings.spacing, 0.028);
    }
  }

  get count() { return this.suckers.length; }

  write(mesh: THREE.InstancedMesh, start: number) {
    const { px, py, pz, segments: n, segmentLength } = this.chain;
    const t = this.tube;
    for (let i = 0; i < this.suckers.length; i++) {
      const { arc, size } = this.suckers[i];
      const f = arc / segmentLength;
      const k = Math.min(n - 1, Math.floor(f));
      const u = f - k;
      const k2 = u < 0.5 ? k : k + 1;
      tmpDir.set(
        t.suckerCos * t.nx[k2] + t.suckerSin * t.bx[k2],
        t.suckerCos * t.ny[k2] + t.suckerSin * t.by[k2],
        t.suckerSin * t.bz[k2],
      ).normalize();
      const r = t.radiusAt(f / n) * 0.86;
      tmpPos.set(
        px[k] * (1 - u) + px[k + 1] * u + tmpDir.x * r,
        py[k] * (1 - u) + py[k + 1] * u + tmpDir.y * r,
        pz[k] * (1 - u) + pz[k + 1] * u + tmpDir.z * r,
      );
      tmpQuat.setFromUnitVectors(Z_AXIS, tmpDir);
      tmpScale.set(size, size, size * 0.75);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(start + i, tmpMatrix);
    }
  }
}
