import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { SatellitePlacement } from '../config/types';
import { ORB_HALO_SCALE, createOrbHaloMaterial, createOrbMaterial } from './orbMaterial';
import { beadAnglesInto, beadPeriod, flightProgress, holdProgress, ringDrawn, ringFlight, ringLineVisible, ringLineWidth, ringPointInto, ringShown } from './satellite';
import type { PlacementFormProps } from './strategies';
import { twinklePop } from './twinkle';

/** Straight pieces the ring line is drawn in. */
const RING_SEGMENTS = 128;
/** Seconds for the ring to fade in or out as the stage changes (the bubbles' own fade). */
const FADE_S = 0.9;
/** The constellation lines are faint: this share of their colour at full, before they flicker. */
const CONSTELLATION_LEVEL = 0.45;
/** How far an unlit bead's glass edge turns to the rim colour (the orb glass's focus mix). */
const RIM_SHARE = 0.5;
/** How much of its own colour a bead's glass body holds: an unlit bead is dim glass, a lit one glows. */
const BODY = { glass: 0.3, lit: 0.6 } as const;
/** How much a bead grows as it brightens before the flight, and again as it flares and splits into its orbs. */
const GROW = { bright: 0.3, flare: 0.7 } as const;
/** How much brighter the ring line glows as the beads brighten. */
const LINE_GLOW = 0.6;

/** `text`'s colour at `share` of its strength, as the linear light an orb's glass compiles in (world/colour.ts). */
function dimmed(text: string, share: number): string {
  const c = new THREE.Color(text).multiplyScalar(share);
  return `color(srgb-linear ${c.r.toFixed(5)} ${c.g.toFixed(5)} ${c.b.toFixed(5)})`;
}

/**
 * The satellite placement's rest form (satellite.ts): the thin ring round the head, nearly edge-on,
 * fading out across the face, and its seed beads swaying about their homes in the rear arc, faint
 * constellation lines joining neighbours. Lives in the head's space, centred on the head's axis.
 * Drawn in the intro and the detail, fading in and out as the stage changes; with motion off the
 * beads stand at their homes and the ring comes and goes at once. In the overview it stays until the
 * flight takes it (satellite.ts `ringFlight`, on the head swell's progress): the beads stop swaying
 * and brighten, flare and split into the orbs (TechBubbles draws those) as the line fades; closing,
 * it comes back the same way. Once the orbs have landed it stays gone through a technology focus.
 *
 * One line batch draws the ring and the constellation lines; the beads are instanced orb glass with
 * no logo (the lit ones with the orb halo), each depth-tested, so the head hides the ones behind it.
 * Every buffer is made once: a frame writes into them and allocates nothing.
 */
