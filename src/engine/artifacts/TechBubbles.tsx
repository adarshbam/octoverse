import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ExpressionId } from '../behavior/expressions';
import type { ArtifactConfig, ChoosingStage, OrbGlass, Point2, TetherStyle } from '../config/types';
import type { BlowSheet } from '../sequences/bubbleBlow';
import type { SequenceId } from '../sequences/keys';
import type { Vec3 } from '../world/types';
import { useInstance } from '../host/instanceContext';
import { type BubbleLive, sideOfFace } from './bubbleLive';
import { APPEARS, type AppearModule, SELECTS, holdModule, placementDriver } from './strategies';
import type { ArmReader } from './pendant';
import { TETHER_POINTS, capRadius } from './tether';
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
  stage: ChoosingStage;
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
  /**
   * The arm lift (artifacts/armLift.ts), written by the character each frame: how far each pendant's
   * arm has lifted it (0..1, the tip's progress; 0 when not chosen). The chosen orb grows by the
   * select's `scale` and its thread shortens by its `threadShorten` with it.
   */
  lift: Float32Array;
  /** Where along its arm each lifted pendant hangs at the full lift (an arc fraction; NaN: its own slot), written with `lift`. */
  hangAt: Float32Array;
  /** The character's live arms, in ARM_IDS order, for a placement that hangs artifacts from them (the pendant placement); the orbit placement does not read them. */
  arms: readonly ArmReader[];
}

/** How much a bubble in focus grows. */
/** How much a bubble in focus grows: as much as the rings' clearance of the title and the face allows (checked in bubbleOrbits.test.ts). */
export const FOCUS_GROW = { intro: 1.1, overview: 1.05 } as const;
/** The bloom's cup glow at its brightest: its radius in cap radii, and how strongly it adds its light. */
const CUP_GLOW_SIZE = 2.6;
const CUP_GLOW_OPACITY = 0.55;
/** Seconds for the bubbles to fade in or out, and to grow into a new stage's size. */
const FADE_S = 0.9;
const RESIZE_PER_S = 3;

/** Points the placement's hang at the character's lift arrays (written by it each frame). */
function linkHang(hang: { at: ArrayLike<number>; weight: ArrayLike<number> }, s: Pick<BubbleState, 'hangAt' | 'lift'>) {
  hang.at = s.hangAt;
  hang.weight = s.lift;
}

/** Marks every bubble as not shown (the page's buttons go inert). */
function hideSpots(live: BubbleLive) {
  for (const spot of live.spots) spot.visible = false;
}

