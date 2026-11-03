import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ExpressionId } from '../behavior/expressions';
import { NOX } from '../config/nox.character';
import { type BlowSheet, BlowRun, blowFrame, blowPosition } from '../sequences/bubbleBlow';
import { useInstance } from '../host/instanceContext';
import type { BubbleLive } from './bubbleLive';
import { NOX_SHELLS, layoutOrbits, orbitPoint, orbitSpeed } from './bubbleOrbits';
import { pullPosition } from './suctionHold';
import { logoColour, logoTexture } from './logoTexture';
import { ORB_HALO_SCALE, createOrbHaloMaterial, createOrbLogoMaterial, createOrbMaterial } from './orbMaterial';

export interface PlacedBubble {
  techId: string;
  iconKey: string;
  /** How Nox's face reacts when this technology is in focus. */
  reaction?: ExpressionId;
}

/** What the bubbles need from Nox each frame. */
export interface BubbleState {
  /** Whether they are shown (the intro and the overview), not in the entrance or beside the detail panel. */
  show: boolean;
  /** Which stage's framing they are sized for. */
  stage: 'intro' | 'overview';
  /** A bubble is hovered, held or in focus: the orbits ease to still. */
  hot: boolean;
  /** Motion off (reduced motion, `?freeze`): the orbits do not move, and the bubbles come and go at once. */
  still: boolean;
  /** How far the head has swollen (0..1), which pushes the orbits out. */
  swell: number;
  /** How far each is in focus (0..1, eased). */
  focus: Float32Array;
  /** The blow's sheet (sequences/bubbleBlow.ts): the bubbles are blown from Nox's mouth when they first appear. */
  blow?: BlowSheet;
  /** Written back each frame for Nox's face: how puffed his cheeks are and how round his mouth, blowing (0 otherwise). */
  puff: number;
  mouthRound: number;
  /** Written back each frame: each bubble's place on its orbit (body space), which the arm holding it turns toward. */
  orbit: THREE.Vector3[];
  /**
   * The suction hold (artifacts/suctionHold.ts), written by Nox each frame: how far each bubble is
   * pulled from its orbit to its arm's tip (0..1, eased; 0 when not held), and that tip and the way
   * the arm runs there (body space). A held bubble sits just off the tip, against its cups.
   */
  hold: { pull: Float32Array; tip: THREE.Vector3[]; dir: THREE.Vector3[] };
}

/** How much a bubble in focus grows. */
/** How much a bubble in focus grows: as much as the rings' clearance of the title and the face allows (checked in bubbleOrbits.test.ts). */
export const FOCUS_GROW = { intro: 1.1, overview: 1.05 } as const;
/** Seconds for the bubbles to fade in or out, and to grow into a new stage's size. */
const FADE_S = 0.9;
const RESIZE_PER_S = 3;
/** How far beyond the arm's tip a held bubble's centre sits, in bubble radii: its glass meets the tip clear of the logo. */
const HOLD_OFF_TIP = 1.25;
/** The middle a pulled bubble swings round (body space): where the orbits are centred. */
const HOLD_CENTRE = { x: 0, y: 0.25 };

/** Marks every bubble as not shown (the page's buttons go inert). */
function hideSpots(live: BubbleLive) {
  for (const spot of live.spots) spot.visible = false;
}

/**
 * The technology bubbles, orbiting Nox on his shells (artifacts/bubbleOrbits.ts) in the approved
 * glass with each technology's logo, their halos breathing a little, each at its own pace. The
 * first time they appear (once the entrance has settled) Nox blows them from his mouth, one after
 * another, each wobbling as it grows on its way to its orbit (sequences/bubbleBlow.ts); with motion
 * off they are simply there. Later they fade in and out (beside the detail panel). The page's buttons follow them:
 * each frame the bubbles' places on the page are written to `bubbleLive`. Lives in body space, so
 * the bubbles go with Nox.
 */