export function SatelliteRing({ config, frame, glass, head }: PlacementFormProps<SatellitePlacement>) {
  const { ring } = config;
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const count = ring.beadCount;
    const lit = ring.beads.lit.filter(i => Number.isInteger(i) && i >= 0 && i < count);
    // Each bead's mesh and its instance in it: the lit beads in one, the others in the other.
    const slots = Array.from({ length: count }, (_, i) => (lit.includes(i) ? { lit: true, index: lit.indexOf(i) } : { lit: false, index: 0 }));
    let unlit = 0;
    for (const slot of slots) if (!slot.lit) slot.index = unlit++;

    const sphere = new THREE.SphereGeometry(1, 32, 20);
    // A bead is coloured glass (a technology's orb is dark inside): its body holds some of the glass
    // colour, or of the rim's gold for a lit bead, where an orb keeps its faint `base`.
    const beadGlass = createOrbMaterial(ring.beads.glass, ring.beads.rim, { ...glass, base: dimmed(ring.beads.glass, BODY.glass) });
    const litGlass = createOrbMaterial(ring.beads.rim, ring.beads.rim, { ...glass, base: dimmed(ring.beads.rim, BODY.lit) });
    const litHalo = createOrbHaloMaterial(ring.beads.rim, ring.beads.rim);
    beadGlass.uniforms.uFocus.value = RIM_SHARE;
    litGlass.uniforms.uFocus.value = 1;
    litHalo.uniforms.uFocus.value = 1;
    // Unlike a technology's orb, a bead is hidden by the head when it passes behind it.
    for (const material of [beadGlass, litGlass, litHalo]) material.depthTest = true;
    const glassBeads = new THREE.InstancedMesh(sphere, beadGlass, unlit);
    const litBeads = new THREE.InstancedMesh(sphere, litGlass, lit.length);
    const litHalos = new THREE.InstancedMesh(sphere, litHalo, lit.length);
    litHalos.renderOrder = 1;
    glassBeads.renderOrder = litBeads.renderOrder = 2;

    // The line batch: the ring's segments, then one constellation segment between each pair of neighbours.
    const links = Math.max(0, count - 1);
    const positions = new Float32Array((RING_SEGMENTS + links) * 6);
    const colours = new Float32Array((RING_SEGMENTS + links) * 6);
    const colour = new THREE.Color(ring.line.color);
    const p = new THREE.Vector3();
    // Each ring vertex's angle and how much of the line shows there (the keep-out), kept for the line drawing round while the ring forms.
    const vertexAngle = new Float32Array(RING_SEGMENTS * 2);
    const vertexSeen = new Float32Array(RING_SEGMENTS * 2);
    for (let k = 0; k < RING_SEGMENTS; k++) {
      for (let end = 0; end < 2; end++) {
        const angle = (2 * Math.PI * (k + end)) / RING_SEGMENTS;
        const at = k * 6 + end * 3;
        ringPointInto(p, angle, ring).toArray(positions, at);
        const seen = ringLineVisible(angle, ring);
        vertexAngle[k * 2 + end] = angle;
        vertexSeen[k * 2 + end] = seen;
        colours.set([colour.r * seen, colour.g * seen, colour.b * seen], at);
      }
    }
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colours);
    // A glow over the water: each pixel keeps the brighter of the line and what is behind it, so its
    // colour, faded, is how much it shows, and the round ends where neighbouring pieces overlap do not
    // add up into beads of light (as an added line's would).
    const material = new LineMaterial({ vertexColors: true, linewidth: 1, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation });
    const line = new LineSegments2(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 1;
    for (const mesh of [glassBeads, litBeads, litHalos]) mesh.frustumCulled = false;
    const buffer = (name: string) => (geometry.getAttribute(name) as THREE.InterleavedBufferAttribute).data;
    return {
      sphere, beadGlass, litGlass, litHalo, glassBeads, litBeads, litHalos, geometry, material, line, slots, positions, colours, colour, vertexAngle, vertexSeen,
      constellation: new THREE.Color(ring.line.constellation),
      positionBuffer: buffer('instanceStart'),
      colourBuffer: buffer('instanceColorStart'),
    };
  }, [ring, glass]);

  useEffect(() => () => {
    for (const disposable of [parts.sphere, parts.beadGlass, parts.litGlass, parts.litHalo, parts.geometry, parts.material, parts.glassBeads, parts.litBeads, parts.litHalos]) disposable.dispose();
  }, [parts]);

  // The sway clock, how far the ring is shown, and the scratch a frame writes into.
  const run = useMemo(() => ({ clock: 0, shown: Number.NaN, angles: new Array<number>(ring.beadCount).fill(0), bead: new THREE.Vector3(), next: new THREE.Vector3(), matrix: new THREE.Matrix4(), centre: new THREE.Vector3(), latch: { landed: false }, drawn: 1 }), [ring.beadCount]);

  useFrame((state, delta) => {
    const f = frame();
    const root = group.current!;
    const dt = Math.min(delta, 0.05);
    // The flight (satellite.ts): the overview, and a focus from it, hold the orbs once they have landed.
    const flight = ringFlight(holdProgress(run.latch, f.stage === 'techFocus' ? 'focus' : f.stage === 'overview' ? 'overview' : 'free', flightProgress(f.swell), f.still), f.reducedMotion ?? false);
    const goal = ringShown(f.stage) || f.stage === 'overview' ? 1 : 0;
    // Forming (the twinkle), the ring is there at once, its line drawing in; else it fades in with the stage.
    run.shown = f.still || f.twinkle || Number.isNaN(run.shown) ? goal : run.shown + Math.sign(goal - run.shown) * Math.min(Math.abs(goal - run.shown), dt / FADE_S);
    root.visible = run.shown > 0.001 && (flight.line > 0 || flight.bead > 0);
    if (!root.visible) return;
    if (!f.still) run.clock += dt;
    const shown = run.shown * run.shown * (3 - 2 * run.shown);
    const { slots, positions, colours, constellation } = parts;
    const { bead, next, matrix, angles } = run;

    // The beads, each at its angle on the ring (drawn home as they brighten for the flight), growing as they brighten and flare.
    beadAnglesInto(angles, run.clock, ring, f.still);
    if (flight.sway < 1) for (let i = 0; i < angles.length; i++) angles[i] = ring.homes[i] + (angles[i] - ring.homes[i]) * flight.sway;
    const grown = ring.beadSize * (1 + GROW.bright * flight.bright + GROW.flare * flight.flare);
    const { twinkle } = f;
    for (let i = 0; i < slots.length; i++) {
      ringPointInto(bead, angles[i], ring);
      // A bead not yet lit (the ring forming) is not there; it swells past its size as it lights and settles.
      const size = twinkle ? grown * twinklePop(twinkle.beads[i] ?? 1) : grown;
      matrix.makeScale(size, size, size).setPosition(bead);
      const slot = slots[i];
      if (slot.lit) {
        parts.litBeads.setMatrixAt(slot.index, matrix);
        matrix.makeScale(size * ORB_HALO_SCALE, size * ORB_HALO_SCALE, size * ORB_HALO_SCALE).setPosition(bead);
        parts.litHalos.setMatrixAt(slot.index, matrix);
      } else parts.glassBeads.setMatrixAt(slot.index, matrix);
    }
    parts.litBeads.instanceMatrix.needsUpdate = parts.litHalos.instanceMatrix.needsUpdate = parts.glassBeads.instanceMatrix.needsUpdate = true;

    // The constellation lines between neighbours, each flickering slowly at its own pace.
    for (let k = 0; k + 1 < slots.length; k++) {
      const at = (RING_SEGMENTS + k) * 6;
      ringPointInto(bead, angles[k], ring).toArray(positions, at);
      ringPointInto(next, angles[k + 1], ring).toArray(positions, at + 3);
      const flicker = f.still ? 0 : 0.5 + 0.5 * Math.sin((2 * Math.PI * run.clock) / beadPeriod(k, ring) + k * 1.7);
      // Forming, a link shows as the later of its two beads lights.
      const formed = twinkle ? Math.min(twinkle.beads[k] ?? 1, twinkle.beads[k + 1] ?? 1) : 1;
      const level = CONSTELLATION_LEVEL * (1 - ring.line.flicker * flicker) * flight.line * formed;
      for (let end = 0; end < 2; end++) {
        colours[at + end * 3] = constellation.r * level;
        colours[at + end * 3 + 1] = constellation.g * level;
        colours[at + end * 3 + 2] = constellation.b * level;
      }
    }
    // The ring line drawing round while the ring forms: each vertex's colour is its keep-out fade times how far the line has got there (written only while it changes).
    const drawn = twinkle ? twinkle.line : 1;
    if (drawn !== run.drawn) {
      const { colour, vertexAngle, vertexSeen } = parts;
      for (let v = 0; v < vertexAngle.length; v++) {
        const level = vertexSeen[v] * ringDrawn(vertexAngle[v], drawn, ring);
        const at = (v >> 1) * 6 + (v & 1) * 3;
        colours[at] = colour.r * level;
        colours[at + 1] = colour.g * level;
        colours[at + 2] = colour.b * level;
      }
      run.drawn = drawn;
    }
    parts.positionBuffer.needsUpdate = parts.colourBuffer.needsUpdate = true;

    parts.beadGlass.uniforms.uOpacity.value = parts.litGlass.uniforms.uOpacity.value = parts.litHalo.uniforms.uOpacity.value = shown * flight.bead;
    // Brightening, every bead's edge turns to the rim's gold.
    parts.beadGlass.uniforms.uFocus.value = RIM_SHARE + (1 - RIM_SHARE) * flight.bright;
    parts.material.color.setScalar(shown * flight.line * (1 + LINE_GLOW * flight.bright));
    // The line's width in pixels: its authored width at the scale a world unit is seen at here.
    root.getWorldPosition(run.centre);
    const pxPerUnit = (state.camera.projectionMatrix.elements[5] * state.size.height) / 2 / Math.max(1e-3, state.camera.position.distanceTo(run.centre));
    parts.material.linewidth = ringLineWidth(ring, pxPerUnit);
    parts.material.resolution.set(state.size.width, state.size.height);
  });

  return (
    <group ref={group} position={[head.centerX, 0, 0]} visible={false}>
      <primitive object={parts.line} />
      <primitive object={parts.litHalos} />
      <primitive object={parts.glassBeads} />
      <primitive object={parts.litBeads} />
    </group>
  );
}
