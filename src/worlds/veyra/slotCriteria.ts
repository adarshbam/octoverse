import { armPoint, assignPendants, swingLimits, threadClearance, type ClearanceGeometry } from '../../engine/artifacts/pendant';
import type { Box } from '../../engine/artifacts/suctionHold';
import { tetherCurve } from '../../engine/artifacts/tether';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { armRadius } from '../../engine/character/armTube';
import { ARM_IDS, type ArmId, type ChoosingStage, type PendantPlacement, type PendantSlot, type Point2 } from '../../engine/config/types';
import type { StageFrame } from '../../engine/stage/framing';
import type { StagePose } from '../../engine/poses/types';
import { VEYRA_ARTIFACTS } from './artifacts';
import { VEYRA } from './character';

// Veyra's slot criteria (Task 14), shared by artifacts.test.ts and the review notes: what a pendant
// must keep clear of, measured in a stage's own arm space (the space the pose's arms are authored
// in: the stage minus the body, over its scale). Test support only: nothing at runtime imports it.

/** The viewports the slots are checked at: the review desktop and the phone held upright (spec 7.11). */
export const VIEWPORTS = { desktop: { width: 1536, height: 1024 }, phone: { width: 390, height: 844 } } as const;
export type ViewportName = keyof typeof VIEWPORTS;

/** The swing envelope a placement's pendants can reach: straight down, half way and its limit, both ways (spec 7.5: at most 25 degrees). */
export const envelopeFor = (placement: PendantPlacement): readonly number[] => [-1, -0.5, 0, 0.5, 1].map(f => f * swingLimits(placement).maxAngle);

/** Veyra's swing envelope (her placement's limits). */
export const ENVELOPE: readonly number[] = envelopeFor(VEYRA_ARTIFACTS.placement);

/** The slots `shown` technologies hang from (the first `shown` in fill order, as the engine assigns them). */
export const shownSlots = (slots: readonly PendantSlot[], shown: number): PendantSlot[] => assignPendants(shown, slots).placed.map(p => p.slot);

/** The face's box in a stage's own arm space: the head's, or the dome the head opens into in the overview. */
export function faceBox(stage: ChoosingStage): Box {
  if (stage === 'overview') {
    const { center, halfWidth, halfHeight } = VEYRA.dome;
    return { x0: center[0] - halfWidth, y0: center[1] - halfHeight, x1: center[0] + halfWidth, y1: center[1] + halfHeight };
  }
  const { head } = VEYRA;
  return { x0: head.centerX - head.halfWidth, y0: head.bottom, x1: head.centerX + head.halfWidth, y1: head.top };
}

/** World units per CSS pixel once the stage camera frames `frame` in `size` (fovFor: tall viewports widen, nothing is cropped). */
export function worldPerPixel(frame: StageFrame, size: { width: number; height: number }) {
  const halfHeight = Math.max(frame.height, frame.width / (size.width / size.height)) / 2;
  return (2 * halfHeight) / size.height;
}

/** A stage box (world units, y up) into the pose's arm space. */
const toArmSpace = (pose: Pick<StagePose, 'body'>, [x0, y0, x1, y1]: readonly [number, number, number, number]): Box => {
  const { x, y, scale } = pose.body;
  return { x0: (x0 - x) / scale, x1: (x1 - x) / scale, y0: (y1 - y) / scale, y1: (y0 - y) / scale };
};

/**
 * The HTML a pendant must not hang under, in the stage's arm space at a viewport. The intro: the
 * title block and the nameplate, laid out on the square stage of side min(100vw, 100vh) (ui/intro.css:
 * the kicker from 19.6% down, the two description lines ending at 35.6% + 2 x 2.05 x 1.32 = 41.0%, the
 * widest line 50.2% of the side across, measured on the Task 13 still at 1536 x 1024; the nameplate
 * 27.2% x 8.9% about 92% down), centred on the stage camera's axis. The overview on a phone: the
 * bottom sheet (168 px) with the tray riding 12 px above it (48 px buttons); on a wider screen the
 * panel sits inside the dome (the face box already holds it). On a phone the tray lists every
 * technology in rows of six (48 px buttons, 8 px apart: measured on the Task 14 390 x 844 still,
 * twelve technologies in two rows, the tray's top 282 px above the bottom); `techCount`, the number
 * of technologies the world shows, sets the rows (13 to 18 make three). The intro's tray on a phone
 * (12 px from the bottom) is far below her and kept too.
 */
export function htmlBoxes(stage: ChoosingStage, pose: Pick<StagePose, 'body'>, frame: StageFrame, viewport: ViewportName, techCount: number): Box[] {
  const size = VIEWPORTS[viewport];
  const wpp = worldPerPixel(frame, size);
  const halfW = (size.width * wpp) / 2;
  const halfH = (size.height * wpp) / 2;
  const boxes: (readonly [number, number, number, number])[] = [];
  const tray = 12 + Math.ceil(techCount / 6) * 56;
  if (stage === 'intro') {
    const side = Math.min(size.width, size.height) * wpp;
    const at = (f: number) => (0.5 - f) * side;
    boxes.push([-0.255 * side, at(0.196), 0.255 * side, at(0.41)]);
    boxes.push([-0.136 * side, at(0.92 - 0.0445), 0.136 * side, at(0.92 + 0.0445)]);
    if (viewport === 'phone') boxes.push([-halfW, -halfH + tray * wpp, halfW, -halfH]);
  } else if (viewport === 'phone') {
    boxes.push([-halfW, -halfH + (168 + tray) * wpp, halfW, -halfH]);
  }
  return boxes.map(box => toArmSpace(pose, box));
}

