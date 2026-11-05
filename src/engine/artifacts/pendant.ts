import * as THREE from 'three';
import type { ArmId, PendantPlacement, PendantSlot, Point2, SwingLimits, TetherStyle } from '../config/types';
import { ARM_IDS } from '../config/types';
import type { StagePose } from '../poses/types';
import type { Vec3 } from '../world/types';
import type { Box } from './suctionHold';
import { tetherCurve } from './tether';

// The pendant placement's pure parts (spec 7.5, contract 9.2): which technology hangs where, how a
// pendant swings as its arm moves, and whether its thread keeps clear of everything it should. None
// of it touches React, instance state or a global, so Aether's `satellite` placement composes the
// same functions. The placement module in strategies.ts and TechBubbles are thin wrappers over them.

// --- Slots -------------------------------------------------------------------------------------

/** The most pendants one arm carries (contract 9.2); a slot table that offers more is cut to it. */
export const MAX_PER_ARM = 2;

/**
 * The technologies, in the project's order, on a stage's slots, in slot `order`: technology `i`
 * takes the i-th slot by order, an arm takes at most two, and the technologies with no slot go to
 * the tray (never extra arms). `techIndex` is the technology's index in the project's order.
 */
export function assignPendants(techCount: number, slots: readonly PendantSlot[]): { placed: { techIndex: number; slot: PendantSlot }[]; tray: number[] } {
  const count = Number.isFinite(techCount) ? Math.max(0, Math.floor(techCount)) : 0;
  const onArm = new Map<ArmId, number>();
  const placed: { techIndex: number; slot: PendantSlot }[] = [];
  for (const slot of [...slots].sort((a, b) => a.order - b.order)) {
    if (placed.length >= count) break;
    const taken = onArm.get(slot.arm) ?? 0;
    if (taken >= MAX_PER_ARM) continue;
    onArm.set(slot.arm, taken + 1);
    placed.push({ techIndex: placed.length, slot });
  }
  const tray: number[] = [];
  for (let i = placed.length; i < count; i++) tray.push(i);
  return { placed, tray };
}

// --- The swing ---------------------------------------------------------------------------------

const DEG = Math.PI / 180;

/** Veyra's swing: at most 25 degrees from vertical, settled 1.2 s after the arm stops (spec 7.5). */
export const DEFAULT_SWING: SwingLimits = { maxAngle: 25 * DEG, settle: 1.2 };

/** The swing's limits a placement config names; absent, Veyra's. */
export const swingLimits = (placement: PendantPlacement): SwingLimits => placement.swing ?? DEFAULT_SWING;

/** The swing's own period: a pendant on a short thread swings slowly, like something hung in water. */
const SWING_PERIOD = 1.6;
const OMEGA = (2 * Math.PI) / SWING_PERIOD;
/** How far the arm's motion kicks the swing, in radians per unit the attach point travels sideways. */
const KICK = 1.5;
/** The idle sway at rest: its amplitude (at most a fifth of the limit) and period, slower than the swing. */
const IDLE_AMPLITUDE = 2 * DEG;
const IDLE_PERIOD = 5.3;
/** The swing has settled once what is left of it is under this: 0.9 degrees, inside the one degree the contract allows. */
const RESIDUAL = 0.9 * DEG;
/** The longest step the swing integrates over, so a hitch does not kick it. */
const MAX_STEP = 0.1;

/**
 * One pendant's swing between frames: `x` the swing's angle (radians, away from the idle sway),
 * `w` its angular speed over the swing's frequency (so the pair is a point in a plane that turns at
 * a constant rate), `t` the clock it was last advanced to (null before the first step), `seed` where
 * in its idle sway this pendant starts, so the pendants are out of step.
 */
export interface SwingState {
  readonly x: number;
  readonly w: number;
  readonly t: number | null;
  readonly seed: number;
}

/** A pendant at rest, `seed` (radians) into its idle sway. */
export const restSwing = (seed = 0): SwingState => ({ x: 0, w: 0, t: null, seed });

