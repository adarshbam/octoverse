import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../nox3d/config/nox.character';
import { EXPRESSIONS } from '../behavior/expressions';
import { FaceCanvas } from './FaceCanvas';

/** A FaceCanvas on a 2D context that does nothing (node has no canvas). */
function face() {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_, key) => (String(key).startsWith('create') ? () => ({ addColorStop: () => {} }) : () => undefined),
    set: () => true,
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  (globalThis as { document?: unknown }).document = { createElement: () => canvas };
  return new FaceCanvas(NOX.face, NOX.facePalette);
}

/** A renderer that counts what the upload asks of it. */
function renderer() {
  const calls: string[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const gl = {
    getRenderTarget: () => target,
    setRenderTarget: (t: THREE.WebGLRenderTarget | null) => { calls.push(t ? 'target' : 'screen'); target = t; },
    render: () => calls.push('render'),
  } as unknown as THREE.WebGLRenderer;
  return { gl, calls };
}

const params = { ...EXPRESSIONS.gentle, blink: 0, gazeX: 0, gazeY: 0 };

test('the canvas goes up as plain RGBA, copied into the sRGB mipmapped texture the skin samples', () => {
  const f = face();
  // The browser copies a canvas into a plain 8-bit texture on the GPU; into an sRGB one it reads it back through the CPU.
  expect(f.staging.colorSpace).toBe(THREE.NoColorSpace);
  expect(f.staging.generateMipmaps).toBe(false);
  // What the skin samples is what it sampled before: sRGB, mipmapped, anisotropic, 1024 square.
  expect(f.texture).toBe(f.target.texture);
  expect(f.texture.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(f.texture.generateMipmaps).toBe(true);
  expect(f.texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  expect(f.texture.anisotropy).toBe(8);
  expect([f.target.width, f.target.height]).toEqual([1024, 1024]);
});

test('a redrawn face is copied once; an unchanged one is not sent again', () => {
  const f = face();
  const { gl, calls } = renderer();
  expect(f.upload(gl)).toBe(false);
  expect(f.draw(params, 0)).toBe(true);
  const version = f.staging.version;
  expect(f.upload(gl)).toBe(true);
  expect(f.staging.version).toBe(version + 1);
  expect(calls).toEqual(['target', 'render', 'screen']);
  expect(f.upload(gl)).toBe(false);
  // Same face a frame later: no redraw, nothing sent.
  expect(f.draw(params, 100)).toBe(false);
  expect(f.upload(gl)).toBe(false);
  expect(calls).toHaveLength(3);
});

test('after a restored context the unchanged face is sent again, once', () => {
  // A restored WebGL context brings the target back empty; a still face (freeze, reduced motion) is not redrawn.
  const f = face();
  const { gl, calls } = renderer();
  f.draw(params, 0);
  f.upload(gl);
  expect(f.draw(params, 100)).toBe(false);
  f.invalidate();
  const version = f.staging.version;
  expect(f.upload(gl)).toBe(true);
  expect(f.staging.version).toBe(version + 1);
  expect(calls).toEqual(['target', 'render', 'screen', 'target', 'render', 'screen']);
  expect(f.upload(gl)).toBe(false);
});
