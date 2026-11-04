import type { StageFrame } from '../../engine/stage/framing';
import { layoutFor } from '../../engine/stage/framing';
import { type FaceStage, type WorldBundle, faceAnchor } from '../../engine/types/bundle';
import type { HowItWorksCard } from '../../worlds/octoverse/poses';

// Where things stand on the screen: stage units (the engine's z = 0 plane, +y up, the stage's centre
// at the origin) to CSS pixels. The engine's stage camera sits on the z axis and fits the frame
// without cropping (`fovFor`: half the viewport height is the larger of half the frame's height and
// half its width over the aspect), so on the z = 0 plane a unit is `height / (2 x that)` pixels and the
// centre of the box is the origin: the same numbers `stageBoxFor` (engine/ui/useStageBox) works out
// with a camera, written out here so a page can use them without one (and a test can check them).

export interface Size {
  width: number;
  height: number;
}
/** A rectangle in CSS pixels from the host box's top-left corner (which is the window's on every layout). */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export type WorldBox = readonly [number, number, number, number];

/** The share of a phone's height the host takes (spec 7.15); the CSS (landing.css `--oct-host-share`) says the same. */
export const PHONE_HOST_SHARE = 0.55;

/** The host's box: the whole window, except on a phone, where it is the upper 55%. */
export function hostBox(win: Size): Size & { phone: boolean } {
  const phone = layoutFor(win) === 'phone';
  return { width: win.width, height: phone ? Math.round(win.height * PHONE_HOST_SHARE) : win.height, phone };
}

/** Pixels per stage unit on the z = 0 plane, once the stage camera has framed `frame` in `box`. */
export function pixelsPerUnit(frame: StageFrame, box: Size): number {
  const halfHeight = Math.max(frame.height, frame.width / (box.width / box.height)) / 2;
  return box.height / (2 * halfHeight);
}

/** A stage box [x0, y0, x1, y1] (top above bottom) as pixels in `box`. */
export function stageRect(frame: StageFrame, box: Size, [x0, y0, x1, y1]: WorldBox) {
  const k = pixelsPerUnit(frame, box);
  return { left: box.width / 2 + x0 * k, top: box.height / 2 - y0 * k, width: (x1 - x0) * k, height: (y0 - y1) * k };
}

/** A stage point as pixels in `box`. */
export function stagePoint(frame: StageFrame, box: Size, x: number, y: number) {
  const k = pixelsPerUnit(frame, box);
  return { x: box.width / 2 + x * k, y: box.height / 2 - y * k };
}

/** A How It Works card's rectangle in `box`. */
export function cardRect(card: HowItWorksCard, frame: StageFrame, box: Size): Rect {
  const { x0, y0, x1, y1 } = card.box;
  const r = stageRect(frame, box, [x0, y0, x1, y1]);
  return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
}

// The host's face, in stage units about its face anchor. The anchor sits on the eye line (character.ts
// FACE_ORIGIN puts the face origin 0.46 below the stage's centre and `faceAnchor` takes 0.1 off it: the
// intro's anchor is (0, -0.56), P2's eye line). From the character's face layout (P2's): eyes at
// x +-0.39 with a 0.155 radius (the lids and lashes reach 0.21), the mouth's open D from 0.15 to 0.38
// below the eye line and about +-0.16 wide (0.30 allows for the smile's reach). Everything is scaled
// with the body and turned with the head's tilt about the anchor.
const EYE_X = 0.39;
const EYE_HALF = 0.22;
const MOUTH_DROP = 0.29;
const MOUTH_HALF_W = 0.3;
const MOUTH_HALF_H = 0.14;

/**
 * The head turns about its neck, not about the face: the pivot lies this far below the eye line (the
 * measured render in How It Works, tilt -0.19, has the eyes 0.08 to 0.09 right of where a turn about
 * the eye line puts them), so a turned face is carried sideways as well as turned.
 */
const NECK_DROP = 0.5;

/** A box centred on `(cx, cy)` with half extents, turned by `tilt` (counter-clockwise, y up) about the neck's pivot, as the box that holds it. */
function turned(cx: number, cy: number, hw: number, hh: number, tilt: number, pivotY: number) {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const dy = cy - pivotY;
  const x = cx * c - dy * s;
  const y = pivotY + cx * s + dy * c;
  const w = hw * Math.abs(c) + hh * Math.abs(s);
  const h = hw * Math.abs(s) + hh * Math.abs(c);
  return { x0: x - w, x1: x + w, y0: y + h, y1: y - h };
}

/** The face's parts as stage boxes [x0, y0, x1, y1] on the stage plane: the two eyes (left, right) and the mouth. */
export function faceBoxes(bundle: Pick<WorldBundle, 'character' | 'poses'>, stage: FaceStage): { eyes: [WorldBox, WorldBox]; mouth: WorldBox; anchor: readonly [number, number, number] } {
  const anchor = faceAnchor(bundle, stage);
  const pose = bundle.poses[stage];
  const scale = pose.body.scale;
  const tilt = pose.tilt ?? 0;
  const place = (cx: number, cy: number, hw: number, hh: number): WorldBox => {
    const t = turned(cx * scale, cy * scale, hw * scale, hh * scale, tilt, -NECK_DROP * scale);
    return [anchor[0] + t.x0, anchor[1] + t.y0, anchor[0] + t.x1, anchor[1] + t.y1];
  };
  return {
    eyes: [place(-EYE_X, 0, EYE_HALF, EYE_HALF), place(EYE_X, 0, EYE_HALF, EYE_HALF)],
    mouth: place(0, -MOUTH_DROP, MOUTH_HALF_W, MOUTH_HALF_H),
    anchor,
  };
}

/**
 * The face's parts in pixels in `box` (before the live camera's shift, which the caller adds).
 *
 * These are projected on the stage plane (z = 0), but the face is drawn on the head's front, at the
 * anchor's z of about 0.71 (`faceAnchor`; character.ts FACE_DEPTH 1.05 is the same effect). The camera
 * is 12 units out, so the real face is magnified by 12 / (12 - 0.71) = 1.063 about the screen's centre:
 * its parts lie 6% further out from the centre than these boxes say (the intro's eyes 0.025 further
 * sideways and 0.035 lower; the overview's face, lower on the stage, 0.07 lower), and a little larger.
 * The model does not apply that. The boxes are padded to absorb it instead: the eyes' 0.22 half
 * size against a 0.155 radius plus lashes (0.065 of room, 13 px at 1536 x 1024), the mouth's
 * 0.30 x 0.14 half size against about 0.16 x 0.115 drawn (0.14 sideways, 0.025 above and below).
 * The mouth's vertical room is the thinnest; the six stills (overlay drawn from `window.__platform`)
 * show every box enclosing its eye or mouth, and the specs' clearances are 49 px or more, so the few
 * pixels of perspective cannot bring a card or a line of text onto the face.
 */
export function faceRects(frame: StageFrame, box: Size, bundle: Pick<WorldBundle, 'character' | 'poses'>, stage: FaceStage): { eyes: [Rect, Rect]; mouth: Rect } {
  const { eyes, mouth } = faceBoxes(bundle, stage);
  const rect = (b: WorldBox): Rect => {
    const r = stageRect(frame, box, b);
    return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
  };
  return { eyes: [rect(eyes[0]), rect(eyes[1])], mouth: rect(mouth) };
}
