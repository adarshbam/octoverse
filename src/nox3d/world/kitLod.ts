// The kit's level-of-detail line, read by Kit.tsx and by the test that pins it to the intro camera.

/**
 * Beyond this distance from the camera a piece draws its `_lod1`, about a quarter of the triangles.
 * 16 keeps the intro's front lit pillars (14.05 and 14.32 units from the panel 2 camera) at full
 * detail, with room for a camera hover (ruling R28).
 */
export const KIT_LOD_DISTANCE = 16;
/** Back to full detail only inside 3% less, so a piece on the line does not flicker as the camera hovers. */
export const LOD_HYSTERESIS = 0.03;
