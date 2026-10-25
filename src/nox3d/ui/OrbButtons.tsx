import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS } from '../config/types';
import { FOCUS_GROW, FOCUS_RAISE } from '../artifacts/TechOrbs';
import { ORB_Z, type OrbSlot, orbRestPosition } from '../artifacts/orbSlots';
import { NOX_POSES } from '../poses/nox.poses';
import { projectToScreen } from '../stage/anchors';
import { STAGE_FRAMES, fovFor } from '../stage/framing';

export interface OrbChoice {
  techId: string;
  name: string;
  slot: OrbSlot;
}

function overviewCamera(size: { width: number; height: number }) {
  const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES.overview, size), size.width / size.height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  return camera;
}

/** Where Nox's face is on the page in the overview, in CSS pixels, with its protected bounding box. */
export function faceSpot() {
  const size = { width: window.innerWidth, height: window.innerHeight };
  const { body } = NOX_POSES.overview;
  const [ox, oy] = NOX.head.faceOrigin;
  const camera = overviewCamera(size);
  const center = projectToScreen(new THREE.Vector3(body.x + ox, body.y + oy - 0.1, NOX.head.depth * NOX.head.halfWidth), camera, size);
  const pRight = projectToScreen(new THREE.Vector3(body.x + ox + 1.05, body.y + oy - 0.1, 0), camera, size);
  const pLeft = projectToScreen(new THREE.Vector3(body.x + ox - 1.05, body.y + oy - 0.1, 0), camera, size);
  const pTop = projectToScreen(new THREE.Vector3(body.x + ox, body.y + oy + 0.45, 0), camera, size);
  const pBottom = projectToScreen(new THREE.Vector3(body.x + ox, body.y + oy - 0.55, 0), camera, size);
  return {
    x: center.x,
    y: center.y,
    bounds: {
      left: Math.min(pLeft.x, pRight.x),
      right: Math.max(pLeft.x, pRight.x),
      top: Math.min(pTop.y, pBottom.y),
      bottom: Math.max(pTop.y, pBottom.y),
    },
  };
}

/**
 * Where each orb rests on the page in the overview, and how big it looks, in CSS pixels; with
 * `presented`, where it sits once raised and grown in focus.
 */
export function orbSpots(orbs: readonly OrbChoice[], presented = false) {
  const size = { width: window.innerWidth, height: window.innerHeight };
  const camera = overviewCamera(size);
  const { body } = NOX_POSES.overview;
  return orbs.map(({ slot }) => {
    const index = ARM_IDS.indexOf(slot.armId);
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[slot.armId]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const p = orbRestPosition(chain, slot);
    const lift = presented ? FOCUS_RAISE : 0;
    const radius = slot.radius * (presented ? FOCUS_GROW : 1);
    const centre = projectToScreen(new THREE.Vector3(p.x + body.x, p.y + body.y + lift, ORB_Z), camera, size);
    const edge = projectToScreen(new THREE.Vector3(p.x + body.x + radius, p.y + body.y + lift, ORB_Z), camera, size);
    return { x: centre.x, y: centre.y, size: Math.max(44, 2 * (edge.x - centre.x)) };
  });
}

/** How long the pointer rests on an orb before it is focused, so gliding across orbs focuses none of them. */
const HOVER_INTENT_MS = 180;

/**
 * One button over each orb's resting place in the overview, so every technology can be reached
 * by pointer, keyboard or touch (at least 44 px). Resting the pointer on one, focusing or pressing
 * it focuses that technology; the focused one is described by the tooltip. The buttons never move,
 * so letting go of a focus never counts as a new hover.
 */
export function OrbButtons({ orbs, open, focused, tooltipId, onChoose }: { orbs: readonly OrbChoice[]; open: boolean; focused: string | null; tooltipId: string; onChoose: (techId: string) => void }) {
  const [spots, setSpots] = useState(() => orbSpots(orbs));
  const hover = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hover.current), []);
  useEffect(() => {
    const update = () => setSpots(orbSpots(orbs));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [orbs]);
  return (
    <div className={`orb-buttons${open ? ' is-open' : ''}`} aria-hidden={!open}>
      {orbs.map((orb, i) => {
        const spot = spots[i];
        return (
          <button
            key={orb.techId}
            type="button"
            className="orb-button"
            aria-label={orb.name}
            aria-describedby={orb.techId === focused ? tooltipId : undefined}
            tabIndex={open ? 0 : -1}
            style={{ left: spot.x, top: spot.y, width: spot.size, height: spot.size }}
            onClick={() => onChoose(orb.techId)}
            onFocus={() => onChoose(orb.techId)}
            onPointerEnter={event => {
              if (event.pointerType !== 'mouse') return;
              window.clearTimeout(hover.current);
              hover.current = window.setTimeout(() => onChoose(orb.techId), HOVER_INTENT_MS);
            }}
            onPointerLeave={() => window.clearTimeout(hover.current)}
          />
        );
      })}
    </div>
  );
}
