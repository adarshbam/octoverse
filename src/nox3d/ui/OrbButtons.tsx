import { type PointerEvent, useEffect, useMemo, useRef } from 'react';
import { HoverIntent } from './hoverIntent';
import { useInstance } from '../host/instanceContext';
import { useWindowListeners } from '../host/listeners';
import type { InstanceState } from '../host/instance';
import * as THREE from 'three';
import { FOCUS_GROW } from '../artifacts/TechBubbles';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { NOX_POSES } from '../poses/nox.poses';
import { projectToScreen } from '../stage/anchors';
import { STAGE_FRAMES, fovFor } from '../stage/framing';

export interface OrbChoice {
  techId: string;
  name: string;
}

function stageCamera(stage: 'intro' | 'overview', size: { width: number; height: number }) {
  const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES[stage], size), size.width / size.height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  return camera;
}

/** Spots worked out for a window size and a stage, so a focus change never rebuilds the camera to place things. */
const spotCache = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
  const full = `${key}@${window.innerWidth}x${window.innerHeight}`;
  if (!spotCache.has(full)) spotCache.set(full, make());
  return spotCache.get(full) as T;
}

/**
 * Where Nox's face is on the page in a stage, in CSS pixels, with its protected bounding box. In
 * the intro the box also takes in the title lines above the face, which a tooltip keeps clear of
 * as well.
 */
export function faceSpot(stage: 'intro' | 'overview' = 'overview') {
  return cached(`face:${stage}`, () => faceSpotNow(stage));
}

/** The intro's title lines, in world units: the widest line's half width, and the top of the kicker (stage % from intro.css). */
const INTRO_TITLE = { halfWidth: 1.4, top: 1.55 };

function faceSpotNow(stage: 'intro' | 'overview') {
  const size = { width: window.innerWidth, height: window.innerHeight };
  const { body } = NOX_POSES[stage];
  const [ox, oy] = NOX.head.faceOrigin;
  const camera = stageCamera(stage, size);
  const center = projectToScreen(new THREE.Vector3(body.x + ox, body.y + oy - 0.1, NOX.head.depth * NOX.head.halfWidth), camera, size);
  const pRight = projectToScreen(new THREE.Vector3(body.x + ox + 1.05, body.y + oy - 0.1, 0), camera, size);
  const pLeft = projectToScreen(new THREE.Vector3(body.x + ox - 1.05, body.y + oy - 0.1, 0), camera, size);
  const pTop = projectToScreen(new THREE.Vector3(body.x + ox, body.y + oy + 0.45, 0), camera, size);
  const pBottom = projectToScreen(new THREE.Vector3(body.x + ox, body.y + oy - 0.55, 0), camera, size);
  const bounds = {
    left: Math.min(pLeft.x, pRight.x),
    right: Math.max(pLeft.x, pRight.x),
    top: Math.min(pTop.y, pBottom.y),
    bottom: Math.max(pTop.y, pBottom.y),
  };
  if (stage === 'intro') {
    const titleLeft = projectToScreen(new THREE.Vector3(-INTRO_TITLE.halfWidth, INTRO_TITLE.top, 0), camera, size);
    const titleRight = projectToScreen(new THREE.Vector3(INTRO_TITLE.halfWidth, INTRO_TITLE.top, 0), camera, size);
    bounds.left = Math.min(bounds.left, titleLeft.x);
    bounds.right = Math.max(bounds.right, titleRight.x);
    bounds.top = Math.min(bounds.top, titleLeft.y);
  }
  return { x: center.x, y: center.y, bounds };
}

/** Whether the pointer is on a bubble, as the instance (and Nox's eyes and arms) will read it. */
function holdHover(hover: InstanceState['hover'], on: boolean) {
  hover.bubble = on;
}

/** The smallest a button is, for touch (CSS pixels). */
const MIN_BUTTON = 44;

/**
 * Where bubble `i` is on the page as the stage camera at rest has it (the tooltip and the page's
 * other overlays are laid out for that camera and follow the hover themselves), in CSS pixels;
 * `grown` is how big it looks in focus. Null when that bubble is not drawn (yet).
 */
export function bubbleDisc(instance: InstanceState, i: number, grown: false | 'intro' | 'overview' = false) {
  const { bubbleLive, liveAnchors } = instance;
  const spot = bubbleLive.spots[i];
  const world = bubbleLive.worlds[i];
  if (!spot || !world) return null;
  const { dx, dy } = liveAnchors.shift([world.x, world.y, world.z]);
  return { x: spot.x - dx, y: spot.y - dy, size: Math.max(MIN_BUTTON, spot.size * (grown ? FOCUS_GROW[grown] : 1)) };
}

