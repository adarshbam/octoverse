import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Attention } from '../engine/behavior/attention';
import { IDLE_TILT_MAX_RATE } from '../engine/behavior/idleTilt';
import { seededRng } from '../engine/motion/micro';
import { AETHER } from './aether/character';
import { FLUX } from './flux/character';
import { NOX } from './nox/character';
import { VEYRA } from './veyra/character';

// Task 15 (idle tilt and look points) is engine work every world shares: this holds the shipped
// characters to it. It sits beside the registry's tests because it reads more than one world.

/** Attention's outputs from the code before the idle tilt and look points (captured at 5e35262): every 10th frame of the script below. */
const FIXTURE = JSON.parse(readFileSync(new URL('../engine/motion/fixtures/attention-pre-idle-tilt.json', import.meta.url), 'utf8')) as Record<'nox' | 'veyra' | 'flux', number[][]>;

const FACE = { x: 0, y: -0.17 };

/** 30 s of a pointer that wanders, holds, leaves; then a focused orb; then the stage's own look. */
function script(personality: typeof NOX.personality, extra: boolean) {
  const a = new Attention(personality, seededRng(7));
  const rows: number[][] = [];
  for (let i = 0; i < 1800; i++) {
    const t = i / 60;
    const pointer = t < 2 ? null : t < 6 ? { x: 0.6 * Math.sin(t * 2), y: 0.3 * Math.cos(t * 3) } : t < 14 ? { x: 0.2, y: 0.1 } : null;
    const fixed = t >= 20 && t < 24 ? { x: -0.4, y: 0.2 } : undefined;
    const rest = t >= 26 ? { x: 0.3, y: -0.3 } : undefined;
    const g = extra ? a.update(pointer, t, 1 / 60, fixed, FACE, rest, undefined) : a.update(pointer, t, 1 / 60, fixed, FACE, rest);
    if (i % 10 === 0) rows.push([g.gazeX, g.gazeY, g.headX, g.headY, g.tracking ? 1 : 0]);
  }
  return rows;
}

test("Nox's, Veyra's and Flux's attention outputs are the pre-change fixtures exactly (no look point)", () => {
  for (const [name, c] of [['nox', NOX], ['veyra', VEYRA], ['flux', FLUX]] as const) {
    expect(script(c.personality, false), name).toEqual(FIXTURE[name]);
    expect(script(c.personality, true), name).toEqual(FIXTURE[name]);
  }
});

test('Nox and Veyra set no idle tilt, so they get none', () => {
  for (const c of [NOX, VEYRA, FLUX]) expect(c.personality.idleTilt, c.id).toBeUndefined();
});

test('the idle tilt moves slower than the slowest shipped head turns (a critically damped spring peaks at omega / e per unit)', () => {
  const slowest = Math.min(...[NOX, VEYRA, FLUX, AETHER].map(c => c.personality.headOmega));
  expect(IDLE_TILT_MAX_RATE).toBeLessThanOrEqual(slowest / Math.E);
});
