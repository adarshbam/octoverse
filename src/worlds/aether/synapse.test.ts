import { beforeAll, expect, test } from 'vitest';
import * as THREE from 'three';
import { HEAD_EFFECTS } from '../../engine/character/headEffects';
import { createSynapse, synapseLayout } from '../../engine/character/headEffects/synapse';
import { headDraw, restingSwell, swellFrame, type HeadDraw } from '../../engine/sequences/headSwell';
import { loadWorldSequences, type Sequences } from '../../engine/sequences/theatre';
import { validateBundle } from '../../engine/types/bundle';
import { AETHER_BUNDLE } from './bundle';
import { AETHER } from './character';
import { SEQUENCE_DEFAULTS } from './sequences/defaults';
import { AETHER_SEQUENCES } from './sequences/index';

// The head swell's synapse effect (spec 7.6; Task 20, provisional): the engine's `synapse` effect, in
// her palette (node #c9d6ff, line #d99982), on the swell's sheet. The effect's own behaviour is the
// engine's tests (headEffects/synapse.test.ts); these pin that she carries it and what it is given.

let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(AETHER_SEQUENCES);
});

test('she names the synapse effect, its palette and her bundle still validates', () => {
  expect(AETHER.headEffect).toBe('synapse');
  expect(HEAD_EFFECTS[AETHER.headEffect!]).toBe(HEAD_EFFECTS.synapse);
  expect(AETHER.palette.effect.core).toBe('#c9d6ff');
  expect(AETHER.palette.effect.stroke).toBe('#d99982');
  expect(() => validateBundle(AETHER_BUNDLE)).not.toThrow();
});

test('built for her dome, the effect draws one points and one line draw in her colours, nodes inside the glass', () => {
  const runtime = HEAD_EFFECTS.synapse.create(AETHER.dome, AETHER.palette);
  const root = runtime.root as THREE.Group;
  expect(root.children.map(o => o.type)).toEqual(['Points', 'LineSegments']);
  const [points, lines] = root.children as [THREE.Points, THREE.LineSegments];
  expect(((points.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).getHex()).toBe(new THREE.Color('#c9d6ff').getHex());
  expect(((lines.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).getHex()).toBe(new THREE.Color('#d99982').getHex());
  const { nodes } = synapseLayout(AETHER.dome);
  for (let i = 0; i < nodes.length; i += 3) {
    expect(Math.abs(nodes[i])).toBeLessThan(AETHER.dome.halfWidth);
    expect(nodes[i + 1]).toBeGreaterThan(0);
    expect(nodes[i + 1]).toBeLessThan(2 * AETHER.dome.halfHeight);
  }
  runtime.dispose();
});

test('the sheet carries the effect over the flight, 0.2 to 1.35 s: none before, whole at the end and nothing left to see at the settled overview', () => {
  expect(SEQUENCE_DEFAULTS.headSwell.objects.main.keys.effect).toEqual([[0.2, 0], [1.35, 1]]);
  expect(swellFrame(seq, 0.2, true).effect).toBe(0);
  expect(swellFrame(seq, 0.775, true).effect).toBeCloseTo(0.5, 2);
  expect(swellFrame(seq, 1.35, true).effect).toBe(1);
  expect(swellFrame(seq, 1.5, true).effect).toBe(1);
  // At the sheet's end (and at rest open) the effect is dissolved and draws nothing.
  const synapse = createSynapse(AETHER.dome, AETHER.palette);
  synapse.update(restingSwell(true).effect, headDraw(restingSwell(true), {} as HeadDraw), 0);
  expect(synapse.root.visible).toBe(false);
  synapse.dispose();
});
