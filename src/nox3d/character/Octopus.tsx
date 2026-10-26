import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BlinkScheduler, floatOffset, spring } from '../behavior/ambient';
import { Attention, nearFace } from '../behavior/attention';
import { EXPRESSIONS, type ExpressionId, blendExpression } from '../behavior/expressions';
import { FocusChoreography } from '../behavior/focusChoreography';
import type { PoseBlender } from '../behavior/poseBlend';
import { reachesForPointer, reachingArm } from '../behavior/reach';
import { isRestful } from '../behavior/stageMachine';
import { ARM_IDS, type CharacterConfig, type StageId } from '../config/types';
import { BODY_X } from '../poses/nox.poses';
import { TIER_SETTINGS, type TierSettings } from '../stage/quality';
import { type OrbState, type PlacedOrb, TechOrbs } from '../artifacts/TechOrbs';
import { ORB_Z, orbRestPosition, tipTarget } from '../artifacts/orbSlots';
import { ArmChain } from './armChain';
import { ArmTube } from './armTube';
import { ArmWeb, WEB_PAIRS } from './armWeb';
import { FACE_RECT, FaceCanvas } from './FaceCanvas';
import { createGlowMaterial } from './glowMaterial';
import { createHaloMaterial } from './haloMaterial';
import { createDomeGeometry, createHeadGeometry } from './headGeometry';
import { createSkinMaterial, createSkinUniforms } from './skinMaterial';
import { createDomeMaterial, domeState } from './domeMaterial';
import { createCupShadowMaterial, createSuckerMaterial } from './suckerMaterial';
import { SuckerRow, createCupShadow, createSuckerCup } from './suckerRow';

/** Rotation pivot for whole-body turns: the middle of the body. */
const PIVOT_Y = -0.6;
/** Pivot for the head's own turns and tilt (head-local height): the neck, under the chin. */
const NECK_Y = -1.05;

export interface OctopusProps {
  config: CharacterConfig;
  /** Moves Nox between stage poses; sampled every frame. */
  blender: PoseBlender;
  /** The current stage, for resting and reaching for the pointer in the intro. */
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
}

/** Seconds for Nox to settle into rest, and to wake from it. */
const REST_IN = 2;
const WAKE = 0.5;

