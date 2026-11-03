import { expect, test } from 'vitest';
import { SEABED_ORDER, WATER_SKY_ORDER } from './drawOrder';

/** The opaque draw order three uses (WebGLRenderLists' painterSortStable): renderOrder, then nearest first. */
const opaqueOrder = (items: { name: string; renderOrder: number; z: number }[]) =>
  [...items].sort((a, b) => a.renderOrder - b.renderOrder || a.z - b.z).map(i => i.name);

test('the seabed and the water sky are drawn after the stone and Nox, the sky last', () => {
  // The seabed's centre sorts it in front of stone further back that covers it; the sky is furthest of all.
  const items = [
    { name: 'sky', renderOrder: WATER_SKY_ORDER, z: 100 },
    { name: 'seabed', renderOrder: SEABED_ORDER, z: 6 },
    { name: 'pillar', renderOrder: 0, z: 14 },
    { name: 'nox', renderOrder: 0, z: 12 },
  ];
  expect(opaqueOrder(items)).toEqual(['nox', 'pillar', 'seabed', 'sky']);
});

