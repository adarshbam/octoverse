import { assignPendants } from '../../engine/artifacts/pendant';
import { beadAngles, ringLineVisible, ringPoint } from '../../engine/artifacts/satellite';
import type { Box } from '../../engine/artifacts/suctionHold';
import { tetherCurve } from '../../engine/artifacts/tether';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS, type ArmId, type Point2 } from '../../engine/config/types';
import type { StagePose } from '../../engine/poses/types';
import type { StageFrame } from '../../engine/stage/framing';
import type { Vec3 } from '../../engine/world/types';
import { AETHER_ARTIFACTS } from './artifacts';
import { AETHER } from './character';
import { BODY_X } from './poses';

// Aether's frame criteria (Task 13), shared by frames.test.ts: where her face, her ring's beads and
// line, her hanging orbs and the intro's HTML land on a viewport, so a test can say that nothing of
// hers covers her face, the title or the nameplate in a frozen stage (spec 2.5), on the review
// desktop and on the 390 x 844 phone (spec 7.11). Test support only: nothing at runtime imports it.

/** The viewports checked: the review desktop and the phone held upright (spec 7.11). */
export const VIEWPORTS = { desktop: { width: 1536, height: 1024 }, phone: { width: 390, height: 844 } } as const;
export type ViewportName = keyof typeof VIEWPORTS;
export type Size = { width: number; height: number };

/**
 * The character's pivots, as character/Octopus.tsx draws her (module constants there; frames.test.ts
 * reads that file to hold these to it): the head turns and tilts about the neck (head-local height
 * NECK_Y, at the head's centre line), and the body yaws about PIVOT_Y on the swim's centre line.
 */
export const NECK_Y = -1.05;
export const PIVOT_Y = -0.6;
/** The swim's centre line, the one the body yaws about (swim.ts: her head's centre, poses.ts BODY_X). */
const SWIM_X = BODY_X;

const { head, face } = AETHER;
const { placement } = AETHER_ARTIFACTS;

/**
 * A point in her head's space (the space her head, face and ring are drawn in) on the stage, x, y, z:
 * tilted about the neck by the pose's tilt, yawed about the body's pivot by its yaw, scaled and
 * placed by its body (Octopus: float > swimTurn > turn > content > headTurn > headSpace). The gaze's
 * small turns and the idle drift are left out: a frozen still has none of the drift, and the gaze
 * only turns the head by a few hundredths of a radian.
 */
export function headToStage(pose: Pick<StagePose, 'body' | 'tilt'>, [x, y, z]: Vec3): Vec3 {
  const tilt = pose.tilt ?? 0;
  const { body } = pose;
  // The neck's tilt (about z), at the head's centre line.
  const nx = x - head.centerX, ny = y - NECK_Y;
  const tx = head.centerX + nx * Math.cos(tilt) - ny * Math.sin(tilt);
  const ty = NECK_Y + nx * Math.sin(tilt) + ny * Math.cos(tilt);
  // The body's yaw (about y), at the swim's pivot.
  const px = tx - SWIM_X;
  const yx = SWIM_X + px * Math.cos(body.yaw) + z * Math.sin(body.yaw);
  const yz = -px * Math.sin(body.yaw) + z * Math.cos(body.yaw);
  return [body.x + body.scale * yx, body.y + body.scale * ty, body.scale * yz];
}

/** A stage point (x, y, z) as the stage camera sees it on the z = 0 plane, and how much it is scaled there. */
export function seen([x, y, z]: Vec3): { x: number; y: number; f: number } {
  const f = CAMERA_Z / (CAMERA_Z - z);
  return { x: x * f, y: y * f, f };
}

/** CSS pixels per stage unit (on the z = 0 plane) once the stage camera frames `frame` in `size` (framing.ts fovFor: tall viewports widen). */
export function pixelsPerUnit(frame: StageFrame, size: Size) {
  const halfHeight = Math.max(frame.height, frame.width / (size.width / size.height)) / 2;
  return size.height / (2 * halfHeight);
}

/** A rectangle on the screen in CSS px, y down. */
export type Rect = { x0: number; y0: number; x1: number; y1: number };

/** A point on the z = 0 plane in CSS px from the viewport's top left. */
export function toScreen(x: number, y: number, frame: StageFrame, size: Size) {
  const ppu = pixelsPerUnit(frame, size);
  return { x: size.width / 2 + x * ppu, y: size.height / 2 - y * ppu };
}

/**
 * Her face (eyes, brows, blush and mouth) as a box in her head's space (Aether's face layout, about
 * the face origin). The mouth's bottom is the closed mouth's depth (face.mouth.depth): the happy and
 * curious faces open it a little lower, so their faces are a little taller than this box. The
 * open mouth's extra depth is not modelled here: the margins the tests ask for (over 20 px for a
 * held orb, over 10 px for a hanging one) are what cover it.
 */