/** The swing's constants for `limits`: the idle sway's reach, the most the drive may add, and the decay's time constant that leaves under a degree after `settle`. */
function constants(limits: SwingLimits) {
  const idle = Math.min(IDLE_AMPLITUDE, 0.2 * limits.maxAngle);
  const reach = Math.max(0, limits.maxAngle - idle);
  // The swing and its speed are each held to `reach`, so the swing's size is at most that times root two.
  const tau = limits.settle / Math.log(Math.max(Math.SQRT2 * reach, 2 * RESIDUAL) / RESIDUAL);
  return { idle, reach, tau };
}

/** The idle sway at clock `t` for a pendant seeded `seed`: a slow sine that never settles away (it is what the swing settles to). */
export function idleSway(t: number, seed: number, limits: SwingLimits): number {
  return constants(limits).idle * Math.sin((2 * Math.PI * t) / IDLE_PERIOD + seed);
}

/**
 * A pendant's angle from straight down at clock `t` (seconds), its arm's attach point moving at
 * `attachVelocity` (units a second): a damped sine driven by the point's sideways speed (contract
 * 9.2; no physics engine). The arm's motion kicks the swing against its direction; the swing then
 * turns at its own pace and dies away by an exponential envelope, to under a degree within
 * `limits.settle` of the arm stopping; at rest only the idle sway is left. The angle never passes
 * `limits.maxAngle`. With `reducedMotion` there is no swing and no idle sway: the angle is 0.
 * Returns the new state: nothing is kept between calls but what `state` carries.
 */
export function pendantSwing(attachVelocity: Vec3, t: number, state: SwingState, limits: SwingLimits, reducedMotion: boolean): { angle: number; state: SwingState } {
  if (reducedMotion) return { angle: 0, state: { x: 0, w: 0, t, seed: state.seed } };
  const { idle, reach, tau } = constants(limits);
  const dt = state.t === null ? 0 : Math.min(MAX_STEP, Math.max(0, t - state.t));
  // The swing turns about its rest and decays: the exact motion of a damped sine over dt.
  const decay = Math.exp(-dt / tau);
  const cos = Math.cos(OMEGA * dt);
  const sin = Math.sin(OMEGA * dt);
  let x = decay * (state.x * cos + state.w * sin);
  let w = decay * (state.w * cos - state.x * sin);
  // The arm's sideways travel this step kicks it the other way. Neither the swing nor its speed may pass the limit (the idle sway takes its own share of it), whatever the step.
  w -= KICK * attachVelocity[0] * dt;
  x = Math.min(reach, Math.max(-reach, x));
  w = Math.min(reach, Math.max(-reach, w));
  const angle = Math.min(limits.maxAngle, Math.max(-limits.maxAngle, x + idle * Math.sin((2 * Math.PI * t) / IDLE_PERIOD + state.seed)));
  return { angle, state: { x, w, t, seed: state.seed } };
}

// --- Thread clearance --------------------------------------------------------------------------

/** How finely an arm's curve is sampled for the clearance. */
const ARM_SAMPLES = 128;

/** An arm's centre line, resampled into equal lengths the way the rig's rest is (a centripetal Catmull-Rom, root first). */
function armLine(curve: readonly Point2[]): Point2[] {
  const spline = new THREE.CatmullRomCurve3(curve.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  return spline.getSpacedPoints(ARM_SAMPLES).map(p => [p.x, p.y] as Point2);
}

const along = (line: readonly Point2[], at: number): Point2 => {
  const f = Math.min(1, Math.max(0, at)) * (line.length - 1);
  const k = Math.min(line.length - 2, Math.floor(f));
  const w = f - k;
  return [line[k][0] * (1 - w) + line[k + 1][0] * w, line[k][1] * (1 - w) + line[k + 1][1] * w];
};

/** The point at arc fraction `at` (0 root, 1 tip) on an arm's authored curve. */
export const armPoint = (curve: readonly Point2[], at: number): Point2 => along(armLine(curve), at);

/** Distance from (x, y) to the box (0 inside it). */
const outsideBox = (x: number, y: number, box: Box) => Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.y0 - y, 0, y - box.y1));

