import type * as THREE from 'three';
import { ARM_IDS, type ArmId, type CharacterConfig, type CupPulse } from '../config/types';
import type { InstanceState } from '../host/instance';

// The cup pulse (contract 18.1 F1, Flux spec 2.4 and 7.5): a band of light that runs along one arm's
// cups, root to tip, when that arm's one-shot trigger fires. Its head leads in the first colour
// (Flux: electric cyan), its middle is the second (lavender) and its tail fades in the third (the
// cup pink). The maths is here once, in TypeScript for the tests and as GLSL for the cup shader,
// written from the same constants.

/** One trigger per arm, T1..T8 in order: `uPulseTimes`, eight floats. */
export const PULSE_ARMS = ARM_IDS.length;
/** The band's leading edge rises over this fraction of its length, and its tail fades over this one. */
const PULSE_HEAD = 0.1;
const PULSE_TAIL = 0.3;
/** With reduced motion, the whole row lights at once for this long instead of the band travelling. */
const REDUCED_FLASH = 0.3;
/** Reduced motion's flash takes the band's middle colour. */
const REDUCED_HUE = 0.5;
/** The most a lit cup brightens at full strength: the pulse is mostly a hue shift (spec 2.4). */
const PULSE_BRIGHTEN = 0.15;
/**
 * What the cup shader is given for an idle arm in place of -Infinity (which a GPU need not
 * honour): a trigger this far in the past, long run off any arm.
 */
export const PULSE_IDLE = -1e4;
/** firePulse restarts an arm's pulse only once its head is this far along the arm. */
const REFIRE_TRAVEL = 0.5;

/**
 * Each arm's trigger: the clock time its pulse was fired, in seconds; -Infinity is idle. One per
 * instance (`InstanceState.pulse`), so a remount or another world starts with every arm idle. The
 * clock is the character's frame clock (R3F `state.clock.elapsedTime`), the one the cups are drawn on.
 */
export interface PulseTriggers {
  times: Float32Array;
}

