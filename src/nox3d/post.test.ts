import { expect, test } from 'vitest';
import { POST } from './post';

test('bloom stays threshold-based and there is no tone-mapping pass', () => {
  expect(POST.bloom.luminanceThreshold).toBeGreaterThan(0.5);
  expect(Object.keys(POST)).not.toContain('toneMapping');
});

test('contact shadows reach about one arm thickness and span the gaps between fanned-out arms', () => {
  expect(POST.contactShadows.reach).toBeGreaterThan(0.1);
  expect(POST.contactShadows.reach).toBeLessThan(0.6);
  expect(POST.contactShadows.maxGap).toBeGreaterThanOrEqual(0.9);
});
