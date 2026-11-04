import * as THREE from 'three';
import type { OrbStyle } from '../config/types';

// A world's orb style (`artifacts.orbStyle`; Aether spec 2.3 and 8 item 11): a rim of small glowing
// beads round each technology orb's outline and a small cap where its thread meets it, drawn beside
// the shared orb glass (orbMaterial.ts), which it never changes. One instanced batch holds every
// orb's beads and one every orb's cap, made once: a frame writes their matrices and allocates
// nothing. No style (or no beads and no cap) draws nothing, so Nox's and Veyra's orbs are as they were.

/** Where the beads sit, in orb radii from its centre: on the outline the camera sees. */
export const RIM_RADIUS = 1;
/** A rim bead's radius, in orb radii: small beside the logo, a string of lights round the glass. */
export const RIM_BEAD = 0.06;
/** How much brighter the beads glow on an orb in focus. */
const FOCUS_GLOW = 0.6;

/**
 * Bead `k` of `count`'s place round an orb of radius 1, written into `out`: evenly round the outline
 * in the plane the orb's logo faces (the camera's, as the logo's plane is), the first at the top.
 */
export function rimBeadOffset(k: number, count: number, out: THREE.Vector3): THREE.Vector3 {
  const angle = Math.PI / 2 + (2 * Math.PI * k) / Math.max(1, count);
  return out.set(RIM_RADIUS * Math.cos(angle), RIM_RADIUS * Math.sin(angle), 0);
}

export interface OrbStyleMeshes {
  /** Every orb's rim beads in one batch (`rimBeads` an orb, orb `i`'s from `i * rimBeads`), or null for none. */
  readonly beads: THREE.InstancedMesh | null;
  /** One cap an orb, or null for none. */
  readonly caps: THREE.InstancedMesh | null;
  /**
   * Orb `i` at `centre` with radius `radius` (body space): its beads round it, glowing at `level`
   * (0..1: the orb's own opacity, brighter with `focus`), and its cap at `capAt` (where its thread
   * ends) or, with no thread, on top of it; the cap's size grows with the orb by `capGrow`.
   */
  write(i: number, centre: THREE.Vector3, radius: number, level: number, capAt: THREE.Vector3 | null, capGrow?: number, focus?: number): void;
  /** Orb `i` is not drawn: neither are its beads or cap. */
  hide(i: number): void;
  /** The frame's writes are done: upload them, and fade the caps with the orbs (`shown`, 0..1). */
  finish(shown: number): void;
  dispose(): void;
}

/** The meshes `style` adds round `orbs` orbs, or null when it adds nothing (no style, or no beads and no cap). */
export function createOrbStyle(style: OrbStyle | undefined, orbs: number): OrbStyleMeshes | null {
  if (!style) return null;
  const perOrb = Math.max(0, Math.floor(style.rimBeads));
  const cap = style.cap;
  if (perOrb === 0 && !cap) return null;
  const count = Math.max(0, orbs);
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  const capSphere = new THREE.SphereGeometry(1, 16, 12);
  // The beads glow: added to what is behind them (each instance's colour is its strength), and like the glass they show whatever is in front of the orb.
  const beadMaterial = new THREE.MeshBasicMaterial({ color: style.rimColour, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const capMaterial = new THREE.MeshBasicMaterial({ color: cap?.colour ?? style.rimColour, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const beads = perOrb > 0 ? new THREE.InstancedMesh(sphere, beadMaterial, perOrb * count) : null;
  const caps = cap ? new THREE.InstancedMesh(capSphere, capMaterial, count) : null;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const black = new THREE.Color(0, 0, 0);
  const matrix = new THREE.Matrix4();
  const offset = new THREE.Vector3();
  const strength = new THREE.Color();
  for (const mesh of [beads, caps]) {
    if (!mesh) continue;
    mesh.frustumCulled = false;
    // After the glass (2) and its logo (3), so the beads ring the logo's edge and the cap sits on the glass.
    mesh.renderOrder = 4;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Every instance starts empty, and with a colour, so the batch compiles with instance colours.
    for (let n = 0; n < mesh.count; n++) {
      mesh.setMatrixAt(n, zero);
      mesh.setColorAt(n, black);
    }
  }
  const hide = (i: number) => {
    if (beads) for (let k = 0; k < perOrb; k++) beads.setMatrixAt(i * perOrb + k, zero);
    caps?.setMatrixAt(i, zero);
  };
  return {
    beads,
    caps,
    write(i, centre, radius, level, capAt, capGrow = 1, focus = 0) {
      if (i < 0 || i >= count) return;
      if (beads) {
        const size = radius * RIM_BEAD;
        strength.setScalar(Math.max(0, level) * (1 + FOCUS_GLOW * focus));
        for (let k = 0; k < perOrb; k++) {
          rimBeadOffset(k, perOrb, offset).multiplyScalar(radius).add(centre);
          beads.setMatrixAt(i * perOrb + k, matrix.makeScale(size, size, size).setPosition(offset));
          beads.setColorAt(i * perOrb + k, strength);
        }
      }
      if (caps && cap) {
        const size = cap.size * capGrow;
        if (capAt) offset.copy(capAt);
        else offset.set(centre.x, centre.y + radius, centre.z);
        caps.setMatrixAt(i, matrix.makeScale(size, size, size).setPosition(offset));
        // The cap is solid gold, fading with the orbs as a batch (finish).
        caps.setColorAt(i, strength.setScalar(1));
      }
    },
    hide,
    finish(shown) {
      for (const mesh of [beads, caps]) {
        if (!mesh) continue;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      capMaterial.opacity = Math.min(1, Math.max(0, shown));
    },
    dispose() {
      beads?.dispose();
      caps?.dispose();
      sphere.dispose();
      capSphere.dispose();
      beadMaterial.dispose();
      capMaterial.dispose();
    },
  };
}
