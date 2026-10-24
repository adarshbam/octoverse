import * as THREE from 'three';
import type { SuckerSettings } from '../config/types';
import type { ArmChain } from './armChain';
import type { ArmTube } from './armTube';

const tmpDir = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpAlong = new THREE.Vector3();
const tmpAcross = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpEdge = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const fitAlong = { slope: 0, bend: 0 };
const fitAcross = { slope: 0, bend: 0 };

/** Default arc fraction where a row begins, just past the webbed root. */
const ROW_START = 0.14;
/** Second-row cups are a little smaller than the main row's. */
const SECOND_ROW_SCALE = 0.82;
/** Cups sit this far (in cup radii) into the arm's surface, so their rims rise out of the skin. */
export const CUP_EMBED = 0.15;
/** Height of the cup's dimpled face in cup space: a hair above the skin, so the two never fight for depth. */
export const CUP_FACE = 0.17;
/** Spacing varies by up to this fraction either way, like living suckers. */
const SPACING_JITTER = 0.09;

const fract = (x: number) => x - Math.floor(x);

/**
 * How far skin curving `curve` per cup radius falls away from a cup's plane at `d` cup radii from
 * its centre: a circle, so it holds where the curve is tight. The cup shaders use the same formula.
 */
export function cupBend(curve: number, d: number) {
  return (curve * d * d) / (1 + Math.sqrt(Math.max(0, 1 - curve * curve * d * d)));
}

/** The bend through a point `d` cup radii out and `drop` below a cup's plane (see cupBend). */
const bendThrough = (d: number, drop: number) => (2 * drop) / (d * d + drop * drop);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A sucker cup of radius 1 opening along +z, sunk CUP_EMBED into the skin as in the painting: a
 * low rim (r ~0.75) round a shallow dimple just above the skin, its outer edge below the skin so
 * no outer wall shows.
 */
