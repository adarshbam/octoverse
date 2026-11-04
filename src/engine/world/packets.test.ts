import { expect, test } from 'vitest';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { LIVE_ELEMENTS, LIVE_ELEMENT_IDS, MAX_PACKETS, STRAND_ELEMENT_IDS } from './live';
import { packetArc, packetCount, pathLength, pathPoint } from './live/packets';
import { motionAmount } from './liveMotion';
import type { PacketsConfig, Vec3, WorldConfig } from './types';
import { WORLD_TIERS, worldTierFor } from './worldTiers';
import { asWorldLayout, layoutProblems, validateWorld } from './validateWorld';

const BRIDGE: readonly Vec3[] = [
  [-6, 1, -4],
  [-2, 1.2, -4],
  [4, 1, -6],
];
const PACKETS: PacketsConfig = { path: 'bridge', count: { high: 12, medium: 8, low: 4 }, speed: 1.5, length: 0.4, colours: ['#4aa6d0', '#a0d8ff'] };

const withPackets = (packets: unknown, paths: Record<string, readonly Vec3[]> = { bridge: BRIDGE }): WorldConfig => ({
  ...SECURITY_WORLD,
  layout: { ...SECURITY_WORLD.layout, paths },
  live: { ...SECURITY_WORLD.live, elements: { packets: packets as PacketsConfig } },
});
const problems = (world: WorldConfig) => validateWorld(world).join('\n');

test('the live element table gains packets: at most 12, and the strand ids stay kelp and seagrass', () => {
  expect(LIVE_ELEMENT_IDS).toEqual(['kelp', 'seagrass', 'packets']);
  expect(STRAND_ELEMENT_IDS).toEqual(['kelp', 'seagrass']);
  expect(MAX_PACKETS).toBe(12);
  expect(LIVE_ELEMENTS.packets.max).toBe(MAX_PACKETS);
});

test('packetArc is in [0, 1), periodic in t and evenly spaced round the path', () => {
  const count = 7;
  const speed = 0.25;
  for (const t of [0, 0.3, 1.9, 33.3, 86400, -4.2]) {
    const arcs = Array.from({ length: count }, (_, i) => packetArc(i, t, count, speed));
    for (const a of arcs) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
    // Neighbouring packets are one count-th of the path apart, wrapping at the end.
    const sorted = [...arcs].sort((a, b) => a - b);
    for (let k = 0; k < count; k++) {
      const gap = (sorted[(k + 1) % count] - sorted[k] + 1) % 1;
      expect(gap).toBeCloseTo(1 / count, 9);
    }
  }
  // One lap is 1 / speed seconds.
  for (let i = 0; i < count; i++) for (const t of [0, 0.7, 5.5]) expect(packetArc(i, t + 1 / speed, count, speed)).toBeCloseTo(packetArc(i, t, count, speed), 9);
  // It runs forward, and wraps from near 1 to near 0.
  expect(packetArc(0, 0.1, 4, 1)).toBeCloseTo(0.1, 12);
  expect(packetArc(0, 0.95, 4, 1)).toBeCloseTo(0.95, 12);
  expect(packetArc(0, 1.05, 4, 1)).toBeCloseTo(0.05, 9);
  expect(packetArc(1, 0.8, 4, 1)).toBeCloseTo(0.05, 9);
  // Nonsense in is a number in range out.
  for (const bad of [Number.NaN, Infinity]) expect(packetArc(0, bad, 4, 1)).toBe(0);
  expect(packetArc(0, 1, 0, 1)).toBe(0);
});

test('under reduced motion (speed scaled by the motion amount, 0) packetArc is frozen, still evenly spaced', () => {
  const motion = motionAmount({ freeze: false, reducedMotion: true });
  expect(motion).toBe(0);
  for (let i = 0; i < 5; i++) {
    const first = packetArc(i, 0, 5, 1.5 * motion);
    for (const t of [0.4, 9, 1234.5]) expect(packetArc(i, t, 5, 1.5 * motion)).toBe(first);
    expect(first).toBeCloseTo(i / 5, 12);
  }
});

test('a path is walked by arc length: position and unit tangent, clamped at its ends', () => {
  const line: readonly Vec3[] = [
    [0, 0, 0],
    [3, 0, 0],
    [3, 4, 0],
  ];
  expect(pathLength(line)).toBe(7);
  expect(pathPoint(line, 0).position).toEqual([0, 0, 0]);
  expect(pathPoint(line, 3 / 7).position[0]).toBeCloseTo(3, 9);
  const mid = pathPoint(line, 5 / 7);
  expect(mid.position[0]).toBeCloseTo(3, 9);
  expect(mid.position[1]).toBeCloseTo(2, 9);
  expect(mid.tangent).toEqual([0, 1, 0]);
  expect(pathPoint(line, 0.1).tangent).toEqual([1, 0, 0]);
  expect(pathPoint(line, 1).position).toEqual([3, 4, 0]);
  expect(pathPoint(line, 2).position).toEqual([3, 4, 0]);
  expect(pathPoint(line, -1).position).toEqual([0, 0, 0]);
  // A path with a repeated point has no zero-length segment to divide by.
  const repeat: readonly Vec3[] = [
    [0, 0, 0],
    [0, 0, 0],
    [2, 0, 0],
  ];
  expect(pathPoint(repeat, 0.5).position[0]).toBeCloseTo(1, 9);
});

