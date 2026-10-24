import * as THREE from 'three';
import type { SuckerSettings } from '../config/types';
import type { ArmChain } from './armChain';
import type { ArmTube } from './armTube';

const tmpDir = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpAlong = new THREE.Vector3();
const tmpAcross = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

/** Default arc fraction where a row begins, just past the webbed root. */
const ROW_START = 0.14;
/** Second-row cups are a little smaller than the main row's. */
const SECOND_ROW_SCALE = 0.82;
/** Cups sit on the arm's surface, so their rims stand proud of it. */
const SEAT = 1.0;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A sucker cup of radius 1 opening along +z: a raised rim (r ~0.82) around a recessed centre,
 * with its outer wall running down into the arm. Profile from the spike's sucker geometry.
 */
export function createSuckerCup() {
  const profile: [number, number][] = [
    [0, 0.14], [0.28, 0.12], [0.48, 0.22], [0.66, 0.46], [0.82, 0.56], [0.95, 0.45], [1.0, 0.25], [0.97, 0.0], [0.82, -0.3],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 24);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export interface Sucker {
  /** Arc length from the root. */
  arc: number;
  /** Cup radius. */
  size: number;
  /** 0 = the main row, toward the viewer; 1 = the staggered row nearer the arm's edge. */
  row: 0 | 1;
  /** Turn round the arm from the oral midline, radians; positive is toward the viewer. */
  angle: number;
}

/**
 * Sucker cups along an arm's oral side, written into a shared instanced mesh. Cups shrink
 * toward the tip, start small next to the body, and run in two staggered rows where the arm
 * is thick, one row toward the tip.
 */
export class SuckerRow {
  readonly suckers: Sucker[] = [];
  private readonly chain: ArmChain;
  private readonly tube: ArmTube;
  private readonly elongation: number;

  constructor(chain: ArmChain, tube: ArmTube, settings: SuckerSettings, index: number) {
    this.chain = chain;
    this.tube = tube;
    this.elongation = settings.elongation;
    // Where the arm is thick, the two rows run either side of the oral midline.
    const half = THREE.MathUtils.degToRad(settings.rowAngle) / 2;
    const length = chain.segmentLength * chain.segments;
    const start = chain.spec.suckerStart ?? ROW_START;
    // Each row starts small at its body end and reaches full size by 30% of the arm.
    const sizeAt = (u: number) => settings.size * tube.radiusAt(u) ** settings.sizePower * (0.35 + 0.65 * smoothstep(start, Math.max(0.3, start + 0.07), u));
    // A small per-arm offset so neighbouring arms' cups do not line up.
    let arc = length * start + (index % 3) * 0.004;
    while (arc < length * 0.975) {
      const size = sizeAt(arc / length);
      const paired = tube.radiusAt(arc / length) > settings.rowRadius;
      this.suckers.push({ arc, size, row: 0, angle: paired ? half : 0 });
      const along = settings.elongation;
      let step = Math.max(size * along * settings.spacing, 0.03);
      // While cups are still growing, leave room for the larger next one.
      for (let pass = 0; pass < 8; pass++) step = Math.max(step, (size + sizeAt((arc + step) / length)) * along * 1.05);
      const mid = arc + step / 2;
      if (mid < length * 0.975 && tube.radiusAt(mid / length) > settings.rowRadius) {
        this.suckers.push({ arc: mid, size: sizeAt(mid / length) * SECOND_ROW_SCALE, row: 1, angle: -half });
      }
      arc += step;
    }
  }

  get count() { return this.suckers.length; }

  write(mesh: THREE.InstancedMesh, start: number) {
    const { px, py, pz, segments: n, segmentLength } = this.chain;
    const t = this.tube;
    for (let i = 0; i < this.suckers.length; i++) {
      const { arc, size, angle } = this.suckers[i];
      const f = arc / segmentLength;
      const k = Math.min(n - 1, Math.floor(f));
      const u = f - k;
      t.suckerDirection(u < 0.5 ? k : k + 1, angle, tmpDir);
      const r = t.radiusAt(f / n) * SEAT;
      tmpPos.set(
        px[k] * (1 - u) + px[k + 1] * u + tmpDir.x * r,
        py[k] * (1 - u) + py[k + 1] * u + tmpDir.y * r,
        pz[k] * (1 - u) + pz[k + 1] * u + tmpDir.z * r,
      );
      // The cup opens along the oral direction, its long axis along the arm.
      tmpAlong.set(px[k + 1] - px[k], py[k + 1] - py[k], pz[k + 1] - pz[k]);
      tmpAlong.addScaledVector(tmpDir, -tmpAlong.dot(tmpDir)).normalize();
      tmpAcross.crossVectors(tmpDir, tmpAlong);
      tmpMatrix.makeBasis(tmpAlong.multiplyScalar(size * this.elongation), tmpAcross.multiplyScalar(size), tmpDir.multiplyScalar(size));
      tmpMatrix.setPosition(tmpPos);
      mesh.setMatrixAt(start + i, tmpMatrix);
    }
  }
}
