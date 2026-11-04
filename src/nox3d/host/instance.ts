import { BubbleLive } from '../artifacts/bubbleLive';
import { LiveAnchors } from '../stage/liveAnchors';
import type { WorldBundle } from '../types/bundle';

/**
 * Everything one running Nox keeps that is not React state or the scene: the bubbles' live places,
 * the camera's live anchors, whether the pointer is on a bubble, and the relief gate the world's
 * shaders read. One per mounted instance, so two instances on a page (or a preview beside the
 * page) never write each other's frame.
 */
export interface InstanceState {
  /** The world's id (`bundle.id`): the key of its storage and its debug names. */
  id: string;
  mode: 'page' | 'preview';
  /** The world this instance shows, validated (`validateBundle`): every engine module reads its data from here or from props, never from a world's files. */
  bundle: WorldBundle;
  bubbleLive: BubbleLive;
  liveAnchors: LiveAnchors;
  /** Whether the pointer is on a technology bubble: the orbits ease to still and no arm reaches for the pointer while it is (the camera takes no notice). */
  hover: { bubble: boolean };
  /**
   * 1 draws the relief and its specular, 0 skips them (a uniform branch, so the texture read and
   * the two BRDFs go): the lower quality tiers set it (WorldScene). The shaders hold this object
   * as their uniform.
   */
  reliefGate: { value: number };
}

export function createInstanceState(bundle: WorldBundle, mode: 'page' | 'preview'): InstanceState {
  return { id: bundle.id, mode, bundle, bubbleLive: new BubbleLive(), liveAnchors: new LiveAnchors(), hover: { bubble: false }, reliefGate: { value: 1 } };
}
