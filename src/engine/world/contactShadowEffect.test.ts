import * as THREE from 'three';
import { expect, test } from 'vitest';
import { ContactShadowEffect } from './contactShadowEffect';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';

const POST = { contactShadows: SECURITY_WORLD.post.contactShadow };

test('contact shadows take their reach, gaps and depth range from the settings', () => {
  const s = POST.contactShadows;
  const effect = new ContactShadowEffect(s);
  expect((effect.uniforms.get('uGap')!.value as THREE.Vector4).toArray().slice(0, 3)).toEqual([s.reach, s.minGap, s.maxGap]);
  expect((effect.uniforms.get('uRange')!.value as THREE.Vector2).toArray()).toEqual([s.near, s.far]);
  expect(effect.uniforms.get('uStrength')!.value).toBe(s.strength);
});

test('contact shadows follow the camera projection, so zoomed views shade the same', () => {
  const effect = new ContactShadowEffect(POST.contactShadows);
  const camera = new THREE.PerspectiveCamera(24, 1.5, 0.1, 60);
  effect.mainCamera = camera;
  effect.update();
  const e = camera.projectionMatrix.elements;
  expect((effect.uniforms.get('uFocal')!.value as THREE.Vector2).toArray()).toEqual([e[0], e[5]]);
});

test('only the character is shaded: the depth range brackets the stage distance and stops short of the backdrop', () => {
  expect(POST.contactShadows.near).toBeLessThan(12 - 1);
  expect(POST.contactShadows.far).toBeGreaterThan(12 + 1);
  expect(POST.contactShadows.far).toBeLessThan(12 + 4);
});

test('contact shadows can be given the camera when they are made', () => {
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const effect = new ContactShadowEffect(POST.contactShadows, camera);
  effect.update();
  expect((effect.uniforms.get('uFocal')!.value as THREE.Vector2).y).toBeCloseTo(camera.projectionMatrix.elements[5], 9);
});