export function faceBoxLocal(): Box {
  const [fx, fy] = head.faceOrigin;
  const { eye, blush, mouth, brow } = face;
  const xs = [...eye.centers.flatMap(([x]) => [x - eye.rx, x + eye.rx]), ...blush.centers.flatMap(([x]) => [x - blush.rx, x + blush.rx]), mouth.center[0] - mouth.halfWidth, mouth.center[0] + mouth.halfWidth, -brow.outer[0], brow.outer[0]];
  const ys = [...eye.centers.flatMap(([, y]) => [y - eye.ry, y + eye.ry]), ...blush.centers.flatMap(([, y]) => [y - blush.ry, y + blush.ry]), mouth.center[1] - mouth.depth - mouth.thickness, brow.control[1] + brow.thickness];
  return { x0: fx + Math.min(...xs), x1: fx + Math.max(...xs), y0: fy + Math.min(...ys), y1: fy + Math.max(...ys) };
}

/** The depth her face is painted at, in her head's space: the head's front. */
export const FACE_Z = head.depth * head.halfWidth;

/** Her face's box on the screen in a pose (its corners at the head's front, turned, tilted and seen), in CSS px. */
export function faceRect(pose: Pick<StagePose, 'body' | 'tilt'>, frame: StageFrame, size: Size): Rect {
  const b = faceBoxLocal();
  const corners = ([[b.x0, b.y0], [b.x0, b.y1], [b.x1, b.y0], [b.x1, b.y1]] as const).map(([x, y]) => {
    const s = seen(headToStage(pose, [x, y, FACE_Z]));
    return toScreen(s.x, s.y, frame, size);
  });
  return { x0: Math.min(...corners.map(c => c.x)), x1: Math.max(...corners.map(c => c.x)), y0: Math.min(...corners.map(c => c.y)), y1: Math.max(...corners.map(c => c.y)) };
}

/** A disc on the screen (CSS px): centre and radius, and whether it is in front of the head's middle (z above the head's centre). */
export type Disc = { x: number; y: number; r: number; front: boolean; name: string };

/** The head's centre on the stage (its z, for what is in front of it). */
const headCentreZ = (pose: Pick<StagePose, 'body' | 'tilt'>) => headToStage(pose, [head.centerX, (head.top + head.bottom) / 2, 0])[2];

/** The ring's beads at time `t` (seconds; frozen stills stand them at their homes), as discs on the screen. */
export function beadDiscs(pose: Pick<StagePose, 'body' | 'tilt'>, frame: StageFrame, size: Size, t: number, still: boolean): Disc[] {
  const ppu = pixelsPerUnit(frame, size);
  const zMid = headCentreZ(pose);
  return beadAngles(t, placement.ring, still).map((angle, i) => {
    const [x, y, z] = ringPoint(angle, placement.ring);
    const p = headToStage(pose, [x + head.centerX, y, z]);
    const s = seen(p);
    const at = toScreen(s.x, s.y, frame, size);
    return { ...at, r: placement.ring.beadSize * pose.body.scale * s.f * ppu, front: p[2] > zMid, name: `bead ${i}` };
  });
}

/** The ring line's drawn points (where it shows: outside the keep-out's fade), on the screen, each with whether it is in front of the head's middle. */
export function ringLinePoints(pose: Pick<StagePose, 'body' | 'tilt'>, frame: StageFrame, size: Size, steps = 360): { x: number; y: number; front: boolean }[] {
  const zMid = headCentreZ(pose);
  const out: { x: number; y: number; front: boolean }[] = [];
  for (let k = 0; k < steps; k++) {
    const angle = (2 * Math.PI * k) / steps;
    if (ringLineVisible(angle, placement.ring) <= 0) continue;
    const [x, y, z] = ringPoint(angle, placement.ring);
    const p = headToStage(pose, [x + head.centerX, y, z]);
    const s = seen(p);
    out.push({ ...toScreen(s.x, s.y, frame, size), front: p[2] > zMid });
  }
  return out;
}

/** The ring's widest extent on the screen, in CSS px (its projected half-width), and her head's (half its width). */
export function ringAndHeadHalfWidths(pose: Pick<StagePose, 'body' | 'tilt'>, frame: StageFrame, size: Size) {
  const xs = Array.from({ length: 360 }, (_, k) => {
    const [x, y, z] = ringPoint((2 * Math.PI * k) / 360, placement.ring);
    return toScreen(seen(headToStage(pose, [x + head.centerX, y, z])).x, 0, frame, size).x;
  });
  const hx = [-1, 1].map(side => toScreen(seen(headToStage(pose, [head.centerX + side * head.halfWidth, head.waist, 0])).x, 0, frame, size).x);
  return { ring: (Math.max(...xs) - Math.min(...xs)) / 2, head: Math.abs(hx[1] - hx[0]) / 2 };
}

