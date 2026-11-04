import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { QualityTier } from '../stage/quality';
import { LIVE_ELEMENTS } from './live';
import { packetArc, packetCount, pathLength, pathPoint } from './live/packets';
import { useMotionAmount } from './liveMotion';
import type { PacketsConfig, Vec3 } from './types';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

const FORWARD = new THREE.Vector3(1, 0, 0);
// Scratch objects for the frame's matrices: nothing is allocated per frame.
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const direction = new THREE.Vector3();
const place = new THREE.Vector3();
const stretch = new THREE.Vector3();

/** Draws the first `count` of the packets. */
function showCount(mesh: THREE.InstancedMesh, count: number) {
  mesh.count = count;
}

/** Puts each of the `count` packets at its place along the path at time `t`: `laps` paths a second. */
function writePackets(mesh: THREE.InstancedMesh, path: readonly Vec3[], length: number, count: number, t: number, laps: number) {
  stretch.set(length, 1, 1);
  for (let i = 0; i < count; i++) {
    const { position, tangent } = pathPoint(path, packetArc(i, t, count, laps));
    quaternion.setFromUnitVectors(FORWARD, direction.set(...tangent));
    mesh.setMatrixAt(i, matrix.compose(place.set(...position), quaternion, stretch));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Packets of light running along `path` (a polyline of the layout, in stage units): one instanced
 * mesh of unlit bars, `config.length` long and facing along the path, alternating between the
 * config's two colours. They are evenly spaced and run `config.speed` stage units a second, end to
 * start without a gap; held where they began while the world's motion is (?freeze, reduced
 * motion). `tier` is the quality tier, which sets how many run (the config's count, at most 12).
 */
export function Packets({ config, path, tier }: { config: PacketsConfig; path: readonly Vec3[]; tier: QualityTier }) {
  const now = useWorldTime();
  const motionAmount = useMotionAmount();
  const { mesh, disposables } = useMemo(() => {
    const { max, width } = LIVE_ELEMENTS.packets;
    const geometry = new THREE.BoxGeometry(1, width, width);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1) });
    const mesh = new THREE.InstancedMesh(geometry, material, max);
    const colours = config.colours.map(c => new THREE.Color(c));
    for (let i = 0; i < max; i++) mesh.setColorAt(i, colours[i % 2]);
    mesh.frustumCulled = false;
    return { mesh, disposables: [geometry, material, mesh] };
  }, [config.colours]);
  useDisposables(disposables);
  const count = packetCount(config, tier);
  useLayoutEffect(() => showCount(mesh, count), [mesh, count]);
  // Laps a second: the speed in stage units over the path's length.
  const laps = useMemo(() => {
    const length = pathLength(path);
    return length > 0 ? config.speed / length : 0;
  }, [path, config.speed]);
  useFrame(state => writePackets(mesh, path, config.length, count, now(state), laps * motionAmount));
  return <primitive object={mesh} />;
}
