import * as THREE from 'three';

/** Where a bubble is on the page this frame (CSS pixels from the canvas's top-left) and how big it looks. */
export interface BubbleSpot {
  x: number;
  y: number;
  size: number;
  /** False while the bubble is not shown (the entrance, the detail) or behind the camera. */
  visible: boolean;
}

/**
 * Where the bubbles are right now, written each frame by TechBubbles (in the 3D scene) and read by
 * the page's buttons, the tooltip and Nox's eyes, so the live buttons follow the bubbles, with no
 * React render. `worlds` are the bubbles' centres in world space; `sides` is which side of Nox's
 * face each is on (-1 left, 1 right), for the tilt of his head.
 */
export class BubbleLive {
  spots: BubbleSpot[] = [];
  worlds: THREE.Vector3[] = [];
  sides: number[] = [];
  private readonly listeners = new Set<() => void>();

  /** Makes room for `count` bubbles. */
  resize(count: number) {
    while (this.spots.length < count) {
      this.spots.push({ x: 0, y: 0, size: 0, visible: false });
      this.worlds.push(new THREE.Vector3());
      this.sides.push(1);
    }
    this.spots.length = this.worlds.length = this.sides.length = count;
  }

  /** Called once per frame after the bubbles have moved. */
  notify() {
    for (const cb of this.listeners) cb();
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
