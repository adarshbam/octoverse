import { armPoint, assignPendants, threadClearance, type ClearanceGeometry } from '../../engine/artifacts/pendant';
import type { Box } from '../../engine/artifacts/suctionHold';
import { tetherCurve } from '../../engine/artifacts/tether';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { armRadius } from '../../engine/character/armTube';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS, type ArmId, type PendantPlacement, type PendantSlot, type Point2 } from '../../engine/config/types';
import type { StageFrame, WorldBox } from '../../engine/stage/framing';
import type { StagePose } from '../../engine/poses/types';
import { FLUX } from './character';

// Flux's slot criteria (Task 12), shared by artifacts.test.ts and the review notes: what a pendant
// orb must keep clear of in the overview. Test support only: nothing at runtime imports it. Veyra
// has her own (a world may not import another), measured the same way: in the pose's own arm space
// against the other arms as the rig draws them and the face, and on the stage plane against the HTML.

/** The viewports the slots are checked at: the review desktop and the phone held upright (spec 7.11). */
export const VIEWPORTS = { desktop: { width: 1536, height: 1024 }, phone: { width: 390, height: 844 } } as const;
export type ViewportName = keyof typeof VIEWPORTS;

/**
 * The face in the head's own space (the arms' space too): the eyes (x +-0.37 +- 0.165, y -0.54 +-
 * 0.175), the blush out to x +-0.64, the brows up to -0.11 and the open smile down to -0.89 (P2's
 * mouth bottom; character.ts face). The overview opens the head into the dome but keeps the face here.
 */
export const FACE_RECT: Box = { x0: -0.64, y0: -0.89, x1: 0.64, y1: -0.11 };

/** The slots `shown` technologies hang from (the first `shown` in fill order, as the engine assigns them). */
export const shownSlots = (slots: readonly PendantSlot[], shown: number): PendantSlot[] => assignPendants(shown, slots).placed.map(p => p.slot);

/** The arms' centre lines as the rig draws them in a still (rest curves plus the rest bend), with each point's depth. */
export function drawnChains(pose: Pick<StagePose, 'arms'>): Record<ArmId, ArmChain> {
  const known = drawn.get(pose.arms);
  if (known) return known;
  const chains = Object.fromEntries(ARM_IDS.map((id, i) => {
    const chain = new ArmChain(restFromCurve(pose.arms[id]), FLUX.arms.find(a => a.id === id)!, i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: FLUX.armBend });
    return [id, chain];
  })) as Record<ArmId, ArmChain>;
  drawn.set(pose.arms, chains);
  return chains;
}
const drawn = new WeakMap<object, Record<ArmId, ArmChain>>();

const lineOf = (chain: ArmChain): Point2[] => Array.from(chain.px, (x, k) => [x, chain.py[k]] as Point2);

/** Flux's arm thickness at arc fraction `u`. */
export const fluxArmRadius = (arm: ArmId, u: number) => armRadius(u, FLUX.arms.find(a => a.id === arm)!, FLUX);

/** What the clearance is measured with: the placement's tether and overview orb, the arms as drawn and their thickness, at `angles` from straight down. */
export function geometryFor(pose: Pick<StagePose, 'arms'>, placement: Pick<PendantPlacement, 'tether' | 'sizes'>, angles: readonly number[] = [0]): ClearanceGeometry {
  const chains = drawnChains(pose);
  return { armLines: Object.fromEntries(ARM_IDS.map(id => [id, lineOf(chains[id])])) as Record<ArmId, Point2[]>, style: placement.tether, radius: placement.sizes.overview, armRadius: fluxArmRadius, angles };
}

/** World units per CSS pixel once the stage camera frames `frame` in `size` (fovFor: tall viewports widen, nothing is cropped). */
export function worldPerPixel(frame: StageFrame, size: { width: number; height: number }) {
  return Math.max(frame.height, frame.width / (size.width / size.height)) / size.height;
}

/** A stage box [left, top, right, bottom] into the pose's arm space. */
const toArmSpace = (pose: Pick<StagePose, 'body'>, [x0, y1, x1, y0]: WorldBox): Box => {
  const { x, y, scale } = pose.body;
  return { x0: (x0 - x) / scale, x1: (x1 - x) / scale, y0: (y0 - y) / scale, y1: (y1 - y) / scale };
};

/**
 * The overview's HTML a pendant must not hang over, in the pose's arm space, at a viewport: the
 * project panel (the title, copy and buttons) inside the dome on a wider screen; on a phone the
 * panel is a sheet along the bottom (168 px) with the tray of every technology riding 12 px above
 * it in rows of six 48 px buttons 8 px apart (measured on the Task 12 390 x 844 still: the tray's
 * top 289 px above the bottom for twelve).
 */
