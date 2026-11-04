import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { CAMERA_Z } from '../config/stage';
import { useInstance } from '../host/instanceContext';
import { useWindowListeners } from '../host/listeners';
import type { StageId } from '../config/types';
import { projectToScreen } from '../stage/anchors';
import { type StageFrame, fovFor } from '../stage/framing';

/** A box in CSS pixels on the page. */
export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a world box [x0, y0, x1, y1] on the z = 0 plane lands in a viewport of `size` once the stage camera has framed `frame` (a stage's, `WorldBundle.stage.frames`). */
export function stageBoxFor(frame: StageFrame, [x0, y0, x1, y1]: readonly [number, number, number, number], size: { width: number; height: number }): ScreenBox {
  const camera = new THREE.PerspectiveCamera(fovFor(frame, size), size.width / size.height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  const a = projectToScreen(new THREE.Vector3(x0, y0, 0), camera, size);
  const b = projectToScreen(new THREE.Vector3(x1, y1, 0), camera, size);
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
}

/**
 * Where a world box [x0, y0, x1, y1] on the z = 0 plane lands on the page once the stage camera
 * has framed `stage` (the instance's world's frame for it), kept up to date as the window resizes.
 */
export function useStageBox(stage: StageId, [x0, y0, x1, y1]: readonly [number, number, number, number]): ScreenBox {
  const { mode, bundle } = useInstance();
  const frame = bundle.stage.frames[stage];
  const measure = () => stageBoxFor(frame, [x0, y0, x1, y1], { width: window.innerWidth, height: window.innerHeight });
  const [box, setBox] = useState(measure);
  // The box is re-measured when the stage or the world box changes.
  useEffect(() => {
    const update = () => setBox(measure());
    update();
  }, [frame, x0, y0, x1, y1]);
  // And as the window resizes, for a page instance (a preview attaches no window listener).
  useWindowListeners(mode, { resize: () => setBox(measure()) });
  return box;
}
