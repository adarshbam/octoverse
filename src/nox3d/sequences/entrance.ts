import type { ExpressionId } from '../behavior/expressions';
import { NOX } from '../config/nox.character';
import type { ArmRest } from '../character/armChain';
import type { ArmId } from '../config/types';
import { type StrokeFrame, strokeAt, swimDrive } from '../motion/stroke';
import { type SwimShapes, swimRests } from '../motion/swimArms';
import type { Placement, Vec3, WorldLayout } from '../world/types';
import { ENTRANCE_SPIRAL } from './keys';
import type { Sequences } from './theatre';

// The entrance (design 9.6): Nox comes out of the murk deep in the corridor on the left, swims
// toward the visitor and to the centre in whole strokes, each a surge, turns once round his
// vertical axis on a short golden-spiral arc into the stage spot, and settles into the intro pose.
// His arms open into that pose before the turn, so he turns with them fully out (owner request).
// The keys live in the Theatre sheet `entrance` (defaults in keys.ts); this file reads them and
// adds what is computed: the surges, the arc and the facing. No arm physics (ruling R48): the
// follow-through is in the stroke drives, which the stage takes from `stroke`, `forward` and `open`.

/** The entrance's length in seconds: the sheet's length. */
export const ENTRANCE_SECONDS = 8.4;

