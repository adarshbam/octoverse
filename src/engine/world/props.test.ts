import * as THREE from 'three';
import { expect, test } from 'vitest';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { motionAmount } from './liveMotion';
import { PROP_DRIVES, PROP_DRIVE_IDS, bobOffset, drive, propPhase } from './props';
import type { WorldConfig, WorldProp } from './types';
import { validateWorld } from './validateWorld';

test('the prop drives are a closed table: rotateZ, emissive and bob', () => {
  expect(PROP_DRIVE_IDS).toEqual(['rotateZ', 'emissive', 'bob']);
  expect(Object.keys(PROP_DRIVES)).toEqual(PROP_DRIVE_IDS);
});

test('rotateZ turns the node about z, and emissive sets the emissive intensity of every material under it', () => {
  const ring = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const b = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()]);
  ring.add(a, b);
  drive({ drive: 'rotateZ' }, ring, 1.25);
  expect(ring.rotation.z).toBe(1.25);
  expect([ring.rotation.x, ring.rotation.y]).toEqual([0, 0]);
  drive({ drive: 'emissive' }, ring, 3);
  const intensities = [(a.material as THREE.MeshStandardMaterial).emissiveIntensity, ...(b.material as THREE.MeshStandardMaterial[]).map(m => m.emissiveIntensity)];
  expect(intensities).toEqual([3, 3, 3]);
  // Neither moves the node.
  expect(ring.position.toArray()).toEqual([0, 0, 0]);
});

const RUBBLE: WorldProp[] = ['rubble_float_a', 'rubble_float_b', 'rubble_float_c'].map((node, i) => ({ id: `${node}Bob`, node, drive: 'bob', bob: { amplitude: 0.04, period: 7 + 2 * i } }));
const times = Array.from({ length: 120 }, (_, i) => i * 0.23);
const live = motionAmount({ freeze: false, reducedMotion: false });

test("a 'bob' prop's offset stays within its amplitude and is periodic in its period", () => {
  for (const prop of RUBBLE) {
    if (prop.drive !== 'bob') throw new Error('a bob prop');
    const { amplitude, period } = prop.bob;
    for (const t of times) {
      const offset = bobOffset(t, prop, live);
      expect(Math.abs(offset)).toBeLessThanOrEqual(amplitude + 1e-12);
      for (const k of [1, 3]) expect(bobOffset(t + k * period, prop, live)).toBeCloseTo(offset, 9);
    }
    // It does bob: over a period it reaches (nearly) both ends of its range.
    const swing = Array.from({ length: 200 }, (_, i) => bobOffset((i / 200) * period, prop, live));
    expect(Math.max(...swing)).toBeGreaterThan(amplitude * 0.95);
    expect(Math.min(...swing)).toBeLessThan(-amplitude * 0.95);
  }
});

test('each prop bobs on its own phase, the same every time for the same id', () => {
  const phases = RUBBLE.map(p => propPhase(p.id));
  expect(new Set(phases).size).toBe(RUBBLE.length);
  for (const phase of phases) {
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(2 * Math.PI);
  }
  expect(RUBBLE.map(p => propPhase(p.id))).toEqual(phases);
  // Out of phase: at the same moment they are not all at the same height.
  expect(new Set(RUBBLE.map(p => bobOffset(0, { ...p, bob: { amplitude: 0.04, period: 9 } } as WorldProp, live).toFixed(6))).size).toBe(RUBBLE.length);
});

test('with reduced motion (or the world frozen) nothing bobs: the offset is 0', () => {
  for (const flags of [{ freeze: false, reducedMotion: true }, { freeze: true, reducedMotion: false }]) {
    for (const prop of RUBBLE) for (const t of times) expect(bobOffset(t, prop, motionAmount(flags))).toBe(0);
  }
});

test('the bob drive lifts the node from where it rests by the offset, without adding up, and touches nothing else', () => {
  const rubble = new THREE.Group();
  rubble.position.set(1, 2, -3);
  rubble.rotation.set(0.1, 0.2, 0.3);
  for (const offset of [0.03, -0.04, 0.01, 0]) {
    drive(RUBBLE[0], rubble, offset);
    expect(rubble.position.y).toBeCloseTo(2 + offset, 12);
    expect([rubble.position.x, rubble.position.z]).toEqual([1, -3]);
  }
  expect(rubble.rotation.toArray().slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
});

test("Nox's props are unchanged (it declares none), and Veyra's kind of props validates as before", () => {
  expect(SECURITY_WORLD.props).toBeUndefined();
  const world = (props: WorldConfig['props'], nodes?: readonly string[]): WorldConfig => ({ ...SECURITY_WORLD, kit: { ...SECURITY_WORLD.kit, nodes }, props });
  const veyra: WorldConfig['props'] = [{ id: 'lockRing', node: 'padlock_ring', drive: 'rotateZ' }, { id: 'membraneFlash', node: 'membrane', drive: 'emissive' }];
  expect(validateWorld(world(veyra, ['padlock_ring', 'membrane']))).toEqual([]);
});

test("a 'bob' prop needs its amplitude and period; no other drive takes them", () => {
  const world = (props: WorldConfig['props']): WorldConfig => ({ ...SECURITY_WORLD, props });
  const bob = (params: unknown) => validateWorld(world([{ id: 'float', node: 'rock_0', drive: 'bob', bob: params } as WorldProp])).join('\n');
  expect(validateWorld(world([{ id: 'float', node: 'rock_0', drive: 'bob', bob: { amplitude: 0.04, period: 9 } }]))).toEqual([]);
  expect(bob(undefined)).toContain('props[0] (float)');
  expect(bob(undefined)).toContain('amplitude');
  expect(bob({ amplitude: -0.04, period: 9 })).toContain('props[0] (float).bob.amplitude');
  expect(bob({ amplitude: 0.04, period: 0 })).toContain('props[0] (float).bob.period');
  expect(bob({ amplitude: 0.04, period: Number.NaN })).toContain('props[0] (float).bob.period');
  const stray = validateWorld(world([{ id: 'ring', node: 'rock_0', drive: 'rotateZ', bob: { amplitude: 0.04, period: 9 } } as unknown as WorldProp])).join('\n');
  expect(stray).toContain("only the 'bob' drive");
});
