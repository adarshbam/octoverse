import * as THREE from 'three';
import { expect, test } from 'vitest';
import { PROP_DRIVES, PROP_DRIVE_IDS, type PropBinding, drive, driveProps } from './props';

test('the prop drives are a closed table: rotateZ and emissive', () => {
  expect(PROP_DRIVE_IDS).toEqual(['rotateZ', 'emissive']);
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
});

test('driveProps applies each prop its value by id, skips a value that holds, and leaves a prop with no value alone', () => {
  const ring = new THREE.Group();
  const ringB = new THREE.Group();
  const flash = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const idle = new THREE.Group();
  idle.rotation.z = 0.5;
  const bindings: PropBinding[] = [
    { prop: { id: 'lockRing', node: 'padlock_ring', drive: 'rotateZ' }, nodes: [ring, ringB] },
    { prop: { id: 'membraneFlash', node: 'membrane', drive: 'emissive' }, nodes: [flash] },
    { prop: { id: 'idle', node: 'x', drive: 'rotateZ' }, nodes: [idle] },
  ];
  driveProps(bindings, { lockRing: 1.5, membraneFlash: 1.2 });
  expect([ring.rotation.z, ringB.rotation.z, (flash.material as THREE.MeshStandardMaterial).emissiveIntensity, idle.rotation.z]).toEqual([1.5, 1.5, 1.2, 0.5]);
  // A held value is not applied again: a change made meanwhile by someone else stays.
  ring.rotation.z = 9;
  driveProps(bindings, { lockRing: 1.5, membraneFlash: 1.2 });
  expect(ring.rotation.z).toBe(9);
  driveProps(bindings, { lockRing: 0 });
  expect(ring.rotation.z).toBe(0);
  // No values at all (Nox): nothing moves.
  driveProps(bindings, {});
  expect(ring.rotation.z).toBe(0);
});
