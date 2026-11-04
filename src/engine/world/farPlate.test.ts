/// <reference types="node" />
import { readFileSync, statSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as THREE from 'three';
import { CAMERA_Z } from '../config/stage';
import { NOX_BUNDLE, NOX_STAGE_FRAMES as STAGE_FRAMES } from '../../nox3d/bundle.nox';
import { fovFor } from '../stage/framing';
import { faceAnchor } from '../types/bundle';
import { pinnedHover } from './cameraHover';
import { leanCamera } from './lensShift';
import { FAR_HOVER, FAR_VIEWPORTS, dropMips, farCardSize, farLayerOf, isFarChain, isFarPlacement, plateCardSize } from './farPlate';
import { SECURITY_WORLD } from '../../nox3d/world/security/config';
import farData from '../../nox3d/world/security/far.json';
import type { Vec3 } from './types';

const FAR_CUT_Z = farData.cutZ;
const FAR_LAYERS = farData.layers;

const PUBLIC = new URL('../../../public/', import.meta.url);

/** The camera the page puts at a pinned hover (App.tsx placeCamera), for a viewport on the intro's frame. */
function hoverCamera(hover: Vec3, viewport: { width: number; height: number }) {
  const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES.intro, viewport), viewport.width / viewport.height, 0.1, 140);
  const { offset, look } = pinnedHover(hover);
  camera.position.set(offset[0], offset[1], CAMERA_Z + offset[2]);
  camera.lookAt(offset[0] + look[0], offset[1] + look[1], CAMERA_Z + look[2]);
  // The world's lean (App.tsx): pitched up and its frame shifted down, as the page has it.
  leanCamera(camera, SECURITY_WORLD.camera.tilt, faceAnchor(NOX_BUNDLE, 'intro'), [0, 0, CAMERA_Z], { fullWidth: viewport.width, fullHeight: viewport.height, x: 0, y: 0, width: viewport.width, height: viewport.height });
  camera.updateMatrixWorld(true);
  return camera;
}

/** Where the frustum's four corner rays meet the plane at depth z. */
function frustumOnPlane(camera: THREE.PerspectiveCamera, z: number) {
  return [-1, 1].flatMap(x =>
    [-1, 1].map(y => {
      const near = new THREE.Vector3(x, y, -1).unproject(camera);
      const far = new THREE.Vector3(x, y, 1).unproject(camera);
      const t = (z - near.z) / (far.z - near.z);
      return near.lerp(far, t);
    }),
  );
}

test('far plate cards cover the frustum at full hover', () => {
  const signs = [-1, 1];
  for (const viewport of [{ width: 2560, height: 1080 }, { width: 390, height: 844 }]) {
    const aspect = viewport.width / viewport.height;
    const fovDeg = fovFor(STAGE_FRAMES.intro, viewport);
    for (const layer of farData.layers) {
      const card = plateCardSize(layer.z, { z: CAMERA_Z, fovDeg, aspect }, FAR_HOVER);
      // Every corner of the hover box: the camera displaced there, looking where the hover looks.
      for (const sx of signs) for (const sy of signs) for (const sz of signs) {
        const hover: Vec3 = [FAR_HOVER[0] * sx, FAR_HOVER[1] * sy, FAR_HOVER[2] * sz];
        for (const p of frustumOnPlane(hoverCamera(hover, viewport), layer.z)) {
          const label = `${viewport.width}x${viewport.height} z ${layer.z} hover ${hover}`;
          expect(Math.abs(p.x), `${label} x`).toBeLessThanOrEqual(card.width / 2);
          expect(Math.abs(p.y), `${label} y`).toBeLessThanOrEqual(card.height / 2);
        }
      }
    }
  }
  // Overscan only adds margin: width and height each grow by twice it.
  const camera = { z: CAMERA_Z, fovDeg: 23.7, aspect: 2 };
  const plain = plateCardSize(-16, camera, [0, 0, 0], 0);
  const wide = plateCardSize(-16, camera, [0, 0, 0], 1);
  expect(wide.width - plain.width).toBeCloseTo(2, 9);
  expect(wide.height - plain.height).toBeCloseTo(2, 9);
  // With no hover and no overscan the card is exactly the frustum at its depth.
  expect(plain.height).toBeCloseTo(2 * (CAMERA_Z + 16) * Math.tan(THREE.MathUtils.degToRad(23.7 / 2)), 9);
  expect(plain.width).toBeCloseTo(plain.height * 2, 9);
});

