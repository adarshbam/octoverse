// Panel 2 of Nox.jpeg, traced in world units: 1 unit = 100 panel px,
// origin at the panel centre, +y up. The camera frames 5.04 units vertically.
export const BODY_X = 0.04;
export const HEAD_CENTER = { x: 0.035, y: -0.42 };
export const HEAD_DEPTH = 0.82;
const ROOT_Y = -1.02;

/**
 * Mantle silhouette fitted to the rim line of panel 2 (scripts/silhouette.py): the dome is a
 * circle (r 0.778, centre y -0.508); below the widest point it fills out into the cheeks.
 */
export const HEAD_SHAPE = { centerX: 0.01, halfWidth: 0.778, waist: -0.508, top: 0.27, bottom: -1.06, topPower: 2, bottomPower: 2.6 };

type Point = [number, number];

export interface ArmPose {
  id: string;
  depth: 'rear' | 'middle' | 'front';
  /** Root z and tip z. Rear arms pass behind the mantle, front arms in front of it. */
  z: [number, number];
  radius: number;
  points: Point[];
}

function arm(id: string, depth: ArmPose['depth'], z: [number, number], radius: number, visible: Point[], spread = 0.2): ArmPose {
  // Each arm starts from a hidden root under the mantle so all eight share one body.
  // Front arms root lower so their thick base tucks under the chin instead of covering the mouth.
  const [x] = visible[0];
  const rootY = depth === 'front' ? ROOT_Y - 0.1 : ROOT_Y;
  return { id, depth, z, radius, points: [[BODY_X + (x - BODY_X) * spread, rootY], ...visible] };
}

export const ARM_POSES: ArmPose[] = [
  // Upper arms rise beside the mantle and curl outward.
  arm('T1', 'rear', [-0.3, -0.42], 0.15, [[-0.72, -0.95], [-0.85, -0.77], [-0.93, -0.53], [-1.0, -0.33], [-1.07, -0.2], [-1.17, -0.15], [-1.25, -0.18], [-1.28, -0.27], [-1.23, -0.32], [-1.18, -0.3]]),
  arm('T2', 'middle', [-0.1, -0.22], 0.17, [[-0.75, -0.99], [-1.02, -0.88], [-1.35, -0.73], [-1.68, -0.62], [-1.92, -0.62], [-2.06, -0.72], [-2.09, -0.86], [-2.0, -0.99], [-1.9, -1.03], [-1.85, -0.98], [-1.89, -0.92]]),
  arm('T3', 'front', [0.26, 0.06], 0.165, [[-0.45, -1.27], [-0.7, -1.29], [-1.0, -1.31], [-1.25, -1.33], [-1.45, -1.4], [-1.56, -1.5], [-1.58, -1.6], [-1.52, -1.69], [-1.42, -1.72], [-1.33, -1.68], [-1.32, -1.61], [-1.37, -1.58]]),
  arm('T4', 'front', [0.4, 0.22], 0.158, [[-0.24, -1.22], [-0.36, -1.4], [-0.52, -1.6], [-0.7, -1.72], [-0.88, -1.78], [-1.0, -1.8], [-1.06, -1.76], [-1.03, -1.7], [-0.97, -1.72]], 0.5),
  arm('T5', 'front', [0.4, 0.22], 0.158, [[0.3, -1.22], [0.44, -1.42], [0.62, -1.6], [0.8, -1.73], [0.98, -1.79], [1.12, -1.78], [1.2, -1.71], [1.16, -1.64], [1.09, -1.67]], 0.5),
  arm('T6', 'front', [0.26, 0.06], 0.165, [[0.42, -1.25], [0.83, -1.2], [1.17, -1.18], [1.5, -1.18], [1.74, -1.27], [1.85, -1.4], [1.82, -1.52], [1.7, -1.58], [1.6, -1.55], [1.58, -1.48], [1.63, -1.45]]),
  arm('T7', 'middle', [-0.1, -0.22], 0.17, [[0.72, -0.99], [1.0, -0.84], [1.33, -0.67], [1.6, -0.58], [1.83, -0.6], [1.97, -0.72], [1.99, -0.86], [1.9, -0.96], [1.8, -0.94], [1.77, -0.88], [1.82, -0.84]]),
  arm('T8', 'rear', [-0.3, -0.42], 0.15, [[0.77, -0.95], [0.88, -0.75], [0.97, -0.57], [1.0, -0.42], [1.04, -0.33], [1.1, -0.3], [1.19, -0.31], [1.26, -0.38], [1.26, -0.45], [1.21, -0.48], [1.17, -0.44]]),
];