/** A procedural octopus: eight bending arms, a lathed mantle and a canvas-drawn face. */
export function Octopus({ config, blender, stage, expression, freeze, reducedMotion = false, panelOpen = false, silhouette = false, quality = TIER_SETTINGS.high, onSelect, orbs = [], focusTechId = null }: OctopusProps) {
  const float = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
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

  const rig = useMemo(() => {
    const uniforms = createSkinUniforms(config);
    const face = new FaceCanvas(config.face, config.facePalette);
    const profile = { tipRadius: config.tipRadius, taperPower: config.taperPower, suckerTilt: config.suckers.tilt, curlTilt: config.suckers.curlTilt, twist: config.suckers.twist, flatten: config.armFlatten };
    const start = blender.sample(performance.now());
    const arms = config.arms.map((spec, i) => {
      const chain = new ArmChain(start.arms[spec.id], spec, i);
      const tube = new ArmTube(chain, spec, profile, quality.radial);
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
      domeGeometry: createDomeGeometry(config.dome),
      domeMaterial: createDomeMaterial(config.palette, config.dome),
      suckers,
      cupShadows,
      suckerBend,
      headMaterial: createSkinMaterial('HEAD', uniforms, { texture: face.texture, rect: FACE_RECT }),
      armMaterial: createSkinMaterial('ARM', uniforms),
      coreGlow: createGlowMaterial('#ff4a2a', 0.22, 2.4),
      armHalo: createHaloMaterial(config.glow.halo, 'ARM'),
      headHalo: createHaloMaterial(config.glow.halo, 'HEAD', new THREE.Vector3(config.head.centerX - config.head.faceOrigin[0], config.head.waist - config.head.faceOrigin[1], 0), uniforms.uMorph),
      glowLocal: new THREE.Vector3(...config.glow.center),
    };
    // Built once per character and quality tier; stage poses reach the arms as new rests each frame.
  }, [config, blender, quality]);

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
    blinks: new BlinkScheduler(config.personality.blinkInterval, config.personality.doubleBlinkChance),
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

    // After a long idle in the intro Nox rests; any input wakes it within half a second.
    const resting = !freeze && isRestful(stage, now - m.lastInput, panelOpen);
    m.rest = THREE.MathUtils.clamp(m.rest + (resting ? dt / REST_IN : -dt / WAKE), 0, 1);

    const drift = floatOffset(t, personality);
    float.current!.position.set(pose.body.x + moving * drift.x, pose.body.y + moving * drift.y, 0);
    float.current!.scale.setScalar(pose.body.scale);

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

    faceAt.set(config.head.faceOrigin[0] + pose.body.x, config.head.faceOrigin[1] + pose.body.y, 0).project(state.camera);

    // Where the stage rests Nox's eyes when nothing else holds them (the detail panel).
    const rest = pose.look ? restAt.set(pose.look[0], pose.look[1], 0).project(state.camera) : null;

    const p = state.pointer;
    // Frozen, the eyes rest ahead, or settle on the orb in focus or where the stage rests them.
    const gaze = freeze && !fixed && !rest
      ? { gazeX: 0, gazeY: 0, headX: 0, headY: 0, tracking: false }
      : m.attention.update(m.pointerInside && !freeze ? { x: p.x, y: p.y } : null, t, dt, fixed, { x: faceAt.x, y: faceAt.y }, rest ? { x: rest.x, y: rest.y } : undefined);
    const near = gaze.tracking ? nearFace(p, faceAt) : 0;
    spring(m.smile, near, 5, dt);

    // The face reacts to each technology in its own way (Kali: the focused face of panel 4;
    // others: a subtle curiosity), and the head tilts a little toward it.
    let activeExpression = expression ? EXPRESSIONS[expression] : pose.expression;
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
    turn.current!.rotation.set(-gaze.headY * 0.08 * bodyTurn, pose.body.yaw + gaze.headX * 0.15 * bodyTurn, moving * drift.roll - gaze.headX * 0.02 * bodyTurn);
    headTurn.current!.rotation.set(-gaze.headY * 0.06 * out, gaze.headX * 0.1 * out, pose.tilt - m.tilt.x);

    const face = blendExpression(activeExpression, EXPRESSIONS.restful, m.rest);
    rig.face.draw({
      ...face,
      mouthCurve: face.mouthCurve + m.smile.x * 0.7,
      blush: Math.max(face.blush, m.smile.x),
      blink: freeze ? 0 : m.blinks.sample(t),
      gazeX: gaze.gazeX,
      gazeY: gaze.gazeY,
    });

    // Breathing: the mantle swells slightly; arm roots stay buried in the web. At rest it slows
    // by 1.4x; the phase is carried forward so a change of pace never jumps.
    m.breathPhase += (live * dt) / (personality.breathPeriod * (1 + 0.4 * m.rest));
    const b = live * Math.sin(m.breathPhase * Math.PI * 2);
    head.current!.scale.set(1 + b * 0.016, 1 + b * 0.011, 1 + b * 0.016);

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
    const pointerArm = reachesForPointer(stage, out, gaze.tracking) ? reachingArm(rig.arms.map(({ chain }) => ({ x: chain.tipX, y: chain.tipY })), m.target, config.head) : -1;
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
      chain.setRest(pose.arms[ARM_IDS[i]]);
      chain.solve({
        time: t,
        sway: moving * personality.sway * (1 - 0.6 * w),
        curl: live * personality.curl,
        droop: drift.vy * live * 2.2,
        reach: { x: target.x, y: target.y, weight: w },
        bend: config.armBend,
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
    rig.uniforms.uGlowStrength.value = (1 + 0.06 * b + 0.025 * live * Math.sin(t * 0.37 + 1.3)) * (1 - 0.15 * m.rest);

    // The head opens into the glass dome: the dome stays whole and in place while its glass is
    // revealed outward from where it sits on the head, and the mantle top sinks inside it in step;
    // closing folds the glass back into the head. The mantle's own halo gives way to the dome's rim.
    // headMorph is already eased by the blender; easing it again would rush the middle.
    const ease = THREE.MathUtils.clamp(pose.headMorph, 0, 1);
    rig.uniforms.uMorph.value = ease;
    const glass = domeState(ease);
    dome.current!.visible = glass.visible && !silhouette;
    dome.current!.scale.setScalar(glass.scale);
    dome.current!.position.set(config.dome.center[0], config.dome.center[1], 0);
    rig.domeMaterial.uniforms.uOpacity.value = glass.opacity;
    rig.domeMaterial.uniforms.uReveal.value = glass.reveal;
    orbState.out = silhouette ? 0 : THREE.MathUtils.clamp(pose.orbs, 0, 1);
    rig.headHalo.uniforms.uStrength.value.set(config.glow.halo.strength * (1 - ease), config.glow.halo.bandStrength * (1 - ease));
  });

  const [faceX, faceY] = config.head.faceOrigin;
  return (
    <group ref={float}>
      <group ref={turn} position={[BODY_X, PIVOT_Y, 0]}>
        <group ref={content} position={[-BODY_X, -PIVOT_Y, 0]}>
          {rig.arms.map(({ tube }, i) => (
            <mesh key={i} geometry={tube.geometry} material={rig.armMaterial} frustumCulled={false} />
          ))}
          {!silhouette && rig.arms.map(({ tube }, i) => (
            <mesh key={`halo-${i}`} geometry={tube.geometry} material={rig.armHalo} frustumCulled={false} />
          ))}
          {rig.webs.map((web, i) => (
            <mesh key={`web-${i}`} geometry={web.geometry} material={rig.webMaterial} frustumCulled={false} />
          ))}
          {orbs.length > 0 && <TechOrbs orbs={orbs} chains={chains} state={readOrbs} />}
          {/* The head, its dome and its glow turn and tilt together about the neck. */}
          <group ref={headTurn} position={[config.head.centerX, NECK_Y, 0]}>
            <group ref={headSpace} position={[-config.head.centerX, -NECK_Y, 0]}>
              <mesh ref={dome} geometry={rig.domeGeometry} material={rig.domeMaterial} visible={false} frustumCulled={false} />
              <mesh
                ref={head}
                geometry={rig.headGeometry}
                material={rig.headMaterial}
                position={[faceX, faceY, 0]}
                onClick={onSelect && (event => { event.stopPropagation(); onSelect(); })}
                onPointerOver={onSelect && (() => { document.body.style.cursor = 'pointer'; })}
                onPointerOut={onSelect && (() => { document.body.style.cursor = ''; })}
              >
                {!silhouette && <mesh geometry={rig.headGeometry} material={rig.headHalo} />}
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
  );
}
