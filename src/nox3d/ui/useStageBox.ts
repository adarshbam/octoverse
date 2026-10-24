import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { CAMERA_Z } from '../config/stage';
import type { StageId } from '../config/types';
import { projectToScreen } from '../stage/anchors';
import { STAGE_FRAMES, fovFor } from '../stage/framing';

/** A box in CSS pixels on the page. */
export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a world box [x0, y0, x1, y1] on the z = 0 plane lands on the page once the stage camera
 * has framed `stage`, kept up to date as the window resizes.
 */
export function useStageBox(stage: StageId, [x0, y0, x1, y1]: readonly [number, number, number, number]): ScreenBox {
  const measure = () => {
    const size = { width: window.innerWidth, height: window.innerHeight };
    const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES[stage], size), size.width / size.height, 0.1, 60);
    camera.position.set(0, 0, CAMERA_Z);
    camera.updateMatrixWorld();
    const a = projectToScreen(new THREE.Vector3(x0, y0, 0), camera, size);
    const b = projectToScreen(new THREE.Vector3(x1, y1, 0), camera, size);
    return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
  };
  const [box, setBox] = useState(measure);
  useEffect(() => {
    const update = () => setBox(measure());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // The box is re-measured when the stage or the world box changes.
  }, [stage, x0, y0, x1, y1]);
  return box;
}
