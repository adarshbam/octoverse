import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS } from '../config/types';
import { ORB_Z, type OrbSlot, orbRestPosition } from '../artifacts/orbSlots';
import { NOX_POSES } from '../poses/nox.poses';
import { projectToScreen } from '../stage/anchors';
import { STAGE_FRAMES, fovFor } from '../stage/framing';

export interface OrbChoice {
  techId: string;
  name: string;
  slot: OrbSlot;
}

/** Where each orb rests on the page in the overview, and how big it looks, in CSS pixels. */
function measure(orbs: readonly OrbChoice[]) {
  const size = { width: window.innerWidth, height: window.innerHeight };
  const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES.overview, size), size.width / size.height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  const { body } = NOX_POSES.overview;
  return orbs.map(({ slot }) => {
    const index = ARM_IDS.indexOf(slot.armId);
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[slot.armId]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const p = orbRestPosition(chain, slot);
    const centre = projectToScreen(new THREE.Vector3(p.x + body.x, p.y + body.y, ORB_Z), camera, size);
    const edge = projectToScreen(new THREE.Vector3(p.x + body.x + slot.radius, p.y + body.y, ORB_Z), camera, size);
    return { x: centre.x, y: centre.y, size: Math.max(44, 2 * (edge.x - centre.x)) };
  });
}

/**
 * One button over each orb in the overview, so every technology can be reached by pointer,
 * keyboard or touch (at least 44 px); pressing one focuses that technology.
 */
export function OrbButtons({ orbs, open, onChoose }: { orbs: readonly OrbChoice[]; open: boolean; onChoose: (techId: string) => void }) {
  const [spots, setSpots] = useState(() => measure(orbs));
  useEffect(() => {
    const update = () => setSpots(measure(orbs));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [orbs]);
  return (
    <div className={`orb-buttons${open ? ' is-open' : ''}`} aria-hidden={!open}>
      {orbs.map((orb, i) => (
        <button
          key={orb.techId}
          type="button"
          className="orb-button"
          aria-label={orb.name}
          tabIndex={open ? 0 : -1}
          style={{ left: spots[i].x, top: spots[i].y, width: spots[i].size, height: spots[i].size }}
          onClick={() => onChoose(orb.techId)}
        />
      ))}
    </div>
  );
}
