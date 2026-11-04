import type * as THREE from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import { holdKtx2Loader, ktx2Loader, releaseKtx2Loader } from './kitLoader';

afterEach(() => {
  vi.useRealTimers();
});

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

test('a held KTX2 loader goes the tick after its last holder lets go, and a hold in that tick keeps it', () => {
  vi.useFakeTimers();
  const gl = fakeRenderer();
  const loader = ktx2Loader(gl);
  const dispose = vi.spyOn(loader, 'dispose');
  const first = holdKtx2Loader(gl);
  const second = holdKtx2Loader(gl);
  // One of two worlds on the renderer leaves: the other's loads keep their workers.
  first();
  first();
  vi.runAllTimers();
  expect(dispose).not.toHaveBeenCalled();
  expect(ktx2Loader(gl)).toBe(loader);
  // The last leaves and one comes back in the same tick (StrictMode's simulated unmount): kept.
  second();
  const again = holdKtx2Loader(gl);
  vi.runAllTimers();
  expect(dispose).not.toHaveBeenCalled();
  // The last holder leaves for good: the loader and its workers go after the tick, not before.
  again();
  expect(dispose).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(dispose).toHaveBeenCalledOnce();
  expect(ktx2Loader(gl)).not.toBe(loader);
});
