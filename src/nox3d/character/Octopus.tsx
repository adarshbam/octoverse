import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BlinkScheduler, floatOffset, spring } from '../behavior/ambient';
import { Attention, nearFace } from '../behavior/attention';
import { coreGlowFacing } from '../behavior/entrance';
import { type ExpressionId, SWIM_BLINK, blendExpression, resolveExpressions } from '../behavior/expressions';
import { FocusChoreography } from '../behavior/focusChoreography';
import type { PoseBlender } from '../behavior/poseBlend';
import { bubbleHotFor, reachesForPointer, reachingArm } from '../behavior/reach';
import { screenToStage } from '../stage/anchors';
import { isRestful } from '../behavior/stageMachine';
import { ARM_IDS, type ArtifactConfig, type CharacterConfig, type StageId } from '../config/types';
import { arrivalWiggle, settleOvershoot, startle } from '../motion/micro';
import { SETTLE_IDLE, arrivalDue, inwardSign, settleStep, startleDue, trailSpeed } from '../motion/microTriggers';
import { strokeAt } from '../motion/stroke';
import { createSwimRests, swimArmPitch, swimShapes } from '../motion/swimArms';
import type { StagePose, SwimPoseSet } from '../poses/types';
import { ENTRANCE_SECONDS, type EntranceFrame, entranceDrive, entranceFrame, entranceRests, revealParts } from '../sequences/entrance';
import type { Sequences } from '../sequences/theatre';
import { type BlowSheet, bubblesExist } from '../sequences/bubbleBlow';
import { type HeadDraw, type SwellFrame, type SwellSheet, SwellRun, headDraw } from '../sequences/headSwell';
import { TIER_SETTINGS, type TierSettings } from '../stage/quality';
import { type BubbleState, type PlacedBubble, TechBubbles } from '../artifacts/TechBubbles';
import { debugWindow, report, reportObject } from '../host/debugHooks';
import { useInstance } from '../host/instanceContext';
import { useWindowListeners } from '../host/listeners';
import type { Box } from '../artifacts/suctionHold';
import { APPEARS, SELECTS } from '../artifacts/strategies';
import { ArmChain } from './armChain';
import { ArmTube } from './armTube';
import { ArmWeb, WEB_PAIRS } from './armWeb';
import { Aura } from './Aura';
import { FACE_RECT, FaceCanvas } from './FaceCanvas';
import { GLOW_LIGHT_OFFSET, lightParticles } from './glowLight';
import { createGlowMaterial } from './glowMaterial';
import { createHaloMaterial } from './haloMaterial';
import { createDomeGeometry, createHeadGeometry } from './headGeometry';
import { createHeadSilhouetteMaterial } from './headMorph';
import { HEAD_EFFECTS } from './headEffects';
import { createSkinMaterial, createSkinUniforms } from './skinMaterial';
import { createDomeMaterial } from './domeMaterial';
import { LocalGrade } from './LocalGrade';
import { createCupArmAttribute, createCupShadowMaterial, createSuckerMaterial } from './suckerMaterial';
import { SuckerRow, createCupShadow, createSuckerCup } from './suckerRow';
import { type AccentLink, farHaze } from './worldAccent';

/** Rotation pivot for whole-body turns: the middle of the body. */
const PIVOT_Y = -0.6;
/** Pivot for the head's own turns and tilt (head-local height): the neck, under the chin. */
const NECK_Y = -1.05;
/**
 * How long the entrance waits for its sheet (the Theatre state, loading beside the first frame)
 * before the stage gives up on it and lands in the intro, in seconds of frames drawn; Nox stays out
 * of sight meanwhile.
 */
export const ENTRANCE_SHEET_WAIT = 4;
/**
 * The most one frame moves the entrance's clock on (seconds). The clock runs on frame time, not the
 * wall clock, so a long stall (shaders compiling, the world's kit decoding on a busy machine) pauses
 * the entrance rather than skipping it; below 10 frames a second it runs slower.
 */
const ENTRANCE_MAX_STEP = 0.1;

/** The entrance's sheet as the stage loads it: the sequences once they are in, or that they failed. */
export interface EntranceSheet {
  sequences: Sequences | null;
  failed: boolean;
}

export interface OctopusProps {
  config: CharacterConfig;
  /** The character's swim: the stroke's arm shapes, and the body's centre line the swim turns about (`WorldBundle.swim`). */
  swimPoses: SwimPoseSet;
  /** The pose the swim settles into: the intro's (`WorldBundle.poses.intro`). */
  introPose: StagePose;
  /** How the world's artifacts are placed, appear and are chosen: the strategies this character's bubbles and hold run (artifacts/strategies.ts). */
  artifacts: ArtifactConfig;
  /** Moves Nox between stage poses; sampled every frame. */
  blender: PoseBlender;
  /** The current stage: the entrance's swim, resting and reaching for the pointer in the intro. */
  stage: StageId;
  /** A face shown instead of the stage's own, for expression captures. */
  expression?: ExpressionId;
  /** Rest pose with no motion, for comparison captures. */
  freeze: boolean;
  /** Visitors who prefer reduced motion: no float or sway. */
  reducedMotion?: boolean;
  /** A panel is open over the stage, so Nox stays awake. */
  panelOpen?: boolean;
  /** Silhouette capture: hide additive glow cards that would read as solid shape. */
  silhouette?: boolean;
  /** Mesh detail from the quality tier. */
  quality?: TierSettings;
  /** Clicking Nox's head (it opens into the overview). */
  onSelect?: () => void;
  /** The technology bubbles that orbit Nox once the entrance has settled. */
  orbs?: readonly PlacedBubble[];
  /** The technology in focus: its bubble glows and Nox looks at it. */
  focusTechId?: string | null;
  /** The bubble blow's sheet: Nox blows the bubbles from his mouth when they first appear (sequences/bubbleBlow.ts). */
  blowSheet?: BlowSheet;
  /**
   * The entrance (sequences/entrance.ts), read each frame while the stage is `entering`: its clock
   * starts on the first frame drawn with the sheet in, and runs on frame time. Until then Nox is out
   * of sight; if the sheet fails, or has not come within ENTRANCE_SHEET_WAIT, `onEntranceUnavailable`
   * is called.
   */
  entranceSheet?: EntranceSheet;
  /** Read each frame: while true the entrance's clock stands at its start (the page's boot veil is up, so the swim waits to be seen). */
  entranceHold?: () => boolean;
  /** With `freeze`: the moment of the entrance shown, in seconds. */
  entranceSeconds?: number;
  /** The settle has begun (7.4 s, after the spin): the intro's words come in. */
  onEntranceSettling?: () => void;
  /** The entrance has run its course: Nox faces the visitor in the intro pose. */
  onEntranceDone?: () => void;
  /** The entrance cannot play (its sheet did not load in time). */
  onEntranceUnavailable?: () => void;
  /** Each entrance frame and its time in seconds (for development checks). */
  onEntranceFrame?: (frame: EntranceFrame, seconds: number) => void;
  /**
   * In a world: the accents it feeds the skin; Octopus writes where the face glow and its light are each frame. Nox
   * then casts the surface light's shadow, and brings his aura, his glow's light and the local grade.
   */
  accents?: AccentLink;
  /** For measurement captures only: the bubbles and the dome glass are not drawn. */
  solo?: boolean;
  /** No technology bubbles are drawn (a preview's `artifacts: 'hidden'`); everything else is as it was. */
  hideArtifacts?: boolean;
  /** Degrees the whole body turns about its upright axis, on top of the stage's turn: for stills of his back. */
  yaw?: number;
  /**
   * A swim drive held on every arm (ArmDrive.pitch and straighten), for review stills of the swim
   * poses; no arm reaches for the pointer while it is on.
   */
  armDrive?: { pitch: number; straighten: number };
  /** With `freeze`: the moment of the suction hold shown, in ms from the choice (review stills); otherwise a still shows it held. */
  holdAt?: number;
  /**
   * Whether the head is swollen open (the overview, and a technology focus from it): each change
   * plays the head swell (sequences/headSwell.ts). Without it, the stage blend's headMorph decides.
   */
  headOpen?: boolean;
  /** The head swell's sheet; until it is in (or if it fails), the stage blend opens the head as before. Its `seconds` time the swell's clock. */
  swellSheet: SwellSheet;
}

