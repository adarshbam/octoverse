import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import { NOX } from '../../../worlds/nox/character';
import { type HeadDraw, headDraw, restingSwell } from '../../sequences/headSwell';
import { HEAD_EFFECTS, type HeadEffectId } from './index';

afterEach(() => vi.unstubAllGlobals());

/** A canvas stand-in whose 2D context records every call and every property set (vitest has no DOM). */
function stubCanvas() {
  const log: unknown[] = [];
  const ctx = new Proxy({}, {
    get: (_target, name) => (...args: unknown[]) => void log.push([String(name), ...args]),
    set: (_target, name, value) => (log.push(['set', String(name), value]), true),
  });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  return log;
}
const sha1 = (x: string) => createHash('sha1').update(x).digest('hex');
const frame = (open: boolean): HeadDraw => headDraw(restingSwell(open), {} as HeadDraw);

test('the head-effect table holds Nox\'s two effects, and the id union follows it', () => {
  expect(Object.keys(HEAD_EFFECTS)).toEqual(['none', 'glyphs']);
  // A third id is a type error until its module is in the table (the closed-variant rule).
  // @ts-expect-error 'vaultDial' arrives in F01 with Veyra
  const unknown: HeadEffectId = 'vaultDial';
  expect(unknown).toBe('vaultDial');
  expect(NOX.headEffect satisfies HeadEffectId | null).toBe('glyphs');
});

test('the none effect draws nothing, and does nothing when updated or disposed', () => {
  const runtime = HEAD_EFFECTS.none.create(NOX.dome, NOX.palette);
  expect(runtime.root).toBeNull();
  runtime.update(1, frame(true), 3);
  runtime.dispose();
  runtime.dispose();
});

test('the glyphs effect builds what createHeadGlyphs built, seated at the dome\'s foot, from the palette', () => {
  const log = stubCanvas();
  const runtime = HEAD_EFFECTS.glyphs.create(NOX.dome, NOX.palette);
  const mesh = runtime.root as THREE.InstancedMesh;
  // The atlas is drawn as before: the same 374 canvas calls, in the same order, with the palette's three colours.
  // (Hash recorded from createHeadGlyphs(NOX.dome, NOX.palette.effect) before the move into the table.)
  expect(log).toHaveLength(374);
  expect(sha1(JSON.stringify(log))).toBe('0aed84af1006b32e11a51e7f60de968a4d9b1004');
  const colours = new Set(log.filter(call => (call as unknown[])[0] === 'set' && (call as unknown[])[1] === 'strokeStyle').map(call => (call as unknown[])[2]));
  expect([...colours].sort()).toEqual([NOX.palette.effect.core, NOX.palette.effect.halo, NOX.palette.effect.stroke].sort());
  // The crown: seven quads at the places the layout gives (recorded before the move), seated at the dome's foot.
  const material = mesh.material as THREE.ShaderMaterial;
  expect(sha1(material.vertexShader + '|' + material.fragmentShader)).toBe('50e6b5226bd13ac5ced9f17807d95a5bef704655');
  expect(mesh.count).toBe(7);
  expect(Array.from(mesh.instanceMatrix.array.slice(12, 16))).toEqual([-1.0404000282287598, 1.4199999570846558, 0.10000000149011612, 1]);
  expect(Array.from(mesh.instanceMatrix.array.slice(60, 64))).toEqual([0, 1.4800000190734863, 0.10000000149011612, 1]);
  const attribute = (name: string) => Array.from((mesh.geometry.getAttribute(name) as THREE.InstancedBufferAttribute).array);
  expect(attribute('aCell')).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(attribute('aDelay')).toEqual([0.3499999940395355, 0.23333333432674408, 0.11666666716337204, 0, 0.11666666716337204, 0.23333333432674408, 0.3499999940395355]);
  expect(attribute('aPhase')).toEqual([0, 1.7000000476837158, 3.4000000953674316, 5.099999904632568, 6.800000190734863, 8.5, 10.199999809265137]);
  expect([material.uniforms.uEffect.value, material.uniforms.uTime.value, material.uniforms.uStrength.value]).toEqual([0, 0, 1.3]);
  expect(mesh.visible).toBe(false);
  expect(mesh.position.toArray()).toEqual([NOX.dome.center[0], NOX.dome.center[1] - NOX.dome.halfHeight, 0]);
  runtime.dispose();
});

test('updating the glyphs writes the swell, the glass\'s size and the clock; no effect hides them', () => {
  stubCanvas();
  const runtime = HEAD_EFFECTS.glyphs.create(NOX.dome, NOX.palette);
  const mesh = runtime.root as THREE.InstancedMesh;
  const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
  const open = frame(true);
  expect(() => runtime.update(0.5, open, 1)).not.toThrow();
  expect(mesh.visible).toBe(true);
  expect(uniforms.uEffect.value).toBe(0.5);
  expect(uniforms.uTime.value).toBe(1);
  expect(mesh.scale.toArray()).toEqual([open.scale, open.scale, open.scale]);
  // Swollen past full, the crown rides the glass.
  runtime.update(1, headDraw({ morph: 1.07, squeeze: 0, push: 0, effect: 1 }, {} as HeadDraw), 2.5);
  expect(mesh.scale.x).toBeCloseTo(1.07, 6);
  expect(uniforms.uTime.value).toBe(2.5);
  // With the effect at 0 the crown is not drawn.
  runtime.update(0, frame(false), 0);
  expect(mesh.visible).toBe(false);
  expect(uniforms.uEffect.value).toBe(0);
  runtime.dispose();
});

test('disposing the glyphs frees what is uploaded each time: a StrictMode remount reusing the runtime leaks no crown', () => {
  stubCanvas();
  const runtime = HEAD_EFFECTS.glyphs.create(NOX.dome, NOX.palette);
  const mesh = runtime.root as THREE.InstancedMesh;
  const material = mesh.material as THREE.ShaderMaterial;
  const map = material.uniforms.uMap.value as THREE.Texture;
  const freed = { geometry: vi.fn(), material: vi.fn(), map: vi.fn() };
  mesh.geometry.addEventListener('dispose', freed.geometry);
  material.addEventListener('dispose', freed.material);
  map.addEventListener('dispose', freed.map);
  // StrictMode in development: mount, clean up (frees the GPU objects), mount again with the same
  // memoised runtime, which is drawn again (three uploads it anew), then the real unmount.
  runtime.dispose();
  runtime.update(1, frame(true), 1);
  runtime.dispose();
  for (const call of Object.values(freed)) expect(call).toHaveBeenCalledTimes(2);
});

test('a character with another palette colours the crown by it, and the hue is nowhere else', () => {
  const log = stubCanvas();
  const effect = { halo: '#112233', stroke: '#445566', core: '#778899' };
  HEAD_EFFECTS.glyphs.create(NOX.dome, { ...NOX.palette, effect }).dispose();
  const strokes = new Set(log.filter(call => (call as unknown[])[0] === 'set' && (call as unknown[])[1] === 'strokeStyle').map(call => (call as unknown[])[2]));
  expect([...strokes].sort()).toEqual(['#112233', '#445566', '#778899']);
});
