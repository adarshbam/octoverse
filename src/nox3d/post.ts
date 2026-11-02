import type { ContactShadowSettings } from './world/contactShadowEffect';

// Post-processing for the stage: contact shadows, then threshold-based bloom, then a vignette.
// There is deliberately no tone-mapping pass.

export const POST = {
  /**
   * Soft shadows where arms cross each other and pass under the head. The character sits about
   * 11.4 to 12.6 from the camera; the backdrop plate, at 15, is never shaded.
   */
  contactShadows: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.6, color: '#1a0418' } satisfies ContactShadowSettings,
  bloom: { luminanceThreshold: 0.66, luminanceSmoothing: 0.25, intensity: 1.05, radius: 0.85 },
  /** Darker corners in the 3D world: the ruin falls away into the dark, as in panel 2. */
  worldVignette: { offset: 0.3, darkness: 0.9 },
};