test('layers are ordered far to near', () => {
  const { layers } = SECURITY_WORLD.farPlate!;
  expect(layers.length).toBe(3);
  expect(layers.map(l => l.z)).toEqual([-45, -27, -16]);
  for (let i = 1; i < layers.length; i++) expect(layers[i].z).toBeGreaterThan(layers[i - 1].z);
  // Their ranges meet end to end from the cut outward: -12 to -20 at -16, -20 to -34 at -27, beyond -34 at -45.
  const spans = [...farData.layers].sort((a, b) => b.z - a.z);
  expect(spans.map(s => [s.near, s.far])).toEqual([[-12, -20], [-20, -34], [-34, null]]);
  expect(FAR_CUT_Z).toBe(-12);
  expect(SECURITY_WORLD.farPlate!.cutZ).toBe(FAR_CUT_Z);
  expect(spans[0].near).toBe(FAR_CUT_Z);
  for (let i = 1; i < spans.length; i++) expect(spans[i].near).toBe(spans[i - 1].far);
  // The page draws far to near, and the files are numbered the same way.
  expect(layers.map(l => l.url)).toEqual([0, 1, 2].map(i => `/nox/world/security/far-${i}.ktx2`));
  // A piece belongs to the layer whose range holds its z; the cut is the first layer's near edge.
  expect(farLayerOf(-12, FAR_CUT_Z, FAR_LAYERS)).toBeNull();
  expect(farLayerOf(-12.5, FAR_CUT_Z, FAR_LAYERS)?.z).toBe(-16);
  expect(farLayerOf(-20, FAR_CUT_Z, FAR_LAYERS)?.z).toBe(-16);
  expect(farLayerOf(-20.01, FAR_CUT_Z, FAR_LAYERS)?.z).toBe(-27);
  expect(farLayerOf(-34, FAR_CUT_Z, FAR_LAYERS)?.z).toBe(-27);
  expect(farLayerOf(-40, FAR_CUT_Z, FAR_LAYERS)?.z).toBe(-45);
});

test('the plate takes exactly the layout pieces beyond the cut', () => {
  const { layout } = SECURITY_WORLD;
  const beyond = (list: readonly { position: Vec3 }[]) => list.filter(p => isFarPlacement(p, FAR_CUT_Z)).map(p => p.position[2]);
  expect(beyond(layout.pillars).every(z => z < -12)).toBe(true);
  expect(layout.pillars.filter(p => !isFarPlacement(p, FAR_CUT_Z)).every(p => p.position[2] >= -12)).toBe(true);
  const descending = (a: number, b: number) => b - a;
  expect(beyond(layout.pillars).sort(descending)).toEqual([-12.5, -18, -20, -26, -29]);
  expect(beyond(layout.rocks).sort(descending)).toEqual([-14, -16]);
  expect(beyond(layout.corals)).toEqual([-16.5]);
  // A chain is far only when both ends are.
  expect(layout.chains.filter(chain => isFarChain(chain, FAR_CUT_Z)).length).toBe(1);
});

test('far.json sizes are the cards the page needs, and the files are within the budget', () => {
  for (const layer of farData.layers) {
    const size = farCardSize(layer.z, STAGE_FRAMES.intro);
    expect(layer.width, `z ${layer.z} width`).toBeCloseTo(size.width, 2);
    expect(layer.height, `z ${layer.z} height`).toBeCloseTo(size.height, 2);
  }
  expect(FAR_VIEWPORTS.length).toBe(2);
  // The fog baked into the layers is the world's own: far.json carries the colour and density the render used.
  expect(farData.fog).toEqual({ color: SECURITY_WORLD.palette.waterFar, density: SECURITY_WORLD.water.fogDensity });
  // The far layers together stay under 1.2 MB (Task 9 / R35).
  const bytes = SECURITY_WORLD.farPlate!.layers.map(l => statSync(new URL(l.url.replace(/^\//, ''), PUBLIC)).size);
  expect(bytes.reduce((a, b) => a + b, 0)).toBeLessThan(1.2 * 1024 * 1024);
  // KTX2 files: the identifier, then the Basis-compressed (supercompression scheme) header says what they hold.
  for (const l of SECURITY_WORLD.farPlate!.layers) {
    const head = readFileSync(new URL(l.url.replace(/^\//, ''), PUBLIC)).subarray(0, 12);
    expect([...head.subarray(1, 7)]).toEqual([...Buffer.from('KTX 20')]);
  }
});

test('a lower plate scale draws from smaller mip levels, only where block compression allows', () => {
  const make = (sizes: number[][]) => Object.assign(new THREE.Texture(), { mipmaps: sizes.map(([width, height]) => ({ width, height })) }) as unknown as THREE.CompressedTexture;
  const full = make([[64, 32], [32, 16], [16, 8]]);
  dropMips(full, 0);
  expect(full.mipmaps).toHaveLength(3);
  const half = make([[64, 32], [32, 16], [16, 8]]);
  dropMips(half, 1);
  expect(half.mipmaps).toHaveLength(2);
  expect(half.image).toEqual({ width: 32, height: 16 });
  // Never past the smallest level.
  const tiny = make([[64, 32], [32, 16], [16, 8]]);
  dropMips(tiny, 9);
  expect(tiny.mipmaps).toHaveLength(1);
  // 900 halves to 450: not a multiple of 4, so this one keeps its full size.
  const odd = make([[1024, 900], [512, 450], [256, 225]]);
  dropMips(odd, 1);
  expect(odd.mipmaps).toHaveLength(3);
});
