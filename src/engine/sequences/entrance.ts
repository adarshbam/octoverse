import type { ExpressionId } from '../behavior/expressions';
import type { ArmRest } from '../character/armChain';
import type { ArmId } from '../config/types';
import { type StrokeFrame, type StrokeTiming, strokeAt, swimDrive } from '../motion/stroke';
import { type SwimShapes, swimRests } from '../motion/swimArms';
import type { Placement, Vec3, WorldLayout } from '../world/types';
import type { EntranceArc } from './keys';
import type { Sequences } from './theatre';

// The entrance (design 9.6): Nox comes out of the murk deep in the corridor on the left, swims
// toward the visitor and to the centre in whole strokes, each a surge, turns once round his
// vertical axis on a short golden-spiral arc into the stage spot, and settles into the intro pose.
// A world without the spiral (`EntranceShape.spiral` false: Veyra) glides to the spot on its keyed
// path instead and turns in place on it, into the front, by its own `turn` (glideTurnYaw).
// His arms open into that pose before the turn, so he turns with them fully out (owner request).
// The keys live in the Theatre sheet `entrance` (Nox's defaults in sequences/defaults.ts); this file reads them and
// adds what is computed: the surges, the arc and the facing. No arm physics (ruling R48): the
// follow-through is in the stroke drives, which the stage takes from `stroke`, `forward` and `open`.
// Nothing here names a world: the stroke's timing, how far the arms and the pillars reach, and the
// turn's size and arc (`EntranceShape`, on the sequences) come in as arguments (Nox's: nox.sequences.ts).

export interface EntranceFrame {
  /** The body's place: stage units, (0, 0, 0) being the intro spot. */
  position: Vec3;
  /**
   * Turn about +y (radians), facing along (sin yaw, 0, cos yaw); 0 faces the visitor. On the
   * spiral (Nox) it is the `yaw` key plus the spin times the entrance turn (`EntranceShape.turn`, 2 pi), the spin wrapped to [-0.5, 0.5], so it is 0 while he swims in and
   * exactly 0 at the end; it jumps by 2 pi half way round the spin, so set a rotation with it
   * directly and do not blend it from frame to frame (use `spin` for that). Without the spiral it
   * is the `yaw` key plus glideTurnYaw(spin, turn): -turn before the turn, rising without a jump to
   * exactly 0 at its end.
   */
  yaw: number;
  /**
   * The body's lean, head first into the way he swims (radians, about his own sideways axis; 0
   * upright). The arms' own swing back (ArmDrive.pitch) comes on top of it; the stage keeps the
   * two together near 1.05 so the trailing bundle reads from the front (Task 16, concern 3).
   */
  pitch: number;
  /** The stroke clock for `strokeAt`: whole strokes plus the progress through the current one. */
  stroke: number;
  /** 0 to 1: how far round the turn on the spiral arc. */
  spin: number;
  /**
   * 0 to 1: how far the arms have swung forward out of the trail; the stroke drives fade with it.
   * It leads `open` (never less than it), so the arms spread only once they have come forward.
   */
  forward: number;
  /**
   * 0 to 1: how far the arms have spread from the stroke into the intro pose. They open before the
   * spin and stay open; never less than `settle`.
   */
  open: number;
  /** 0 to 1: how far into the intro (face gentle, the intro's words in); after the spin. */
  settle: number;
  /** 0 to 1: out of the murk; the glow and aura first, then the shape. */
  reveal: number;
  expression: ExpressionId;
}

const smoothstep = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * How much of Nox shows at `reveal` (0 to 1) as he comes out of the murk: his glow and aura first
 * (`glow`, in by 0.6), then his shape (`shape`, from 0.35). Both are 0 at 0 and exactly 1 at 1.
 */
export function revealParts(reveal: number) {
  return { glow: smoothstep(0, 0.6, reveal), shape: smoothstep(0.35, 1, reveal) };
}

