/// <reference types="node" />
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, test, vi } from 'vitest';
import { asBakeRecord } from './bakedLight';
import { applyPlacement, coralRest, withLod } from './placement';
import { SECURITY_WORLD } from '../../nox3d/world/security/config';

// The bake (blender/security/bake_world.py) places every piece and drops the coral itself, in
// Blender; the page does it again in Kit.tsx. near.glb records where the bake put each one, and
// these tests check the page's own functions put them in the same place.

const NEAR_FILE = new URL('../../../public/nox/world/security/near.glb', import.meta.url);

/** near.glb as the page loads it: three's GLTFLoader with the meshopt decoder. Its lightmaps are left undecoded. */
async function loadNear() {
  const glb = readFileSync(NEAR_FILE);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // The lightmaps are KTX2; a stand-in loader hands back empty textures, as only geometry is read.
  const ktx2 = { load: (_url: string, onLoad: (texture: THREE.Texture) => void) => onLoad(new THREE.Texture()), detectSupport: () => ktx2 };
  loader.setKTX2Loader(ktx2 as never);
  vi.stubGlobal('self', globalThis); // the loader reads URL from `self`
  try {
    return await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  } finally {
    vi.unstubAllGlobals();
  }
}

test("each placed piece's matrix is the one the bake placed it with", async () => {
  const gltf = await loadNear();
  const record = asBakeRecord(gltf.scene.userData.nox_bake);
  let checked = 0;
  for (const group of ['pillars', 'rocks', 'corals'] as const) {
    for (const [k, { placement, matrix }] of record.instances[group].entries()) {
      // Coral's height is where it came to rest, which the next test checks.
      const [x, , z] = placement.position;
      const p = group === 'corals' ? { ...placement, position: [x, matrix[13], z] as const } : placement;
      const object = new THREE.Object3D();
      applyPlacement(object, p);
      object.updateMatrix();
      // Blender holds matrices in single precision: 1e-5 is a few of its steps at 30 units out.
      const worst = Math.max(...object.matrix.elements.map((v, i) => Math.abs(v - matrix[i])));
      expect(worst, `${group}[${k}] ${placement.piece}`).toBeLessThan(1e-5);
      checked++;
    }
  }
  expect(checked).toBe(SECURITY_WORLD.layout.pillars.length + SECURITY_WORLD.layout.rocks.length + SECURITY_WORLD.layout.corals.length);
});

test('coral comes to rest on the same rock or seabed, at the same height, on the page as in the bake', async () => {
  const gltf = await loadNear();
  const record = asBakeRecord(gltf.scene.userData.nox_bake);
  const { layout } = SECURITY_WORLD;
  // The rocks as Kit.tsx places them: each a LOD of its two levels; coral rests on the full detail.
  gltf.scene.updateMatrixWorld(true);
  const surfaces = layout.rocks.map(p => {
    const lod = withLod(gltf.scene.getObjectByName(p.piece)!.clone(true), gltf.scene.getObjectByName(`${p.piece}_lod1`)!.clone(true));
    applyPlacement(lod, p);
    lod.updateMatrixWorld(true);
    return lod.levels[0].object;
  });
  const on = { rock: 0, seabed: 0 };
  for (const [k, { placement, matrix, restsOn }] of record.instances.corals.entries()) {
    const [x, , z] = placement.position;
    const rest = coralRest(x, z, layout.floorY, surfaces);
    const at = `corals[${k}] at (${x}, ${z})`;
    expect(rest.on, at).toBe(restsOn);
    // On the seabed both run the same function (floorHeight and its port, checked to 1e-9 in
    // validateWorld.test); the recorded height went through Blender's single-precision matrix. On
    // a rock the page casts against the file's geometry, whose positions meshopt quantized, and the
    // bake against Blender's own: they agree to under a millimetre of stage (0.001).
    expect(Math.abs(rest.y - matrix[13]), at).toBeLessThan(rest.on === 'seabed' ? 1e-5 : 1e-3);
    on[rest.on]++;
  }
  // Both kinds of rest are exercised.
  expect(on.rock).toBeGreaterThan(0);
  expect(on.seabed).toBeGreaterThan(0);
});