/** A pendant placement's threads: one batch of thin tube segments (a stretch of every thread) and one of beads (every cap), as instances of one geometry each, in the world's tether colours. */
function useThreads(tether: TetherStyle | null, count: number) {
  const threads = useMemo(() => {
    if (!tether) return null;
    // A unit-diameter tube one unit long on y: each instance scales it to a stretch of thread (width across, length along).
    const tube = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true);
    const bead = new THREE.SphereGeometry(1, 12, 8);
    const threadMaterial = new THREE.MeshBasicMaterial({ color: tether.color, transparent: true, toneMapped: false, depthWrite: false });
    const capMaterial = new THREE.MeshBasicMaterial({ color: tether.cap, transparent: true, toneMapped: false });
    // The bloom's glow on each pendant's cup as it brightens (additive, in the cap's cream).
    const glowMaterial = new THREE.MeshBasicMaterial({ color: tether.cap, transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const segments = new THREE.InstancedMesh(tube, threadMaterial, count * (TETHER_POINTS - 1));
    const caps = new THREE.InstancedMesh(bead, capMaterial, count);
    const glows = new THREE.InstancedMesh(bead, glowMaterial, count);
    segments.frustumCulled = caps.frustumCulled = glows.frustumCulled = false;
    segments.renderOrder = 1;
    caps.renderOrder = 2;
    glows.renderOrder = 2;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const hide = (i: number) => {
      for (let k = 0; k < TETHER_POINTS - 1; k++) segments.setMatrixAt(i * (TETHER_POINTS - 1) + k, zero);
      caps.setMatrixAt(i, zero);
      glows.setMatrixAt(i, zero);
    };
    // Nothing is drawn until a frame writes it: every instance starts empty (an unset one would be a unit tube at the origin).
    for (let i = 0; i < count; i++) hide(i);
    return {
      segments,
      caps,
      glows,
      tube,
      bead,
      threadMaterial,
      capMaterial,
      glowMaterial,
      /** Pendant `i` is not drawn (its place is not shown, or its orb is away from it). */
      hide,
      /**
       * Pendant `i`'s thread along `points` (body space) and its cap at the end: the thread drawn
       * `reach` of its length from the arm (the curve scaled toward its first point, so it keeps its
       * bow), the cap `cap` of its size, and the cup it hangs from glowing `glow` (0: none).
       */
      write(i: number, points: readonly (readonly [number, number, number])[], reach = 1, cap = 1, glow = 0) {
        if (points.length < TETHER_POINTS) return hide(i);
        const [ox, oy, oz] = points[0];
        for (let k = 0; k < TETHER_POINTS - 1; k++) {
          const [px, py, pz] = points[k];
          const [qx, qy, qz] = points[k + 1];
          const ax = ox + (px - ox) * reach;
          const ay = oy + (py - oy) * reach;
          const az = oz + (pz - oz) * reach;
          const bx = ox + (qx - ox) * reach;
          const by = oy + (qy - oy) * reach;
          const bz = oz + (qz - oz) * reach;
          dir.set(bx - ax, by - ay, bz - az);
          const length = dir.length();
          if (length < 1e-6) {
            segments.setMatrixAt(i * (TETHER_POINTS - 1) + k, zero);
            continue;
          }
          quaternion.setFromUnitVectors(up, dir.divideScalar(length));
          position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
          scale.set(tether.width, length, tether.width);
          segments.setMatrixAt(i * (TETHER_POINTS - 1) + k, matrix.compose(position, quaternion, scale));
        }
        const end = points[TETHER_POINTS - 1];
        caps.setMatrixAt(i, matrix.compose(position.set(ox + (end[0] - ox) * reach, oy + (end[1] - oy) * reach, oz + (end[2] - oz) * reach), quaternion.identity(), scale.setScalar(capRadius(tether) * cap)));
        glows.setMatrixAt(i, glow > 0 ? matrix.compose(position.set(ox, oy, oz), quaternion.identity(), scale.setScalar(capRadius(tether) * CUP_GLOW_SIZE * glow)) : zero);
      },
      /** The frame's writes are done: upload them and fade the batch with the bubbles. */
      finish(shown: number) {
        segments.instanceMatrix.needsUpdate = true;
        caps.instanceMatrix.needsUpdate = true;
        glows.instanceMatrix.needsUpdate = true;
        threadMaterial.opacity = shown;
        capMaterial.opacity = shown;
        glowMaterial.opacity = shown * CUP_GLOW_OPACITY;
      },
    };
  }, [tether, count]);
  useEffect(() => () => {
    if (!threads) return;
    threads.segments.dispose();
    threads.caps.dispose();
    threads.glows.dispose();
    threads.glowMaterial.dispose();
    threads.tube.dispose();
    threads.bead.dispose();
    threads.threadMaterial.dispose();
    threads.capMaterial.dispose();
  }, [threads]);
  return threads;
}

/**
 * The technology bubbles, placed, made to appear and held as the world's ArtifactConfig says
 * (strategies.ts; Nox's: orbiting on his shells, artifacts/bubbleOrbits.ts), in the approved glass
 * with each technology's logo, their halos breathing a little, each at its own pace. The first
 * time they appear (once the entrance has settled) Nox blows them from his mouth, one after
 * another, each wobbling as it grows on its way to its orbit (sequences/bubbleBlow.ts); with motion
 * off they are simply there. Later they fade in and out (beside the detail panel). The page's
 * buttons follow them: each frame the bubbles' places on the page are written to `bubbleLive`.
 * Lives in body space, so the bubbles go with Nox.
 */
export function TechBubbles({ bubbles, state, focusColour, glass, mouth, artifacts, faceOrigin }: {
  bubbles: readonly PlacedBubble[];
  state: () => BubbleState;
  focusColour: string;
  /** What the orbs' glass picks up round its edge (the character's `palette.orbGlass`). */
  glass: OrbGlass;
  /** Where the appearance begins (the appear's origin: Nox's mouth), in body space. */
  mouth: Vec3;
  /** The world's placement, appearance and selection of its artifacts, and where the artifacts can be chosen. */
  artifacts: ArtifactConfig;
  /** The character's face origin: which side of it each bubble is on. */
  faceOrigin: Point2;
}) {
  const { bubbleLive } = useInstance();
  // The strategies the config names (artifacts/strategies.ts).
  const { placement: placementConfig } = artifacts;
  const appear: AppearModule & { sheet: SequenceId } = APPEARS[artifacts.appear.kind];
  const select = SELECTS[artifacts.select.kind];
  // The suction hold's module (with the arm lift nothing is held, so it is never used there).
  const holder = holdModule(select);
  // The arm lift's growth and thread (1 and 0 for a select that does not lift).
  const liftScale = artifacts.select.kind === 'armLift' ? artifacts.select.scale : 1;
  const liftShorten = artifacts.select.kind === 'armLift' ? artifacts.select.threadShorten : 0;
  // Where a held artifact swings round, from the world's placement (Nox's: the middle of his rings).
  const holdCentre = useMemo(() => holder.centre(placementConfig), [holder, placementConfig]);
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 48, 32);
    const plane = new THREE.PlaneGeometry(1, 1);
    return {
      sphere,
      plane,
      items: bubbles.map(bubble => ({
        bubble,
        glass: createOrbMaterial(logoColour(bubble.iconKey), focusColour, glass),
        halo: createOrbHaloMaterial(logoColour(bubble.iconKey), focusColour),
        logo: createOrbLogoMaterial(logoTexture(bubble.iconKey)),
      })),
    };
  }, [bubbles, focusColour, glass]);

  useEffect(() => () => {
    parts.sphere.dispose();
    parts.plane.dispose();
    for (const item of parts.items) {
      item.glass.dispose();
      item.halo.dispose();
      item.logo.dispose();
    }
  }, [parts]);

  // The placement's run for this many bubbles (the orbit clock and its speed spring, or the pendants' swings), each bubble's current size, and how far all are shown.
  const driver = useMemo(() => placementDriver(placementConfig, bubbles.length), [placementConfig, bubbles.length]);
  const run = useMemo(() => ({ size: new Float32Array(bubbles.length).fill(Number.NaN), shown: 0, hidden: false, blow: appear.createRun(artifacts), hang: { at: new Float32Array(0) as ArrayLike<number>, weight: new Float32Array(0) as ArrayLike<number> } }), [bubbles.length, appear, artifacts]);
  // A placement that hangs its artifacts on threads draws them as one instanced tube batch (a segment each) and one bead per cap.
  const threads = useThreads(placementConfig.kind === 'pendant' ? placementConfig.tether : null, bubbles.length);
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
    // One blow's length is the loaded sheet's; with no sheet in, the run does not read it (it waits, or the blow is given up).
    const sheet = s.blow?.sequences;
    blow.step({ exist: s.show, still: s.still, ready: !!sheet, failed: !s.blow || s.blow.failed, dt, count: bubbles.length, length: sheet ? sheet.length(appear.sheet) : 0, at: s.blow?.at });
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
        // Not stepped while hidden: forget the arms' last places, so they reappear unkicked.
        driver.reset?.();
      }
      s.puff = s.mouthRound = 0;
      return;
    }
    run.hidden = false;
    // The arm lift's hang, read by a placement that hangs pendants (the arrays are the character's, written each frame).
    linkHang(run.hang, s);
    // The placement advances: the orbit clock at its eased speed (motion off, it stands where it is), or the pendants' swings from their arms' motion.
    driver.step({ stage: s.stage, swell: s.swell, dt, hot: s.hot, still: s.still, hang: run.hang }, s.arms);
    const shown = run.shown * run.shown * (3 - 2 * run.shown);
    root.updateWorldMatrix(true, false);
    const { edge, ndc, right, orbit: target, held } = scratch;
    const e = frame.camera.matrixWorld.elements;
    right.set(e[0], e[1], e[2]).normalize();
    const strongest = s.focus.reduce((a, b) => Math.max(a, b), 0);
    const t = frame.clock.elapsedTime;
    parts.items.forEach((item, i) => {
      const node = root.children[i];
      const size = driver.size(s.stage, i);
      // A placement with no place for it (a world that has not laid its artifacts out yet, or a stage with fewer slots than artifacts) draws and offers none.
      if (size === null) {
        node.visible = false;
        bubbleLive.spots[i].visible = false;
        threads?.hide(i);
        return;
      }
      const f = s.focus[i];
      // A bubble grows into its stage's size.
      run.size[i] = Number.isNaN(run.size[i]) || s.still ? size : run.size[i] + (size - run.size[i]) * (1 - Math.exp(-RESIZE_PER_S * dt));
      // Lifted by its arm, a pendant grows by the lift's scale (the focus's own growth is the hold's).
      const lifted = s.lift[i] ?? 0;
      let radius = run.size[i] * (0.4 + 0.6 * shown) * (holder === select ? 1 + (FOCUS_GROW[s.stage] - 1) * f : 1 + (liftScale - 1) * lifted);
      // Blowing, it comes from the mouth to its orbit as it pops out and grows, squashing and stretching (blooming, it grows where it hangs).
      const b = blowing ? appear.frame(blowing, i, blow.seconds!, bubbles.length, artifacts) : null;
      // A pendant hangs its orb a radius past its cap at the size it is now, on a thread drawn down as far as the bloom has it and shortened as far as the lift has it.
      const pendant = threads && driver.pendants ? driver.pendants[i] : null;
      const reach = (b?.bloom ? b.bloom.thread : 1) * (1 - liftShorten * lifted);
      if (pendant && pendant.points.length > 0) {
        const [ax, ay, az] = pendant.attach;
        const end = pendant.points[pendant.points.length - 1];
        const hang = radius * (b ? b.scale : 1);
        target.set(ax + (end[0] - ax) * reach + Math.sin(pendant.angle) * hang, ay + (end[1] - ay) * reach - Math.cos(pendant.angle) * hang, az);
      } else {
        driver.point(s.stage, i, s.swell, target);
      }
      s.orbit[i]?.copy(target);
      if (b) {
        puff = Math.max(puff, b.puff);
        mouthRound = Math.max(mouthRound, b.mouthRound);
        radius *= b.scale;
        appear.position(mouth, target, b.emerged, node.position);
        node.scale.set(radius * (1 + b.wobble), radius * (1 - b.wobble), radius);
        node.visible = b.scale > 0;
      } else {
        node.position.copy(target);
        node.scale.setScalar(radius);
        node.visible = true;
      }
      // Held: pulled along from where it was, swinging round Nox, to just off its arm's tip.
      const pull = s.hold.pull[i] ?? 0;
      if (pull > 0) holder.position(scratch.from.copy(node.position), held.copy(s.hold.tip[i]).addScaledVector(s.hold.dir[i], radius * holder.offTip), pull, holdCentre, node.position);
      // Its thread, from the arm to the cap on the orb: not while it flies from the mouth to its place, nor once an arm has taken it off its thread.
      // Blooming, its cup glows, the pearl (the cap) grows and the thread draws down.
      if (threads && pendant) {
        if ((b && b.emerged < 1) || pull > 0.001) threads.hide(i);
        else threads.write(i, pendant.points, reach, b?.bloom ? b.bloom.pearl : 1, b?.bloom ? b.bloom.cupGlow * (1 - b.scale) : 0);
      }
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
      bubbleLive.sides[i] = sideOfFace(node.position.x, faceOrigin);
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
    threads?.finish(shown);
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
      {threads && (
        <>
          <primitive object={threads.segments} />
          <primitive object={threads.caps} />
          <primitive object={threads.glows} />
        </>
      )}
    </group>
  );
}
