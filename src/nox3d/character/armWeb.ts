import * as THREE from 'three';
import type { ArmId } from '../config/types';
import type { ArmChain } from './armChain';

/** Neighbouring arms joined by webbing, in order around the body. Never across the back (T8–T1). */
export const WEB_PAIRS: readonly (readonly [ArmId, ArmId])[] = [
  ['T1', 'T2'], ['T2', 'T3'], ['T3', 'T4'], ['T4', 'T5'], ['T5', 'T6'], ['T6', 'T7'], ['T7', 'T8'],
];

const ROWS = 16;
const COLS = 8;
/** Default sag: how far the free edge's middle falls back toward the root, as a fraction of the reach. */
const SAG = 0.35;

const pa = { x: 0, y: 0, z: 0 };
const pb = { x: 0, y: 0, z: 0 };

/**
 * The membrane between two neighbouring arms near the body, the anatomy that
 * makes eight arms read as one creature. It spans from each arm's facing side,
 * covers the first `reach` of their length, and its free edge sags toward the
 * root. Rebuilt every frame from both chains, so it stretches and folds with them.
 */
export class ArmWeb {
  readonly geometry = new THREE.BufferGeometry();
  private readonly a: ArmChain;
  private readonly b: ArmChain;
  private readonly ra: (u: number) => number;
  private readonly rb: (u: number) => number;
  private readonly reach: number;
  private readonly sag: number;
  private readonly positions: Float32Array;

  constructor(a: ArmChain, b: ArmChain, ra: (u: number) => number, rb: (u: number) => number, reach = 0.2, sag = SAG) {
    this.a = a;
    this.b = b;
    this.ra = ra;
    this.rb = rb;
    this.reach = reach;
    this.sag = sag;
    const count = (ROWS + 1) * (COLS + 1);
    this.positions = new Float32Array(count * 3);
    const under = new Float32Array(count);
    const arcU = new Float32Array(count);
    const speck = new Float32Array(count * 3);
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const v = i * (COLS + 1) + j;
        // Webs are body skin: keep them inside the shader's body-colour join (arc < 0.1).
        arcU[v] = (i / ROWS) * 0.08;
        speck[v * 3] = (i / ROWS) * 0.6;
        speck[v * 3 + 1] = (j / COLS) * 1.5;
        speck[v * 3 + 2] = 0.12;
      }
    }
    const indices: number[] = [];
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        const q = i * (COLS + 1) + j;
        indices.push(q, q + COLS + 1, q + 1, q + 1, q + COLS + 1, q + COLS + 2);
      }
    }
    this.geometry.setIndex(indices);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aUnder', new THREE.BufferAttribute(under, 1));
    this.geometry.setAttribute('aU', new THREE.BufferAttribute(arcU, 1));
    this.geometry.setAttribute('aSpeck', new THREE.BufferAttribute(speck, 3));
    this.update();
  }

  update() {
    for (let j = 0; j <= COLS; j++) {
      const v = j / COLS;
      // Parabolic sag: the middle of the free edge reaches less far than its ends.
      const reach = this.reach * (1 - this.sag * 4 * v * (1 - v));
      for (let i = 0; i <= ROWS; i++) {
        const u = (i / ROWS) * reach;
        this.a.pointAt(u, pa);
        this.b.pointAt(u, pb);
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const gap = Math.hypot(dx, dy) || 1;
        // Start each side just inside the tube surface that faces the other arm.
        const ea = Math.min(this.ra(u) * 0.9, gap * 0.45) / gap;
        const eb = Math.min(this.rb(u) * 0.9, gap * 0.45) / gap;
        const t = ea + (1 - ea - eb) * v;
        const o = (i * (COLS + 1) + j) * 3;
        this.positions[o] = pa.x + dx * t;
        this.positions[o + 1] = pa.y + dy * t;
        this.positions[o + 2] = pa.z + (pb.z - pa.z) * t;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
