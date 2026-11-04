// The stage camera: perspective, on the z axis, framing the intro stage (panel 2).

/** Camera distance from the z = 0 plane the stages are traced in. */
export const CAMERA_Z = 12;
/** World units from stage centre to the top edge (panel 2 is 504 px = 5.04 units tall). */
export const STAGE_HALF = 2.52;

/**
 * The sub-window of the stage frame that shows world box [x0, y0, x1, y1] on a canvas of the
 * given size, for `camera.setViewOffset`. The camera does not move, so a zoomed view is an
 * exact magnification of the stage, with the same perspective on things in front of or behind
 * the traced plane.
 */
export function viewWindow([x0, y0, x1, y1]: readonly [number, number, number, number], width: number, height: number) {
  const pxPerUnit = Math.min(width / (x1 - x0), height / (y0 - y1));
  const fullHeight = 2 * STAGE_HALF * pxPerUnit;
  const fullWidth = fullHeight * (width / height);
  return {
    fullWidth,
    fullHeight,
    x: fullWidth / 2 + ((x0 + x1) / 2) * pxPerUnit - width / 2,
    y: fullHeight / 2 - ((y0 + y1) / 2) * pxPerUnit - height / 2,
    width,
    height,
  };
}
