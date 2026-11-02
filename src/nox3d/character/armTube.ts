import * as THREE from 'three';
import { ARM_IDS, type ArmSpec } from '../config/types';
import type { ArmChain } from './armChain';

/** The base swells by up to 12%, easing out along the arm, so it fills the joint with the body. */
const BASE_SWELL = 0.12;
/** Rings in the rounded cap that closes each arm's tip. */
export const CAP_RINGS = 6;
/**
 * Rings in the rounded cap that closes each arm's root, reaching in to the body's upright axis.
 * The rear arms' roots sit on the mantle's surface, so from behind an open end read as a flat cut;
 * the cap tucks the root into the body. From the front it lies inside the head and neck.
 */
export const ROOT_RINGS = 6;

/**
 * Arm radius at arc fraction u (0 = root, 1 = tip): thick for most of the length, then
 * tapering into the curl (1 - u^taperPower), with a fuller base and a rounded tip.
 */
export function armRadius(u: number, spec: ArmSpec, profile: { tipRadius: number; taperPower: number }) {
  const t = Math.min(1, Math.max(0, u));
  const taper = profile.tipRadius + (spec.rootRadius - profile.tipRadius) * (1 - t ** profile.taperPower);
  return taper * (1 + BASE_SWELL * (1 - t) ** 4);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How far (radians) the oral side turns from the arm's edge toward the viewer at arc fraction
 * u: `suckerTilt` along most of the arm, turning to `curlTilt` in the curl, so the cups face the
 * viewer inside the spirals.
 */
export function suckerTilt(u: number, profile: { suckerTilt: number; curlTilt: number }) {
  return THREE.MathUtils.degToRad(profile.suckerTilt + (profile.curlTilt - profile.suckerTilt) * smoothstep(0.6, 1, u));
}

/**
 * A tapered tube rebuilt around an arm chain every frame. Ring 0 of each
 * cross-section faces the chain's left normal; the sucker side is an angle in
 * that frame that turns toward the viewer in the curl, stored per vertex as
 * `aUnder` for the skin shader.
 */
export class ArmTube {
  readonly geometry = new THREE.BufferGeometry();
  /** Per-ring frame: left normal (n) and camera-ish binormal (b). */
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly bx: Float32Array;
  readonly by: Float32Array;
  readonly bz: Float32Array;
  /** Per-ring tilt of the oral side toward the viewer (radians), and which side of the arm carries it. */
  readonly tilt: Float32Array;
  readonly side: 1 | -1;
  /** The sucker side is flattened to this fraction of the radius; the back stays round. */
  readonly flatten: number;
  private readonly chain: ArmChain;
  private readonly radius: Float32Array;
  /** Vertices round each ring, less one (the seam repeats the first). */
  readonly radial: number;
  private readonly ringCos: Float32Array;
  private readonly ringSin: Float32Array;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  /** The body's upright axis (x, at z = 0) in the arm's space: the root cap reaches in to it. */
  private readonly axisX: number;

  constructor(chain: ArmChain, spec: ArmSpec, profile: { tipRadius: number; taperPower: number; suckerTilt: number; curlTilt: number; twist: number; flatten: number }, radial = 24, axisX = 0) {
    const n = chain.segments;
    this.chain = chain;
    this.radial = radial;
    this.axisX = axisX;
    this.nx = new Float32Array(n + 1);
    this.ny = new Float32Array(n + 1);
    this.bx = new Float32Array(n + 1);
    this.by = new Float32Array(n + 1);
    this.bz = new Float32Array(n + 1);
    this.radius = new Float32Array(n + 1);
    for (let k = 0; k <= n; k++) this.radius[k] = armRadius(k / n, spec, profile);
    this.ringCos = Float32Array.from({ length: radial + 1 }, (_, j) => Math.cos((j / radial) * Math.PI * 2));
    this.ringSin = Float32Array.from({ length: radial + 1 }, (_, j) => Math.sin((j / radial) * Math.PI * 2));
    this.side = chain.side;
    this.flatten = profile.flatten;
    // Along the middle of the arm the oral side rolls toward and away from the viewer, so the
    // red band widens and narrows as the arm turns; the root and the curl keep their tilt.
    const twist = THREE.MathUtils.degToRad(profile.twist);
    const phase = ARM_IDS.indexOf(spec.id) * 2.1;
    this.tilt = Float32Array.from({ length: n + 1 }, (_, k) => {
      const u = k / n;
      const roll = Math.sin(Math.PI * 2.6 * u + phase) * smoothstep(0.06, 0.18, u) * (1 - smoothstep(0.55, 0.72, u));
      return suckerTilt(u, profile) + twist * roll;
    });

    const ring = radial + 1;
    // The arm's rings, then a rounded cap past the tip, then a rounded cap behind the root.
    const rootFirst = n + 1 + CAP_RINGS;
    const count = (rootFirst + ROOT_RINGS) * ring;
    this.positions = new Float32Array(count * 3);
    this.normals = new Float32Array(count * 3);
    const under = new Float32Array(count);
    const arcU = new Float32Array(count);
    const speck = new Float32Array(count * 3);
    for (let k = 0; k < rootFirst + ROOT_RINGS; k++) {
      const root = k >= rootFirst;
      const kk = root ? 0 : Math.min(k, n);
      // Distance along the arm: the root cap's rings run back from the root.
      const along = root ? -(k - rootFirst + 1) : k;
      const suckerAngle = Math.atan2(Math.sin(this.tilt[kk]), chain.side * Math.cos(this.tilt[kk]));
      for (let j = 0; j <= radial; j++) {
        const v = k * ring + j;
        under[v] = Math.cos((j / radial) * Math.PI * 2 - suckerAngle);
        arcU[v] = kk / n;
        // Skin detail coordinates: arc length along the arm, the angle round it, and its rest radius.
        speck[v * 3] = along * chain.segmentLength;
        speck[v * 3 + 1] = (j / radial) * Math.PI * 2;
        speck[v * 3 + 2] = this.radius[kk];
      }
    }
    const indices: number[] = [];
    const strip = (from: number, to: number) => {
      for (let j = 0; j < radial; j++) {
        const a = from * ring + j;
        const b = to * ring + j;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    };
    for (let k = 0; k < n + CAP_RINGS; k++) strip(k, k + 1);
    // The root cap runs from its closed end out to the root ring, the same way round as the arm.
    for (let c = ROOT_RINGS; c >= 1; c--) strip(rootFirst + c - 1, c === 1 ? 0 : rootFirst + c - 2);
    this.geometry.setIndex(indices);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aUnder', new THREE.BufferAttribute(under, 1));
    this.geometry.setAttribute('aU', new THREE.BufferAttribute(arcU, 1));
    this.geometry.setAttribute('aSpeck', new THREE.BufferAttribute(speck, 3));
    this.update();
  }

  /**
   * Outward direction at ring k of a point `offset` radians round the arm from the oral
   * midline (positive is toward the viewer), written into `out`.
   */
  suckerDirection(k: number, offset: number, out: THREE.Vector3) {
    const a = this.tilt[k] + offset;
    const c = this.side * Math.cos(a);
    const s = Math.sin(a);
    return out.set(c * this.nx[k] + s * this.bx[k], c * this.ny[k] + s * this.by[k], s * this.bz[k]).normalize();
  }

  /**
   * Distance from the arm's centre line to its surface at arc fraction u, `offset` radians round
   * from the oral midline: shorter on the flattened sucker half, the full radius on the back.
   */
  surfaceRadius(u: number, offset: number) {
    const r = this.radiusAt(u);
    const along = Math.max(0, Math.cos(offset));
    return r / Math.sqrt((along * along) / (this.flatten * this.flatten) + 1 - along * along);
  }

  /** Radius at arc fraction u. */
  radiusAt(u: number) {
    const n = this.chain.segments;
    const f = Math.min(1, Math.max(0, u)) * n;
    const k = Math.min(n - 1, Math.floor(f));
    const w = f - k;
    return this.radius[k] * (1 - w) + this.radius[k + 1] * w;
  }

  /**
   * The root cap: the root ring drawn in, level, toward the body's upright axis, closing to a point
   * on it (or half a root radius past it, for a root already near the axis), with the root ring's
   * own flattened cross-section and normals easing round to face inward.
   */
  private updateRootCap() {
    const { px, py, pz, segments: n } = this.chain;
    const ring = this.radial + 1;
    const first = n + 1 + CAP_RINGS;
    const r = this.radius[0];
    let dx = this.axisX - px[0];
    let dz = -pz[0];
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-6) {
      dx /= dist;
      dz /= dist;
    } else {
      dx = px[0] - px[1];
      dz = pz[0] - pz[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
    }
    const length = Math.max(dist, 0.5 * r);
    const p = this.positions;
    const nm = this.normals;
    for (let c = 1; c <= ROOT_RINGS; c++) {
      const a = (c / ROOT_RINGS) * (Math.PI / 2);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      // Normals of an ellipsoid cap stretched to `length`: they turn inward more slowly when it is long.
      const turn = sin * (r / length);
      for (let j = 0; j <= this.radial; j++) {
        const o0 = j * 3;
        const o = ((first + c - 1) * ring + j) * 3;
        p[o] = px[0] + dx * length * sin + (p[o0] - px[0]) * cos;
        p[o + 1] = py[0] + (p[o0 + 1] - py[0]) * cos;
        p[o + 2] = pz[0] + dz * length * sin + (p[o0 + 2] - pz[0]) * cos;
        const nx = nm[o0] * cos + dx * turn;
        const ny = nm[o0 + 1] * cos;
        const nz = nm[o0 + 2] * cos + dz * turn;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nm[o] = nx / nl;
        nm[o + 1] = ny / nl;
        nm[o + 2] = nz / nl;
      }
    }
  }

  update() {
    const { px, py, pz, segments: n } = this.chain;
    const ring = this.radial + 1;
    let ex = 0;
    let ey = 0;
    let ez = 0;
    for (let k = 0; k <= n; k++) {
      const k0 = Math.max(k - 1, 0);
      const k1 = Math.min(k + 1, n);
      let tx = px[k1] - px[k0];
      let ty = py[k1] - py[k0];
      let tz = pz[k1] - pz[k0];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      ex = tx; ey = ty; ez = tz;
      const nl = Math.hypot(ty, tx) || 1;
      const nx = -ty / nl;
      const ny = tx / nl;
      const bx = -tz * ny;
      const by = tz * nx;
      const bz = tx * ny - ty * nx;
      this.nx[k] = nx; this.ny[k] = ny; this.bx[k] = bx; this.by[k] = by; this.bz[k] = bz;
      const r = this.radius[k];
      // The oral direction in this ring, and how strongly the flattened half bends normals toward it.
      const oc = this.side * Math.cos(this.tilt[k]);
      const os = Math.sin(this.tilt[k]);
      const ox = oc * nx + os * bx;
      const oy = oc * ny + os * by;
      const oz = os * bz;
      const pull = 1 / (this.flatten * this.flatten) - 1;
      for (let j = 0; j <= this.radial; j++) {
        const c = this.ringCos[j];
        const s = this.ringSin[j];
        const dx = c * nx + s * bx;
        const dy = c * ny + s * by;
        const dz = s * bz;
        // On the sucker half the cross-section is half an ellipse, flatter toward the suckers.
        const along = Math.max(0, c * oc + s * os);
        const rho = r / Math.sqrt(along * along * (pull + 1) + 1 - along * along);
        let mx = dx + pull * along * ox;
        let my = dy + pull * along * oy;
        let mz = dz + pull * along * oz;
        const ml = Math.hypot(mx, my, mz) || 1;
        mx /= ml; my /= ml; mz /= ml;
        const o = (k * ring + j) * 3;
        this.positions[o] = px[k] + rho * dx;
        this.positions[o + 1] = py[k] + rho * dy;
        this.positions[o + 2] = pz[k] + rho * dz;
        this.normals[o] = mx;
        this.normals[o + 1] = my;
        this.normals[o + 2] = mz;
      }
    }
    // Rounded cap: a quarter circle past the tip, closing to a point one tip radius beyond it.
    const r = this.radius[n];
    const nx = this.nx[n];
    const ny = this.ny[n];
    const bx = this.bx[n];
    const by = this.by[n];
    const bz = this.bz[n];
    for (let c = 1; c <= CAP_RINGS; c++) {
      const a = (c / CAP_RINGS) * (Math.PI / 2);
      const along = r * Math.sin(a);
      const across = r * Math.cos(a);
      for (let j = 0; j <= this.radial; j++) {
        const dx = this.ringCos[j] * nx + this.ringSin[j] * bx;
        const dy = this.ringCos[j] * ny + this.ringSin[j] * by;
        const dz = this.ringSin[j] * bz;
        const o = ((n + c) * ring + j) * 3;
        this.positions[o] = px[n] + ex * along + dx * across;
        this.positions[o + 1] = py[n] + ey * along + dy * across;
        this.positions[o + 2] = pz[n] + ez * along + dz * across;
        this.normals[o] = dx * Math.cos(a) + ex * Math.sin(a);
        this.normals[o + 1] = dy * Math.cos(a) + ey * Math.sin(a);
        this.normals[o + 2] = dz * Math.cos(a) + ez * Math.sin(a);
      }
    }
    this.updateRootCap();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }
}