/** A pose's arms as the rig draws them at rest (the pose's curves with her rest bend), root first, in the arms' space. */
export function drawnArms(pose: Pick<StagePose, 'arms'>): Record<ArmId, Point2[]> {
  return Object.fromEntries(ARM_IDS.map((id, i) => {
    const chain = new ArmChain(restFromCurve(pose.arms[id]), AETHER.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: AETHER.armBend });
    return [id, Array.from({ length: chain.segments + 1 }, (_, k) => [chain.px[k], chain.py[k]] as Point2)];
  })) as Record<ArmId, Point2[]>;
}

/** The point at arc fraction `at` on a drawn arm (its points are equal lengths apart). */
export function along(line: readonly Point2[], at: number): Vec3 {
  const f = Math.min(1, Math.max(0, at)) * (line.length - 1);
  const k = Math.min(line.length - 2, Math.floor(f));
  const w = f - k;
  return [line[k][0] * (1 - w) + line[k + 1][0] * w, line[k][1] * (1 - w) + line[k + 1][1] * w, 0];
}

/**
 * The overview's hanging orbs and their threads for `count` technologies, frozen (hanging straight
 * down, as every still holds them), on the screen: each orb a disc, each thread its points as tiny
 * discs. The arms are the pose's (the overview's, or the tech focus's whose orbs hang from the same
 * slots); the arms' space is the stage's at the body's place and scale (no yaw or tilt in either).
 */
export function hangingDiscs(pose: Pick<StagePose, 'arms' | 'body'>, count: number, frame: StageFrame, size: Size): Disc[] {
  const arms = drawnArms(pose);
  const radius = placement.sizes!.overview;
  const ppu = pixelsPerUnit(frame, size);
  const { body } = pose;
  const out: Disc[] = [];
  for (const { slot } of assignPendants(count, placement.slots!.overview).placed) {
    const { points, orbCentre } = tetherCurve(along(arms[slot.arm], slot.at), 0, placement.tether!, radius);
    const at = (p: readonly number[]) => toScreen(body.x + body.scale * p[0], body.y + body.scale * p[1], frame, size);
    out.push({ ...at(orbCentre), r: radius * body.scale * ppu, front: true, name: `${slot.arm}@${slot.at} orb` });
    for (const p of points) out.push({ ...at(p), r: 0.5 * placement.tether!.width * ppu, front: true, name: `${slot.arm}@${slot.at} thread` });
  }
  return out;
}

/**
 * The intro's HTML on the screen (CSS px): the title block and the nameplate, laid out on the square
 * stage of side min(100vw, 100vh), centred (ui/intro.css): the kicker from 19.6% down, the description
 * ending at 35.6% + 2 lines x 2.05% x 1.32 = 41.0%, as wide as her title box (bundle.ts
 * AETHER_INTRO_TITLE: the widest line's half-width 1.16 at P2's 100 px a unit, so 2 x 116 / 514 of the
 * stage); the nameplate 27.2% x 8.9% about 92% down.
 */
export function introHtml(size: Size, titleHalfWidth: number, frameWidth: number): { title: Rect; nameplate: Rect } {
  const side = Math.min(size.width, size.height);
  const left = (size.width - side) / 2, top = (size.height - side) / 2;
  const half = (titleHalfWidth / frameWidth) * side;
  return {
    title: { x0: size.width / 2 - half, x1: size.width / 2 + half, y0: top + 0.196 * side, y1: top + 0.41 * side },
    nameplate: { x0: left + (0.5 - 0.136) * side, x1: left + (0.5 + 0.136) * side, y0: top + (0.92 - 0.0445) * side, y1: top + (0.92 + 0.0445) * side },
  };
}

/** How far a disc's edge is outside a rectangle (CSS px; below 0 it overlaps). */
export const discClear = (d: { x: number; y: number; r: number }, rect: Rect) => Math.hypot(Math.max(rect.x0 - d.x, 0, d.x - rect.x1), Math.max(rect.y0 - d.y, 0, d.y - rect.y1)) - d.r;

/** The rectangle the phone's overview keeps for its bottom sheet and the tray riding above it (Veyra's Task 14 measure: a 168 px sheet, 48 px buttons in rows of six, 8 px apart, 12 px under). */
export function phoneSheetAndTray(size: Size, techCount: number): Rect {
  const tray = 12 + Math.ceil(techCount / 6) * 56;
  return { x0: 0, x1: size.width, y0: size.height - (168 + tray), y1: size.height };
}