/** What a clearance is measured over (all optional: without them only the slots' attach points are measured). */
export interface ClearanceGeometry {
  /** The thread each pendant hangs on. */
  style: TetherStyle;
  /** The orb's radius. */
  radius: number;
  /** An arm's thickness at arc fraction `u`, taken off the distance to its centre line (without it an arm is a line). */
  armRadius?: (arm: ArmId, u: number) => number;
  /** The angles from vertical the pendants are checked at (default: hanging straight down). */
  angles?: readonly number[];
  /**
   * The arms' centre lines as they are drawn (root first, equal lengths, as the rig's chains hold
   * them), where those differ from the pose's rest curves: the rig adds a rest bend to the curves,
   * which moves a mid-arm slot by a tenth of a unit. Without them the pose's curves are used.
   */
  armLines?: Record<ArmId, readonly Point2[]>;
}

/**
 * The least distance from any pendant's thread or orb to another arm or to the face, for `slots`
 * hung on `pose`'s arms: how close what hangs comes to what it must not touch, in world units (0 or
 * less: it touches). `faceRect` is the face's box in the pose's own arm space. A pendant's own arm
 * is not counted (it hangs from it). With no `geometry` only the slots' attach points are measured.
 */
export function threadClearance(pose: Pick<StagePose, 'arms'>, slots: readonly PendantSlot[], faceRect: Box, geometry?: ClearanceGeometry): number {
  const lines = Object.fromEntries(ARM_IDS.map(id => [id, geometry?.armLines?.[id] ?? armLine(pose.arms[id])])) as Record<ArmId, readonly Point2[]>;
  const armRadius = geometry?.armRadius ?? (() => 0);
  const angles = geometry?.angles ?? [0];
  const radius = geometry?.radius ?? 0;
  let least = Infinity;
  /** A disc (a thread's point has radius 0, the orb its own) against every other arm and the face. */
  const measure = (own: ArmId, x: number, y: number, r: number) => {
    least = Math.min(least, outsideBox(x, y, faceRect) - r);
    for (const id of ARM_IDS) {
      if (id === own) continue;
      const line = lines[id];
      for (let k = 0; k < line.length; k++) least = Math.min(least, Math.hypot(line[k][0] - x, line[k][1] - y) - r - armRadius(id, k / (line.length - 1)));
    }
  };
  for (const slot of slots) {
    const [ax, ay] = along(lines[slot.arm], slot.at);
    if (!geometry) {
      measure(slot.arm, ax, ay, 0);
      continue;
    }
    for (const angle of angles) {
      const { points, orbCentre } = tetherCurve([ax, ay, 0], angle, geometry.style, radius);
      for (const p of points) measure(slot.arm, p[0], p[1], 0);
      measure(slot.arm, orbCentre[0], orbCentre[1], radius);
    }
  }
  return least;
}

// --- The placement's frame ---------------------------------------------------------------------

/** One artifact's place in a stage: the slot it hangs from and its orb's radius; null where it has no slot (the tray's, in that stage). */
export interface PendantPlace {
  slot: PendantSlot;
  size: number;
}

/** The artifacts `count` of them in a stage's framing: each one's slot (technology `i` takes the i-th by order) and size, or null. */
export function layoutPendants(count: number, placement: Pick<PendantPlacement, 'slots' | 'sizes'>, stage: 'intro' | 'overview'): (PendantPlace | null)[] {
  const out: (PendantPlace | null)[] = Array.from({ length: Math.max(0, count) }, () => null);
  for (const { techIndex, slot } of assignPendants(count, placement.slots[stage]).placed) out[techIndex] = { slot, size: placement.sizes[stage] };
  return out;
}

/** How the engine's arms are read: the point at arc fraction `u` (the rig's `ArmChain.pointAt`), in the arms' own space, indexed in ARM_IDS order. */
export interface ArmReader {
  pointAt(u: number, out: { x: number; y: number; z: number }): void;
}

/** What a pendant placement is given each frame (contract 9.2): the stage, the head swell and the frame time, and whether motion is off. */
export interface PendantFrame {
  stage: 'intro' | 'overview';
  swell: number;
  dt: number;
  reducedMotion: boolean;
  /**
   * The arm lift (Task 19): where along its arm each pendant hangs at the full lift (`at`, an arc
   * fraction; NaN: its slot) and how far it is lifted (`weight`, 0 to 1). A lifted pendant's attach
   * point runs from its slot toward `at` with the weight, so it rides under the lifted arm's crown.
   */
  hang?: { at: ArrayLike<number>; weight: ArrayLike<number> };
}

