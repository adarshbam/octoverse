import * as THREE from 'three';
import type { ArmPose } from './armPoses';

const SEGMENTS = 64;
const RADIAL = 18;
const TIP_RADIUS = 0.035;
const SUCKER_TILT = THREE.MathUtils.degToRad(12);
const RING_COS = Float32Array.from({ length: RADIAL + 1 }, (_, j) => Math.cos((j / RADIAL) * Math.PI * 2));
const RING_SIN = Float32Array.from({ length: RADIAL + 1 }, (_, j) => Math.sin((j / RADIAL) * Math.PI * 2));

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface ArmDrive {
  time: number;
  /** Travelling-wave amplitude, radians accumulated toward the tip. */
  sway: number;
  /** Extra tip curl toward the sucker side. */
  curl: number;
  /** Body vertical velocity; arms trail against it. */
  droop: number;
  /** Optional point (arm space) the tip reaches toward, blended by weight 0..1. */
  reach?: { x: number; y: number; weight: number };
}

const REACH_START = Math.floor(SEGMENTS * 0.3);

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpDir = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

/**
 * One tentacle as a forward-kinematic chain. The authored panel-2 curve is the
 * rest pose; every frame small joint rotations are accumulated from root to tip
 * and a tapered tube is rebuilt around the chain, so the whole limb bends.
 */
export class ArmRig {
  readonly geometry = new THREE.BufferGeometry();
  readonly suckers: { arc: number; size: number }[] = [];
  private readonly seg: number;
  private readonly rest = new Float32Array(SEGMENTS);
  private readonly restZ = new Float32Array(SEGMENTS + 1);
  private readonly radius = new Float32Array(SEGMENTS + 1);
  private readonly px = new Float32Array(SEGMENTS + 1);
  private readonly py = new Float32Array(SEGMENTS + 1);
  private readonly pz = new Float32Array(SEGMENTS + 1);
  private readonly angle = new Float32Array(SEGMENTS);
  private readonly work = new Float32Array(SEGMENTS);
  private readonly qx = new Float32Array(SEGMENTS + 1);
  private readonly qy = new Float32Array(SEGMENTS + 1);
  private readonly nx = new Float32Array(SEGMENTS + 1);
  private readonly ny = new Float32Array(SEGMENTS + 1);
  private readonly bx = new Float32Array(SEGMENTS + 1);
  private readonly by = new Float32Array(SEGMENTS + 1);
  private readonly bz = new Float32Array(SEGMENTS + 1);
  private readonly side: number;
  private readonly suckerCos: number;
  private readonly suckerSin: number;
  private readonly rootX: number;
  private readonly rootY: number;
  private readonly phase: number;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;

