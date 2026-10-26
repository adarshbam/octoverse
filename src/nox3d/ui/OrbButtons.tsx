import { useEffect, useMemo, useRef, useState } from 'react';
import { HoverIntent } from './hoverIntent';
import * as THREE from 'three';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS } from '../config/types';
import { FOCUS_GROW, ORB_Z, type OrbSlot, orbRestPosition } from '../artifacts/orbSlots';
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

/** Spots worked out for a window size, so a focus change never rebuilds the arms to place things. */
const spotCache = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
  const full = `${key}@${window.innerWidth}x${window.innerHeight}`;
  if (!spotCache.has(full)) spotCache.set(full, make());
  return spotCache.get(full) as T;
}

/** Where Nox's face is on the page in the overview, in CSS pixels, with its protected bounding box. */
export function faceSpot() {
  return cached('face', faceSpotNow);
}

function faceSpotNow() {
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
 * `presented`, where it sits when its arm presents it (its slot's presentation pose), grown.
 */
export function orbSpots(orbs: readonly OrbChoice[], presented = false) {
  return cached(`orbs:${presented}:${orbs.map(o => o.techId).join()}`, () => orbSpotsNow(orbs, presented));
}

function orbSpotsNow(orbs: readonly OrbChoice[], presented: boolean) {
  const size = { width: window.innerWidth, height: window.innerHeight };
  const camera = overviewCamera(size);
  const { body } = NOX_POSES.overview;
  return orbs.map(({ slot }) => {
    const index = ARM_IDS.indexOf(slot.armId);
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[slot.armId]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const p = presented ? { x: slot.present[0], y: slot.present[1] } : orbRestPosition(chain, slot);
    const radius = slot.radius * (presented ? FOCUS_GROW : 1);
    const centre = projectToScreen(new THREE.Vector3(p.x + body.x, p.y + body.y, ORB_Z), camera, size);
    const edge = projectToScreen(new THREE.Vector3(p.x + body.x + radius, p.y + body.y, ORB_Z), camera, size);
    return { x: centre.x, y: centre.y, size: Math.max(44, 2 * (edge.x - centre.x)) };
  });
}

/**
 * One button over each orb's resting place in the overview, so every technology can be reached
 * by pointer, keyboard or touch (at least 44 px). Bringing the pointer to rest on one (HoverIntent:
 * gliding across orbs chooses none of them), focusing or pressing it focuses that technology; the
 * focused one is described by the tooltip. The buttons never move, so letting go of a focus never
 * counts as a new hover.
 */
export function OrbButtons({ orbs, open, focused, tooltipId, onChoose }: { orbs: readonly OrbChoice[]; open: boolean; focused: string | null; tooltipId: string; onChoose: (techId: string) => void }) {
  const [spots, setSpots] = useState(() => orbSpots(orbs));
  const hover = useRef<{ techId: string | null; timer?: number }>({ techId: null });
  const intent = useMemo(() => new HoverIntent(), []);
  useEffect(() => () => window.clearTimeout(hover.current.timer), []);
  // Chooses the orb under the pointer once it has come to rest there; checks again when it might.
  const consider = (techId: string, x: number, y: number) => {
    const now = performance.now();
    intent.move(x, y, now);
    window.clearTimeout(hover.current.timer);
    if (intent.due(now)) return onChoose(techId);
    hover.current.timer = window.setTimeout(() => {
      if (hover.current.techId === techId && intent.due(performance.now())) onChoose(techId);
    }, intent.wait(now) + 5);
  };
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
              hover.current.techId = orb.techId;
              intent.reset();
              consider(orb.techId, event.clientX, event.clientY);
            }}
            onPointerMove={event => {
              if (event.pointerType === 'mouse' && hover.current.techId === orb.techId) consider(orb.techId, event.clientX, event.clientY);
            }}
            onPointerLeave={() => {
              hover.current.techId = null;
              window.clearTimeout(hover.current.timer);
            }}
          />
        );
      })}
    </div>
  );
}