test('how many packets are drawn follows the quality tier and never passes the cap', () => {
  expect(packetCount(PACKETS, 'high')).toBe(12);
  expect(packetCount(PACKETS, 'medium')).toBe(8);
  expect(packetCount(PACKETS, 'low')).toBe(4);
  expect(packetCount({ ...PACKETS, count: { high: 50, medium: 50, low: 50 } }, 'high')).toBe(MAX_PACKETS);
  // The phone's world tier is the low one.
  expect(WORLD_TIERS.high.id).toBe('high');
  expect(worldTierFor('high', true).id).toBe('low');
});

test('a world with packets on a path validates', () => {
  expect(validateWorld(withPackets(PACKETS))).toEqual([]);
});

test('a packets element naming a missing path fails validation with the path name', () => {
  expect(problems(withPackets({ ...PACKETS, path: 'viaduct' }))).toContain('live.elements.packets.path names "viaduct", which is not in layout.paths');
  // A layout with no paths at all.
  const noPaths: WorldConfig = { ...SECURITY_WORLD, live: { ...SECURITY_WORLD.live, elements: { packets: PACKETS } } };
  expect(noPaths.layout.paths).toBeUndefined();
  expect(problems(noPaths)).toContain('live.elements.packets.path names "bridge", which is not in layout.paths');
  expect(problems(withPackets(PACKETS, {}))).toContain('names "bridge"');
});

test('a path needs at least two valid points', () => {
  expect(problems(withPackets(PACKETS, { bridge: [[0, 0, 0]] }))).toContain('layout.paths.bridge needs at least 2 points');
  expect(problems(withPackets(PACKETS, { bridge: [] }))).toContain('layout.paths.bridge needs at least 2 points');
  expect(problems(withPackets(PACKETS, { bridge: [[0, 0, 0], [1, 2] as unknown as Vec3] }))).toContain('layout.paths.bridge[1] is not an x, y, z position');
  // A path no element uses is still checked.
  const unused = { ...SECURITY_WORLD, layout: { ...SECURITY_WORLD.layout, paths: { deck: [[0, 0, 0]] as readonly Vec3[] } } };
  expect(problems(unused)).toContain('layout.paths.deck needs at least 2 points');
  // The raw layout.json is held to the same.
  const raw = { ...SECURITY_WORLD.layout, paths: { bridge: [[0, 0, 0]] } };
  expect(layoutProblems(raw).join('\n')).toContain('paths.bridge needs at least 2 points');
  expect(layoutProblems({ ...SECURITY_WORLD.layout, paths: { bridge: BRIDGE } })).toEqual([]);
  expect(layoutProblems({ ...SECURITY_WORLD.layout, paths: [] }).join('\n')).toContain('paths is not an object');
  expect(asWorldLayout({ ...SECURITY_WORLD.layout, paths: { bridge: BRIDGE } }).paths).toEqual({ bridge: BRIDGE });
});

test('the packets config is checked: counts by tier (low not above high), speed, length, two colours', () => {
  expect(problems(withPackets({ ...PACKETS, count: { high: 4, medium: 6, low: 8 } }))).toContain('live.elements.packets.count.low must not be more than medium');
  expect(problems(withPackets({ ...PACKETS, count: { high: 4, medium: 4, low: 8 } }))).toContain('live.elements.packets.count.low must not be more than medium');
  expect(problems(withPackets({ ...PACKETS, count: { high: 4, medium: 6, low: 2 } }))).toContain('live.elements.packets.count.medium must not be more than high');
  expect(problems(withPackets({ ...PACKETS, count: { high: 13, medium: 8, low: 4 } }))).toContain(`live.elements.packets.count.high must be a whole number from 0 to ${MAX_PACKETS}`);
  expect(problems(withPackets({ ...PACKETS, count: { high: 2.5, medium: 2, low: 1 } }))).toContain('live.elements.packets.count.high');
  expect(problems(withPackets({ ...PACKETS, count: { high: 4, medium: 2 } }))).toContain('live.elements.packets.count.low');
  expect(problems(withPackets({ ...PACKETS, count: 8 }))).toContain('live.elements.packets.count needs high, medium and low');
  expect(problems(withPackets({ ...PACKETS, speed: -1 }))).toContain('live.elements.packets.speed must be 0 or more');
  expect(problems(withPackets({ ...PACKETS, length: 0 }))).toContain('live.elements.packets.length must be above 0');
  expect(problems(withPackets({ ...PACKETS, colours: ['#4aa6d0'] }))).toContain('live.elements.packets.colours needs two #rrggbb colours');
  expect(problems(withPackets({ ...PACKETS, colours: ['#4aa6d0', 'blue'] }))).toContain('live.elements.packets.colours needs two #rrggbb colours');
  expect(problems(withPackets(null))).toContain('live.elements.packets needs');
  // A count of 0 at a tier is fine: that tier draws none.
  expect(validateWorld(withPackets({ ...PACKETS, count: { high: 8, medium: 4, low: 0 } }))).toEqual([]);
});
