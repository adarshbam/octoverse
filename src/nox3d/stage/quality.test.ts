import { expect, test } from 'vitest';
import { FrameProbe, TIER_SETTINGS, pickTier } from './quality';

test('tiers step down in every setting', () => {
  const { high, medium, low } = TIER_SETTINGS;
  for (const key of ['dpr', 'renderScale', 'radial', 'segments', 'suckerScale', 'bloomScale', 'particles'] as const) {
    expect(high[key]).toBeGreaterThan(medium[key]);
    expect(medium[key]).toBeGreaterThan(low[key]);
  }
  // High is the look the owner signed off.
  expect(high.segments).toBe(128);
  expect(high.radial).toBe(24);
  // Nox's contact shadows stay on at every tier, so his look does not change with it.
  expect([high, medium, low].every(t => t.contactShadows)).toBe(true);
  expect(high.renderScale).toBe(1);
});

test('probe downgrades after sustained slow frames and never upgrades', () => {
  const probe = new FrameProbe('high');
  // Two seconds of 25 ms frames on high: down to medium.
  let tier = null;
  for (let i = 0; i < 80 && !tier; i++) tier = probe.push(25);
  expect(tier).toBe('medium');
  // Fast frames never raise it.
  for (let i = 0; i < 400; i++) expect(probe.push(5)).toBeNull();
  // Two seconds of 40 ms frames on medium: down to low.
  tier = null;
  for (let i = 0; i < 60 && !tier; i++) tier = probe.push(40);
  expect(tier).toBe('low');
  for (let i = 0; i < 200; i++) expect(probe.push(80)).toBeNull();
});

test('a brief stall does not downgrade', () => {
  const probe = new FrameProbe('high');
  expect(probe.push(300)).toBeNull();
  for (let i = 0; i < 200; i++) expect(probe.push(12)).toBeNull();
});

test('touch phones start at medium or lower', () => {
  expect(pickTier({ cores: 8, memoryGb: 8, isTouch: true, width: 390 })).not.toBe('high');
  expect(pickTier({ cores: 2, memoryGb: 2, isTouch: true, width: 390 })).toBe('low');
});

test('strong desktops start high, weak ones lower', () => {
  expect(pickTier({ cores: 8, memoryGb: 16, isTouch: false, width: 1440 })).toBe('high');
  expect(pickTier({ cores: 4, memoryGb: 4, isTouch: false, width: 1440 })).toBe('medium');
  expect(pickTier({ cores: 2, memoryGb: 8, isTouch: false, width: 1440 })).toBe('low');
});

function demotedAfter(tier: 'high' | 'medium', ms: number) {
  const probe = new FrameProbe(tier);
  let result = null;
  for (let i = 0; i < 400 && !result; i++) result = probe.push(ms);
  return result;
}

test('high demotes below 45 fps, medium below 30', () => {
  // 22.2 ms is 45 fps: slower frames step high down, faster ones keep it.
  expect(demotedAfter('high', 23)).toBe('medium');
  expect(demotedAfter('high', 21.5)).toBeNull();
  // 33.3 ms is 30 fps.
  expect(demotedAfter('medium', 34)).toBe('low');
  expect(demotedAfter('medium', 32.5)).toBeNull();
});
