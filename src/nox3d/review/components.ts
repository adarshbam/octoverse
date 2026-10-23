export type ComponentId = 'full' | 'mantle' | 'junction' | 'brows' | 'eyes' | 'mouth' | 'arms-left' | 'arms-right' | 'curl' | 'suckers' | 'skin';

/** Where each character component sits in panel 2, as a world box [x0, y0, x1, y1]. */
export const COMPONENT_VIEWS: Record<ComponentId, { panel: 2; box: [number, number, number, number]; label: string }> = {
  full: { panel: 2, box: [-2.53, 2.52, 2.53, -2.52], label: 'Whole character' },
  mantle: { panel: 2, box: [-0.9, 0.35, 0.95, -1.1], label: 'Mantle (head)' },
  junction: { panel: 2, box: [-0.95, -0.6, 1.0, -1.65], label: 'Body–arm junction' },
  brows: { panel: 2, box: [-0.62, -0.12, 0.68, -0.45], label: 'Eyebrows' },
  eyes: { panel: 2, box: [-0.62, -0.38, 0.68, -0.95], label: 'Eyes' },
  mouth: { panel: 2, box: [-0.6, -0.7, 0.7, -1.05], label: 'Mouth and blush' },
  'arms-left': { panel: 2, box: [-2.2, 0.0, -0.6, -1.9], label: 'Arms T1–T4 (left)' },
  'arms-right': { panel: 2, box: [0.6, 0.0, 2.2, -1.9], label: 'Arms T5–T8 (right)' },
  curl: { panel: 2, box: [-2.2, -0.45, -1.1, -1.15], label: 'Arm curl (T2)' },
  suckers: { panel: 2, box: [-2.2, -0.45, -1.1, -1.15], label: 'Suckers (T2 curl)' },
  skin: { panel: 2, box: [-0.7, 0.3, 0.3, -0.4], label: 'Skin detail (crown)' },
};

/** Panel 2's rectangle in Nox.jpeg, for cropping the reference. */
export const PANEL_2 = { left: 512, top: 0, width: 506, height: 504, imageWidth: 1536, imageHeight: 1024 };