export function htmlBoxes(pose: Pick<StagePose, 'body'>, panel: WorldBox, frame: StageFrame, viewport: ViewportName, techCount: number): Box[] {
  if (viewport !== 'phone') return [toArmSpace(pose, panel)];
  const size = VIEWPORTS[viewport];
  const wpp = worldPerPixel(frame, size);
  const halfW = (size.width * wpp) / 2;
  const halfH = (size.height * wpp) / 2;
  const covered = 168 + 12 + Math.ceil(techCount / 6) * 56;
  return [toArmSpace(pose, [-halfW, -halfH + covered * wpp, halfW, -halfH])];
}

/** The least clearance of the shown pendants from every other arm, the face and the given boxes (threadClearance once per box). */
export function clearance(pose: StagePose, slots: readonly PendantSlot[], placement: Pick<PendantPlacement, 'tether' | 'sizes'>, shown: number, boxes: readonly Box[], angles: readonly number[] = [0]): number {
  const geometry = geometryFor(pose, placement, angles);
  const hung = shownSlots(slots, shown);
  return Math.min(...[FACE_RECT, ...boxes].map(box => threadClearance(pose, hung, box, geometry)));
}

/** An orb as the camera sees it on the stage plane: its centre and radius after perspective (it hangs at its arm's depth). */
export interface SeenOrb {
  slot: PendantSlot;
  x: number;
  y: number;
  r: number;
}

/** The shown orbs at rest, seen on the stage plane (the overview's camera at CAMERA_Z; z toward it shows larger). */
export function seenOrbs(pose: StagePose, slots: readonly PendantSlot[], placement: Pick<PendantPlacement, 'tether' | 'sizes'>, shown: number): SeenOrb[] {
  const chains = drawnChains(pose);
  const { x: bx, y: by, scale } = pose.body;
  const at = { x: 0, y: 0, z: 0 };
  return shownSlots(slots, shown).map(slot => {
    chains[slot.arm].pointAt(slot.at, at);
    const { orbCentre } = tetherCurve([at.x, at.y, at.z], 0, placement.tether, placement.sizes.overview);
    const f = CAMERA_Z / (CAMERA_Z - at.z);
    return { slot, x: bx + scale * orbCentre[0] * f, y: by + scale * orbCentre[1] * f, r: scale * placement.sizes.overview * f };
  });
}

/** The face rect as seen on the stage plane: the face sits at the front of the head (its depth times its half width). */
export function seenFace(pose: Pick<StagePose, 'body'>): Box {
  const f = CAMERA_Z / (CAMERA_Z - FLUX.head.depth * FLUX.head.halfWidth * pose.body.scale);
  const { x, y, scale } = pose.body;
  return { x0: x + scale * FACE_RECT.x0 * f, x1: x + scale * FACE_RECT.x1 * f, y0: y + scale * FACE_RECT.y0 * f, y1: y + scale * FACE_RECT.y1 * f };
}

/** How far a seen orb's edge is outside a stage box (below 0: it overlaps). */
export const outsideBox = (orb: SeenOrb, box: Box) => Math.hypot(Math.max(box.x0 - orb.x, 0, orb.x - box.x1), Math.max(box.y0 - orb.y, 0, orb.y - box.y1)) - orb.r;

/** The least gap between two seen orbs. */
export function leastOrbGap(orbs: readonly SeenOrb[]): number {
  let least = Infinity;
  for (let i = 0; i < orbs.length; i++) for (let j = i + 1; j < orbs.length; j++) least = Math.min(least, Math.hypot(orbs[i].x - orbs[j].x, orbs[i].y - orbs[j].y) - orbs[i].r - orbs[j].r);
  return least;
}

/** How far a stage point is outside the overview dome's outline (its z = 0 superellipse, placed by the body): below 0 inside it. */
export function outsideDome(pose: Pick<StagePose, 'body'>, orb: SeenOrb, steps = 720): number {
  const { center, halfWidth, halfHeight, power } = FLUX.dome;
  const { x, y, scale } = pose.body;
  const bend = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / power);
  const nx = (orb.x - x - scale * center[0]) / (scale * halfWidth);
  const ny = (orb.y - y - scale * center[1]) / (scale * halfHeight);
  const inside = Math.abs(nx) ** power + Math.abs(ny) ** power < 1;
  let least = Infinity;
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    least = Math.min(least, Math.hypot(x + scale * (center[0] + halfWidth * bend(Math.cos(a))) - orb.x, y + scale * (center[1] + halfHeight * bend(Math.sin(a))) - orb.y));
  }
  return inside ? -least - orb.r : least - orb.r;
}

/** The point on an arm's drawn line at arc fraction `at`, on the stage (no perspective). */
export function slotPoint(pose: StagePose, slot: PendantSlot): Point2 {
  const [x, y] = armPoint(lineOf(drawnChains(pose)[slot.arm]), slot.at);
  return [pose.body.x + pose.body.scale * x, pose.body.y + pose.body.scale * y];
}