export interface EntranceFrame {
  /** The body's place: stage units, (0, 0, 0) being the intro spot. */
  position: Vec3;
  /**
   * Turn about +y (radians), facing along (sin yaw, 0, cos yaw); 0 faces the visitor. It is the
   * `yaw` key plus 2 pi spin, the turn wrapped to [-pi, pi), so it is 0 while he swims in and
   * exactly 0 at the end; it jumps by 2 pi half way round the spin, so set a rotation with it
   * directly and do not blend it from frame to frame (use `spin` for that).
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
 * the turn completes. It starts at ENTRANCE_SPIRAL.phase, heading for the visitor, and runs the
 * way `yaw` turns, so its own heading at θ stays within 8 degrees of θ while it is more than a
 * quarter of r0 from the spot: Nox faces along the arc. Inside that it turns in to close on the spot.
 */
export function spiralOffset(spin: number, r0: number): Vec3 {
  const s = Math.min(1, Math.max(0, spin));
  if (s === 1) return [0, 0, 0];
  const theta = 2 * Math.PI * s;
  const r = (r0 * (PHI ** ((-2 * theta) / Math.PI) - PHI_END)) / (1 - PHI_END);
  const angle = ENTRANCE_SPIRAL.phase + theta;
  return [r * Math.sin(angle), 0, r * Math.cos(angle)];
}

/**
 * How far ahead of the keyed path (seconds) the strokes carry Nox, as a function of the stroke
 * clock: the path's own speed times thrust / mean thrust, integrated. It is zero at every whole
 * stroke, so a swim of whole strokes keeps the keyed times at its ends. Built once from Nox's timing.
 */
let leadTable: Float64Array | null = null;
const LEAD_STEPS = 512;
function strokeLead(clock: number) {
  const timing = NOX.personality.swim;
  if (!leadTable) {
    const thrust = Array.from({ length: LEAD_STEPS + 1 }, (_, i) => strokeAt(Math.min(i / LEAD_STEPS, 1 - 1e-9), timing).thrust);
    let mean = 0;
    for (let i = 0; i < LEAD_STEPS; i++) mean += (thrust[i] + thrust[i + 1]) / 2 / LEAD_STEPS;
    leadTable = new Float64Array(LEAD_STEPS + 1);
    for (let i = 0; i < LEAD_STEPS; i++) leadTable[i + 1] = leadTable[i] + ((thrust[i] + thrust[i + 1]) / 2 / mean - 1) / LEAD_STEPS;
  }
  const period = timing.recovery + timing.power + timing.glide;
  const f = (clock - Math.floor(clock)) * LEAD_STEPS;
  const i = Math.min(LEAD_STEPS - 1, Math.floor(f));
  return period * (leadTable[i] + (leadTable[i + 1] - leadTable[i]) * (f - i));
}

/**
 * The entrance at `seconds` (clamped to 0 to ENTRANCE_SECONDS), from the sheet. The keyed x, y, z
 * are the swim to the arc's start; the strokes pull the swim along that path in surges (the
 * `surge` prop, 0 none, 1 the speed in step with the thrust), and the arc adds
 * spiralOffset(spin) - spiralOffset(0), which ends at the spot.
 */
export function entranceFrame(seq: Sequences, seconds: number): EntranceFrame {
  const t = Math.min(ENTRANCE_SECONDS, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  // Copy at once: the next sample moves the same sheet.
  const k = { ...seq.sample<EntranceProps>('entrance', 'main', t) };
  const lead = k.surge * strokeLead(k.stroke);
  const path = lead === 0 ? k : seq.sample<EntranceProps>('entrance', 'main', t + lead);
  const arc = spiralOffset(k.spin, ENTRANCE_SPIRAL.r0);
  const arcStart = spiralOffset(0, ENTRANCE_SPIRAL.r0);
  const turn = k.spin - Math.round(k.spin);
  return {
    position: [path.x + arc[0] - arcStart[0], path.y, path.z + arc[2] - arcStart[2]],
    yaw: k.yaw + 2 * Math.PI * turn,
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
const PILLAR_HALF = { x: 0.55, z: 0.5 } as const;

/** Distance in the x-z plane from `p` to a pillar's footprint (0 inside it). */
function pillarDistance(p: Vec3, pillar: Placement) {
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
  const ox = Math.max(0, Math.abs(lx) - PILLAR_HALF.x * sx);
  const oz = Math.max(0, Math.abs(lz) - PILLAR_HALF.z * sz);
  return Math.hypot(ox, oz);
}

/**
 * How far Nox's arms reach either side in `frame`: closed while he swims, open as a stroke opens
 * them and as they open into the intro pose (`open`, what the stage draws them from). A stroke's
 * arms are the trail blended toward the open pose by `spread` and back by `sweep`
 * (motion/stroke.ts), so they are open by spread (1 - sweep); that much open counts as the intro's
 * full reach.
 */
export function armHalfSpan(frame: EntranceFrame) {
  const { spread, sweep } = strokeAt(frame.stroke, NOX.personality.swim);
  const open = Math.max(spread * (1 - sweep), frame.open);
  return ARM_HALF_SPAN.closed + (ARM_HALF_SPAN.open - ARM_HALF_SPAN.closed) * Math.min(1, Math.max(0, open));
}

/**
 * The arm drive the stage gives in `frame` (swing back, tip straightening): the stroke's, given
 * way as the arms swing forward (`forward`), before they spread. Octopus and the tests both call
 * this, so the arms cannot go back to following `settle` without a test failing.
 */
export function entranceDrive(frame: EntranceFrame, stroke: StrokeFrame) {
  return swimDrive(stroke, frame.forward);
}

/** The arm rests the stage draws in `frame`, written into `out`: the stroke's, carried to the intro pose as the arms spread (`open`). */
export function entranceRests(frame: EntranceFrame, stroke: StrokeFrame, shapes: SwimShapes, out: Record<ArmId, ArmRest>) {
  return swimRests(shapes, stroke, frame.open, out);
}

/**
 * Smallest gap between Nox's arm span (open 2.15, closed 1.2 half-span) and any pillar along the
 * path, sampled `samples` times from 0 to `until` seconds. In the x-z plane, so the pillars count at
 * every height. A circle of reach, the same every way: right for the swim, where the strokes swing
 * the arms back as far as they reach sideways, but blind to the open intro pose's shape (flat, side
 * to side). Past the swim, sequences/armClearance.test.ts checks the real arms instead.
 */
export function pathClearance(frame: (s: number) => EntranceFrame, layout: WorldLayout, samples = 651, until = ENTRANCE_SECONDS): number {
  let least = Infinity;
  for (let i = 0; i < samples; i++) {
    const f = frame((i / Math.max(1, samples - 1)) * until);
    const reach = armHalfSpan(f);
    for (const pillar of layout.pillars) least = Math.min(least, pillarDistance(f.position, pillar) - reach);
  }
  return least;
}
