import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import type { OrbStyle } from '../config/types';
import { createOrbHaloMaterial, createOrbLogoMaterial, createOrbMaterial } from './orbMaterial';
import { RIM_RADIUS, createOrbStyle, rimBeadOffset } from './orbStyle';

// `artifacts.orbStyle` (Aether spec 2.3, 8 item 11): a rim of small glowing beads and a small cap
// where the thread meets the orb, drawn beside the shared orb glass. Absent, nothing is added and the
// glass is today's, exactly: Nox's and Veyra's orbs do not change.

/** A short, stable fingerprint of a text (FNV-1a, 32 bits). */
function fingerprint(source: string): string {
  const text = source.replace(/\r\n/g, '\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** What a material compiles and starts with: its shaders' fingerprints, its uniforms' values and its flags. */
function snapshot(material: THREE.ShaderMaterial | THREE.MeshBasicMaterial) {
  const shader = material as THREE.ShaderMaterial;
  return {
    vertex: shader.vertexShader ? fingerprint(shader.vertexShader) : null,
    fragment: shader.fragmentShader ? fingerprint(shader.fragmentShader) : null,
    uniforms: shader.uniforms ? Object.fromEntries(Object.entries(shader.uniforms).map(([key, { value }]) => [key, value instanceof THREE.Color ? value.getHexString() : value])) : null,
    flags: { transparent: material.transparent, depthTest: material.depthTest, depthWrite: material.depthWrite, blending: material.blending, side: material.side },
  };
}

const AETHER_LIKE: OrbStyle = { rimBeads: 16, rimColour: '#e4d9f8', cap: { colour: '#d99982', size: 0.05 } };

test("today's orb glass, halo and logo, pinned (recorded before orbStyle existed): an orb style never changes them", () => {
  const glass = snapshot(createOrbMaterial('#ff0000', NOX.palette.orbFocus, NOX.palette.orbGlass));
  expect(glass.vertex).toBe('c2317b8a');
  expect(glass.fragment).toBe('852186bd');
  expect(glass.uniforms).toEqual({ uTint: 'ff0000', uOpacity: 0, uFocus: 0, uFocusColour: new THREE.Color(NOX.palette.orbFocus).getHexString() });
  expect(glass.flags).toEqual({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending, side: THREE.FrontSide });
  const halo = snapshot(createOrbHaloMaterial('#ff0000', NOX.palette.orbFocus));
  expect(halo.fragment).toBe('2d453d45');
  expect(halo.flags).toEqual({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide });
  const logo = snapshot(createOrbLogoMaterial(new THREE.Texture()));
  expect(logo.flags).toEqual({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending, side: THREE.FrontSide });
});

test('no orb style, or one with no beads and no cap, adds nothing: the orbs are drawn as today', () => {
  expect(createOrbStyle(undefined, 10)).toBeNull();
  expect(createOrbStyle({ rimBeads: 0, rimColour: '#e4d9f8', cap: null }, 10)).toBeNull();
});

test('16 rim beads give 16 bead instances per orb, in one batch; a cap gives one cap per orb', () => {
  const style = createOrbStyle(AETHER_LIKE, 10)!;
  expect(style.beads!.count).toBe(16 * 10);
  expect(style.caps!.count).toBe(10);
  expect(createOrbStyle({ ...AETHER_LIKE, cap: null }, 3)!.caps).toBeNull();
  expect(createOrbStyle({ ...AETHER_LIKE, rimBeads: 0 }, 3)!.beads).toBeNull();
  style.dispose();
});

test('the rim beads sit evenly round the orb\'s outline as the camera sees it (the logo\'s plane), the first at the top', () => {
  const out = new THREE.Vector3();
  const angles: number[] = [];
  for (let k = 0; k < 16; k++) {
    rimBeadOffset(k, 16, out);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(RIM_RADIUS, 9);
    expect(out.z).toBe(0);
    angles.push(Math.atan2(out.y, out.x));
  }
  expect(angles[0]).toBeCloseTo(Math.PI / 2, 9);
  for (let k = 1; k < 16; k++) expect(Math.abs(Math.atan2(Math.sin(angles[k] - angles[k - 1]), Math.cos(angles[k] - angles[k - 1])))).toBeCloseTo((2 * Math.PI) / 16, 9);
});

test("writing an orb places its beads round it at its radius and its cap where its thread meets it; hiding it hides them; colours are the style's", () => {
  const style = createOrbStyle(AETHER_LIKE, 2)!;
  const matrix = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const centre = new THREE.Vector3(1, 2, 0);
  style.write(1, centre, 0.3, 1, null);
  const expected = new THREE.Vector3();
  for (let k = 0; k < 16; k++) {
    style.beads!.getMatrixAt(16 + k, matrix);
    matrix.decompose(at, new THREE.Quaternion(), scale);
    rimBeadOffset(k, 16, expected).multiplyScalar(0.3).add(centre);
    expect(at.distanceTo(expected)).toBeLessThan(1e-6);
    expect(scale.x).toBeGreaterThan(0);
  }
  // No thread end given: the cap sits on top of the orb, at the style's size.
  style.caps!.getMatrixAt(1, matrix);
  matrix.decompose(at, new THREE.Quaternion(), scale);
  expect(at.distanceTo(new THREE.Vector3(1, 2.3, 0))).toBeLessThan(1e-6);
  expect(scale.x).toBeCloseTo(0.05, 6);
  // A thread end given: the cap is there.
  style.write(1, centre, 0.3, 1, new THREE.Vector3(1.1, 2.28, 0));
  style.caps!.getMatrixAt(1, matrix);
  matrix.decompose(at, new THREE.Quaternion(), scale);
  expect(at.distanceTo(new THREE.Vector3(1.1, 2.28, 0))).toBeLessThan(1e-6);
  style.hide(1);
  style.beads!.getMatrixAt(16, matrix);
  expect(matrix.elements.slice(0, 11).every(e => e === 0)).toBe(true);
  style.caps!.getMatrixAt(1, matrix);
  expect(matrix.elements.slice(0, 11).every(e => e === 0)).toBe(true);
  // The beads glow in the rim colour, the cap is the cap colour: both from the config, never the engine.
  expect((style.beads!.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('e4d9f8');
  expect((style.caps!.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('d99982');
  style.dispose();
});