/** Seconds for Nox to settle into rest, and to wake from it. */
const REST_IN = 2;
const WAKE = 0.5;
/** The warm glow card before the chin, facing the visitor. */
const CORE_GLOW = 0.22;

/** A procedural octopus: eight bending arms, a lathed mantle and a canvas-drawn face. */
export function Octopus({ config, swimPoses, introPose, artifacts, blender, stage, expression, freeze, reducedMotion = false, panelOpen = false, silhouette = false, quality = TIER_SETTINGS.high, onSelect, orbs = [], focusTechId = null, blowSheet, entranceSheet, entranceHold, entranceSeconds = 0, onEntranceSettling, onEntranceDone, onEntranceUnavailable, onEntranceFrame, accents, solo = false, hideArtifacts = false, yaw = 0, armDrive, holdAt, headOpen, swellSheet }: OctopusProps) {
  const instance = useInstance();
  const extraYaw = THREE.MathUtils.degToRad(yaw);
  const float = useRef<THREE.Group>(null);
  // The swim's own turn and lean, about the body's middle: yaw first, then the lean about his own
  // sideways axis. Identity outside the entrance, but for a still's extra turn (?yaw).
  const swimTurn = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const auraMesh = useRef<THREE.Mesh>(null);
  const gradeMesh = useRef<THREE.Mesh>(null);
  const content = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const dome = useRef<THREE.Mesh>(null);
  const headTurn = useRef<THREE.Group>(null);
  const headSpace = useRef<THREE.Group>(null);
  // Where the bubbles come out: this character's mouth, worked out once from its head and face.
  const appear = APPEARS[artifacts.appear.kind];
  const select = SELECTS[artifacts.select.kind];
  const mouth = useMemo(() => appear.origin(config.head, config.face), [appear, config.head, config.face]);
  // The entrance's stroke timing (the arguments entranceFrame takes of the character).
  const entranceSwim = useMemo(() => ({ swim: config.personality.swim }), [config.personality.swim]);
  // The head swell's clock, and the frame and draw it writes each frame (never allocated per frame).
  const swellSeconds = swellSheet.seconds;
  const swell = useMemo(() => ({ run: new SwellRun(swellSeconds), frame: { morph: 0, squeeze: 0, push: 0, effect: 0 } as SwellFrame, draw: {} as HeadDraw }), [swellSeconds]);
  const bubbleState = useMemo<BubbleState>(() => ({
    show: false, stage: 'intro', hot: false, still: false, swell: 0, focus: new Float32Array(orbs.length), blow: blowSheet, puff: 0, mouthRound: 0,
    orbit: orbs.map(() => new THREE.Vector3()),
    hold: { pull: new Float32Array(orbs.length), tip: orbs.map(() => new THREE.Vector3()), dir: orbs.map(() => new THREE.Vector3(0, -1, 0)) },
  }), [orbs, blowSheet]);
  // One timeline for every technology focus: eyes, face, arm, emphasis, release.
  const choreography = useMemo(() => new FocusChoreography(orbs.length), [orbs]);
  // The suction hold: the arm nearest a chosen bubble (not across the face) turns, pulls it to its tip and lifts it.
  const holdArm = useRef<(bubble: number) => number>(() => 0);
  const hold = useMemo(() => select.choreography(bubble => holdArm.current(bubble)), [select, orbs]);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const faceAt = useMemo(() => new THREE.Vector3(), []);
  const restAt = useMemo(() => new THREE.Vector3(), []);
  // In a world Nox brings his aura, the grade of the water near him and his face glow's light on
  // the seabed, stone and the world's lit pieces round him (his own skin lights itself and takes
  // none of it). A silhouette capture has none of them: they would draw as shape.
  const world = silhouette ? undefined : accents;
  // The faces this character wears: the engine's base table with its own overrides.
  const faces = useMemo(() => resolveExpressions(config), [config]);
  const glowLight = useMemo(() => (world ? new THREE.PointLight(config.glow.light.color, config.glow.light.intensity, config.glow.light.distance, config.glow.light.decay) : null), [world, config.glow.light]);
  useEffect(() => () => glowLight?.dispose(), [glowLight]);
  // The world's particles take no scene lights: they take the same light as a tint, black again when he leaves.
  useEffect(() => {
    if (!world) return;
    lightParticles(world.light, config.glow.light);
    return () => void world.light.uNoxLight.value.setScalar(0);
  }, [world, config.glow.light]);

  const rig = useMemo(() => {
    // In a world, the world's accents replace the skin's own all-zero ones.
    const uniforms = { ...createSkinUniforms(config), ...accents?.uniforms };
    const face = new FaceCanvas(config.face, config.facePalette);
    const profile = { tipRadius: config.tipRadius, taperPower: config.taperPower, suckerTilt: config.suckers.tilt, curlTilt: config.suckers.curlTilt, twist: config.suckers.twist, flatten: config.armFlatten };
    const arms = config.arms.map((spec, i) => {
      const chain = new ArmChain(blender.layout[spec.id], spec, i);
      const tube = new ArmTube(chain, spec, profile, quality.radial, config.head.centerX);
      return { chain, tube, row: new SuckerRow(chain, tube, config.suckers, i) };
    });
    const byId = new Map(config.arms.map((spec, i) => [spec.id, arms[i]]));
    const webs = WEB_PAIRS.map(([a, b]) => {
      const left = byId.get(a)!;
      const right = byId.get(b)!;
      const centre = a === 'T4' && b === 'T5';
      return new ArmWeb(left.chain, right.chain, u => left.tube.radiusAt(u), u => right.tube.radiusAt(u), centre ? 0.14 : 0.2, centre ? 0 : undefined);
    });
    const webMaterial = createSkinMaterial('ARM', uniforms);
    webMaterial.side = THREE.DoubleSide;
    // The cups and their contact shadows share one set of placements and bends.
    const suckerTotal = arms.reduce((n, a) => n + a.row.count, 0);
    const suckerBend = new THREE.InstancedBufferAttribute(new Float32Array(suckerTotal * 2), 2).setUsage(THREE.DynamicDrawUsage);
    const cupDetail = Math.round(32 * quality.suckerScale);
    const cupGeometry = createSuckerCup(cupDetail);
    cupGeometry.setAttribute('aBend', suckerBend);
    cupGeometry.setAttribute('aCup', createCupArmAttribute(arms.map(({ row, chain }) => ({ row, length: chain.segmentLength * chain.segments }))));
    const shadowGeometry = createCupShadow(cupDetail);
    shadowGeometry.setAttribute('aBend', suckerBend);
    const suckers = new THREE.InstancedMesh(cupGeometry, createSuckerMaterial(config.palette, uniforms), suckerTotal);
    suckers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    suckers.frustumCulled = false;
    const cupShadows = new THREE.InstancedMesh(shadowGeometry, createCupShadowMaterial(config.palette, config.suckers, uniforms), suckerTotal);
    cupShadows.instanceMatrix = suckers.instanceMatrix;
    cupShadows.frustumCulled = false;
    return {
      uniforms,
      face,
      arms,
      webs,
      webMaterial,
      headGeometry: createHeadGeometry(config.head, config.dome.mantleTop),
      // The halo shell draws its far side: without the cheek lobes mirrored behind, the front keeps
      // its approved glow and the back gets a glow round the cheeks.
      haloGeometry: createHeadGeometry(config.head, config.dome.mantleTop, false),
      domeGeometry: createDomeGeometry(config.dome),
      domeMaterial: createDomeMaterial(config.palette, config.dome),
      suckers,
      cupShadows,
      suckerBend,
      headMaterial: createSkinMaterial('HEAD', uniforms, { texture: face.texture, rect: FACE_RECT }),
      armMaterial: createSkinMaterial('ARM', uniforms),
      coreGlow: createGlowMaterial(config.glow.core, CORE_GLOW, 2.4),
      armHalo: createHaloMaterial(config.glow.halo, 'ARM'),
      headHalo: createHaloMaterial(config.glow.halo, 'HEAD', new THREE.Vector3(config.head.centerX - config.head.faceOrigin[0], config.head.waist - config.head.faceOrigin[1], 0), uniforms.uMorph),
      glowLocal: new THREE.Vector3(...config.glow.center),
      // The skin's atmospheric depth, measured from the body's own plane (it moves with him in z).
      hazeBase: uniforms.uHaze.value.clone(),
      swimRests: createSwimRests(arms[0].chain.segments),
      // What this rig's materials last showed of the entrance's haze and veil (written only on a change).
      shown: { hazeZ: 0, veil: 0 },
    };
    // Built once per character and quality tier; stage poses reach the arms as new rests each frame.
  }, [config, blender, quality, accents]);

  // A silhouette capture draws the head white through its morph, so the overview's mask has the
  // open head the overview shows, not the closed one.
  const headSilhouette = useMemo(() => (silhouette ? createHeadSilhouetteMaterial(rig.uniforms.uMorph) : null), [silhouette, rig]);
  useEffect(() => () => headSilhouette?.dispose(), [headSilhouette]);
  // The head swell's effect (HEAD_EFFECTS; Nox's: glowing red glyphs over the dome); 'none' draws the
  // dome alone, and so does a silhouette capture, where an effect would read as shape.
  const effect = useMemo(() => (silhouette ? null : HEAD_EFFECTS[config.headEffect ?? 'none'].create(config.dome, config.palette)), [config, silhouette]);
  useEffect(() => () => effect?.dispose(), [effect]);

  const readBubbles = useMemo(() => () => bubbleState, [bubbleState]);

  // Every shader, the dome's too, is compiled up front, so the first opening never stalls.
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  useEffect(() => {
    const mesh = dome.current;
    if (!mesh) return;
    const was = mesh.visible;
    const effectRoot = effect?.root;
    const effectWas = effectRoot?.visible ?? false;
    mesh.visible = true;
    if (effectRoot) effectRoot.visible = true;
    gl.compile(scene, camera);
    mesh.visible = was;
    if (effectRoot) effectRoot.visible = effectWas;
  }, [gl, scene, camera, rig, effect]);

  // A lost WebGL context takes the face's texture with it, and a still face (freeze, reduced
  // motion, a held expression) is not redrawn: send it again once the context is restored
  // (three.js's own listener, added first, has by then rebuilt its state).
  useEffect(() => {
    const restored = () => rig.face.invalidate();
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => gl.domElement.removeEventListener('webglcontextrestored', restored);
  }, [gl, rig]);

  // A rebuilt rig (a lower tier) frees the old one's GPU buffers.
  useEffect(() => () => {
    for (const { tube } of rig.arms) tube.geometry.dispose();
    for (const web of rig.webs) web.geometry.dispose();
    rig.headGeometry.dispose();
    rig.haloGeometry.dispose();
    rig.domeGeometry.dispose();
    rig.domeMaterial.dispose();
    for (const mesh of [rig.suckers, rig.cupShadows]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const material of [rig.webMaterial, rig.headMaterial, rig.armMaterial, rig.coreGlow, rig.armHalo, rig.headHalo]) material.dispose();
    rig.face.dispose();
  }, [rig]);

  const motion = useRef({
    attention: new Attention(config.personality),
    blinks: new BlinkScheduler(config.personality.blinkInterval, config.personality.doubleBlinkChance, config.personality.micro.blink),
    smile: { x: 0, v: 0 },
    tilt: { x: 0, v: 0 },
    pointerInside: false,
    ray: new THREE.Vector3(),
    target: new THREE.Vector3(),
    inverse: new THREE.Matrix4(),
    glow: new THREE.Vector3(),
    reach: config.arms.map(() => ({ x: 0, v: 0 })),
    reachPoint: config.arms.map(() => new THREE.Vector2()),
    // What the host asked it to look at (instance.attend), in normalised device coordinates.
    attendAt: { x: 0, y: 0 },
    // The suction hold: each held bubble's arm tip when it was chosen; each arm's turn toward its bubble, and where to.
    holdFrom: new Map<number, THREE.Vector3>(),
    holdWeight: new Float32Array(config.arms.length),
    holdSum: config.arms.map(() => new THREE.Vector2()),
    holdPoint: new THREE.Vector2(),
    lastInput: performance.now(),
    rest: 0,
    breathPhase: 0,
    // The entrance's clock (seconds of frame time from its first frame; null until the sheet is in) and the wait for its sheet.
    entrance: { seconds: null as number | null, waited: 0, settling: false, done: false, gaveUp: false },
    // How much of the glow the aura, the grade and the glow's light last showed: written only on a change (never at rest).
    glowShown: 1,
    // The micro-animations (motion/micro.ts): seconds since each began (Infinity: not playing), on
    // frame time that stops with `freeze` and reduced motion; what triggers them; and last frame's
    // lift, so the arms trail against it.
    micro: {
      startle: Infinity,
      settle: Infinity,
      arrival: Infinity,
      arrived: false,
      pointer: null as { x: number; y: number } | null,
      near: 0,
      body: null as { x: number; y: number } | null,
      move: SETTLE_IDLE,
      dir: { x: 0, y: 0 },
      lift: 0,
    },
  });

  // The pointer and the keys wake him from rest. Only a page instance listens (a preview shares the window with the page and does not).
  useWindowListeners(instance.mode, {
    pointermove: () => {
      motion.current.pointerInside = true;
      motion.current.lastInput = performance.now();
    },
    pointerdown: () => { motion.current.lastInput = performance.now(); },
    keydown: () => { motion.current.lastInput = performance.now(); },
    touchstart: () => { motion.current.lastInput = performance.now(); },
  });
  useEffect(() => {
    if (instance.mode !== 'page') return;
    const m = motion.current;
    const leave = () => { m.pointerInside = false; };
    document.documentElement.addEventListener('mouseleave', leave);
    return () => document.documentElement.removeEventListener('mouseleave', leave);
  }, [instance.mode]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = freeze ? 0 : state.clock.elapsedTime;
    const live = freeze ? 0 : 1;
    const m = motion.current;
    const personality = config.personality;
    const now = performance.now();
    const pose = blender.sample(now);
    const moving = reducedMotion ? 0 : live;

    // The entrance (design 9.6): the sheet carries the body in from the murk, leans and turns it,
    // and drives the strokes, timed from its own first frame on frame time, so neither a slow start
    // nor a stall cuts it short. A still (`freeze`) shows the moment `entranceSeconds`. Until the
    // sheet is in Nox is out of sight.
    let swim: EntranceFrame | null = null;
    let hidden = false;
    if (stage === 'entering') {
      const e = m.entrance;
      const sheet = entranceSheet?.sequences ?? null;
      const step = Math.min(delta, ENTRANCE_MAX_STEP);
      if (!sheet) {
        hidden = true;
        e.waited += step;
        if (!freeze && !e.gaveUp && (entranceSheet?.failed || e.waited >= ENTRANCE_SHEET_WAIT)) {
          e.gaveUp = true;
          onEntranceUnavailable?.();
        }
      } else {
        e.seconds = e.seconds === null ? 0 : e.seconds + (entranceHold?.() ? 0 : step);
        const seconds = freeze ? entranceSeconds : e.seconds;
        swim = entranceFrame(sheet, seconds, entranceSwim);
        onEntranceFrame?.(swim, seconds);
        if (!freeze) {
          if (!e.settling && swim.settle > 0) {
            e.settling = true;
            onEntranceSettling?.();
          }
          if (!e.done && seconds >= ENTRANCE_SECONDS) {
            e.done = true;
            onEntranceDone?.();
          }
        }
      }
    }
    // The stroke the sheet is in, and its arm drive: the follow-through is in these (no arm physics).
    // The drive gives way as the arms swing forward (`forward`), before they spread (`open`).
    const stroke = swim ? strokeAt(swim.stroke, personality.swim) : null;
    const drive = swim && stroke ? entranceDrive(swim, stroke) : null;
    const bodyX = pose.body.x + (swim ? swim.position[0] : 0);
    const bodyY = pose.body.y + (swim ? swim.position[1] : 0);
    const bodyZ = swim ? swim.position[2] : 0;

    // After a long idle in the intro Nox rests; any input wakes it within half a second.
    const resting = !freeze && isRestful(stage, now - m.lastInput, panelOpen);
    m.rest = THREE.MathUtils.clamp(m.rest + (resting ? dt / REST_IN : -dt / WAKE), 0, 1);

    // The micro-animations (design 9.7, motion/micro.ts), each fed into the pose: their clocks run
    // on frame time and stop with `freeze` and reduced motion, and each is scaled by `moving`, so a
    // still shows the pose exactly. No arm physics (R52): the follow-through is in their curves.
    const mc = m.micro;
    const micro = personality.micro;
    const microStep = moving * dt;
    mc.startle += microStep;
    mc.settle += microStep;
    mc.arrival += microStep;
    // The settle overshoot: when a stage move of the body lands, he carries on past the pose along it
    // and back (motion/microTriggers.ts settleStep: a skip, landing at once, has none).
    const lastBody = (mc.body ??= { x: pose.body.x, y: pose.body.y });
    mc.move = settleStep(mc.move, pose.body.x - lastBody.x, pose.body.y - lastBody.y, moving, swim !== null);
    lastBody.x = pose.body.x;
    lastBody.y = pose.body.y;
    if (mc.move.landed) {
      mc.dir.x = mc.move.landed.x;
      mc.dir.y = mc.move.landed.y;
      mc.settle = 0;
    }
    // The arrival wiggle plays once, as the entrance (run to its end, not skipped) hands over to the intro.
    if (arrivalDue({ moving, stage, arrived: mc.arrived, entranceDone: m.entrance.done })) {
      mc.arrived = true;
      if (entranceSheet?.sequences) mc.arrival = 0;
    }
    const flinch = startle(mc.startle, micro);
    const settle = moving * settleOvershoot(mc.settle, micro);
    const wiggle = entranceSheet?.sequences ? arrivalWiggle(entranceSheet.sequences, mc.arrival, micro) : { roll: 0, armWave: 0 };
    const lift = moving * flinch.lift + settle * mc.dir.y;
    // The arms trail against the lift as they do against the float (`droop`), at a gentler gain;
    // never when still, and clamped, so motion switching back on mid-startle cannot spike a frame.
    const liftSpeed = trailSpeed(lift, mc.lift, dt, moving);
    mc.lift = lift;

    const drift = floatOffset(t, personality);
    float.current!.position.set(bodyX + moving * drift.x + settle * mc.dir.x, bodyY + moving * drift.y + lift, bodyZ);
    float.current!.scale.setScalar(pose.body.scale);
    // A still's extra turn (?yaw) goes on outside the lean, so a swim still turned 90 degrees shows him in profile.
    swimTurn.current!.rotation.set(swim ? swim.pitch : 0, (swim ? swim.yaw : 0) + extraYaw, 0);
    turn.current!.visible = !hidden;

    // Out of the murk: how much of Nox shows (the sheet's reveal; none while the sheet loads), and
    // how far the water between him and the camera hides him (his own far haze, beyond 18 units).
    const parts = swim ? revealParts(swim.reveal) : hidden ? { glow: 0, shape: 0 } : null;
    const far = swim && world ? farHaze(state.camera.position.distanceTo(float.current!.position), rig.uniforms.uFarHaze.value) : 0;
    const glowShown = parts ? parts.glow * (1 - far) : 1;
    // The skin fades by the pixel (its far haze is in its shader); the cups and the glows by the body's distance.
    const skinVeil = parts ? 1 - parts.shape : 0;
    const cupVeil = Math.max(far, skinVeil);
    rig.uniforms.uVeil.value = skinVeil;
    const shown = rig.shown;
    if (bodyZ !== shown.hazeZ) {
      // The skin's depth haze is for the parts behind his body's plane, wherever he is.
      shown.hazeZ = bodyZ;
      rig.uniforms.uHaze.value.set(rig.hazeBase.x - bodyZ, rig.hazeBase.y - bodyZ, rig.hazeBase.z);
    }
    if (glowShown !== m.glowShown) {
      m.glowShown = glowShown;
      if (world) lightParticles(world.light, config.glow.light, glowShown);
      if (glowLight) glowLight.intensity = config.glow.light.intensity * glowShown;
      const aura = auraMesh.current?.material as THREE.ShaderMaterial | undefined;
      if (aura) aura.uniforms.uStrength.value = config.glow.aura.strength * glowShown;
      const grade = gradeMesh.current?.material as THREE.ShaderMaterial | undefined;
      if (grade) grade.uniforms.uStrength.value = config.glow.grade.strength * glowShown;
    }
    if (cupVeil !== shown.veil) {
      shown.veil = cupVeil;
      (rig.suckers.material as THREE.ShaderMaterial).uniforms.uVeil.value = cupVeil;
      (rig.cupShadows.material as THREE.ShaderMaterial).uniforms.uStrength.value = config.suckers.shadow * (1 - cupVeil);
      rig.armHalo.uniforms.uStrength.value.set(config.glow.halo.strength * (1 - cupVeil), config.glow.halo.bandStrength * (1 - cupVeil));
    }

    // The technology in focus. One timeline (FocusChoreography) runs it: the eyes turn at once,
    // the face reacts a beat later, then the bubble glows and grows while the others dim; the
    // orbits have eased to still. Letting go runs back the same way. Every value retargets from
    // where it is, so quick changes never jump.
    const selected = focusTechId ? orbs.findIndex(o => o.techId === focusTechId) : -1;
    // A still capture (freeze) shows the focus as it settles, at once.
    choreography.update(selected, now, dt * 1000, reducedMotion || freeze);
    const out = THREE.MathUtils.clamp(pose.orbs, 0, 1);
    let fixed: { x: number; y: number } | undefined;
    if (selected >= 0) {
      // Eyes follow the bubble (it slows to a stop as they settle on it).
      lookAt.copy(instance.bubbleLive.worlds[selected]).project(state.camera);
      fixed = { x: lookAt.x, y: lookAt.y };
    }
    // The host's `attend` target (canvas pixels) stands in for the pointer as a fixed point of attention: a focused bubble comes first.
    const { attend } = instance;
    if (attend.target && !fixed) {
      m.attendAt.x = (attend.target.x / state.size.width) * 2 - 1;
      m.attendAt.y = 1 - (attend.target.y / state.size.height) * 2;
      fixed = m.attendAt;
    }

    faceAt.set(config.head.faceOrigin[0] + bodyX, config.head.faceOrigin[1] + bodyY, 0).project(state.camera);

    // Where the stage rests Nox's eyes when nothing else holds them (the detail panel).
    const rest = pose.look ? restAt.set(pose.look[0], pose.look[1], 0).project(state.camera) : null;

    const p = state.pointer;
    // Frozen, the eyes rest ahead, or settle on the orb in focus or where the stage rests them.
    // Swimming in, Nox looks where he is going.
    const gaze = (freeze && !fixed && !rest) || stage === 'entering'
      ? { gazeX: 0, gazeY: 0, headX: 0, headY: 0, tracking: false }
      : m.attention.update(m.pointerInside && !freeze ? { x: p.x, y: p.y } : null, t, dt, fixed, { x: faceAt.x, y: faceAt.y }, rest ? { x: rest.x, y: rest.y } : undefined);
    const near = gaze.tracking ? nearFace(p, faceAt) : 0;
    spring(m.smile, near, 5, dt);
    // The small startle: the pointer darting in close to the face (motion/microTriggers.ts startleDue).
    const closeness = m.pointerInside ? nearFace(p, faceAt) : 0;
    const pointerSpeed = mc.pointer && dt > 0 ? Math.hypot(p.x - mc.pointer.x, p.y - mc.pointer.y) / dt : 0;
    if (startleDue({ moving, stage, near: closeness, nearBefore: mc.near, speed: pointerSpeed, since: mc.startle }, micro)) mc.startle = 0;
    mc.near = closeness;
    if (m.pointerInside) {
      mc.pointer ??= { x: 0, y: 0 };
      mc.pointer.x = p.x;
      mc.pointer.y = p.y;
    } else {
      mc.pointer = null;
    }

    // The face reacts to each technology in its own way (Kali: the focused face of panel 4;
    // others: a subtle curiosity), and the head tilts a little toward it.
    // Swimming in, the determined happy face, landing on the gentle smile as he settles.
    let activeExpression = expression ? faces[expression] : swim ? blendExpression(faces.happy, faces.gentle, swim.settle) : pose.expression;
    let tiltTarget = 0;
    let strongest = 0;
    orbs.forEach((orb, i) => {
      const f = choreography.face(i);
      if (f <= 0) return;
      activeExpression = blendExpression(activeExpression, faces[orb.reaction ?? 'curious'], f);
      if (f > strongest) {
        strongest = f;
        tiltTarget = 0.1 * f * (instance.bubbleLive.sides[i] ?? 1);
      }
    });
    spring(m.tilt, reducedMotion ? 0 : tiltTarget, 5, dt);
    // While the orbs are out the body barely turns, so the orbs and arms hold still under the
    // visitor's pointer; the head turns and tilts on its own instead. In the intro the whole body
    // turns, as before.
    const bodyTurn = 1 - 0.75 * out;
    turn.current!.rotation.set(-gaze.headY * 0.08 * bodyTurn, pose.body.yaw + gaze.headX * 0.15 * bodyTurn, moving * (drift.roll + wiggle.roll) - gaze.headX * 0.02 * bodyTurn);
    headTurn.current!.rotation.set(-gaze.headY * 0.06 * out, gaze.headX * 0.1 * out, pose.tilt - m.tilt.x);
    // The glow card turns with the head; turned side-on (the entrance's spin) it fades rather than
    // show edge-on beside the face.
    rig.coreGlow.uniforms.uStrength.value = CORE_GLOW * coreGlowFacing((swim ? swim.yaw : 0) + extraYaw) * glowShown;

    const face = blendExpression(activeExpression, faces.restful, m.rest);
    // Startled, the brows jump and the eyes open wide.
    const startled = moving * flinch.eyes;
    rig.face.draw({
      ...face,
      browLift: face.browLift + startled,
      lidRest: face.lidRest * (1 - Math.min(1, startled)),
      mouthCurve: face.mouthCurve + m.smile.x * 0.7,
      blush: Math.max(face.blush, m.smile.x),
      // Swimming, he blinks at a slower rate.
      blink: freeze ? 0 : m.blinks.sample(t, swim && swim.settle < 1 ? SWIM_BLINK : 1),
      // Blowing the bubbles, his cheeks puff and his mouth rounds (written by TechBubbles).
      puff: Math.max(face.puff ?? 0, bubbleState.puff),
      mouthRound: Math.max(face.mouthRound ?? 0, bubbleState.mouthRound),
      gazeX: gaze.gazeX,
      gazeY: gaze.gazeY,
    });
    rig.face.upload(state.gl);

    // Breathing: the mantle swells slightly; arm roots stay buried in the web. At rest it slows
    // by 1.4x; the phase is carried forward so a change of pace never jumps.
    m.breathPhase += (live * dt) / (personality.breathPeriod * (1 + 0.4 * m.rest));
    const b = live * Math.sin(m.breathPhase * Math.PI * 2);
    // Swimming, the mantle fills in each recovery and squeezes in each power stroke, less as he settles.
    const mantle = swim && stroke ? 1 + stroke.mantle * (1 - swim.settle) : 1;
    // The head swell (sequences/headSwell.ts): opening or closing plays its sheet on frame time; with
    // motion off it is at its end at once (a review still, `?freeze&swell=<s>`, holds that moment).
    swell.run.step({ open: headOpen ?? pose.headMorph >= 0.5, still: freeze || reducedMotion, dt: Math.min(delta, ENTRANCE_MAX_STEP), at: swellSheet.at });
    const sf = swell.run.frame(swellSheet.sequences, pose.headMorph, swell.frame);
    const hd = headDraw(sf, swell.draw);
    // The swell as the development build reports it, for the end-to-end tests (`window.__octoverse.swell`; `__noxSwell` for Nox).
    const probe = import.meta.env.DEV ? debugWindow(instance) : null;
    if (probe) Object.assign(reportObject(instance, 'swell', () => ({})), { open: swell.run.open, moving: swell.run.moving, morph: sf.morph, effect: sf.effect, push: sf.push });
    // Before it swells the head squeezes a little: the anticipation.
    head.current!.scale.set((1 + b * 0.016) * mantle * hd.across, (1 + b * 0.011) * mantle * hd.up, (1 + b * 0.016) * mantle * hd.across);

    // Pointer on the z = 0 plane, in the space the arms are authored in.
    content.current!.updateWorldMatrix(true, false);
    m.ray.set(p.x, p.y, 0.5).unproject(state.camera).sub(state.camera.position).normalize();
    m.target.copy(state.camera.position).addScaledVector(m.ray, -state.camera.position.z / m.ray.z);
    m.inverse.copy(content.current!.matrixWorld).invert();
    m.target.applyMatrix4(m.inverse);
    // Reaching for the host's `attend` target: the point on the stage plane it looks at stands in for the pointer's.
    const attendReach = attend.reach && attend.target !== null;
    if (attendReach) {
      const at = screenToStage(attend.target!, state.camera, state.size);
      m.target.set(at.x, at.y, 0).applyMatrix4(m.inverse);
    }

    // The bubbles: shown in the intro and the overview once the entrance has settled (never in it),
    // hidden beside the detail panel. Their orbits ease to still while one is hovered, held or in
    // focus, and stand still with motion off.
    bubbleState.show = !silhouette && !solo && !hideArtifacts && bubblesExist(stage);
    bubbleState.stage = stage === 'intro' || (stage === 'techFocus' && pose.orbs < 0.5) ? 'intro' : 'overview';
    bubbleState.hot = instance.hover.bubble || selected >= 0;
    bubbleState.still = freeze || reducedMotion;
    // The swollen head pushes the orbits out.
    bubbleState.swell = sf.push;
    bubbleState.blow = blowSheet;
    orbs.forEach((_, i) => { bubbleState.focus[i] = choreography.arm(i); });
    // The suction hold (design 9.8): the chosen bubble's arm turns toward it, its cups flare, it is
    // pulled to the tip and lifted; letting go (or choosing another) sends it home. Motion off, it
    // is held at once; `?freeze&hold=<ms>` shows that moment of it.
    const holdStill = freeze && holdAt !== undefined;
    const faceBox: Box = { x0: config.head.centerX - config.head.halfWidth, y0: config.head.bottom, x1: config.head.centerX + config.head.halfWidth, y1: config.head.top };
    holdArm.current = bubble => {
      const at = bubbleState.orbit[bubble];
      return select.nearestArm(rig.arms.map(({ chain }) => [chain.tipX, chain.tipY, chain.pz[chain.segments]] as const), [at.x, at.y, at.z], faceBox);
    };
    hold.instant = reducedMotion || (freeze && !holdStill);
    hold.choose(selected >= 0 ? selected : null, holdStill ? 0 : now);
    const holds = hold.sample(holdStill ? holdAt : now);
    // The hold as the development build reports it, for the end-to-end tests (`window.__octoverse.hold`; `__noxHold` for Nox).
    if (probe) report(instance, 'hold', holds.map(f => ({ techId: orbs[f.bubble].techId, pull: f.pull, release: f.release })));
    m.holdWeight.fill(0);
    for (const sum of m.holdSum) sum.set(0, 0);
    for (const key of m.holdFrom.keys()) if (!holds.some(f => f.bubble === key)) m.holdFrom.delete(key);
    for (const f of holds) {
      const { chain } = rig.arms[f.arm];
      let from = m.holdFrom.get(f.bubble);
      if (!from) m.holdFrom.set(f.bubble, (from = new THREE.Vector3(chain.tipX, chain.tipY, 0)));
      const orbit = bubbleState.orbit[f.bubble];
      const dx = orbit.x - from.x;
      const dy = orbit.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      const outward = Math.min(select.arm.reach, Math.max(0, d - select.arm.short)) * (1 - select.arm.draw * f.pull);
      m.holdWeight[f.arm] += f.turn;
      m.holdSum[f.arm].x += (from.x + (dx / d) * outward) * f.turn;
      m.holdSum[f.arm].y += (from.y + (dy / d) * outward + select.arm.lift * f.lift) * f.turn;
    }
    // In the intro, the arm whose tip is nearest the pointer reaches toward it, never into the
    // face; it never reaches while the pointer is on a bubble.
    // A card is far from every tip, so `attend`'s reach has no range (the head's outline still keeps an arm out of the face).
    const pointerArm = !armDrive && !swim && reachesForPointer(stage, out, gaze.tracking, bubbleHotFor(instance.hover.bubble, selected >= 0, attendReach), attendReach) ? reachingArm(rig.arms.map(({ chain }) => ({ x: chain.tipX, y: chain.tipY })), m.target, config.head, attendReach ? Infinity : undefined) : -1;
    if (probe) {
      // Where the character looks and which arm reaches, for the end-to-end tests (`window.__octoverse.attention`).
      const seen = reportObject(instance, 'attention', () => ({ gazeX: 0, reachArm: -1, tips: rig.arms.map(() => ({ x: 0, y: 0 })), target: { x: 0, y: 0 } }));
      seen.gazeX = gaze.gazeX;
      seen.reachArm = pointerArm;
      rig.arms.forEach(({ chain }, i) => { seen.tips[i].x = chain.tipX; seen.tips[i].y = chain.tipY; });
      seen.target.x = m.target.x;
      seen.target.y = m.target.y;
    }
    // Swimming, the arms take the stroke's shape (motion/swimArms.ts) and its swing back: the
    // bundle and the body's lean together near TRAIL_PITCH, so it shows behind and below the head.
    const rests = swim && stroke ? entranceRests(swim, stroke, swimShapes(swimPoses, introPose, rig.arms[0].chain.segments), rig.swimRests) : null;
    const pitch = swim && drive ? swimArmPitch(drive.pitch, swim.pitch) : armDrive?.pitch;
    const straighten = drive ? drive.straighten : armDrive?.straighten;
    let offset = 0;
    rig.arms.forEach(({ chain, tube, row }, i) => {
      const weight = m.reach[i];
      spring(weight, i === pointerArm ? 1 : 0, i === pointerArm ? 5 : 3, dt);
      if (i === pointerArm) m.reachPoint[i].set(m.target.x, m.target.y);
      const pointerWeight = THREE.MathUtils.clamp(weight.x, 0, 1);
      // A held bubble's arm turns toward it, shared with any reach for the pointer as one lets go.
      const held = m.holdWeight[i];
      const w = Math.min(1, pointerWeight + held);
      const target = held > 0 ? m.holdPoint.copy(m.reachPoint[i]).multiplyScalar(pointerWeight).add(m.holdSum[i]).divideScalar(pointerWeight + held) : m.reachPoint[i];
      chain.setRest(rests ? rests[ARM_IDS[i]] : pose.arms[ARM_IDS[i]]);
      // Toward the body: the swing about the root that brings this arm's tip toward the body's middle
      // (from where it was last frame). The startle draws the arms in; the arrival wiggle fans them out and back.
      const inward = inwardSign(swimPoses.bodyX, PIVOT_Y, chain.px[0], chain.py[0], chain.tipX, chain.tipY);
      chain.solve({
        time: t,
        sway: moving * personality.sway * (1 - 0.6 * w),
        curl: live * personality.curl,
        droop: drift.vy * live * 2.2 + liftSpeed * 0.4,
        flare: moving * inward * (flinch.armsIn - wiggle.armWave),
        reach: { x: target.x, y: target.y, weight: w },
        bend: config.armBend,
        pitch,
        straighten,
      });
      tube.update();
      row.write(rig.suckers, offset, rig.suckerBend);
      offset += row.count;
    });
    // Each held bubble rides its arm's tip; that arm's cups flare.
    const flare = (rig.suckers.material as THREE.ShaderMaterial).uniforms.uFlare.value as Float32Array;
    flare.fill(0);
    bubbleState.hold.pull.fill(0);
    for (const f of holds) {
      const { px, py, pz, segments: n } = rig.arms[f.arm].chain;
      bubbleState.hold.pull[f.bubble] = f.pull;
      bubbleState.hold.tip[f.bubble].set(px[n], py[n] + select.arm.bob * f.lift, pz[n]);
      // Across the view (no depth), so the bubble sits off the tip on the page, never over it.
      bubbleState.hold.dir[f.bubble].set(px[n] - px[n - 4], py[n] - py[n - 4], 0).normalize();
      flare[f.arm] = Math.max(flare[f.arm], f.flare);
    }
    rig.suckers.instanceMatrix.needsUpdate = true;
    rig.suckerBend.needsUpdate = true;
    for (const web of rig.webs) web.update();

    // The face glow follows the head as it turns; it breathes, and drifts a little on its own.
    headSpace.current!.updateWorldMatrix(true, false);
    m.glow.copy(rig.glowLocal).applyMatrix4(headSpace.current!.matrixWorld);
    rig.uniforms.uGlowPos.value.copy(m.glow);
    accents?.at.copy(m.glow);
    if (world && glowLight) {
      // Placed in world space, where the particles read it, then into the float group's (its matrix was just brought up to date).
      const at = world.light.uNoxLightPos.value.copy(m.glow).add(GLOW_LIGHT_OFFSET);
      glowLight.parent?.worldToLocal(glowLight.position.copy(at));
    }
    rig.uniforms.uGlowStrength.value = (1 + 0.06 * b + 0.025 * live * Math.sin(t * 0.37 + 1.3)) * (1 - 0.15 * m.rest);

    // The head opens into the glass dome: the dome stays whole and in place while its glass is
    // revealed outward from where it sits on the head, and the mantle top sinks inside it in step;
    // closing folds the glass back into the head. The mantle's own halo gives way to the dome's rim.
    // The swell's morph is eased in its sheet (or by the blender without it); easing it again would
    // rush the middle. Past full (the overshoot) the glass swells about its seat, which stays put.
    const ease = hd.morph;
    rig.uniforms.uMorph.value = ease;
    dome.current!.visible = hd.visible && !silhouette && !solo;
    dome.current!.scale.setScalar(hd.scale);
    dome.current!.position.set(config.dome.center[0], config.dome.center[1] + config.dome.halfHeight * hd.lift, 0);
    rig.domeMaterial.uniforms.uOpacity.value = hd.opacity;
    rig.domeMaterial.uniforms.uReveal.value = hd.reveal;
    // The effect rides the glass's swell; with motion off it stands still (its clock is held at 0).
    effect?.update(solo ? 0 : sf.effect, hd, reducedMotion ? 0 : t);
    rig.headHalo.uniforms.uStrength.value.set(config.glow.halo.strength * (1 - ease) * (1 - cupVeil), config.glow.halo.bandStrength * (1 - ease) * (1 - cupVeil));
  });

  const [faceX, faceY] = config.head.faceOrigin;
  // The skin casts the surface light's shadow on the seabed and stone below, in a world.
  const castShadow = accents !== undefined;
  return (
    <group ref={float}>
      <group ref={swimTurn} position={[swimPoses.bodyX, PIVOT_Y, 0]} rotation-order="YXZ">
      <group ref={turn}>
        {/* The aura, at the body's middle, moves and turns with him; a still's extra turn (?yaw) is
            undone, so the card stays behind him, where his skin hides its middle, and never covers him. */}
        {world && (
          <group rotation={[0, -extraYaw, 0]}>
            <Aura aura={config.glow.aura} meshRef={auraMesh} />
          </group>
        )}
        <group ref={content} position={[-swimPoses.bodyX, -PIVOT_Y, 0]}>
          {rig.arms.map(({ tube }, i) => (
            <mesh key={i} geometry={tube.geometry} material={rig.armMaterial} frustumCulled={false} castShadow={castShadow} />
          ))}
          {!silhouette && rig.arms.map(({ tube }, i) => (
            <mesh key={`halo-${i}`} geometry={tube.geometry} material={rig.armHalo} frustumCulled={false} />
          ))}
          {rig.webs.map((web, i) => (
            <mesh key={`web-${i}`} geometry={web.geometry} material={rig.webMaterial} frustumCulled={false} castShadow={castShadow} />
          ))}
          {orbs.length > 0 && <TechBubbles bubbles={orbs} state={readBubbles} focusColour={config.palette.orbFocus} mouth={mouth} artifacts={artifacts} faceOrigin={config.head.faceOrigin} />}
          {/* The head, its dome and its glow turn and tilt together about the neck. */}
          <group ref={headTurn} position={[config.head.centerX, NECK_Y, 0]}>
            <group ref={headSpace} position={[-config.head.centerX, -NECK_Y, 0]}>
              <mesh ref={dome} geometry={rig.domeGeometry} material={rig.domeMaterial} visible={false} frustumCulled={false} />
              {effect?.root && <primitive object={effect.root} />}
              <mesh
                ref={head}
                geometry={rig.headGeometry}
                material={headSilhouette ?? rig.headMaterial}
                position={[faceX, faceY, 0]}
                castShadow={castShadow}
                onClick={onSelect && (event => { event.stopPropagation(); onSelect(); })}
                onPointerOver={onSelect && (() => { document.body.style.cursor = 'pointer'; })}
                onPointerOut={onSelect && (() => { document.body.style.cursor = ''; })}
              >
                {!silhouette && <mesh geometry={rig.haloGeometry} material={rig.headHalo} />}
              </mesh>
              <mesh material={rig.coreGlow} position={[0.05, -0.98, 0.9]} scale={[1.3, 0.9, 1]} visible={!silhouette}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            </group>
          </group>
          <primitive object={rig.suckers} />
          <primitive object={rig.cupShadows} visible={!silhouette} />
        </group>
      </group>
      </group>
      {glowLight && <primitive object={glowLight} />}
      {world && <LocalGrade grade={config.glow.grade} glow={world.at} meshRef={gradeMesh} />}
    </group>
  );
}