export function createSuckerCup() {
  const profile: [number, number][] = [
    [0, CUP_FACE], [0.2, 0.175], [0.4, 0.205], [0.6, 0.26], [0.75, 0.275], [0.88, 0.25], [0.96, 0.18], [1.0, 0.08], [0.95, -0.2],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 32);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The soft contact shadow round a cup: a flat ring in the cup's plane, from under its edge out to
 * 1.55 radii. The shadow shader lifts it to the skin and bends it with the arm.
 */
export function createCupShadow() {
  return new THREE.RingGeometry(0.9, 1.55, 32, 3);
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
  /**
   * Each cup's stretch of the arm (arc from, arc to): out toward its neighbours in its row, split
   * between them in proportion to their sizes, so each has room for its own half-length.
   */
  private readonly territory: Float32Array;

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
    while (arc < length * 0.995) {
      const size = sizeAt(arc / length);
      const paired = tube.radiusAt(arc / length) > settings.rowRadius;
      this.suckers.push({ arc, size, row: 0, angle: paired ? half : 0 });
      const along = settings.elongation;
      const jitter = 1 + SPACING_JITTER * 2 * (fract(Math.sin(this.suckers.length * 12.9898 + index * 78.233) * 43758.5453) - 0.5);
      let step = Math.max(size * along * settings.spacing * jitter, 0.03);
      // While cups are still growing, leave room for the larger next one.
      for (let pass = 0; pass < 8; pass++) step = Math.max(step, (size + sizeAt((arc + step) / length)) * along * 1.05);
      const mid = arc + step / 2;
      if (mid < length * 0.995 && tube.radiusAt(mid / length) > settings.rowRadius) {
        this.suckers.push({ arc: mid, size: sizeAt(mid / length) * SECOND_ROW_SCALE, row: 1, angle: -half });
      }
      arc += step;
    }
    this.territory = new Float32Array(this.suckers.length * 2);
    for (const r of [0, 1]) {
      const line = this.suckers.map((s, i) => ({ s, i })).filter(c => c.s.row === r);
      line.forEach(({ s, i }, c) => {
        const reach = s.size * this.elongation;
        const before = line[c - 1]?.s;
        const after = line[c + 1]?.s;
        this.territory[i * 2] = before ? s.arc - ((s.arc - before.arc) * s.size) / (s.size + before.size) : s.arc - reach;
        this.territory[i * 2 + 1] = after ? s.arc + ((after.arc - s.arc) * s.size) / (s.size + after.size) : s.arc + reach;
      });
    }
  }

  get count() { return this.suckers.length; }

  /**
   * Places the cups on the arm as it is now. Each sits on the skin itself, its plane levelled to
   * the skin under its edges, so it tilts with the taper and the twist. With `bend`, also writes
   * each cup's bend across the arm and along it (see cupBend; negative is hollow).
   */
  write(mesh: THREE.InstancedMesh, start: number, bend?: THREE.InstancedBufferAttribute) {
    const n = this.chain.segments;
    for (let i = 0; i < this.suckers.length; i++) {
      const { arc, angle } = this.suckers[i];
      const f = arc / this.chain.segmentLength;
      const k = Math.min(n - 1, Math.floor(f));
      const w = f - k;
      // The skin under the cup, from the skin lines along and round the arm.
      this.skinPoint(k, angle, tmpA);
      this.skinPoint(k + 1, angle, tmpB);
      tmpAlong.subVectors(tmpB, tmpA);
      tmpPos.copy(tmpA).addScaledVector(tmpAlong, w);
      // Inside a tight curl the skin is squeezed shorter than the arm's centre line. Where it leaves a
      // cup too little room in its stretch of the arm, the cup is squashed along the arm to fit, so
      // neighbours never overlap, and shrinks a little across. Both rows alike, so sizes still run
      // evenly down the arm.
      const full = this.suckers[i].size;
      const room = Math.min(arc - this.territory[i * 2], this.territory[i * 2 + 1] - arc);
      const reach = Math.min(full * this.elongation, room * Math.min(this.squeeze(i, angle), this.squeeze(i, -angle)));
      const size = full * Math.sqrt(reach / (full * this.elongation));
      const kk = w < 0.5 ? k : k + 1;
      this.skinPoint(kk, angle + 0.01, tmpA);
      this.skinPoint(kk, angle - 0.01, tmpB);
      tmpNormal.crossVectors(tmpA.sub(tmpB), tmpAlong).normalize();
      if (tmpNormal.dot(this.tube.suckerDirection(kk, angle, tmpDir)) < 0) tmpNormal.negate();
      this.frame();
      // Level the cup to the skin under its edges and fit its bends there, from the skin a
      // half-length out each way along the arm and round it: tilt toward whichever side lies higher.
      this.fitEdges(side => this.alongSkin(k, angle, side, reach, tmpEdge), tmpAlong, reach, fitAlong);
      this.fitEdges(side => this.roundSkin(k, w, angle, side, size, tmpEdge), tmpAcross, size, fitAcross);
      tmpNormal.addScaledVector(tmpAlong, fitAlong.slope).addScaledVector(tmpAcross, fitAcross.slope).normalize();
      this.frame();
      if (bend) bend.setXY(start + i, fitAcross.bend, (fitAlong.bend * reach) / size);
      // Sunk into the skin, opening along its normal, the cup's long axis along the arm.
      tmpPos.addScaledVector(tmpNormal, -CUP_EMBED * size);
      tmpMatrix.makeBasis(tmpAlong.multiplyScalar(reach), tmpAcross.multiplyScalar(size), tmpNormal.multiplyScalar(size));
      tmpMatrix.setPosition(tmpPos);
      mesh.setMatrixAt(start + i, tmpMatrix);
    }
  }

  /** How far the skin is squeezed shorter than the centre line, at its tightest in cup i's territory (at most 1). */
  private squeeze(i: number, angle: number) {
    const { segmentLength, segments: n } = this.chain;
    const from = Math.max(0, Math.floor(this.territory[i * 2] / segmentLength));
    const to = Math.min(n, Math.ceil(this.territory[i * 2 + 1] / segmentLength));
    let tightest = 1;
    this.skinPoint(from, angle, tmpB);
    for (let j = from; j < to; j++) {
      tmpA.copy(tmpB);
      this.skinPoint(j + 1, angle, tmpB);
      tightest = Math.min(tightest, tmpA.distanceTo(tmpB) / segmentLength);
    }
    return tightest;
  }

  /** Squares the cup's axes up to its normal, keeping the long axis along the arm. */
  private frame() {
    tmpAlong.addScaledVector(tmpNormal, -tmpAlong.dot(tmpNormal)).normalize();
    tmpAcross.crossVectors(tmpNormal, tmpAlong);
  }

  /** The skin at ring j, `angle` radians round from the oral midline, written into `out`. */
  private skinPoint(j: number, angle: number, out: THREE.Vector3) {
    const { px, py, pz, segments: n } = this.chain;
    this.tube.suckerDirection(j, angle, tmpDir);
    return out.set(px[j], py[j], pz[j]).addScaledVector(tmpDir, this.tube.surfaceRadius(j / n, angle));
  }

  /** The skin at fraction w of the way from ring k to ring k + 1, `angle` round from the oral midline. */
  private skinAt(k: number, w: number, angle: number, out: THREE.Vector3) {
    this.skinPoint(k, angle, out);
    this.skinPoint(k + 1, angle, tmpC);
    return out.lerp(tmpC, w);
  }

  /**
   * The skin `reach` along the arm from the cup's centre (tmpPos), ahead (side 1) or behind, walked
   * ring by ring along the skin line at the cup's turn; past the arm's ends it runs on straight.
   */
  private alongSkin(k: number, angle: number, side: number, reach: number, out: THREE.Vector3) {
    const n = this.chain.segments;
    out.copy(tmpPos);
    let left = reach;
    for (let j = side > 0 ? k + 1 : k; ; j += side) {
      if (j < 0 || j > n) {
        this.skinPoint(side > 0 ? n : 0, angle, tmpB);
        this.skinPoint(side > 0 ? n - 1 : 1, angle, tmpC);
        return out.addScaledVector(tmpB.sub(tmpC).normalize(), left);
      }
      this.skinPoint(j, angle, tmpB);
      const d = out.distanceTo(tmpB);
      if (d >= left) return out.lerp(tmpB, left / d);
      left -= d;
      out.copy(tmpB);
    }
  }

  /**
   * The skin `reach` round the arm from the cup's centre (tmpPos), one way (side 1) or the other,
   * in the arm's section at the cup: aimed by the surface radius, then corrected once by the chord.
   */
  private roundSkin(k: number, w: number, angle: number, side: number, reach: number, out: THREE.Vector3) {
    let turn = reach / this.tube.surfaceRadius((k + w) / this.chain.segments, angle);
    this.skinAt(k, w, angle + side * turn, out);
    const chord = out.distanceTo(tmpPos);
    if (chord > 1e-9) turn *= reach / chord;
    return this.skinAt(k, w, angle + side * turn, out);
  }

  /**
   * Fits the skin under a cup's two edges along `axis` (found by `edge`, each side of its centre)
   * against the cup's plane: the skin's drop below it as slope * x + curve * x^2 through both edges,
   * x in reaches. `slope` is how fast the skin falls away toward +axis; `bend` is the curve as a
   * cupBend through the edge.
   */
  private fitEdges(edge: (side: number) => void, axis: THREE.Vector3, reach: number, out: { slope: number; bend: number }) {
    edge(1);
    tmpEdge.sub(tmpPos);
    const x1 = tmpEdge.dot(axis) / reach;
    const d1 = -tmpEdge.dot(tmpNormal) / reach;
    edge(-1);
    tmpEdge.sub(tmpPos);
    const x2 = tmpEdge.dot(axis) / reach;
    const d2 = -tmpEdge.dot(tmpNormal) / reach;
    const det = x1 * x2 * (x2 - x1);
    if (Math.abs(det) < 1e-9) {
      out.slope = 0;
      out.bend = 0;
      return;
    }
    out.slope = (d1 * x2 * x2 - d2 * x1 * x1) / det;
    out.bend = bendThrough(1, (x1 * d2 - x2 * d1) / det);
  }
}
