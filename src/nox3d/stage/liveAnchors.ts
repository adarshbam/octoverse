import { type RefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../world/types';
import { projectToScreen } from './anchors';
import { NOX } from '../config/nox.character';
import { NOX_POSES } from '../poses/nox.poses';

/**
 * Nox's face in the intro, the overview or the detail (the point the overlays stay attached to,
 * and the world camera's lens shift keeps in place): the same place the overview's face spot is
 * projected from, at the head's front.
 */
export function noxFaceAnchor(stage: 'intro' | 'overview' | 'detail'): Vec3 {
  const { body } = NOX_POSES[stage];
  const [ox, oy] = NOX.head.faceOrigin;
  return [body.x + ox, body.y + oy - 0.1, NOX.head.depth * NOX.head.halfWidth];
}

/**
 * Where the live camera has moved world points on screen, against the stage camera at rest
 * (`base`), so page UI laid out for the stage camera can follow the hover without re-rendering.
 */
export class LiveAnchors {
  private live: THREE.Camera | null = null;
  private base: THREE.Camera | null = null;
  private size = { width: 1, height: 1 };
  private readonly point = new THREE.Vector3();
  private readonly out = { dx: 0, dy: 0 };
  private readonly listeners = new Set<() => void>();

  /** Called once per frame after the camera has moved; tells the subscribers. */
  set(camera: THREE.Camera, base: THREE.Camera, size: { width: number; height: number }) {
    this.live = camera;
    this.base = base;
    this.size = size;
    camera.updateMatrixWorld();
    base.updateMatrixWorld();
    for (const cb of this.listeners) cb();
  }

  /** Screen shift in CSS px of a world point; the returned object is reused by the next call. */
  shift(world: Vec3): { dx: number; dy: number } {
    if (!this.live || !this.base) {
      this.out.dx = 0;
      this.out.dy = 0;
      return this.out;
    }
    this.point.set(world[0], world[1], world[2]);
    const a = projectToScreen(this.point, this.live, this.size);
    const ax = a.x;
    const ay = a.y;
    const b = projectToScreen(this.point, this.base, this.size);
    this.out.dx = ax - b.x;
    this.out.dy = ay - b.y;
    return this.out;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

/** The page's one set of live anchors, updated by the stage camera. */
export const liveAnchors = new LiveAnchors();

/**
 * Keeps an element attached to a world point as the camera hovers: writes `style.translate` each
 * frame, with no React render. The element's own layout (and `transform`) is left as it is.
 */
export function useAnchorShift(ref: RefObject<HTMLElement | null>, world: Vec3): void {
  const at = useRef(world);
  useEffect(() => {
    at.current = world;
  });
  useEffect(() => {
    const el0 = ref.current;
    let last = '';
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const { dx, dy } = liveAnchors.shift(at.current);
      const next = Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005 ? '' : `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
      if (next === last) return;
      last = next;
      el.style.translate = next;
    };
    apply();
    const off = liveAnchors.subscribe(apply);
    return () => {
      off();
      if (el0) el0.style.translate = '';
    };
  }, [ref]);
}