export function createPulseTriggers(): PulseTriggers {
  return { times: new Float32Array(PULSE_ARMS).fill(-Infinity) };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Fires `arm`'s pulse at `clock` (seconds). It returns false, and changes nothing, while that arm's
 * pulse is under half way along the arm, so a quick second call never cuts a band short; past half
 * way, or idle, it (re)starts the pulse from the root.
 */
export function firePulse(t: PulseTriggers, arm: ArmId, clock: number, cfg: CupPulse): boolean {
  const i = ARM_IDS.indexOf(arm);
  if (i < 0) return false;
  const since = clock - t.times[i];
  if (since * cfg.speed < REFIRE_TRAVEL) return false;
  t.times[i] = clock;
  return true;
}

/** What an idle pulse draws on: the random stream (Math.random by default; a seeded one in tests) and the busy-arm hook. */
export interface IdlePulseOptions {
  random?: () => number;
  /** True for an arm that is lifting or holding something: it never pulses idle (the flourish layer's own busy hook). */
  busy?: (arm: ArmId) => boolean;
}

/**
 * The idle pulse's subscription, called to unsubscribe (on unmount). `flush` is called once a frame,
 * after the flourish scheduler has stepped, with the pulse clock (the R3F frame clock) and whether
 * reduced motion is on: it fires what the subscription heard this frame.
 */
export interface IdlePulse {
  (): void;
  flush(clock: number, reducedMotion?: boolean): void;
}

const NO_IDLE_PULSE: IdlePulse = Object.assign(() => {}, { flush: () => {} });

/**
 * The idle pulse (Flux, spec 2.4 and 7.8; amendment A2 X1): on each idle flourish, with probability
 * `personality.flourishPulse`, the flourishing arm's cups run a pulse. Returns the unsubscribe
 * function, which also carries `flush`. A `flourishPulse` of 0 or absent, or a config with no cup
 * pulse, subscribes nothing, so Nox and Veyra are untouched.
 *
 * The flourish event is `{ arm, start }` and `start` is on the flourish scheduler's clock, which
 * runs only while a flourish may play. The cups read the R3F frame clock, so the subscription only
 * notes the arm and `flush` (Octopus's frame loop, which has that clock) fires it in the same frame.
 *
 * Interplay with Veyra's tip unroll: there is no way to suppress the unroll, and none is added. It
 * plays on every flourish, so the pulse travels alongside it: the band runs root to tip in 0.75 s
 * while the tip uncurls over the flourish's three seconds, and has gone before the unroll peaks.
 *
 * Two idle pulses never overlap: flourishes are 4.8 s or more apart and a pulse lasts about 0.9 s,
 * and `firePulse` refuses an arm whose pulse is under half way regardless. An arm that is busy (lifting)
 * or reduced motion drops the pulse; it is never held over to a later frame.
 */
export function subscribeIdlePulse(instance: Pick<InstanceState, 'flourish' | 'pulse'>, cfg: CharacterConfig, options: IdlePulseOptions = {}): IdlePulse {
  const share = cfg.personality.flourishPulse;
  const pulse = cfg.suckers.pulse;
  if (!pulse || share === undefined || !Number.isFinite(share) || share <= 0) return NO_IDLE_PULSE;
  const random = options.random ?? Math.random;
  const pending: ArmId[] = [];
  const unsubscribe = instance.flourish.subscribe(e => {
    if (random() < share) pending.push(e.arm);
  });
  return Object.assign(() => unsubscribe(), {
    flush(clock: number, reducedMotion = false) {
      for (const arm of pending) {
        if (!reducedMotion && !options.busy?.(arm)) firePulse(instance.pulse, arm, clock, pulse);
      }
      pending.length = 0;
    },
  });
}

/**
 * The pulse on a cup `arc` along its arm (0 root, 1 tip), `since` seconds after the arm fired:
 * `level` 0 to 1 (0 before it fires and once the band has run off the tip) and `hue` 0 to 1 across
 * the three colours (0 at the band's head, 1 at its tail). The band's head is `speed * since` along
 * the arm and its tail `wavelength` behind; its level rises quickly at the head and fades along the tail.
 */
export function cupPulseAt(arc: number, since: number, cfg: Pick<CupPulse, 'speed' | 'wavelength'>): { level: number; hue: number } {
  if (since < 0) return { level: 0, hue: 0 };
  const x = (cfg.speed * since - arc) / cfg.wavelength;
  const level = smoothstep(0, PULSE_HEAD, x) * (1 - smoothstep(1 - PULSE_TAIL, 1, x));
  return { level, hue: Math.min(1, Math.max(0, x)) };
}

/** With reduced motion: the row's level `since` seconds after it fired (1 for 0 to 0.3 s, then 0). */
export function reducedLevel(since: number): number {
  return since >= 0 && since <= REDUCED_FLASH ? 1 : 0;
}

const f = (n: number) => n.toFixed(4);

/**
 * The cup vertex shader's pulse: per cup (the `aCup` attribute: its arm and its arc fraction), the
 * level times the strength and the hue, as `vPulse`. The same maths as cupPulseAt and reducedLevel.
 * `uPulse` is (speed, wavelength, strength, reduced motion 0 or 1).
 */
export const PULSE_VERTEX_DECLARATIONS = /* glsl */ `      uniform float uPulseTimes[${PULSE_ARMS}];
      uniform float uPulseClock;
      uniform vec4 uPulse;
      varying vec2 vPulse;
      vec2 cupPulseAt(float arc, float since) {
        if (since < 0.0) return vec2(0.0);
        if (uPulse.w > 0.5) return vec2(since <= ${f(REDUCED_FLASH)} ? 1.0 : 0.0, ${f(REDUCED_HUE)});
        float x = (uPulse.x * since - arc) / uPulse.y;
        float level = smoothstep(0.0, ${f(PULSE_HEAD)}, x) * (1.0 - smoothstep(${f(1 - PULSE_TAIL)}, 1.0, x));
        return vec2(level, clamp(x, 0.0, 1.0));
      }
`;
export const PULSE_VERTEX_TERM = /* glsl */ `        vPulse = cupPulseAt(aCup.y, uPulseClock - uPulseTimes[int(aCup.x + 0.5)]);
        vPulse.x *= uPulse.z;
`;

/** The cup fragment shader's pulse colours (config, never constants) and the band's value. */
export const PULSE_FRAGMENT_DECLARATIONS = /* glsl */ `      uniform vec3 uPulseColours[3];
      varying vec2 vPulse;
`;
/**
 * The pulse on the cup's own glowing colour: it turns toward the band's colour at that point, held
 * to the cup's own brightness (so the shift is of hue), and brightens by at most PULSE_BRIGHTEN.
 */
export const PULSE_FRAGMENT_TERM = /* glsl */ `        // The cup pulse: the cup turns toward the band's colour at its brightness, a little brighter.
        vec3 band = vPulse.y < 0.5 ? mix(uPulseColours[0], uPulseColours[1], vPulse.y * 2.0) : mix(uPulseColours[1], uPulseColours[2], vPulse.y * 2.0 - 1.0);
        band *= max(c.r, max(c.g, c.b)) / max(max(band.r, max(band.g, band.b)), 0.001);
        c = mix(c, band, vPulse.x) * (1.0 + ${f(PULSE_BRIGHTEN)} * vPulse.x);
`;

/**
 * Writes the triggers, the clock and the reduced-motion switch into a pulsing cup material's
 * uniforms, in place (no allocation per frame): an idle arm's -Infinity goes in as PULSE_IDLE.
 * A review still (`?freeze&pulse=<arm>@<s>`, `review`) shows its arm fired at clock 0 and the clock
 * at its moment, without touching the triggers.
 */
export function writePulseUniforms(uniforms: Record<string, THREE.IUniform>, t: PulseTriggers, clock: number, reducedMotion: boolean, review?: { arm: ArmId; seconds: number }) {
  const out = uniforms.uPulseTimes.value as Float32Array;
  for (let i = 0; i < PULSE_ARMS; i++) out[i] = Number.isFinite(t.times[i]) ? t.times[i] : PULSE_IDLE;
  if (review) out[ARM_IDS.indexOf(review.arm)] = 0;
  uniforms.uPulseClock.value = review ? review.seconds : clock;
  (uniforms.uPulse.value as THREE.Vector4).w = reducedMotion ? 1 : 0;
}
