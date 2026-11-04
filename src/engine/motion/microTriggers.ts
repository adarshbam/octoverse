import type { Personality, StageId } from '../config/types';

/**
 * When the micro-animations (motion/micro.ts) start, as pure predicates, so Octopus only keeps the
 * state and tests can check every rule. `moving` is Octopus's own: exactly 0 under `?freeze` and
 * reduced motion, when nothing starts.
 */

type Micro = Personality['micro'];

export interface StartleInput {
  moving: number;
  stage: StageId;
  /** How near the pointer is to the face now (attention.ts nearFace, 0 to 1; 0 off the page), and last frame. */
  near: number;
  nearBefore: number;
  /** Pointer speed, NDC per second. */
  speed: number;
  /** Seconds since the last startle began (Infinity: none yet). */
  since: number;
}

/**
 * The small startle starts as the pointer darts in close to the face: on the frame it comes within
 * `near` (not while it lingers there), fast enough, once the cooldown has passed; in the intro and
 * the overview only.
 */
export function startleDue(s: StartleInput, p: Micro): boolean {
  const { near, speed, cooldown } = p.startle;
  return s.moving > 0 && (s.stage === 'intro' || s.stage === 'overview') && s.near >= near && s.nearBefore < near && s.speed >= speed && s.since >= cooldown;
}

export interface ArrivalInput {
  moving: number;
  stage: StageId;
  /** The wiggle has already played (or been passed over). */
  arrived: boolean;
  /** The entrance ran to its end (never set when it was skipped). */
  entranceDone: boolean;
}

/** The arrival wiggle starts once, on the first frame after an entrance that ran its course hands over. */
export function arrivalDue(a: ArrivalInput): boolean {
  return a.moving > 0 && !a.arrived && a.entranceDone && a.stage !== 'entering';
}

/** A stage move of the body as it runs: how far it has gone so far, over how many frames. */
export interface SettleTrack {
  x: number;
  y: number;
  frames: number;
  /** On the frame a move lands: the way it went (a unit vector), else null. */
  landed: { x: number; y: number } | null;
}

export const SETTLE_IDLE: SettleTrack = { x: 0, y: 0, frames: 0, landed: null };
/** Body steps smaller than this (world units per frame) count as still, so a pose that eases in for ever still lands. */
export const SETTLE_STILL = 1e-5;
/** A move must run this many frames (a skip lands in one, under the crossfade) and go this far to overshoot. */
const SETTLE_MIN_FRAMES = 5;
const SETTLE_MIN_TRAVEL = 0.05;

/**
 * One frame of watching the body's stage moves: `dx`, `dy` is how far the stage pose moved the body
 * this frame. Returns the next track; its `landed` is set on the frame a real move comes to rest
 * (and only while `moving` and not swimming).
 */
export function settleStep(track: SettleTrack, dx: number, dy: number, moving: number, swimming: boolean): SettleTrack {
  if (Math.abs(dx) >= SETTLE_STILL || Math.abs(dy) >= SETTLE_STILL) return { x: track.x + dx, y: track.y + dy, frames: track.frames + 1, landed: null };
  if (track.frames === 0) return track.landed ? SETTLE_IDLE : track;
  const travel = Math.hypot(track.x, track.y);
  const real = moving > 0 && !swimming && track.frames >= SETTLE_MIN_FRAMES && travel > SETTLE_MIN_TRAVEL;
  return real ? { x: 0, y: 0, frames: 0, landed: { x: track.x / travel, y: track.y / travel } } : SETTLE_IDLE;
}

/** The fastest the micro lift may make the arms trail (world units per second), so no single frame spikes. */
export const TRAIL_SPEED_MAX = 1;

/** How fast the micro lift moved this frame, for the arms' trail: 0 when nothing moves, and clamped. */
export function trailSpeed(lift: number, liftBefore: number, dt: number, moving: number): number {
  if (!(moving > 0) || !(dt > 0)) return 0;
  return moving * Math.min(TRAIL_SPEED_MAX, Math.max(-TRAIL_SPEED_MAX, (lift - liftBefore) / dt));
}

/**
 * Which way (+1 or -1, as ArmDrive.flare's sign) swings an arm's tip toward the body's middle
 * (`centerX`, `centerY`), given its root and tip. A flare turns the arm about its root, so a positive
 * one moves the tip square to the root-to-tip line, along (-(tipY - rootY), tipX - rootX); the sign
 * that shortens the tip's distance to the middle is inward. (Measured against the middle, not the
 * upright axis: an arm lying flat out to the side barely moves across, but rises toward the body.)
 * 0 when the middle lies on the arm's line.
 */
export function inwardSign(centerX: number, centerY: number, rootX: number, rootY: number, tipX: number, tipY: number): number {
  return -Math.sign((tipX - centerX) * (rootY - tipY) + (tipY - centerY) * (tipX - rootX));
}
