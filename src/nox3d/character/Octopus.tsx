import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BlinkScheduler, floatOffset, spring } from '../behavior/ambient';
import { Attention, nearFace } from '../behavior/attention';
import { coreGlowFacing } from '../behavior/entrance';
import { EXPRESSIONS, type ExpressionId, SWIM_BLINK, blendExpression } from '../behavior/expressions';
import { FocusChoreography } from '../behavior/focusChoreography';
import type { PoseBlender } from '../behavior/poseBlend';
import { reachesForPointer, reachingArm } from '../behavior/reach';
import { isRestful } from '../behavior/stageMachine';
import { ARM_IDS, type CharacterConfig, type StageId } from '../config/types';
import { arrivalWiggle, settleOvershoot, startle } from '../motion/micro';
import { SETTLE_IDLE, arrivalDue, inwardSign, settleStep, startleDue, trailSpeed } from '../motion/microTriggers';
import { strokeAt, swimDrive } from '../motion/stroke';
import { createSwimRests, swimArmPitch, swimRests } from '../motion/swimArms';
import { BODY_X } from '../poses/nox.poses';
import { swimShapes } from '../poses/nox.swim';
import { ENTRANCE_SECONDS, type EntranceFrame, entranceFrame, revealParts } from '../sequences/entrance';
import type { Sequences } from '../sequences/theatre';
import { TIER_SETTINGS, type TierSettings } from '../stage/quality';
import { type OrbState, type PlacedOrb, TechOrbs } from '../artifacts/TechOrbs';
import { ORB_Z, orbRestPosition, tipTarget } from '../artifacts/orbSlots';
import { ArmChain } from './armChain';
import { ArmTube } from './armTube';
import { ArmWeb, WEB_PAIRS } from './armWeb';
import { Aura } from './Aura';
import { FACE_RECT, FaceCanvas } from './FaceCanvas';
import { GLOW_LIGHT, GLOW_LIGHT_OFFSET, lightParticles } from './glowLight';
import { createGlowMaterial } from './glowMaterial';
import { createHaloMaterial } from './haloMaterial';
import { createDomeGeometry, createHeadGeometry } from './headGeometry';
import { createHeadSilhouetteMaterial } from './headMorph';
import { createSkinMaterial, createSkinUniforms } from './skinMaterial';
import { createDomeMaterial, domeState } from './domeMaterial';
import { LocalGrade } from './LocalGrade';
import { createCupShadowMaterial, createSuckerMaterial } from './suckerMaterial';
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
  /** Technology orbs the arms carry while the head is open. */
  orbs?: readonly PlacedOrb[];
  /** The technology in focus: its arm presents its orb and Nox looks at it. */
  focusTechId?: string | null;
  /**
   * The entrance (sequences/entrance.ts), read each frame while the stage is `entering`: its clock
   * starts on the first frame drawn with the sheet in, and runs on frame time. Until then Nox is out
   * of sight; if the sheet fails, or has not come within ENTRANCE_SHEET_WAIT, `onEntranceUnavailable`
   * is called.
   */
  entranceSheet?: EntranceSheet;
  /** With `freeze`: the moment of the entrance shown, in seconds. */
  entranceSeconds?: number;
  /** The settle has begun (6.5 s): the intro's words come in. */
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
  /** For measurement captures only: the orbs and the dome glass are not drawn (the arms still carry and present the orbs). */
  solo?: boolean;
  /** Degrees the whole body turns about its upright axis, on top of the stage's turn: for stills of his back. */
  yaw?: number;
  /**
   * A swim drive held on every arm (ArmDrive.pitch and straighten), for review stills of the swim
   * poses; no arm reaches for the pointer while it is on.
   */
  armDrive?: { pitch: number; straighten: number };
}

/** Seconds for Nox to settle into rest, and to wake from it. */
const REST_IN = 2;
const WAKE = 0.5;
/** The warm glow card before the chin, facing the visitor. */
const CORE_GLOW = 0.22;

