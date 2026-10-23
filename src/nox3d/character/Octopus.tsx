import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BlinkScheduler, breath, floatOffset, spring } from '../behavior/ambient';
import { Attention } from '../behavior/attention';
import { EXPRESSIONS, type ExpressionId } from '../behavior/expressions';
import { ARM_IDS, type CharacterConfig } from '../config/types';
import { BODY_X } from '../poses/nox.poses';
import type { StagePose } from '../poses/types';
import { ArmChain, restFromCurve } from './armChain';
import { ArmTube } from './armTube';
import { ArmWeb, WEB_PAIRS } from './armWeb';
import { FACE_RECT, FaceCanvas } from './FaceCanvas';
import { createGlowMaterial } from './glowMaterial';
import { createHeadGeometry } from './headGeometry';
import { createSkinMaterial, createSkinUniforms } from './skinMaterial';
import { createSuckerMaterial } from './suckerMaterial';
import { SuckerRow } from './suckerRow';

/** Rotation pivot for head turns: the middle of the body. */
const PIVOT_Y = -0.6;

export interface OctopusProps {
  config: CharacterConfig;
  pose: StagePose;
  expression: ExpressionId;
  /** Rest pose with no motion, for comparison captures. */
  freeze: boolean;
}

/** A procedural octopus: eight bending arms, a lathed mantle and a canvas-drawn face. */
export function Octopus({ config, pose, expression, freeze }: OctopusProps) {
  const float = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const content = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const suckers = useRef<THREE.InstancedMesh>(null);

  const rig = useMemo(() => {
    const uniforms = createSkinUniforms(config);
    const face = new FaceCanvas(config.face, config.facePalette);
    const profile = { tipRadius: config.tipRadius, taperPower: config.taperPower, suckerTilt: config.suckers.tilt };
    const arms = config.arms.map((spec, i) => {
      const chain = new ArmChain(restFromCurve(pose.arms[spec.id]), spec, i);
      const tube = new ArmTube(chain, spec, profile);
      return { chain, tube, row: new SuckerRow(chain, tube, config.suckers, i) };
    });
    const byId = new Map(config.arms.map((spec, i) => [spec.id, arms[i]]));
    const webs = WEB_PAIRS.map(([a, b]) => {
      const left = byId.get(a)!;
      const right = byId.get(b)!;
      return new ArmWeb(left.chain, right.chain, u => left.tube.radiusAt(u), u => right.tube.radiusAt(u));
    });
    const webMaterial = createSkinMaterial('ARM', uniforms);
    webMaterial.side = THREE.DoubleSide;
    return {
      uniforms,
      face,
      arms,
      webs,
      webMaterial,
      headGeometry: createHeadGeometry(config.head),
      webGeometry: new THREE.SphereGeometry(1, 48, 32).scale(0.34, 0.2, 0.26),
      suckerGeometry: new THREE.SphereGeometry(1, 16, 12),
      suckerTotal: arms.reduce((n, a) => n + a.row.count, 0),
      headMaterial: createSkinMaterial('HEAD', uniforms, { texture: face.texture, rect: FACE_RECT }),
      armMaterial: createSkinMaterial('ARM', uniforms),
      bodyMaterial: createSkinMaterial('BODY', uniforms),
      suckerMaterial: createSuckerMaterial(config.palette),
      coreGlow: createGlowMaterial('#ff4a2a', 0.22, 2.4),
      glowLocal: new THREE.Vector3(...config.glow.center),
    };
    // Built once per character; later pose changes are applied as new rests below.
  }, [config]);

  useEffect(() => {
    ARM_IDS.forEach((id, i) => rig.arms[i].chain.setRest(restFromCurve(pose.arms[id], rig.arms[i].chain.segments)));
  }, [pose, rig]);

  const motion = useRef({
    attention: new Attention(config.personality),
    blinks: new BlinkScheduler(config.personality.blinkInterval, config.personality.doubleBlinkChance),
    smile: { x: 0, v: 0 },
    pointerInside: false,
    ray: new THREE.Vector3(),
    target: new THREE.Vector3(),
    inverse: new THREE.Matrix4(),
    glow: new THREE.Vector3(),
    reach: config.arms.map(() => ({ x: 0, v: 0 })),
    reachPoint: config.arms.map(() => new THREE.Vector2()),
  });

  useEffect(() => {
    const m = motion.current;
    const enter = () => { m.pointerInside = true; };
    const leave = () => { m.pointerInside = false; };
    window.addEventListener('pointermove', enter);
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('pointermove', enter);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = freeze ? 0 : state.clock.elapsedTime;
    const live = freeze ? 0 : 1;
    const m = motion.current;
    const personality = config.personality;

    const drift = floatOffset(t, personality);
    float.current!.position.set(pose.body.x + live * drift.x, pose.body.y + live * drift.y, 0);
    float.current!.scale.setScalar(pose.body.scale);

    const p = state.pointer;
    const gaze = freeze
      ? { gazeX: 0, gazeY: 0, headX: 0, headY: 0, tracking: false }
      : m.attention.update(m.pointerInside ? { x: p.x, y: p.y } : null, t, dt);
    const near = gaze.tracking ? Math.max(0, 1 - Math.hypot(p.x, p.y + 0.17) * 1.4) : 0;
    spring(m.smile, near, 5, dt);
    turn.current!.rotation.set(-gaze.headY * 0.08, pose.body.yaw + gaze.headX * 0.15, live * drift.roll - gaze.headX * 0.02);

    const face = EXPRESSIONS[expression];
    rig.face.draw({
      ...face,
      mouthCurve: face.mouthCurve + m.smile.x * 0.7,
      blush: Math.max(face.blush, m.smile.x),
      blink: freeze ? 0 : m.blinks.sample(t),
      gazeX: gaze.gazeX,
      gazeY: gaze.gazeY,
    });

    // Breathing: the mantle swells slightly; arm roots stay buried in the web.
    const b = live * breath(t, personality.breathPeriod);
    head.current!.scale.set(1 + b * 0.016, 1 + b * 0.011, 1 + b * 0.016);

    // Pointer on the z = 0 plane, in the space the arms are authored in.
    content.current!.updateWorldMatrix(true, false);
    m.ray.set(p.x, p.y, 0.5).unproject(state.camera).sub(state.camera.position).normalize();
    m.target.copy(state.camera.position).addScaledVector(m.ray, -state.camera.position.z / m.ray.z);
    m.inverse.copy(content.current!.matrixWorld).invert();
    m.target.applyMatrix4(m.inverse);

    // Only the arm whose tip is nearest the pointer reaches; it lets go gently.
    let active = -1;
    let best = 0.8;
    if (gaze.tracking) {
      rig.arms.forEach(({ chain }, i) => {
        const d = Math.hypot(chain.tipX - m.target.x, chain.tipY - m.target.y);
        if (d < best) { best = d; active = i; }
      });
    }
    let offset = 0;
    rig.arms.forEach(({ chain, tube, row }, i) => {
      const weight = m.reach[i];
      spring(weight, i === active ? 1 : 0, i === active ? 5 : 3, dt);
      if (i === active) m.reachPoint[i].set(m.target.x, m.target.y);
      const w = THREE.MathUtils.clamp(weight.x, 0, 1);
      chain.solve({
        time: t,
        sway: live * personality.sway * (1 - 0.6 * w),
        curl: live * personality.curl,
        droop: drift.vy * live * 2.2,
        reach: { x: m.reachPoint[i].x, y: m.reachPoint[i].y, weight: w },
      });
      tube.update();
      row.write(suckers.current!, offset);
      offset += row.count;
    });
    suckers.current!.instanceMatrix.needsUpdate = true;
    for (const web of rig.webs) web.update();

    m.glow.copy(rig.glowLocal).applyMatrix4(content.current!.matrixWorld);
    rig.uniforms.uGlowPos.value.copy(m.glow);
    rig.uniforms.uGlowStrength.value = 1 + 0.06 * b;
  });

  const [faceX, faceY] = config.head.faceOrigin;
  return (
    <group ref={float}>
      <group ref={turn} position={[BODY_X, PIVOT_Y, 0]}>
        <group ref={content} position={[-BODY_X, -PIVOT_Y, 0]}>
          {rig.arms.map(({ tube }, i) => (
            <mesh key={i} geometry={tube.geometry} material={rig.armMaterial} frustumCulled={false} />
          ))}
          {rig.webs.map((web, i) => (
            <mesh key={`web-${i}`} geometry={web.geometry} material={rig.webMaterial} frustumCulled={false} />
          ))}
          <mesh geometry={rig.webGeometry} material={rig.bodyMaterial} position={[BODY_X, -1.04, 0.02]} />
          <mesh ref={head} geometry={rig.headGeometry} material={rig.headMaterial} position={[faceX, faceY, 0]} />
          <instancedMesh ref={suckers} args={[rig.suckerGeometry, rig.suckerMaterial, rig.suckerTotal]} frustumCulled={false} />
          <mesh material={rig.coreGlow} position={[0.05, -0.98, 0.9]} scale={[1.3, 0.9, 1]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
