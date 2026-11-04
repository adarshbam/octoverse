import * as THREE from 'three';
import { seeded } from '../noise';
import { floorHeight } from '../seabed';
import type { StrandConfig } from '../types';
import type { StrandShape } from './index';

// The strands of kelp and seagrass (Kelp.tsx draws them): one ribbon of geometry, instanced, and a
// scatter over the seabed's flanks. Pure, so the tests can read both.

/** How much narrower the tip of a strand is than its root. */
const TAPER = 0.8;
/** Where strands stand: x out to `maxX` either side of the clear middle, z from `nearZ` back to `farZ`. */
export const STRAND_AREA = { maxX: 9, nearZ: 2, farZ: -26 };
/** A strand's root sinks this far into the seabed. */
const ROOT_SINK = 0.02;

/**
 * A strand: a tapered ribbon one stage unit tall (the instance's y scale is its height), facing +z,
 * in `segments` rings of two vertices. Its `y` is the fraction up the strand the shader sways by.
 */
export function strandGeometry({ width, segments }: Pick<StrandShape, 'width' | 'segments'>) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const y = i / segments;
    const half = (width / 2) * (1 - TAPER * y);
    positions.push(-half, y, 0, half, y, 0);
    uvs.push(0, y, 1, y);
    if (i < segments) {
      const a = 2 * i;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

export interface StrandPlacement {
  x: number;
  y: number;
  z: number;
  /** Turn about y: the direction the strand's lean takes. */
  yaw: number;
  /** Stage units, at most the config's `height`. */
  height: number;
}

/**
 * Where the config's `count` strands stand: both flanks, outside the shape's clear middle,
 * thicker toward the middle, each rooted in the seabed, from the shape's seed. The same every call.
 */
export function scatterStrands(config: StrandConfig, shape: Pick<StrandShape, 'clear' | 'seed'>, floorY: number): StrandPlacement[] {
  const rand = seeded(shape.seed);
  return Array.from({ length: Math.max(0, config.count) }, () => {
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * (shape.clear + Math.pow(rand(), 1.4) * (STRAND_AREA.maxX - shape.clear));
    const z = STRAND_AREA.nearZ - rand() * (STRAND_AREA.nearZ - STRAND_AREA.farZ);
    return { x, y: floorHeight(x, z, floorY) - ROOT_SINK, z, yaw: rand() * Math.PI * 2, height: config.height * (0.6 + 0.4 * rand()) };
  });
}