/** A procedural octopus: eight bending arms, a lathed mantle and a canvas-drawn face. */
export function Octopus({ config, blender, stage, expression, freeze, reducedMotion = false, panelOpen = false, silhouette = false, quality = TIER_SETTINGS.high, onSelect, orbs = [], focusTechId = null, entranceSheet, entranceSeconds = 0, onEntranceSettling, onEntranceDone, onEntranceUnavailable, onEntranceFrame, accents, solo = false, yaw = 0, armDrive }: OctopusProps) {
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
  const orbState = useMemo<OrbState>(
    () => ({
      out: 0,
      focus: new Float32Array(orbs.length),
      tips: ARM_IDS.map(() => new THREE.Vector2()),
      armReach: new Float32Array(ARM_IDS.length),
      driver: new Int8Array(ARM_IDS.length).fill(-1),
    }),
    [orbs],
  );
  // One timeline for every technology focus: eyes, face, arm, emphasis, release.
  const choreography = useMemo(() => new FocusChoreography(orbs.length), [orbs]);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const faceAt = useMemo(() => new THREE.Vector3(), []);
  const restAt = useMemo(() => new THREE.Vector3(), []);
  // In a world Nox brings his aura, the grade of the water near him and his face glow's light on
  // the seabed, stone and the world's lit pieces round him (his own skin lights itself and takes
  // none of it). A silhouette capture has none of them: they would draw as shape.
  const world = silhouette ? undefined : accents;
  const glowLight = useMemo(() => (world ? new THREE.PointLight(GLOW_LIGHT.color, GLOW_LIGHT.intensity, GLOW_LIGHT.distance, GLOW_LIGHT.decay) : null), [world]);
  useEffect(() => () => glowLight?.dispose(), [glowLight]);
  // The world's particles take no scene lights: they take the same light as a tint, black again when he leaves.
  useEffect(() => {
    if (!world) return;
    lightParticles(world.light);
    return () => void world.light.uNoxLight.value.setScalar(0);
  }, [world]);

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
      coreGlow: createGlowMaterial('#ff4a2a', CORE_GLOW, 2.4),
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

  const chains = useMemo(() => rig.arms.map(arm => arm.chain), [rig]);
  const readOrbs = useMemo(() => () => orbState, [orbState]);

  // Every shader, the dome's too, is compiled up front, so the first opening never stalls.
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  useEffect(() => {
    const mesh = dome.current;
    if (!mesh) return;
    const was = mesh.visible;
    mesh.visible = true;
    gl.compile(scene, camera);
    mesh.visible = was;
  }, [gl, scene, camera, rig]);

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
    rig.face.texture.dispose();
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

  useEffect(() => {
    const m = motion.current;
    const enter = () => { m.pointerInside = true; m.lastInput = performance.now(); };
    const leave = () => { m.pointerInside = false; };
    const wake = () => { m.lastInput = performance.now(); };
    window.addEventListener('pointermove', enter);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('touchstart', wake);
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('pointermove', enter);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('touchstart', wake);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, []);

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
        e.seconds = e.seconds === null ? 0 : e.seconds + step;
        const seconds = freeze ? entranceSeconds : e.seconds;
        swim = entranceFrame(sheet, seconds);
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
    const stroke = swim ? strokeAt(swim.stroke, personality.swim) : null;
    const drive = swim && stroke ? swimDrive(stroke, swim.settle) : null;
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
      if (world) lightParticles(world.light, glowShown);
      if (glowLight) glowLight.intensity = GLOW_LIGHT.intensity * glowShown;
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
    // the face reacts a beat later, then the orb's arm reaches its tip under the orb and lifts it
    // to its presentation pose while the orb glows and the others dim. Letting go runs back the
    // same way. Every value retargets from where it is, so quick changes never jump.
    const selected = focusTechId ? orbs.findIndex(o => o.techId === focusTechId) : -1;
    // A still capture (freeze) shows the focus as it settles, at once.
    choreography.update(selected, now, dt * 1000, reducedMotion || freeze);
    const out = THREE.MathUtils.clamp(pose.orbs, 0, 1);
    let fixed: { x: number; y: number } | undefined;
    if (selected >= 0) {
      // Eyes follow the orb as its arm brings it to where it is presented.
      const orb = orbs[selected];
      const riding = orbRestPosition(rig.arms[ARM_IDS.indexOf(orb.slot.armId)].chain, orb.slot);
      const f = choreography.arm(selected);
      lookAt.set(riding.x + (orb.slot.present[0] - riding.x) * f, riding.y + (orb.slot.present[1] - riding.y) * f, ORB_Z);
      lookAt.applyMatrix4(content.current!.matrixWorld).project(state.camera);
      fixed = { x: lookAt.x, y: lookAt.y };
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
    let activeExpression = expression ? EXPRESSIONS[expression] : swim ? blendExpression(EXPRESSIONS.happy, EXPRESSIONS.gentle, swim.settle) : pose.expression;
    let tiltTarget = 0;
    let strongest = 0;
    orbs.forEach((orb, i) => {
      const f = choreography.face(i);
      if (f <= 0) return;
      activeExpression = blendExpression(activeExpression, EXPRESSIONS[orb.reaction ?? 'curious'], f);
      if (f > strongest) {
        strongest = f;
        tiltTarget = 0.1 * f * Math.sign(orb.slot.present[0] - config.head.faceOrigin[0]);
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

    const face = blendExpression(activeExpression, EXPRESSIONS.restful, m.rest);
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
      gazeX: gaze.gazeX,
      gazeY: gaze.gazeY,
    });

    // Breathing: the mantle swells slightly; arm roots stay buried in the web. At rest it slows
    // by 1.4x; the phase is carried forward so a change of pace never jumps.
    m.breathPhase += (live * dt) / (personality.breathPeriod * (1 + 0.4 * m.rest));
    const b = live * Math.sin(m.breathPhase * Math.PI * 2);
    // Swimming, the mantle fills in each recovery and squeezes in each power stroke, less as he settles.
    const mantle = swim && stroke ? 1 + stroke.mantle * (1 - swim.settle) : 1;
    head.current!.scale.set((1 + b * 0.016) * mantle, (1 + b * 0.011) * mantle, (1 + b * 0.016) * mantle);

    // Pointer on the z = 0 plane, in the space the arms are authored in.
    content.current!.updateWorldMatrix(true, false);
    m.ray.set(p.x, p.y, 0.5).unproject(state.camera).sub(state.camera.position).normalize();
    m.target.copy(state.camera.position).addScaledVector(m.ray, -state.camera.position.z / m.ray.z);
    m.inverse.copy(content.current!.matrixWorld).invert();
    m.target.applyMatrix4(m.inverse);

    // Which orb each arm presents (the one furthest along), and how far: that arm reaches its tip
    // to hold the orb at its presentation pose. With reduced motion no arm moves.
    orbState.armReach.fill(0);
    orbState.driver.fill(-1);
    orbs.forEach((orb, i) => {
      const f = choreography.arm(i);
      orbState.focus[i] = f;
      const a = ARM_IDS.indexOf(orb.slot.armId);
      if (f > orbState.armReach[a]) {
        orbState.armReach[a] = f;
        orbState.driver[a] = i;
      }
    });
    if (reducedMotion) orbState.armReach.fill(0);
    // In the intro, the arm whose tip is nearest the pointer reaches toward it, never into the
    // face. While the orbs are out, only arms presenting a technology move.
    const pointerArm = !armDrive && !swim && reachesForPointer(stage, out, gaze.tracking) ? reachingArm(rig.arms.map(({ chain }) => ({ x: chain.tipX, y: chain.tipY })), m.target, config.head) : -1;
    // Swimming, the arms take the stroke's shape (motion/swimArms.ts) and its swing back: the
    // bundle and the body's lean together near TRAIL_PITCH, so it shows behind and below the head.
    const rests = swim && stroke ? swimRests(swimShapes(rig.arms[0].chain.segments), stroke, swim.settle, rig.swimRests) : null;
    const pitch = swim && drive ? swimArmPitch(drive.pitch, swim.pitch) : armDrive?.pitch;
    const straighten = drive ? drive.straighten : armDrive?.straighten;
    let offset = 0;
    rig.arms.forEach(({ chain, tube, row }, i) => {
      const weight = m.reach[i];
      spring(weight, i === pointerArm ? 1 : 0, i === pointerArm ? 5 : 3, dt);
      if (i === pointerArm) m.reachPoint[i].set(m.target.x, m.target.y);
      const pointerW = THREE.MathUtils.clamp(weight.x, 0, 1);
      const presentW = orbState.armReach[i];
      const driver = orbState.driver[i];
      const target = presentW > 0 && driver >= 0 ? tipTarget(orbs[driver].slot) : m.reachPoint[i];
      const w = presentW > 0 && driver >= 0 ? presentW : pointerW;
      chain.setRest(rests ? rests[ARM_IDS[i]] : pose.arms[ARM_IDS[i]]);
      // Toward the body: the swing about the root that brings this arm's tip toward the body's middle
      // (from where it was last frame). The startle draws the arms in; the arrival wiggle fans them out and back.
      const inward = inwardSign(BODY_X, PIVOT_Y, chain.px[0], chain.py[0], chain.tipX, chain.tipY);
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
      orbState.tips[i].set(chain.tipX, chain.tipY);
      tube.update();
      row.write(rig.suckers, offset, rig.suckerBend);
      offset += row.count;
    });
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
    // headMorph is already eased by the blender; easing it again would rush the middle.
    const ease = THREE.MathUtils.clamp(pose.headMorph, 0, 1);
    rig.uniforms.uMorph.value = ease;
    const glass = domeState(ease);
    dome.current!.visible = glass.visible && !silhouette && !solo;
    dome.current!.scale.setScalar(glass.scale);
    dome.current!.position.set(config.dome.center[0], config.dome.center[1], 0);
    rig.domeMaterial.uniforms.uOpacity.value = glass.opacity;
    rig.domeMaterial.uniforms.uReveal.value = glass.reveal;
    orbState.out = silhouette ? 0 : THREE.MathUtils.clamp(pose.orbs, 0, 1);
    rig.headHalo.uniforms.uStrength.value.set(config.glow.halo.strength * (1 - ease) * (1 - cupVeil), config.glow.halo.bandStrength * (1 - ease) * (1 - cupVeil));
  });

  const [faceX, faceY] = config.head.faceOrigin;
  // The skin casts the surface light's shadow on the seabed and stone below, in a world.
  const castShadow = accents !== undefined;
  return (
    <group ref={float}>
      <group ref={swimTurn} position={[BODY_X, PIVOT_Y, 0]} rotation-order="YXZ">
      <group ref={turn}>
        {/* The aura, at the body's middle, moves and turns with him; a still's extra turn (?yaw) is
            undone, so the card stays behind him, where his skin hides its middle, and never covers him. */}
        {world && (
          <group rotation={[0, -extraYaw, 0]}>
            <Aura aura={config.glow.aura} meshRef={auraMesh} />
          </group>
        )}
        <group ref={content} position={[-BODY_X, -PIVOT_Y, 0]}>
          {rig.arms.map(({ tube }, i) => (
            <mesh key={i} geometry={tube.geometry} material={rig.armMaterial} frustumCulled={false} castShadow={castShadow} />
          ))}
          {!silhouette && rig.arms.map(({ tube }, i) => (
            <mesh key={`halo-${i}`} geometry={tube.geometry} material={rig.armHalo} frustumCulled={false} />
          ))}
          {rig.webs.map((web, i) => (
            <mesh key={`web-${i}`} geometry={web.geometry} material={rig.webMaterial} frustumCulled={false} castShadow={castShadow} />
          ))}
          {orbs.length > 0 && (
            <group visible={!solo}>
              <TechOrbs orbs={orbs} chains={chains} state={readOrbs} />
            </group>
          )}
          {/* The head, its dome and its glow turn and tilt together about the neck. */}
          <group ref={headTurn} position={[config.head.centerX, NECK_Y, 0]}>
            <group ref={headSpace} position={[-config.head.centerX, -NECK_Y, 0]}>
              <mesh ref={dome} geometry={rig.domeGeometry} material={rig.domeMaterial} visible={false} frustumCulled={false} />
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
