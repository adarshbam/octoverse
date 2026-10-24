import * as THREE from 'three';
import type { ArmSpec } from '../config/types';
import type { ArmChain } from './armChain';

/** The base swells by up to 12%, easing out along the arm, so it fills the joint with the body. */
const BASE_SWELL = 0.12;

/**
 * Arm radius at arc fraction u (0 = root, 1 = tip): thick for most of the length, then
 * tapering into the curl (1 - u^taperPower), with a fuller base and a rounded tip.
 */
export function armRadius(u: number, spec: ArmSpec, profile: { tipRadius: number; taperPower: number }) {
  const t = Math.min(1, Math.max(0, u));
  const taper = profile.tipRadius + (spec.rootRadius - profile.tipRadius) * (1 - t ** profile.taperPower);
  return taper * (1 + BASE_SWELL * (1 - t) ** 4);
}

/**
 * A tapered tube rebuilt around an arm chain every frame. Ring 0 of each
 * cross-section faces the chain's left normal; the sucker side is a fixed
 * angle in that frame, stored per vertex as `aUnder` for the skin shader.
 */
export class ArmTube {
  readonly geometry = new THREE.BufferGeometry();
  /** Per-ring frame: left normal (n) and camera-ish binormal (b). */
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly bx: Float32Array;
  readonly by: Float32Array;
  readonly bz: Float32Array;
  readonly suckerCos: number;
  readonly suckerSin: number;
  private readonly chain: ArmChain;
  private readonly radius: Float32Array;
  private readonly radial: number;
  private readonly ringCos: Float32Array;
  private readonly ringSin: Float32Array;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;

  constructor(chain: ArmChain, spec: ArmSpec, profile: { tipRadius: number; taperPower: number; suckerTilt: number }, radial = 18) {
    const n = chain.segments;
    this.chain = chain;
    this.radial = radial;
    this.nx = new Float32Array(n + 1);
    this.ny = new Float32Array(n + 1);
    this.bx = new Float32Array(n + 1);
    this.by = new Float32Array(n + 1);
    this.bz = new Float32Array(n + 1);
    this.radius = new Float32Array(n + 1);
    for (let k = 0; k <= n; k++) this.radius[k] = armRadius(k / n, spec, profile);
    this.ringCos = Float32Array.from({ length: radial + 1 }, (_, j) => Math.cos((j / radial) * Math.PI * 2));
    this.ringSin = Float32Array.from({ length: radial + 1 }, (_, j) => Math.sin((j / radial) * Math.PI * 2));
    const tilt = THREE.MathUtils.degToRad(profile.suckerTilt);
    this.suckerCos = chain.side * Math.cos(tilt);
    this.suckerSin = Math.sin(tilt);

    const ring = radial + 1;
    const count = (n + 1) * ring;
    this.positions = new Float32Array(count * 3);
    this.normals = new Float32Array(count * 3);
    const under = new Float32Array(count);
    const arcU = new Float32Array(count);
    const speck = new Float32Array(count * 2);
    const suckerAngle = Math.atan2(this.suckerSin, this.suckerCos);
    for (let k = 0; k <= n; k++) {
      for (let j = 0; j <= radial; j++) {
        const v = k * ring + j;
        under[v] = Math.cos((j / radial) * Math.PI * 2 - suckerAngle);
        arcU[v] = k / n;
        speck[v * 2] = k * chain.segmentLength * 15;
        speck[v * 2 + 1] = (j / radial) * 8;
      }
    }
    const indices: number[] = [];
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < radial; j++) {
        const a = k * ring + j;
        const b = a + ring;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    this.geometry.setIndex(indices);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aUnder', new THREE.BufferAttribute(under, 1));
    this.geometry.setAttribute('aU', new THREE.BufferAttribute(arcU, 1));
    this.geometry.setAttribute('aSpeck', new THREE.BufferAttribute(speck, 2));
    this.update();
  }

  /** Radius at arc fraction u. */
  radiusAt(u: number) {
    const n = this.chain.segments;
    const f = Math.min(1, Math.max(0, u)) * n;
    const k = Math.min(n - 1, Math.floor(f));
    const w = f - k;
    return this.radius[k] * (1 - w) + this.radius[k + 1] * w;
  }

  update() {
    const { px, py, pz, segments: n } = this.chain;
    const ring = this.radial + 1;
    for (let k = 0; k <= n; k++) {
      const k0 = Math.max(k - 1, 0);
      const k1 = Math.min(k + 1, n);
      let tx = px[k1] - px[k0];
      let ty = py[k1] - py[k0];
      let tz = pz[k1] - pz[k0];
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
      for (let j = 0; j <= this.radial; j++) {
        const c = this.ringCos[j];
        const s = this.ringSin[j];
        const dx = c * nx + s * bx;
        const dy = c * ny + s * by;
        const dz = s * bz;
        const o = (k * ring + j) * 3;
        this.positions[o] = px[k] + r * dx;
        this.positions[o + 1] = py[k] + r * dy;
        this.positions[o + 2] = pz[k] + r * dz;
        this.normals[o] = dx;
        this.normals[o + 1] = dy;
        this.normals[o + 2] = dz;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }
}