/** One bubble's button, which follows the bubble each frame (no React render). */
function OrbButton({ index, orb, focused, tooltipId, tabIndex, onChoose, onPointerEnter, onPointerMove, onPointerLeave }: {
  index: number;
  orb: OrbChoice;
  focused: string | null;
  tooltipId: string;
  tabIndex: number;
  onChoose: (techId: string) => void;
  onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: () => void;
}) {
  const { bubbleLive } = useInstance();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let last = '';
    const apply = () => {
      const el = button.current;
      const spot = bubbleLive.spots[index];
      if (!el || !spot) return;
      // Inert (still real buttons for assistive tech) while the bubble is faded out.
      el.style.pointerEvents = spot.visible ? '' : 'none';
      const size = Math.max(MIN_BUTTON, spot.size).toFixed(0);
      const next = `${spot.visible}${spot.x.toFixed(1)}px ${spot.y.toFixed(1)}px ${size}`;
      if (next === last) return;
      last = next;
      el.style.translate = `${spot.x.toFixed(1)}px ${spot.y.toFixed(1)}px`;
      el.style.width = el.style.height = `${size}px`;
    };
    apply();
    return bubbleLive.subscribe(apply);
  }, [index, bubbleLive]);
  return (
    <button
      ref={button}
      type="button"
      className="orb-button"
      aria-label={orb.name}
      aria-describedby={orb.techId === focused ? tooltipId : undefined}
      tabIndex={tabIndex}
      style={{ left: 0, top: 0, width: MIN_BUTTON, height: MIN_BUTTON, pointerEvents: 'none' }}
      onClick={() => onChoose(orb.techId)}
      onFocus={() => onChoose(orb.techId)}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    />
  );
}

/**
 * One button over each orbiting bubble, following it every frame, so every technology can be
 * reached by pointer, keyboard or touch (at least 44 px). Bringing the pointer to rest on one
 * (HoverIntent: gliding across bubbles chooses none of them, and nor does a bubble drifting under a
 * pointer that is not moving), focusing or pressing it focuses that technology; the focused one is
 * described by the tooltip. While the pointer is on a bubble the orbits ease to still.
 */
export function OrbButtons({ orbs, open, focused, tooltipId, onChoose }: { orbs: readonly OrbChoice[]; open: boolean; focused: string | null; tooltipId: string; onChoose: (techId: string) => void }) {
  const { hover: pointer, mode } = useInstance();
  const hover = useRef<{ techId: string | null; timer?: number }>({ techId: null });
  const intent = useMemo(() => new HoverIntent(), []);
  useEffect(() => () => {
    window.clearTimeout(hover.current.timer);
    holdHover(pointer, false);
  }, [pointer]);
  // The pointer's own movement, wherever it is: a bubble that comes to a pointer that has been still is not a choice.
  // (A page instance listens on the window; a preview does not, and goes by the pointer events on its own buttons.)
  useWindowListeners(
    mode,
    {
      pointermove: event => {
        if (event.pointerType === 'mouse') intent.track(event.clientX, event.clientY, performance.now());
      },
    },
    true,
  );
  // Hiding the buttons under a resting pointer sends no leave event: let go of the hover then, so
  // the orbits do not stay settled once the bubbles are hidden.
  useEffect(() => {
    if (open) return;
    hover.current.techId = null;
    holdHover(pointer, false);
    intent.reset();
    window.clearTimeout(hover.current.timer);
  }, [open, intent, pointer]);
  // Chooses the bubble under the pointer once it has come to rest there; checks again when it might.
  const consider = (techId: string, x: number, y: number) => {
    const now = performance.now();
    intent.move(x, y, now);
    holdHover(pointer, intent.engaged);
    window.clearTimeout(hover.current.timer);
    if (intent.due(now)) return onChoose(techId);
    hover.current.timer = window.setTimeout(() => {
      if (hover.current.techId === techId && intent.due(performance.now())) onChoose(techId);
    }, intent.wait(now) + 5);
  };
  return (
    <div className={`orb-buttons${open ? ' is-open' : ''}`} aria-hidden={!open}>
      {orbs.map((orb, i) => (
        <OrbButton
          key={orb.techId}
          index={i}
          orb={orb}
          focused={focused}
          tooltipId={tooltipId}
          tabIndex={open ? 0 : -1}
          onChoose={onChoose}
          onPointerEnter={event => {
            if (event.pointerType !== 'mouse') return;
            hover.current.techId = orb.techId;
            intent.enter(event.clientX, event.clientY, performance.now());
            holdHover(pointer, intent.engaged);
            consider(orb.techId, event.clientX, event.clientY);
          }}
          onPointerMove={event => {
            if (event.pointerType === 'mouse' && hover.current.techId === orb.techId) consider(orb.techId, event.clientX, event.clientY);
          }}
          onPointerLeave={() => {
            hover.current.techId = null;
            holdHover(pointer, false);
            intent.reset();
            window.clearTimeout(hover.current.timer);
          }}
        />
      ))}
    </div>
  );
}