/** The sheet's props at one moment. */
interface EntranceProps {
  x: number;
  y: number;
  z: number;
  stroke: number;
  spin: number;
  forward: number;
  open: number;
  settle: number;
  reveal: number;
  pitch: number;
  yaw: number;
  surge: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;
/** Where the spiral ends: phi^-4, a full turn in (it shrinks by phi every quarter turn). */
const PHI_END = PHI ** -4;

/**
 * Offset of the final arc: a golden spiral in the x-z plane round the stage spot,
 * r = r0 (phi^(-2θ/π) - phi^-4) / (1 - phi^-4), θ = 2π spin, so it reaches the spot exactly as
 * the turn completes. It starts at the world's `arc.phase` (`EntranceShape.arc`; Nox's heads for
 * the visitor), `arc.r0` from the spot, and runs the way `yaw` turns, so its own heading at θ stays
 * within 8 degrees of θ while it is more than a quarter of r0 from the spot: Nox faces along the arc.
 * Inside that it turns in to close on the spot. `turn` (radians, `EntranceShape.turn`; a full turn
 * by default) is how far round the angle goes by the end of the spin; the radius still closes on
 * the spot as the spin completes.
 */
export function spiralOffset(spin: number, arc: EntranceArc, turn: number = 2 * Math.PI): Vec3 {
  const s = Math.min(1, Math.max(0, spin));
  if (s === 1) return [0, 0, 0];
  const theta = 2 * Math.PI * s;
  const r = (arc.r0 * (PHI ** ((-2 * theta) / Math.PI) - PHI_END)) / (1 - PHI_END);
  const angle = arc.phase + turn * s;
  return [r * Math.sin(angle), 0, r * Math.cos(angle)];
}

/**
 * The glide-turn's share of the yaw (the path without the spiral, `EntranceShape.spiral` false) at
 * `spin` (clamped to 0 to 1): turn (spin - 1), so the body faces -turn before the turn and turns
 * the way Nox's spin does (+yaw), monotonically, through exactly `turn`, to exactly 0 (facing the
 * visitor) as the spin completes. Not wrapped: a part turn has no jump to hide.
 */
export function glideTurnYaw(spin: number, turn: number): number {
  const s = Math.min(1, Math.max(0, spin));
  return turn * (s - 1);
}

/** What the entrance needs of the character: the timing of its stroke. */
export interface EntranceSwim {
  swim: StrokeTiming;
}

/**
 * How far ahead of the keyed path (seconds) the strokes carry the swimmer, as a function of the
 * stroke clock: the path's own speed times thrust / mean thrust, integrated. It is zero at every
 * whole stroke, so a swim of whole strokes keeps the keyed times at its ends. Built once per stroke
 * timing (a pure memo of the timing's values, so instances may share it).
 */
const leadTables = new Map<string, Float64Array>();
const LEAD_STEPS = 512;
function strokeLead(clock: number, timing: StrokeTiming) {
  const tableKey = `${timing.recovery}/${timing.power}/${timing.glide}`;
  let leadTable = leadTables.get(tableKey);
  if (!leadTable) {
    const thrust = Array.from({ length: LEAD_STEPS + 1 }, (_, i) => strokeAt(Math.min(i / LEAD_STEPS, 1 - 1e-9), timing).thrust);
    let mean = 0;
    for (let i = 0; i < LEAD_STEPS; i++) mean += (thrust[i] + thrust[i + 1]) / 2 / LEAD_STEPS;
    leadTable = new Float64Array(LEAD_STEPS + 1);
    for (let i = 0; i < LEAD_STEPS; i++) leadTable[i + 1] = leadTable[i] + ((thrust[i] + thrust[i + 1]) / 2 / mean - 1) / LEAD_STEPS;
    leadTables.set(tableKey, leadTable);
  }
  const period = timing.recovery + timing.power + timing.glide;
  const f = (clock - Math.floor(clock)) * LEAD_STEPS;
  const i = Math.min(LEAD_STEPS - 1, Math.floor(f));
  return period * (leadTable[i] + (leadTable[i + 1] - leadTable[i]) * (f - i));
}

/**
 * The entrance at `seconds` (clamped to 0 to the sheet's length, `seq.length('entrance')`: the world's own, 8.4 s for Nox), from the sheet. The keyed x, y, z
 * are the swim to the arc's start; the strokes pull the swim along that path in surges (the
 * `surge` prop, 0 none, 1 the speed in step with the thrust), and the arc adds
 * spiralOffset(spin) - spiralOffset(0), which ends at the spot. The turn's size is the sequences'
 * `entrance.turn` (the yaw and the arc's angle read it); the stroke's timing is `swim`. Without the
 * spiral (`entrance.spiral` false) there is no arc: the keyed path is the whole way to the spot,
 * and the spin turns the body in place by glideTurnYaw.
 */
export function entranceFrame(seq: Sequences, seconds: number, { swim }: EntranceSwim): EntranceFrame {
  const t = Math.min(seq.length('entrance'), Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  // Copy at once: the next sample moves the same sheet.
  const k = { ...seq.sample<EntranceProps>('entrance', 'main', t) };
  const lead = k.surge * strokeLead(k.stroke, swim);
  const path = lead === 0 ? k : seq.sample<EntranceProps>('entrance', 'main', t + lead);
  const shape = seq.entrance;
  let position: Vec3;
  let yaw: number;
  if (shape.spiral) {
    const { turn } = shape;
    const arc = spiralOffset(k.spin, shape.arc, turn);
    const arcStart = spiralOffset(0, shape.arc, turn);
    const round = k.spin - Math.round(k.spin);
    position = [path.x + arc[0] - arcStart[0], path.y, path.z + arc[2] - arcStart[2]];
    yaw = k.yaw + turn * round;
  } else {
    position = [path.x, path.y, path.z];
    yaw = k.yaw + glideTurnYaw(k.spin, shape.turn);
  }
  return {
    position,
    yaw,
    pitch: k.pitch,
    stroke: k.stroke,
    spin: k.spin,
    // A sheet edited without the opening still lands open, as the settle used to carry the arms.
    forward: Math.max(k.forward, k.open, k.settle),
    open: Math.max(k.open, k.settle),
    settle: k.settle,
    reveal: k.reveal,
    expression: k.settle > 0 ? 'gentle' : 'happy',
  };
}

/**
 * Nox's arm reach either side of his body's centre (stage units): `open` in the intro pose (the
 * widest he ever is) and `closed` with the arms drawn back to swim. The swim poses measure 1.17
 * (open, swung back 0.9) and 0.41 (trail); the head is 0.75. Opened less far back, the swim's open
 * pose reaches 1.7 to 2.1, so an opening stroke counts as open.
 */
export const ARM_HALF_SPAN = { open: 2.15, closed: 1.2 } as const;

/**
 * A pillar's footprint: half its shaft's width and depth (blender/security/build_kit.py PILLAR_W,
 * PILLAR_D), before its rotY and scale. The plinth, 0.46 high, is below the arms along the path.
 */
export const PILLAR_HALF = { x: 0.55, z: 0.5 } as const;

/** A kit piece's footprint in the x-z plane: half its width (x) and depth (z) in its own axes, before a placement's rotY and scale. */
export interface Footprint {
  readonly x: number;
  readonly z: number;
}

/**
 * What the clearance check measures with: the character's stroke and arm reach, and the kit's pillar
 * footprint. `swim` is the stroke the character swims, `strokeTiming(personality)` (motion/stroke.ts),
 * never the raw `personality.swim` once a world sets `glideBias` (Veyra: HANDOFF, Task 16).
 */
export interface EntranceGeometry extends EntranceSwim {
  armHalfSpan: { readonly open: number; readonly closed: number };
  pillarHalf: Footprint;
}

/** Distance in the x-z plane from `p` to a placed piece's footprint (0 inside it). */
function pillarDistance(p: Vec3, pillar: Placement, pillarHalf: Footprint) {
  const dx = p[0] - pillar.position[0];
  const dz = p[2] - pillar.position[2];
  const rot = pillar.rotY ?? 0;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // Into the pillar's own axes (it is turned rotY about +y).
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const scale = pillar.scale ?? 1;
  const [sx, sz] = typeof scale === 'number' ? [scale, scale] : [scale[0], scale[2]];
  const ox = Math.max(0, Math.abs(lx) - pillarHalf.x * sx);
  const oz = Math.max(0, Math.abs(lz) - pillarHalf.z * sz);
  return Math.hypot(ox, oz);
}

/**
 * How far Nox's arms reach either side in `frame`: closed while he swims, open as a stroke opens
 * them and as they open into the intro pose (`open`, what the stage draws them from). A stroke's
 * arms are the trail blended toward the open pose by `spread` and back by `sweep`
 * (motion/stroke.ts), so they are open by spread (1 - sweep); that much open counts as the intro's
 * full reach.
 */
export function armHalfSpan(frame: EntranceFrame, { swim, armHalfSpan: span }: Pick<EntranceGeometry, 'swim' | 'armHalfSpan'>) {
  const { spread, sweep } = strokeAt(frame.stroke, swim);
  const open = Math.max(spread * (1 - sweep), frame.open);
  return span.closed + (span.open - span.closed) * Math.min(1, Math.max(0, open));
}

/**
 * The arm drive the stage gives in `frame` (swing back, tip straightening): the stroke's, given
 * way as the arms swing forward (`forward`), before they spread. Octopus and the tests both call
 * this, so the arms cannot go back to following `settle` without a test failing.
 */
export function entranceDrive(frame: EntranceFrame, stroke: StrokeFrame) {
  return swimDrive(stroke, frame.forward);
}

/**
 * The arm rests the stage draws in `frame`, written into `out`: the stroke's, carried to the intro
 * pose as the arms spread (`open`), running past it by the personality's settle (`overshoot`, 1 Nox's).
 */
export function entranceRests(frame: EntranceFrame, stroke: StrokeFrame, shapes: SwimShapes, out: Record<ArmId, ArmRest>, overshoot = 1) {
  return swimRests(shapes, stroke, frame.open, out, overshoot);
}

/**
 * Smallest gap between Nox's arm span (open 2.15, closed 1.2 half-span) and any pillar along the
 * path, sampled `samples` times (651 is plenty for a swim) from 0 to `until` seconds (a length the caller reads from its world's sequences). In the x-z plane, so the pillars count at
 * every height. A circle of reach, the same every way: right for the swim, where the strokes swing
 * the arms back as far as they reach sideways, but blind to the open intro pose's shape (flat, side
 * to side). Past the swim, sequences/armClearance.test.ts checks the real arms instead.
 */
export function pathClearance(frame: (s: number) => EntranceFrame, layout: WorldLayout, geometry: EntranceGeometry, samples: number, until: number): number {
  let least = Infinity;
  for (let i = 0; i < samples; i++) {
    const f = frame((i / Math.max(1, samples - 1)) * until);
    const reach = armHalfSpan(f, geometry);
    for (const pillar of layout.groups.pillars ?? []) least = Math.min(least, pillarDistance(f.position, pillar, geometry.pillarHalf) - reach);
  }
  return least;
}

/** The least gap a clearance check found, and where: the entrance's second and the piece (its group, kit name and index in the group). */
export interface ClearanceGap {
  gap: number;
  seconds: number;
  piece: string;
}

/** Whose arm reach a clearance check counts: as the frame draws it (armHalfSpan), or held fully open or fully closed the whole way. */
export type ClearanceReach = 'frame' | 'open' | 'closed';

/**
 * Smallest gap between the arm reach and any piece of `layout` (every group, the world's own) whose
 * kit name has a footprint in `footprints`, along the entrance, sampled `samples` times from 0 to
 * `until` seconds. Pieces without a footprint (plants, corals, low rocks the swim passes over) are
 * not counted. In the x-z plane, a circle of reach, as pathClearance: `reach` 'frame' is the reach
 * the frame draws, 'open' and 'closed' hold the arms at the geometry's open or closed half-span the
 * whole way (the "arms open and closed" check). With Nox's pillars as the only footprints and
 * 'frame', it is pathClearance.
 */
export function layoutClearance(
  frame: (s: number) => EntranceFrame,
  layout: WorldLayout,
  geometry: Pick<EntranceGeometry, 'swim' | 'armHalfSpan'>,
  footprints: Readonly<Record<string, Footprint>>,
  samples: number,
  until: number,
  reach: ClearanceReach = 'frame',
): ClearanceGap {
  const least: ClearanceGap = { gap: Infinity, seconds: 0, piece: '' };
  for (let i = 0; i < samples; i++) {
    const seconds = (i / Math.max(1, samples - 1)) * until;
    const f = frame(seconds);
    const span = reach === 'frame' ? armHalfSpan(f, geometry) : geometry.armHalfSpan[reach];
    for (const [group, pieces] of Object.entries(layout.groups)) {
      pieces.forEach((placed, n) => {
        const footprint = footprints[placed.piece];
        if (!footprint) return;
        const gap = pillarDistance(f.position, placed, footprint) - span;
        if (gap < least.gap) Object.assign(least, { gap, seconds, piece: `${group}[${n}] ${placed.piece}` });
      });
    }
  }
  return least;
}

/**
 * The entrance's clearance against a world's own layout with the arms as drawn, held open and held
 * closed (layoutClearance three ways), from 0 to `until` seconds (default: the sheet's length).
 * The hook a world's entrance test calls with its own sequences, geometry, layout and kit
 * footprints (Nox: sequences/entrance.test.ts; Veyra's arch, walls and blocks: her entrance task).
 */
export function entranceClearance(
  seq: Sequences,
  geometry: Pick<EntranceGeometry, 'swim' | 'armHalfSpan'>,
  layout: WorldLayout,
  footprints: Readonly<Record<string, Footprint>>,
  { samples = 651, until = seq.length('entrance') }: { samples?: number; until?: number } = {},
): Record<ClearanceReach, ClearanceGap> {
  const frame = (s: number) => entranceFrame(seq, s, geometry);
  const check = (reach: ClearanceReach) => layoutClearance(frame, layout, geometry, footprints, samples, until, reach);
  return { frame: check('frame'), open: check('open'), closed: check('closed') };
}
