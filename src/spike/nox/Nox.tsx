import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ArmRig } from './ArmRig';
import { ARM_POSES, BODY_X, HEAD_CENTER } from './armPoses';
import { createHeadGeometry } from './geometry';
import { createGlowMaterial, createSkinMaterial, createSuckerMaterial, skinUniforms } from './materials';
import { FACE_RECT, NoxFace } from './NoxFace';

const PIVOT_Y = -0.6;
const GLOW_LOCAL = new THREE.Vector3(0.05, -0.97, 0.6);
/** `?freeze` renders the authored rest pose with no motion, for comparison against the reference. */
const FREEZE = new URLSearchParams(location.search).has('freeze');

/** Critically damped spring toward a target; `omega` sets the response speed. */
function spring(state: { x: number; v: number }, target: number, omega: number, dt: number) {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  const x = (f * state.x + dt * state.v + hhoo * target) * det;
  state.v = (state.v + hoo * (target - state.x)) * det;
  state.x = x;
}

export function Nox() {
  const float = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const content = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const suckers = useRef<THREE.InstancedMesh>(null);

  const rig = useMemo(() => {
    const face = new NoxFace();
    const arms = ARM_POSES.map((pose, i) => new ArmRig(pose, i));
    const headGeometry = createHeadGeometry();
    const webGeometry = new THREE.SphereGeometry(1, 48, 32).scale(0.34, 0.2, 0.26);
    const suckerGeometry = new THREE.SphereGeometry(1, 16, 12);
    return {
      face,
      arms,
      headGeometry,
      webGeometry,
      suckerGeometry,
      suckerTotal: arms.reduce((n, a) => n + a.suckers.length, 0),
      headMaterial: createSkinMaterial('HEAD', { texture: face.texture, rect: FACE_RECT }),
      armMaterial: createSkinMaterial('ARM'),
      bodyMaterial: createSkinMaterial('BODY'),
      suckerMaterial: createSuckerMaterial(),
      coreGlow: createGlowMaterial('#ff4a2a', 0.22, 2.4),
    };
  }, []);

  const motion = useRef({
    gazeX: { x: 0, v: 0 },
    gazeY: { x: 0, v: 0 },
    headX: { x: 0, v: 0 },
    headY: { x: 0, v: 0 },
    smile: { x: 0.3, v: 0 },
    blinkStart: -1,
    nextBlink: 1.6,
    doubleBlink: false,
    lastPointer: new THREE.Vector2(9, 9),
    lastMove: -10,
    pointerInside: false,
    saccade: new THREE.Vector2(0, 0),
    nextSaccade: 2,
    glow: new THREE.Vector3(),
    ray: new THREE.Vector3(),
    target: new THREE.Vector3(),
    inverse: new THREE.Matrix4(),
    reach: ARM_POSES.map(() => ({ x: 0, v: 0 })),
    reachPoint: ARM_POSES.map(() => new THREE.Vector2()),
  });

  useEffect(() => {
    const leave = () => { motion.current.pointerInside = false; };
    document.documentElement.addEventListener('mouseleave', leave);
    return () => document.documentElement.removeEventListener('mouseleave', leave);
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = FREEZE ? 0 : state.clock.elapsedTime;
    const m = motion.current;
    const live = FREEZE ? 0 : 1;

    // Buoyant float: two incommensurate periods so the loop never visibly repeats.
    const w1 = (Math.PI * 2) / 6.2;
    const w2 = (Math.PI * 2) / 3.3;
    const y = live * (0.045 * Math.sin(t * w1) + 0.015 * Math.sin(t * w2 + 1.3));
    const vy = live * (0.045 * w1 * Math.cos(t * w1) + 0.015 * w2 * Math.cos(t * w2 + 1.3));
    float.current!.position.set(live * 0.012 * Math.sin(t * 0.37), y, 0);

    // Attention: follow the pointer while it moves, otherwise make small idle glances.
    const p = state.pointer;
    if (p.distanceToSquared(m.lastPointer) > 1e-6) {
      m.lastPointer.copy(p);
      m.lastMove = t;
      m.pointerInside = true;
    }
    const tracking = !FREEZE && m.pointerInside && t - m.lastMove < 3.5;
    if (!tracking && !FREEZE && t > m.nextSaccade) {
      m.saccade.set((Math.random() - 0.5) * 0.5, 0.05 + (Math.random() - 0.5) * 0.3);
      m.nextSaccade = t + 1.8 + Math.random() * 2.6;
    }
    const gx = tracking ? THREE.MathUtils.clamp(p.x * 1.6, -1, 1) : m.saccade.x;
    const gy = tracking ? THREE.MathUtils.clamp((p.y + 0.17) * 1.6, -1, 1) : m.saccade.y;
    spring(m.gazeX, gx, 16, dt);
    spring(m.gazeY, gy, 16, dt);
    spring(m.headX, gx, 3.2, dt);
    spring(m.headY, gy, 3.2, dt);
    const near = tracking ? Math.max(0, 1 - Math.hypot(p.x, p.y + 0.17) * 1.4) : 0;
    spring(m.smile, 0.3 + near * 0.7, 5, dt);

    turn.current!.rotation.set(-m.headY.x * 0.08, m.headX.x * 0.15, 0.012 * Math.sin(t * 0.81) - m.headX.x * 0.02);

    // Irregular blinking with an occasional double blink.
    if (!FREEZE && t >= m.nextBlink && m.blinkStart < 0) {
      m.blinkStart = t;
      m.doubleBlink = Math.random() < 0.2;
    }
    let blink = 0;
    if (m.blinkStart >= 0) {
      const u = (t - m.blinkStart) / 0.17;
      blink = u < 0.4 ? THREE.MathUtils.smootherstep(u / 0.4, 0, 1) : 1 - THREE.MathUtils.smoothstep((u - 0.4) / 0.6, 0, 1);
      if (u >= 1) {
        m.blinkStart = -1;
        m.nextBlink = t + (m.doubleBlink ? 0.12 : 2.6 + Math.random() * 4.4);
        m.doubleBlink = false;
        blink = 0;
      }
    }
    rig.face.draw({ gazeX: m.gazeX.x, gazeY: m.gazeY.x, blink, smile: m.smile.x, blush: near });

    // Breathing: the mantle swells slightly; arm roots stay buried in the web.
    const breath = live * Math.sin((t * Math.PI * 2) / 4.6);
    head.current!.scale.set(1 + breath * 0.016, 1 + breath * 0.011, 1 + breath * 0.016);

    // Pointer on the z=0 plane, in the same space the arms are authored in.
    content.current!.updateWorldMatrix(true, false);
    m.ray.set(p.x, p.y, 0.5).unproject(state.camera).sub(state.camera.position).normalize();
    m.target.copy(state.camera.position).addScaledVector(m.ray, -state.camera.position.z / m.ray.z);
    m.inverse.copy(content.current!.matrixWorld).invert();
    m.target.applyMatrix4(m.inverse);

    // Only the arm whose tip is nearest the pointer reaches; it lets go gently.
    let active = -1;
    let best = 0.8;
    if (tracking) {
      rig.arms.forEach((arm, i) => {
        const d = Math.hypot(arm.tipX - m.target.x, arm.tipY - m.target.y);
        if (d < best) { best = d; active = i; }
      });
    }
    let offset = 0;
    rig.arms.forEach((arm, i) => {
      const weight = m.reach[i];
      spring(weight, i === active ? 1 : 0, i === active ? 5 : 3, dt);
      if (i === active) m.reachPoint[i].set(m.target.x, m.target.y);
      const w = THREE.MathUtils.clamp(weight.x, 0, 1);
      arm.update({ time: t, sway: live * 0.5 * (1 - 0.6 * w), curl: live * 1.1, droop: vy * 2.2, reach: { x: m.reachPoint[i].x, y: m.reachPoint[i].y, weight: w } });
      arm.writeSuckers(suckers.current!, offset);
      offset += arm.suckers.length;
    });
    suckers.current!.instanceMatrix.needsUpdate = true;

    m.glow.copy(GLOW_LOCAL).applyMatrix4(content.current!.matrixWorld);
    skinUniforms.uGlowPos.value.copy(m.glow);
    skinUniforms.uGlowStrength.value = 1 + 0.06 * breath;
  });

  return (
    <group ref={float}>
      <group ref={turn} position={[BODY_X, PIVOT_Y, 0]}>
        <group ref={content} position={[-BODY_X, -PIVOT_Y, 0]}>
          {rig.arms.map((arm, i) => (
            <mesh key={i} geometry={arm.geometry} material={rig.armMaterial} frustumCulled={false} />
          ))}
          <mesh geometry={rig.webGeometry} material={rig.bodyMaterial} position={[BODY_X, -1.04, 0.02]} />
          <mesh ref={head} geometry={rig.headGeometry} material={rig.headMaterial} position={[HEAD_CENTER.x, HEAD_CENTER.y, 0]} />
          <instancedMesh ref={suckers} args={[rig.suckerGeometry, rig.suckerMaterial, rig.suckerTotal]} frustumCulled={false} />
          <mesh material={rig.coreGlow} position={[0.05, -0.98, 0.9]} scale={[1.3, 0.9, 1]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
