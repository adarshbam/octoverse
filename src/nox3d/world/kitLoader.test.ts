import type * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { ktx2Loader, releaseKtx2Loader } from './kitLoader';

/** Just enough of a WebGL renderer for KTX2Loader.detectSupport: no compressed formats. */
const fakeRenderer = () => ({ extensions: { has: () => false } }) as unknown as THREE.WebGLRenderer;

test('one KTX2 loader per renderer, disposed with its transcoder workers when the world lets it go', () => {
  const gl = fakeRenderer();
  const loader = ktx2Loader(gl);
  expect(ktx2Loader(gl)).toBe(loader);
  expect(ktx2Loader(fakeRenderer())).not.toBe(loader);
  const dispose = vi.spyOn(loader, 'dispose');
  releaseKtx2Loader(gl);
  expect(dispose).toHaveBeenCalledOnce();
  // Releasing twice (the kit and the seabed both let go) disposes once; a later load gets a new loader.
  releaseKtx2Loader(gl);
  expect(dispose).toHaveBeenCalledOnce();
  expect(ktx2Loader(gl)).not.toBe(loader);
});