export function TechBubbles({ bubbles, state, focusColour }: { bubbles: readonly PlacedBubble[]; state: () => BubbleState; focusColour: string }) {
  const { bubbleLive } = useInstance();
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 48, 32);
    const plane = new THREE.PlaneGeometry(1, 1);
    return {
      sphere,
      plane,
      items: bubbles.map(bubble => ({
        bubble,
        glass: createOrbMaterial(logoColour(bubble.iconKey), focusColour),
        halo: createOrbHaloMaterial(logoColour(bubble.iconKey), focusColour),
        logo: createOrbLogoMaterial(logoTexture(bubble.iconKey)),
      })),
    };
  }, [bubbles, focusColour]);

  useEffect(() => () => {
    parts.sphere.dispose();
    parts.plane.dispose();
    for (const item of parts.items) {
      item.glass.dispose();
      item.halo.dispose();
      item.logo.dispose();
    }
  }, [parts]);

  const layouts = useMemo(() => ({ intro: layoutOrbits(bubbles.length, NOX_SHELLS, 'intro'), overview: layoutOrbits(bubbles.length, NOX_SHELLS, 'overview') }), [bubbles.length]);
  // The orbit clock, the speed spring that eases it, each bubble's current size, and how far all are shown.
  const run = useMemo(() => ({ clock: 0, speed: { x: 1, v: 0 }, size: new Float32Array(bubbles.length).fill(Number.NaN), shown: 0, hidden: false, blow: new BlowRun() }), [bubbles.length]);
  const scratch = useMemo(() => ({ edge: new THREE.Vector3(), ndc: new THREE.Vector3(), right: new THREE.Vector3(), orbit: new THREE.Vector3(), held: new THREE.Vector3(), from: new THREE.Vector3() }), []);
  useEffect(() => {
    bubbleLive.resize(bubbles.length);
    return () => bubbleLive.resize(0);
  }, [bubbleLive, bubbles.length]);

  useFrame((frame, delta) => {
    const s = state();
    const dt = Math.min(delta, 0.05);
    const root = group.current!;
    // The blow: it starts the first time the bubbles are shown, and until it does there are none.
    const { blow } = run;
    blow.step({ exist: s.show, still: s.still, ready: !!s.blow?.sequences, failed: !s.blow || s.blow.failed, dt, count: bubbles.length, at: s.blow?.at });
    const blowing = blow.blowing ? s.blow?.sequences ?? null : null;
    const waiting = !blow.done && !blowing;
    // Fading in and out; with motion off they come and go at once, and blowing each comes as it pops out.
    const goal = s.show && !waiting ? 1 : 0;
    run.shown = s.still || blowing ? goal : run.shown + Math.sign(goal - run.shown) * Math.min(Math.abs(goal - run.shown), dt / FADE_S);
    let puff = 0;
    let mouthRound = 0;
    root.visible = run.shown > 0.001;
    if (!root.visible) {
      // Told once that they are gone, then left alone while hidden.
      if (!run.hidden) {
        hideSpots(bubbleLive);
        bubbleLive.notify();
        run.hidden = true;
      }
      s.puff = s.mouthRound = 0;
      return;
    }
    run.hidden = false;
    // The orbit clock runs at the eased speed; motion off, it stands where it is.
    const pace = orbitSpeed(s.hot, dt, run.speed);
    if (!s.still) run.clock += dt * pace;
    const shown = run.shown * run.shown * (3 - 2 * run.shown);
    root.updateWorldMatrix(true, false);
    const { edge, ndc, right, orbit: target, held } = scratch;
    const e = frame.camera.matrixWorld.elements;
    right.set(e[0], e[1], e[2]).normalize();
    const strongest = s.focus.reduce((a, b) => Math.max(a, b), 0);
    const orbits = layouts[s.stage];
    const t = frame.clock.elapsedTime;
    parts.items.forEach((item, i) => {
      const node = root.children[i];
      const orbit = orbits[i];
      orbitPoint(orbit, run.clock, s.swell, target);
      s.orbit[i]?.copy(target);
      const f = s.focus[i];
      // A bubble grows into its stage's size.
      run.size[i] = Number.isNaN(run.size[i]) || s.still ? orbit.size : run.size[i] + (orbit.size - run.size[i]) * (1 - Math.exp(-RESIZE_PER_S * dt));
      let radius = run.size[i] * (0.4 + 0.6 * shown) * (1 + (FOCUS_GROW[s.stage] - 1) * f);
      // Blowing, it comes from the mouth to its orbit as it pops out and grows, squashing and stretching.
      const b = blowing ? blowFrame(blowing, i, blow.seconds!) : null;
      if (b) {
        puff = Math.max(puff, b.puff);
        mouthRound = Math.max(mouthRound, b.mouthRound);
        radius *= b.scale;
        blowPosition(target, b.emerged, node.position);
        node.scale.set(radius * (1 + b.wobble), radius * (1 - b.wobble), radius);
        node.visible = b.scale > 0;
      } else {
        node.position.copy(target);
        node.scale.setScalar(radius);
        node.visible = true;
      }
      // Held: pulled along from where it was, swinging round Nox, to just off its arm's tip.
      const pull = s.hold.pull[i] ?? 0;
      if (pull > 0) pullPosition(scratch.from.copy(node.position), held.copy(s.hold.tip[i]).addScaledVector(s.hold.dir[i], radius * HOLD_OFF_TIP), pull, HOLD_CENTRE, node.position);
      // The focused bubble glows; the others dim subtly while one is. Each halo breathes a little at its own pace.
      const dim = 1 - 0.25 * Math.max(0, strongest - f);
      const breathe = s.still ? 1 : 1 + 0.1 * Math.sin(t * (0.5 + 0.045 * i) + i * 2.1);
      item.glass.uniforms.uOpacity.value = shown * dim;
      item.halo.uniforms.uOpacity.value = shown * dim * breathe;
      item.halo.uniforms.uFocus.value = f;
      item.glass.uniforms.uFocus.value = f;
      item.logo.opacity = shown * dim;
      // Where it is in the world and on the page, for the buttons, the tooltip and Nox's eyes.
      const world = bubbleLive.worlds[i].copy(node.position).applyMatrix4(root.matrixWorld);
      bubbleLive.sides[i] = Math.sign(node.position.x - NOX.head.faceOrigin[0]) || 1;
      ndc.copy(world).project(frame.camera);
      edge.copy(world).addScaledVector(right, radius);
      const edgeX = edge.project(frame.camera).x;
      const spot = bubbleLive.spots[i];
      spot.x = ((ndc.x + 1) / 2) * frame.size.width;
      spot.y = ((1 - ndc.y) / 2) * frame.size.height;
      spot.size = Math.abs(edgeX - ndc.x) * frame.size.width;
      spot.visible = shown > 0.5 && ndc.z < 1 && (!b || b.scale > 0.5);
    });
    s.puff = puff;
    s.mouthRound = mouthRound;
    bubbleLive.notify();
  });

  return (
    <group ref={group} visible={false}>
      {parts.items.map(item => (
        <group key={item.bubble.techId}>
          <mesh geometry={parts.sphere} material={item.halo} scale={ORB_HALO_SCALE} renderOrder={1} />
          <mesh geometry={parts.sphere} material={item.glass} renderOrder={2} />
          <mesh geometry={parts.plane} material={item.logo} scale={2.1} position={[0, 0, 0.02]} renderOrder={3} />
        </group>
      ))}
    </group>
  );
}
