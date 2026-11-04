import { expect, test } from 'vitest';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';

// The post-processing values live in the world's config (`post`); these hold Nox's world to them.
const POST = SECURITY_WORLD.post;

test('bloom stays threshold-based and there is no tone-mapping pass', () => {
  expect(POST.bloom.luminanceThreshold).toBeGreaterThan(0.5);
  expect(Object.keys(POST)).not.toContain('toneMapping');
});

test('contact shadows reach about one arm thickness and span the gaps between fanned-out arms', () => {
  expect(POST.contactShadow.reach).toBeGreaterThan(0.1);
  expect(POST.contactShadow.reach).toBeLessThan(0.6);
  expect(POST.contactShadow.maxGap).toBeGreaterThanOrEqual(0.9);
});

test('the Nox world\'s post values are the ones the stage drew with before they moved into the config', () => {
  expect(POST).toEqual({
    contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.6, color: '#1a0418' },
    bloom: { luminanceThreshold: 0.66, luminanceSmoothing: 0.25, intensity: 1.05, radius: 0.85 },
    vignette: { offset: 0.3, darkness: 0.9 },
  });
  expect(SECURITY_WORLD.skinAccent).toBe('color(srgb-linear 0.052 0.0252 0.06)');
  expect(SECURITY_WORLD.water.causticStrength).toBe(0.005);
  expect(SECURITY_WORLD.camera).toEqual({ tilt: 0.07, hover: { amount: 1, pace: 1 } });
});