  constructor(pose: ArmPose, index: number) {
    const curve = new THREE.CatmullRomCurve3(pose.points.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
    const points = curve.getSpacedPoints(SEGMENTS);
    this.seg = curve.getLength() / SEGMENTS;
    this.rootX = points[0].x;
    this.rootY = points[0].y;
    for (let k = 0; k < SEGMENTS; k++) this.rest[k] = Math.atan2(points[k + 1].y - points[k].y, points[k + 1].x - points[k].x);

    // Octopus arms curl toward their oral side, so the tip's turning direction picks the sucker side.
    let turn = 0;
    for (let k = Math.floor(SEGMENTS * 0.6); k < SEGMENTS - 1; k++) turn += wrap(this.rest[k + 1] - this.rest[k]);
    this.side = turn >= 0 ? 1 : -1;
    this.suckerCos = this.side * Math.cos(SUCKER_TILT);
    this.suckerSin = Math.sin(SUCKER_TILT);
    this.phase = index * 1.37 + 0.4;

    for (let k = 0; k <= SEGMENTS; k++) {
      const s = k / SEGMENTS;
      this.restZ[k] = pose.z[0] + (pose.z[1] - pose.z[0]) * s;
      this.radius[k] = TIP_RADIUS + (pose.radius - TIP_RADIUS) * Math.pow(1 - s, 0.75);
    }

    const ring = RADIAL + 1;
    const count = (SEGMENTS + 1) * ring;
    this.positions = new Float32Array(count * 3);
    this.normals = new Float32Array(count * 3);
    const under = new Float32Array(count);
    const speck = new Float32Array(count * 2);
    const suckerAngle = Math.atan2(this.suckerSin, this.suckerCos);
    for (let k = 0; k <= SEGMENTS; k++) {
      for (let j = 0; j <= RADIAL; j++) {
        const v = k * ring + j;
        under[v] = Math.cos((j / RADIAL) * Math.PI * 2 - suckerAngle);
        speck[v * 2] = k * this.seg * 15;
        speck[v * 2 + 1] = (j / RADIAL) * 8;
      }
    }
    const indices: number[] = [];
    for (let k = 0; k < SEGMENTS; k++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = k * ring + j;
        const b = a + ring;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    this.geometry.setIndex(indices);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aUnder', new THREE.BufferAttribute(under, 1));
    this.geometry.setAttribute('aSpeck', new THREE.BufferAttribute(speck, 2));

    const length = this.seg * SEGMENTS;
    let arc = length * 0.14;
    while (arc < length * 0.975) {
      const jitter = 0.85 + 0.3 * Math.abs(Math.sin(arc * 91.7 + index * 3.1));
      const size = this.radiusAt(arc / this.seg) * 0.6 * jitter;
      this.suckers.push({ arc, size });
      arc += Math.max(size * 2.2, 0.028);
    }
  }

  private integrate() {
    this.px[0] = this.rootX;
    this.py[0] = this.rootY;
    for (let k = 0; k < SEGMENTS; k++) {
      this.px[k + 1] = this.px[k] + this.seg * Math.cos(this.angle[k]);
      this.py[k + 1] = this.py[k] + this.seg * Math.sin(this.angle[k]);
    }
  }

  /** Cyclic coordinate descent over the outer arm; the root third stays anchored to the body. */
  private solveReach(targetX: number, targetY: number) {
    this.work.set(this.angle);
    this.qx.set(this.px);
    this.qy.set(this.py);
    for (let iter = 0; iter < 4; iter++) {
      for (let j = SEGMENTS - 4; j >= REACH_START; j -= 3) {
        const ex = this.qx[SEGMENTS] - this.qx[j];
        const ey = this.qy[SEGMENTS] - this.qy[j];
        const delta = Math.max(-0.09, Math.min(0.09, wrap(Math.atan2(targetY - this.qy[j], targetX - this.qx[j]) - Math.atan2(ey, ex))));
        const c = Math.cos(delta);
        const s = Math.sin(delta);
        for (let k = j; k < SEGMENTS; k++) this.work[k] += delta;
        for (let k = j + 1; k <= SEGMENTS; k++) {
          const dx = this.qx[k] - this.qx[j];
          const dy = this.qy[k] - this.qy[j];
          this.qx[k] = this.qx[j] + dx * c - dy * s;
          this.qy[k] = this.qy[j] + dx * s + dy * c;
        }
      }
    }
  }

  private radiusAt(f: number) {
    const k = Math.min(SEGMENTS - 1, Math.floor(f));
    const u = f - k;
    return this.radius[k] * (1 - u) + this.radius[k + 1] * u;
  }

  get tipX() { return this.px[SEGMENTS]; }
  get tipY() { return this.py[SEGMENTS]; }

  update({ time: t, sway, curl, droop, reach }: ArmDrive) {
    const ph = this.phase;
    let acc = 0;
    for (let k = 0; k < SEGMENTS; k++) {
      const s = (k + 0.5) / SEGMENTS;
      const wave = sway * ((0.35 + s) * Math.sin(t * 0.78 - s * 3.1 + ph) + 0.55 * s * s * Math.sin(t * 1.27 - s * 5.4 + ph * 1.9));
      const tipCurl = curl * this.side * smoothstep(0.5, 1, s) * 0.5 * Math.sin(t * 0.53 + ph * 0.7);
      const trail = -droop * Math.cos(this.rest[k]) * (1 - 0.5 * s);
      acc += (wave + tipCurl + trail) / SEGMENTS;
      this.angle[k] = this.rest[k] + acc;
    }
    this.integrate();
    if (reach && reach.weight > 0.001) {
      this.solveReach(reach.x, reach.y);
      for (let k = 0; k < SEGMENTS; k++) this.angle[k] += wrap(this.work[k] - this.angle[k]) * reach.weight;
      this.integrate();
    }
    for (let k = 1; k <= SEGMENTS; k++) {
      const s = k / SEGMENTS;
      this.pz[k] = this.restZ[k] + 0.035 * s * Math.sin(t * 0.9 + ph + s * 2.5);
    }
    this.pz[0] = this.restZ[0];

    const ring = RADIAL + 1;
    for (let k = 0; k <= SEGMENTS; k++) {
      const k0 = Math.max(k - 1, 0);
      const k1 = Math.min(k + 1, SEGMENTS);
      let tx = this.px[k1] - this.px[k0];
      let ty = this.py[k1] - this.py[k0];
      let tz = this.pz[k1] - this.pz[k0];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      const nl = Math.hypot(ty, tx) || 1;
      const nx = -ty / nl;
      const ny = tx / nl;
      const bx = -tz * ny;
      const by = tz * nx;
      const bz = tx * ny - ty * nx;
      this.nx[k] = nx; this.ny[k] = ny; this.bx[k] = bx; this.by[k] = by; this.bz[k] = bz;
      const r = this.radius[k];
      for (let j = 0; j <= RADIAL; j++) {
        const c = RING_COS[j];
        const sn = RING_SIN[j];
        const dx = c * nx + sn * bx;
        const dy = c * ny + sn * by;
        const dz = sn * bz;
        const o = (k * ring + j) * 3;
        this.positions[o] = this.px[k] + r * dx;
        this.positions[o + 1] = this.py[k] + r * dy;
        this.positions[o + 2] = this.pz[k] + r * dz;
        this.normals[o] = dx;
        this.normals[o + 1] = dy;
        this.normals[o + 2] = dz;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }

  writeSuckers(mesh: THREE.InstancedMesh, start: number) {
    for (let i = 0; i < this.suckers.length; i++) {
      const { arc, size } = this.suckers[i];
      const f = arc / this.seg;
      const k = Math.min(SEGMENTS - 1, Math.floor(f));
      const u = f - k;
      const k2 = u < 0.5 ? k : k + 1;
      tmpDir.set(
        this.suckerCos * this.nx[k2] + this.suckerSin * this.bx[k2],
        this.suckerCos * this.ny[k2] + this.suckerSin * this.by[k2],
        this.suckerSin * this.bz[k2],
      ).normalize();
      const r = this.radiusAt(f) * 0.86;
      tmpPos.set(
        this.px[k] * (1 - u) + this.px[k + 1] * u + tmpDir.x * r,
        this.py[k] * (1 - u) + this.py[k + 1] * u + tmpDir.y * r,
        this.pz[k] * (1 - u) + this.pz[k + 1] * u + tmpDir.z * r,
      );
      tmpQuat.setFromUnitVectors(Z_AXIS, tmpDir);
      tmpScale.set(size, size, size * 0.75);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(start + i, tmpMatrix);
    }
  }
}