/** One pendant's live state between frames, written by `stepPendants` and read by the page's buttons and the thread's drawing. */
export interface PendantLive {
  /** Where the pendant's slot is now on its arc (it slides along the arm when a new stage moves its slot, and snaps to a new arm). */
  at: number;
  arm: ArmId | null;
  swing: SwingState;
  /** The attach point last frame, to find the arm's speed from, and whether there is one (a pendant new to an arm has none). */
  prev: [number, number, number];
  hasPrev: boolean;
  attach: [number, number, number];
  angle: number;
  /** The thread's curve and the orb's centre, in the arms' space. */
  points: Vec3[];
  orbCentre: [number, number, number];
}

/** How fast a pendant slides along its arm to a new stage's slot, per second (an exponential approach). */
const SLIDE_PER_S = 3;

/** One live state per artifact, each out of step in its idle sway; and the placement's clock. */
export function createPendantRun(count: number): { clock: number; live: PendantLive[] } {
  return {
    clock: 0,
    live: Array.from({ length: count }, (_, i) => ({ at: 0, arm: null, swing: restSwing(i * 2.399963), prev: [0, 0, 0], hasPrev: false, attach: [0, 0, 0], angle: 0, points: [], orbCentre: [0, 0, 0] })),
  };
}

/**
 * Forgets where each pendant's attach point was last frame: call it when the pendants have not been
 * stepped for a while (hidden), so the first frame after is not read as the arm's whole travel in
 * the hidden time in one step (a kick to the swing's limit).
 */
export function resetPendants(run: ReturnType<typeof createPendantRun>) {
  for (const live of run.live) live.hasPrev = false;
}

/**
 * Advances every placed pendant a frame (the module's `step`): finds its attach point on the arm,
 * the arm's speed there, the swing that speed drives, and the thread and orb that hang from it.
 * `places` are the stage's (layoutPendants); a null place is left alone. With motion off the clock
 * stands still and the pendants hang straight down. Nothing is kept but `run`.
 */
export function stepPendants(run: ReturnType<typeof createPendantRun>, places: readonly (PendantPlace | null)[], frame: PendantFrame, arms: readonly ArmReader[], placement: PendantPlacement) {
  const dt = frame.reducedMotion ? 0 : frame.dt;
  run.clock += dt;
  const limits = swingLimits(placement);
  const at = { x: 0, y: 0, z: 0 };
  places.forEach((place, i) => {
    const live = run.live[i];
    if (!place || !live) return;
    // A slot on another arm is a jump (no slide, no speed); on the same arm the pendant slides to it.
    const reach = place.slot.arm;
    if (live.arm !== reach) {
      live.arm = reach;
      live.at = place.slot.at;
      live.hasPrev = false;
    } else {
      live.at += (place.slot.at - live.at) * (frame.reducedMotion ? 1 : 1 - Math.exp(-SLIDE_PER_S * frame.dt));
    }
    const hangAt = frame.hang?.at[i] ?? Number.NaN;
    const hangWeight = frame.hang?.weight[i] ?? 0;
    const u = Number.isFinite(hangAt) && hangWeight > 0 ? live.at + (hangAt - live.at) * Math.min(1, hangWeight) : live.at;
    arms[ARM_IDS.indexOf(reach)].pointAt(u, at);
    const speed: Vec3 = live.hasPrev && dt > 0 ? [(at.x - live.prev[0]) / dt, (at.y - live.prev[1]) / dt, (at.z - live.prev[2]) / dt] : [0, 0, 0];
    live.prev[0] = live.attach[0] = at.x;
    live.prev[1] = live.attach[1] = at.y;
    live.prev[2] = live.attach[2] = at.z;
    live.hasPrev = true;
    const swing = pendantSwing(speed, run.clock, live.swing, limits, frame.reducedMotion);
    live.swing = swing.state;
    live.angle = swing.angle;
    const curve = tetherCurve(live.attach, swing.angle, placement.tether, place.size);
    live.points = curve.points;
    live.orbCentre = curve.orbCentre as [number, number, number];
  });
}
