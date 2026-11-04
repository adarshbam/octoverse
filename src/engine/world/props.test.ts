import * as THREE from 'three';
import { expect, test } from 'vitest';
import { PROP_DRIVES, PROP_DRIVE_IDS, drive } from './props';

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
