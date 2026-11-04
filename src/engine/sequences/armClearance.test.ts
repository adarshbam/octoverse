import { beforeAll, expect, test } from 'vitest';
import { floatOffset } from '../behavior/ambient';
import { ArmChain } from '../character/armChain';
import { NOX } from '../../worlds/nox/character';
import { ARM_IDS } from '../config/types';
import { armRadius } from '../character/armTube';
import { strokeAt } from '../motion/stroke';
import { createSwimRests, swimArmPitch, swimShapes as shapesFor } from '../motion/swimArms';
import { BODY_X, NOX_POSES } from '../../worlds/nox/poses';
import { SWIM_POSES } from '../../worlds/nox/swim';
import type { Placement } from '../world/types';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { entranceDrive, entranceFrame, entranceRests } from './entrance';
import { ENTRANCE_HOLD } from '../../worlds/nox/sequences/defaults';
import { NOX_ENTRANCE_GEOMETRY } from '../../worlds/nox/bundle';
import { loadNoxSequences } from '../../worlds/nox/sequences/index';
import type { Sequences } from './theatre';

/** Nox's swim shapes at `segments`. */
const swimShapes = (segments: number) => shapesFor(SWIM_POSES, NOX_POSES.intro, segments);

// Ruling C6 (Task 19c): Nox opens his arms beside the near left pillar, before the spin. The
// circle of reach in pathClearance cannot see the open pose's shape, so here the real arms are
// placed as the stage places them (character/Octopus.tsx: the same rests, drive and solve, the
// lean and turn about the same pivot, the float's drift and droop) and every point along every arm
// is kept clear of every pillar's footprint, from the opening to the end of the entrance (the cups
// are not modelled, only the arm's own surface).

let seq: Sequences;
beforeAll(async () => {
  seq = await loadNoxSequences();
});

/** Octopus's PIVOT_Y: the height the body leans and turns about (its swimTurn group). */
const PIVOT_Y = -0.6;
/** A pillar shaft's half width and depth (as sequences/entrance.ts PILLAR_HALF). */
const PILLAR_HALF = { x: 0.55, z: 0.5 } as const;
/** The least gap allowed between an arm's surface and a pillar (stage units); the closest it gets is about 0.03. */
const MIN_GAP = 0.02;

/** Signed distance in the x-z plane from (x, z) to a pillar's footprint: negative inside it. */
function pillarGap(x: number, z: number, pillar: Placement) {
  const dx = x - pillar.position[0];
  const dz = z - pillar.position[2];
  const rot = pillar.rotY ?? 0;
  const lx = dx * Math.cos(rot) - dz * Math.sin(rot);
  const lz = dx * Math.sin(rot) + dz * Math.cos(rot);
  const scale = pillar.scale ?? 1;
  const [sx, sz] = typeof scale === 'number' ? [scale, scale] : [scale[0], scale[2]];
  const ox = Math.abs(lx) - PILLAR_HALF.x * sx;
  const oz = Math.abs(lz) - PILLAR_HALF.z * sz;
  return ox < 0 && oz < 0 ? Math.max(ox, oz) : Math.hypot(Math.max(0, ox), Math.max(0, oz));
}

test('the real arms stay clear of every pillar as they open and all through the spin', () => {
  const N = ArmChain.SEGMENTS;
  const shapes = swimShapes(N);
  const rests = createSwimRests(N);
  const specs = ARM_IDS.map(id => NOX.arms.find(arm => arm.id === id)!);
  const chains = specs.map((spec, i) => new ArmChain(shapes.rest[ARM_IDS[i]], spec, i));
  const { swim, sway, curl } = NOX.personality;
  const from = 4.5 + ENTRANCE_HOLD;
  const to = seq.length('entrance');
  let least = Infinity;
  let where = '';
  for (let i = 0; i <= Math.round((to - from) / 0.01); i++) {
    const s = from + i * 0.01;
    const f = entranceFrame(seq, s, NOX_ENTRANCE_GEOMETRY);
    const stroke = strokeAt(f.stroke, swim);
    entranceRests(f, stroke, shapes, rests);
    const drive = entranceDrive(f, stroke);
    const pitch = swimArmPitch(drive.pitch, f.pitch);
    // The body leans about its own sideways axis, then turns (rotation order YXZ).
    const cy = Math.cos(f.yaw);
    const sy = Math.sin(f.yaw);
    const cp = Math.cos(f.pitch);
    const sp = Math.sin(f.pitch);
    // The sway, curl and float run on the page's clock, not the sheet's: try it at several phases.
    for (const clock of [0, 1.3, 2.9, 4.4, 7.1, 9.6]) {
      const drift = floatOffset(clock, NOX.personality);
      chains.forEach((chain, a) => {
        chain.setRest(rests[ARM_IDS[a]]);
        chain.solve({ time: clock, sway, curl, droop: drift.vy * 2.2, reach: { x: 0, y: 0, weight: 0 }, bend: NOX.armBend, pitch, straighten: drive.straighten });
        for (let k = 0; k <= N; k += 2) {
          const x = chain.px[k] - BODY_X;
          const y = chain.py[k] - PIVOT_Y;
          const z = cp * chain.pz[k] + sp * y;
          const wx = f.position[0] + drift.x + BODY_X + cy * x + sy * z;
          const wz = f.position[2] - sy * x + cy * z;
          for (const pillar of SECURITY_WORLD.layout.pillars) {
            // To the arm's surface: its radius there (the arm thins toward its tip).
            const gap = pillarGap(wx, wz, pillar) - armRadius(k / N, specs[a], NOX);
            if (gap < least) {
              least = gap;
              where = `${ARM_IDS[a]} point ${k} at ${s.toFixed(2)} s`;
            }
          }
        }
      });
    }
  }
  expect(least, where).toBeGreaterThanOrEqual(MIN_GAP);
}, 120_000);