/**
 * The arms' centre lines as the rig draws them in a still: the pose's rest curves with the
 * character's rest bend (what `Octopus` solves each arm to with no motion), root first.
 */
export function drawnArms(pose: Pick<StagePose, 'arms'>): Record<ArmId, Point2[]> {
  const known = drawn.get(pose.arms);
  if (known) return known;
  const lines = Object.fromEntries(ARM_IDS.map((id, i) => {
    const chain = new ArmChain(restFromCurve(pose.arms[id]), VEYRA.arms.find(a => a.id === id)!, i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: VEYRA.armBend });
    return [id, Array.from({ length: chain.segments + 1 }, (_, k) => [chain.px[k], chain.py[k]] as Point2)];
  })) as Record<ArmId, Point2[]>;
  drawn.set(pose.arms, lines);
  return lines;
}

/** The drawn arms worked out once per pose's arm table. */
const drawn = new WeakMap<object, Record<ArmId, Point2[]>>();

/** An arm's thickness at arc fraction `u`, Veyra's. */
export const veyraArmRadius = (arm: ArmId, u: number) => armRadius(u, VEYRA.arms.find(a => a.id === arm)!, VEYRA);

/** The geometry a stage's clearance is measured with: her thread, the stage's orb, her arms as drawn and their thickness, at `angles`. */
export function geometryFor(pose: Pick<StagePose, 'arms'>, placement: Pick<PendantPlacement, 'tether' | 'sizes'>, stage: ChoosingStage, angles: readonly number[] = [0]): ClearanceGeometry {
  return { armLines: drawnArms(pose), style: placement.tether, radius: placement.sizes[stage], armRadius: veyraArmRadius, angles };
}

/**
 * The least clearance of a stage's pendants from every other arm, the face, and the HTML at a
 * viewport (`threadClearance` once per box: each call also measures the arms), across `angles`,
 * with `shown` technologies: the first `shown` slots hang an orb, and the phone's tray is sized for
 * `shown` (it lists every technology), so the count is measured as it would be laid out.
 */
export function stageClearance(pose: StagePose, slots: readonly PendantSlot[], placement: Pick<PendantPlacement, 'tether' | 'sizes'>, stage: ChoosingStage, frame: StageFrame, viewport: ViewportName, shown: number, angles: readonly number[] = ENVELOPE): number {
  const geometry = geometryFor(pose, placement, stage, angles);
  const hung = shownSlots(slots, shown);
  return Math.min(...[faceBox(stage), ...htmlBoxes(stage, pose, frame, viewport, shown)].map(box => threadClearance(pose, hung, box, geometry)));
}

/** How far along its own arm (world units of arc) a pendant's orb is let near the arm it hangs from: the stretch round the attach point it hangs under. */
export const OWN_ARM_SKIP = 0.3;

/**
 * The least distance from each pendant's orb to its OWN arm away from the attach point (more than
 * OWN_ARM_SKIP of arc either side), arm thickness taken off, across `angles`: below 0 an orb sits on
 * the arm it hangs from (the curl above it, or the arm running on below a mid-arm slot).
 */
export function ownArmClearance(pose: Pick<StagePose, 'arms'>, slots: readonly PendantSlot[], placement: Pick<PendantPlacement, 'tether' | 'sizes'>, stage: ChoosingStage, angles: readonly number[] = ENVELOPE): number {
  const lines = drawnArms(pose);
  const radius = placement.sizes[stage];
  let least = Infinity;
  for (const slot of slots) {
    const line = lines[slot.arm];
    const arc = [0];
    for (let k = 1; k < line.length; k++) arc.push(arc[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]));
    const total = arc[arc.length - 1];
    const [ax, ay] = armPoint(line, slot.at);
    const atArc = slot.at * total;
    for (const angle of angles) {
      const { orbCentre } = tetherCurve([ax, ay, 0], angle, placement.tether, radius);
      for (let k = 0; k < line.length; k++) {
        if (Math.abs(arc[k] - atArc) <= OWN_ARM_SKIP) continue;
        least = Math.min(least, Math.hypot(line[k][0] - orbCentre[0], line[k][1] - orbCentre[1]) - radius - veyraArmRadius(slot.arm, k / (line.length - 1)));
      }
    }
  }
  return least;
}

/** The orbs' centres at rest on the arms as drawn. */
export function orbCentres(pose: Pick<StagePose, 'arms'>, slots: readonly PendantSlot[], placement: Pick<PendantPlacement, 'tether' | 'sizes'>, stage: ChoosingStage, angle = 0): Point2[] {
  const lines = drawnArms(pose);
  return slots.map(slot => {
    const [x, y] = armPoint(lines[slot.arm], slot.at);
    const c = tetherCurve([x, y, 0], angle, placement.tether, placement.sizes[stage]).orbCentre;
    return [c[0], c[1]] as Point2;
  });
}

/** The least gap between two orbs' surfaces at rest. */
export function leastOrbGap(pose: Pick<StagePose, 'arms'>, slots: readonly PendantSlot[], placement: Pick<PendantPlacement, 'tether' | 'sizes'>, stage: ChoosingStage): number {
  const centres = orbCentres(pose, slots, placement, stage);
  let least = Infinity;
  for (let i = 0; i < centres.length; i++) {
    for (let j = i + 1; j < centres.length; j++) least = Math.min(least, Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]) - 2 * placement.sizes[stage]);
  }
  return least;
}
