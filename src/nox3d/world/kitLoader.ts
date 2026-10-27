import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { bakedLightOf } from './bakedLight';
import type { WorldConfig } from './types';
import { type Disposable, reclaim, retire } from './useDisposables';

/** One KTX2 loader per renderer: it transcodes in workers, to the formats this GPU supports. */
const ktx2Loaders = new WeakMap<THREE.WebGLRenderer, KTX2Loader>();

/** The renderer's KTX2 loader, made on first use, with the Basis transcoder in public/nox/basis. */
export function ktx2Loader(gl: THREE.WebGLRenderer) {
  let loader = ktx2Loaders.get(gl);
  if (!loader) {
    loader = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}nox/basis/`).detectSupport(gl);
    ktx2Loaders.set(gl, loader);
  }
  return loader;
}

/**
 * Ends the renderer's KTX2 loader and its transcoder workers; a later compressed load makes a new
 * loader. Worlds do not call it directly: they hold the loader (`holdKtx2Loader`).
 */
export function releaseKtx2Loader(gl: THREE.WebGLRenderer) {
  ktx2Loaders.get(gl)?.dispose();
  ktx2Loaders.delete(gl);
}

/** How many mounted worlds hold each renderer's KTX2 loader. */
const holders = new WeakMap<THREE.WebGLRenderer, number>();
/** Each renderer's release, as a list `retire` and `reclaim` can key on (one list per renderer). */
const releases = new WeakMap<THREE.WebGLRenderer, readonly Disposable[]>();

/**
 * Holds the renderer's KTX2 loader for a mounted world; returns the release. The loader and its
 * transcoder workers go the tick after the last holder on that renderer lets go, through
 * useDisposables' `retire`: StrictMode's simulated unmount and remount, or one world handing over
 * to the next, keeps the loader, and one world leaving never ends another's loads.
 */
export function holdKtx2Loader(gl: THREE.WebGLRenderer) {
  let release = releases.get(gl);
  if (!release) {
    release = [{ dispose: () => releaseKtx2Loader(gl) }];
    releases.set(gl, release);
  }
  const list = release;
  holders.set(gl, (holders.get(gl) ?? 0) + 1);
  reclaim(list);
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    const left = (holders.get(gl) ?? 1) - 1;
    holders.set(gl, left);
    if (left === 0) retire(list);
  };
}

/** The kit is compressed: meshopt geometry, KTX2 (Basis) textures. */
export function compressedKit(gl: THREE.WebGLRenderer) {
  return (loader: GLTFLoader) => {
    loader.setKTX2Loader(ktx2Loader(gl));
    loader.setMeshoptDecoder(MeshoptDecoder);
  };
}

/**
 * The world's kit as loaded: near.glb, the pieces with the near world's baked light, when the world
 * has one; else kit.glb, lit in real time. The same object every render until the file or the
 * world changes, so what is built from it is built once. The world holds the KTX2 loader while it
 * is mounted.
 */
export function useWorldKit(world: WorldConfig) {
  const gl = useThree(state => state.gl);
  const gltf = useLoader(GLTFLoader, world.near?.url ?? world.kit.url, compressedKit(gl));
  useEffect(() => holdKtx2Loader(gl), [gl]);
  const baked = useMemo(() => (world.near ? bakedLightOf(gltf.scene, world.layout) : null), [gltf, world]);
  return useMemo(() => ({ scene: gltf.scene, baked }), [gltf, baked]);
}
export type WorldKit = ReturnType<typeof useWorldKit>;

/**
 * A kit mesh as plain float geometry in its piece's own space. The compressed file stores
 * positions quantized into a [-1, 1] box and puts the scale and offset back in the node; code
 * that reads positions as stage units (the coral's sway, the chain's bending) needs them undone.
 */
export function bakedGeometry(mesh: THREE.Mesh) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, source] of Object.entries(mesh.geometry.attributes)) {
    const size = source.itemSize;
    const values = new Float32Array(source.count * size);
    // getX..getW undo the normalisation of quantized attributes.
    const read = (i: number, c: number) => (c === 0 ? source.getX(i) : c === 1 ? source.getY(i) : c === 2 ? source.getZ(i) : source.getW(i));
    for (let i = 0; i < source.count; i++) for (let c = 0; c < size; c++) values[i * size + c] = read(i, c);
    geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
  }
  // Its own copy: disposing this geometry must not free the cached piece's index on the GPU.
  if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
  mesh.updateWorldMatrix(true, false);
  return geometry.applyMatrix4(mesh.matrixWorld);
}
