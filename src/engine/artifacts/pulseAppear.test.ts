import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARM_IDS, type ArmId, type CupPulse, type PendantPlacement, type PendantSlot } from '../config/types';
import { createPulseTriggers, cupPulseAt, firePulse, reducedLevel } from '../character/cupPulse';
import { bloomState } from './bloom';
import { ArmLiftChoreography, fireLiftPulse, MAX_LIFT_PULSES } from './armLift';
import { idleSway, pendantSwing, restSwing } from './pendant';
import { pendantFixture } from './fixtures/pendant';
import { PULSE_GROW, PULSE_LIGHT, orbGrowStart, pulseDue, pulseFrame, pulseLength, pulseSchedule, revealFraction, revealSize } from './pulseAppear';
import { APPEARS, choiceRemoved, choosableNow } from './strategies';

// The pulse appear (Flux spec 7.5, "Appearing"; contract F2): the arms fire in pairs, T1 and T8, then
// T2 and T7, T3 and T6, T4 and T5, `step` apart; each orb grows at its slot as its arm's pulse
// reaches it; the head's swell then grows the orbs from the intro's size to the overview's. Flux's
// numbers are written here as the fixture's own (the engine imports nothing from a world); the
// world's test checks that its data are these.

const DEG = Math.PI / 180;
const STEP = 0.18;
/** The cup pulse's band (Flux: root to tip in 0.75 s). */
const CUPS: CupPulse = { speed: 1.33, wavelength: 0.17, strength: 0.85, colours: ['#20e0ff', '#9a78ff', '#ff8ce0'] };
const REVEAL = { start: 0.35, span: 0.3, step: 0.03 };
const SWING = { maxAngle: 18 * DEG, settle: 0.8 };
const OVERVIEW = 0.28;
const INTRO = 0.001;

/** Flux's sixteen slots: the eight tips top arms first, then the mids in the same order (order = technology index). */
const TOP_DOWN: ArmId[] = ['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5'];
const slots = (): PendantSlot[] => [...TOP_DOWN.map(arm => ({ arm, at: 1 })), ...TOP_DOWN.map(arm => ({ arm, at: 0.55 }))].map((slot, order) => ({ ...slot, order }));

const placement: PendantPlacement = { ...pendantFixture(), slots: { intro: slots(), overview: slots() }, sizes: { intro: INTRO, overview: OVERVIEW }, swing: SWING, reveal: REVEAL };
const context = { appear: { kind: 'pulse', step: STEP } as const, placement, pulse: CUPS };
const SHOWN = 16;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** An orb's radius as TechBubbles draws it: the stage's size or the swell's reveal (whichever is larger), times the appear's growth. */
const radiusAt = (seconds: number, swell: number, i: number) => Math.max(INTRO, revealSize(swell, i, REVEAL, OVERVIEW)) * pulseFrame(null, i, seconds, SHOWN, context).scale;

describe('pulseSchedule (four pairs in pipeline order)', () => {
  it('has four mirrored pairs, T1 and T8 first, ascending, `step` apart', () => {
    const schedule = pulseSchedule(STEP);
    expect(schedule).toHaveLength(8);
    expect(schedule.map(f => f.arm)).toEqual(['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5']);
    for (let pair = 0; pair < 4; pair++) {
      const [left, right] = schedule.slice(pair * 2, pair * 2 + 2);
      // Mirrored: T<n> with T<9 - n>, at the same moment.
      expect(Number(left.arm.slice(1)) + Number(right.arm.slice(1))).toBe(9);
      expect(left.fireAt).toBe(right.fireAt);
      expect(left.fireAt).toBeCloseTo(pair * STEP, 12);
    }
    for (let k = 1; k < schedule.length; k++) expect(schedule[k].fireAt).toBeGreaterThanOrEqual(schedule[k - 1].fireAt);
    expect(new Set(schedule.map(f => f.arm)).size).toBe(8);
  });

  it('stretches with the step', () => {
    expect(pulseSchedule(0.5).map(f => f.fireAt)).toEqual([0, 0, 0.5, 0.5, 1, 1, 1.5, 1.5]);
    expect(pulseSchedule(0).every(f => f.fireAt === 0)).toBe(true);
  });
});

describe('orbGrowStart (an orb grows once its pulse reaches its slot)', () => {
  it('is the arm\'s fire time plus the slot\'s arc over the pulse speed', () => {
    const schedule = pulseSchedule(STEP);
    expect(orbGrowStart({ arm: 'T1', at: 1 }, schedule, 1.33)).toBeCloseTo(1 / 1.33, 12);
    expect(orbGrowStart({ arm: 'T7', at: 0.55 }, schedule, 1.33)).toBeCloseTo(STEP + 0.55 / 1.33, 12);
    expect(orbGrowStart({ arm: 'T5', at: 1 }, schedule, 2)).toBeCloseTo(3 * STEP + 0.5, 12);
  });

  it('is never before the arm\'s pulse has been fired, and a mid slot grows before the tip of its arm', () => {
    const schedule = pulseSchedule(STEP);
    for (const f of schedule) {
      expect(orbGrowStart({ arm: f.arm, at: 0 }, schedule, CUPS.speed)).toBe(f.fireAt);
      expect(orbGrowStart({ arm: f.arm, at: 0.55 }, schedule, CUPS.speed)).toBeLessThan(orbGrowStart({ arm: f.arm, at: 1 }, schedule, CUPS.speed));
    }
  });

  it('keeps every orb at nothing until the pulse head reaches its slot, whatever the moment', () => {
    const schedule = pulseSchedule(STEP);
    const places = slots();
    for (let i = 0; i < SHOWN; i++) {
      const start = orbGrowStart(places[i], schedule, CUPS.speed);
      for (let t = 0; t <= start; t += 1 / 240) expect(pulseFrame(null, i, t, SHOWN, context).scale, `orb ${i} at ${t}`).toBe(0);
      expect(pulseFrame(null, i, start + PULSE_GROW / 2, SHOWN, context).scale).toBeGreaterThan(0);
      expect(pulseFrame(null, i, start + PULSE_GROW, SHOWN, context).scale).toBe(1);
    }
  });

  it('agrees with the cup pulse: the band\'s head is at the slot when the orb starts', () => {
    const schedule = pulseSchedule(STEP);
    for (const slot of slots()) {
      const since = orbGrowStart(slot, schedule, CUPS.speed) - schedule.find(f => f.arm === slot.arm)!.fireAt;
      // The band's head (level rising) has reached the slot's arc, and a hair earlier it had not.
      expect(cupPulseAt(slot.at, since + 0.02, CUPS).level).toBeGreaterThan(0);
      expect(cupPulseAt(slot.at, since - 0.05, CUPS).level).toBe(0);
    }
  });
});

describe('pulseFrame (the appear table\'s frame)', () => {
  it('grows each orb with the bloom\'s own orb channel and wobble, at its slot (it travels nowhere)', () => {
    const schedule = pulseSchedule(STEP);
    const places = slots();
    for (let i = 0; i < SHOWN; i++) {
      const start = orbGrowStart(places[i], schedule, CUPS.speed);
      let last = 0;
      let wobbled = false;
      for (let t = start; t <= start + PULSE_GROW + 0.1; t += 1 / 120) {
        const frame = pulseFrame(null, i, t, SHOWN, context);
        const reference = bloomState(t, 0, 1, { reveal: { start: start - PULSE_GROW, span: PULSE_GROW * 2, step: 0 } });
        expect(frame.scale).toBeCloseTo(reference.orb, 12);
        expect(frame.wobble).toBeCloseTo(reference.wobble, 12);
        expect(frame.scale).toBeGreaterThanOrEqual(last - 1e-12);
        last = frame.scale;
        wobbled ||= Math.abs(frame.wobble) > 0.02;
        expect(frame.emerged).toBe(1);
        expect(frame.puff).toBe(0);
        expect(frame.mouthRound).toBe(0);
        expect(frame.bloom).toBeUndefined();
      }
      expect(wobbled).toBe(true);
    }
  });

  it('is full and still wobble-free at the end of the run', () => {
    const total = pulseLength(SHOWN, placement, STEP, CUPS.speed);
    for (let i = 0; i < SHOWN; i++) expect(pulseFrame(null, i, total, SHOWN, context)).toMatchObject({ scale: 1, wobble: 0 });
    expect(pulseFrame(null, 0, Number.NaN, SHOWN, context).scale).toBe(0);
  });

  it('lasts until the last orb has grown: the last pair\'s tips', () => {
    // T4 and T5 fire at 3 x step, their tips are reached 1 / speed later, and the orb grows PULSE_GROW more.
    expect(pulseLength(SHOWN, placement, STEP, CUPS.speed)).toBeCloseTo(3 * STEP + 1 / CUPS.speed + PULSE_GROW, 12);
    // Fewer technologies take the top arms' tips only, so the run is shorter.
    expect(pulseLength(3, placement, STEP, CUPS.speed)).toBeCloseTo(STEP + 1 / CUPS.speed + PULSE_GROW, 12);
    expect(pulseLength(0, placement, STEP, CUPS.speed)).toBe(0);
  });
});

describe('the appear module (APPEARS.pulse)', () => {
  it('has no sheet (G5) and is the table\'s third entry', () => {
    expect(Object.keys(APPEARS)).toEqual(['blow', 'bloom', 'pulse']);
    expect('sheet' in APPEARS.pulse).toBe(false);
    expect(APPEARS.blow.sheet).toBe('bubbleBlow');
    expect(APPEARS.bloom.sheet).toBe('bloom');
  });

  it('runs on frame time without a sheet and ends when the last orb has grown', () => {
    const run = APPEARS.pulse.createRun(context);
    const total = pulseLength(SHOWN, placement, STEP, CUPS.speed);
    // A sheet length of 0 and no sequences: it does not wait on a sheet it has none of.
    const frame = { exist: true, still: false, ready: true, dt: 0.1, count: SHOWN, length: 0 };
    run.step(frame);
    expect(run.blowing).toBe(true);
    expect(run.seconds).toBe(0);
    run.step({ ...frame, dt: total - 0.01 });
    expect(run.done).toBe(false);
    run.step({ ...frame, dt: 0.02 });
    expect(run.done).toBe(true);
  });

  it('is over at once with reduced motion: the orbs are simply there', () => {
    const run = APPEARS.pulse.createRun(context);
    run.step({ exist: true, still: true, ready: true, dt: 0.016, count: SHOWN, length: 0 });
    expect(run.done).toBe(true);
    expect(run.blowing).toBe(false);
  });

  it('is the table\'s origin-less appear: the orb is at its slot', () => {
    const target = { x: 1, y: 2, z: 3, copy(v: { x: number; y: number; z: number }) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } };
    const out = { x: 0, y: 0, z: 0, copy(v: { x: number; y: number; z: number }) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } };
    APPEARS.pulse.position([0, 0, 0], target as never, 0.2, out as never);
    expect(out).toMatchObject({ x: 1, y: 2, z: 3 });
    expect(APPEARS.pulse.origin()).toEqual([0, 0, 0]);
  });
});

describe('pulseDue (which arms the appear fires, frame by frame)', () => {
  it('fires each arm once, at its pair\'s moment, however the frames fall', () => {
    for (const dt of [1 / 240, 1 / 60, 1 / 30, 0.1, 0.05]) {
      const fired: ArmId[] = [];
      let from = Number.NEGATIVE_INFINITY;
      for (let t = 0; t <= 1; t += dt) {
        fired.push(...pulseDue(from, t, STEP));
        from = t;
      }
      expect([...fired].sort(), `dt ${dt}`).toEqual([...ARM_IDS].sort());
      // Ascending by pair, and the first pair is the first frame's.
      expect(fired.slice(0, 2).sort()).toEqual(['T1', 'T8']);
      expect(fired.slice(6, 8).sort()).toEqual(['T4', 'T5']);
    }
  });

  it('fires nothing for a frame with no new moment, and the very first frame fires the first pair', () => {
    expect([...pulseDue(Number.NEGATIVE_INFINITY, 0, STEP)].sort()).toEqual(['T1', 'T8']);
    expect(pulseDue(0, 0.05, STEP)).toEqual([]);
    expect(pulseDue(0.1, 0.1, STEP)).toEqual([]);
  });

  it('drives the cups\' trigger: every arm pulses once, the pairs STEP apart, T1 and T8 in step', () => {
    const triggers = createPulseTriggers();
    let from = Number.NEGATIVE_INFINITY;
    for (let t = 0; t <= 1; t += 1 / 60) {
      for (const arm of pulseDue(from, t, STEP)) expect(firePulse(triggers, arm, 10 + t, CUPS)).toBe(true);
      from = t;
    }
    const at = (arm: ArmId) => triggers.times[ARM_IDS.indexOf(arm)] - 10;
    expect(at('T1')).toBe(at('T8'));
    expect(at('T2') - at('T1')).toBeGreaterThanOrEqual(STEP - 1 / 60);
    expect(at('T2') - at('T1')).toBeLessThan(STEP + 1 / 60);
    expect(at('T4') - at('T1')).toBeCloseTo(3 * STEP, 1);
  });
});

describe('intro: no orbs, pulses only (spec 7.5, A3)', () => {
  it('leaves every intro orb at about nothing, whatever moment of the appear', () => {
    const total = pulseLength(SHOWN, placement, STEP, CUPS.speed);
    for (let i = 0; i < SHOWN; i++) {
      for (let t = 0; t <= total + 0.3; t += 1 / 60) expect(radiusAt(t, 0, i), `orb ${i} at ${t}`).toBeLessThanOrEqual(INTRO + 1e-12);
    }
  });

  it('offers no button or tray entry there: the world chooses in the overview only', () => {
    const artifacts = { choosableIn: ['overview'] as const };
    expect(choosableNow('intro', artifacts)).toBe(false);
    expect(choiceRemoved('intro', artifacts)).toBe(true);
    expect(choosableNow('overview', artifacts)).toBe(true);
  });
});

describe('the swell\'s reveal (orb i grows over swell start + step x i to that plus span, clamped to 1)', () => {
  it('is monotonic in swell, nothing at swell 0.35 and under, the overview size at swell 1, for all 16', () => {
    for (let i = 0; i < SHOWN; i++) {
      let last = 0;
      for (let swell = 0; swell <= 1 + 1e-9; swell += 1 / 400) {
        const size = revealSize(swell, i, REVEAL, OVERVIEW);
        expect(size, `orb ${i} at ${swell}`).toBeGreaterThanOrEqual(last - 1e-12);
        last = size;
        if (swell <= 0.35 + 1e-9) expect(size).toBeLessThan(1e-9);
      }
      expect(revealSize(0.35, i, REVEAL, OVERVIEW)).toBe(0);
      expect(revealSize(1, i, REVEAL, OVERVIEW)).toBe(OVERVIEW);
      // Overshoot past full (the swell runs past 1) and a closed head hold the ends.
      expect(revealSize(1.2, i, REVEAL, OVERVIEW)).toBe(OVERVIEW);
      expect(revealSize(-0.2, i, REVEAL, OVERVIEW)).toBe(0);
    }
  });

  it('starts each orb 0.03 of swell after the one before, tips first', () => {
    // Orb 0 is under way by swell 0.5 and orb 10 (starting at 0.65) has not begun; at 0.65 orb 0 is done.
    expect(revealFraction(0.5, 0, REVEAL)).toBeGreaterThan(0.2);
    expect(revealFraction(0.65, 10, REVEAL)).toBeLessThan(1e-9);
    expect(revealFraction(0.65, 0, REVEAL)).toBe(1);
    for (let i = 1; i < SHOWN; i++) for (let swell = 0; swell <= 1; swell += 0.01) expect(revealFraction(swell, i - 1, REVEAL)).toBeGreaterThanOrEqual(revealFraction(swell, i, REVEAL) - 1e-12);
  });

  it('clamps an orb whose window passes swell 1 so that it still ends full (orbs 12 to 15)', () => {
    for (let i = 12; i < SHOWN; i++) {
      expect(REVEAL.start + REVEAL.step * i + REVEAL.span).toBeGreaterThan(1);
      expect(revealFraction(1, i, REVEAL)).toBe(1);
      expect(revealFraction(REVEAL.start + REVEAL.step * i, i, REVEAL)).toBeLessThan(1e-9);
    }
  });

  it('is full at the end for a reveal that starts at or past swell 1', () => {
    expect(revealFraction(1, 0, { start: 1, span: 0.3, step: 0 })).toBe(1);
    expect(revealFraction(0.99, 0, { start: 1, span: 0.3, step: 0 })).toBe(0);
  });
});

describe('Explore pressed while the appear is still running (Review Focus 2)', () => {
  it('ends every orb at the overview size, and none flickers back to nothing', () => {
    const total = pulseLength(SHOWN, placement, STEP, CUPS.speed);
    // The swell starts at several moments of the appear, including the very first and well before the last orb's pulse arrives.
    for (const begins of [0, 0.1, 0.3, 0.6, 0.9, 1.4]) {
      for (let i = 0; i < SHOWN; i++) {
        let last = 0;
        let seen = false;
        for (let t = 0; t <= total + 1.5; t += 1 / 120) {
          const swell = clamp01((t - begins) / 0.9);
          const r = radiusAt(t, swell, i);
          // Never smaller than it has been: it grows once, and does not drop back to nothing.
          expect(r, `orb ${i}, swell at ${begins}, t ${t}`).toBeGreaterThanOrEqual(last - 1e-12);
          if (seen) expect(r).toBeGreaterThan(0);
          seen ||= r > 0;
          last = r;
        }
        expect(last, `orb ${i}`).toBeCloseTo(OVERVIEW, 12);
      }
    }
  });

  it('also holds with the swell opening and closing again mid-appear', () => {
    // Open to 0.8 then close, then open: the orb follows the swell and never beyond the overview size.
    for (let i = 0; i < SHOWN; i++) {
      for (let t = 0; t <= 4; t += 1 / 60) {
        const swell = t < 1 ? t * 0.8 : t < 1.6 ? 0.8 - (t - 1) * 1.3 : clamp01((t - 1.6) / 0.9);
        const r = radiusAt(t, clamp01(swell), i);
        expect(r).toBeLessThanOrEqual(OVERVIEW + 1e-12);
        expect(r).toBeGreaterThanOrEqual(0);
      }
      expect(radiusAt(4, 1, i)).toBeCloseTo(OVERVIEW, 12);
    }
  });
});

describe('the swing with Flux\'s limits (18 degrees, settled in 0.8 s)', () => {
  /** A 3 units a second sideways step lasting `secs`, then the arm at rest; the angle each frame. */
  function stepResponse(secs: number, dt = 1 / 120) {
    let state = restSwing(0);
    let t = 0;
    const out: { t: number; angle: number; x: number; moving: boolean }[] = [];
    for (; t <= secs + 1e-9; t += dt) {
      const r = pendantSwing([3, 0, 0], t, state, SWING, false);
      state = r.state;
      out.push({ t, angle: r.angle, x: r.state.x, moving: true });
    }
    const stopped = t;
    for (; t <= stopped + 2; t += dt) {
      const r = pendantSwing([0, 0, 0], t, state, SWING, false);
      state = r.state;
      out.push({ t, angle: r.angle, x: r.state.x, moving: false });
    }
    return { out, stopped };
  }

  it('stays within 18 degrees for a velocity step of 3 units a second, of any length', () => {
    for (const secs of [0.05, 0.2, 0.5, 1, 3]) {
      const { out } = stepResponse(secs);
      expect(Math.max(...out.map(s => Math.abs(s.angle))), `${secs} s`).toBeLessThanOrEqual(SWING.maxAngle + 1e-12);
    }
  });

  it('is settled under a degree 0.8 s after the arm stops: only the idle sway is left', () => {
    for (const secs of [0.05, 0.2, 0.5, 1]) {
      const { out, stopped } = stepResponse(secs);
      for (const s of out.filter(o => o.t >= stopped + SWING.settle)) {
        expect(Math.abs(s.x), `${secs} s, t ${s.t}`).toBeLessThanOrEqual(1 * DEG);
        expect(Math.abs(s.angle - idleSway(s.t, 0, SWING))).toBeLessThanOrEqual(1 * DEG);
      }
    }
  });

  it('has no swing with reduced motion', () => {
    const r = pendantSwing([3, 0, 0], 1, restSwing(0), SWING, true);
    expect(r.angle).toBe(0);
  });
});

describe('the lift pulse (a select fires its arm\'s pulse)', () => {
  const lift = (n: number) => ['T1', 'T8', 'T2', 'T7', 'T3', 'T6'][n] as ArmId;

  it('fires one pulse on the owning arm and none on another', () => {
    const triggers = createPulseTriggers();
    expect(fireLiftPulse(triggers, 'T3', 5, CUPS)).toBe(true);
    ARM_IDS.forEach((arm, k) => expect(triggers.times[k], arm).toBe(arm === 'T3' ? 5 : -Infinity));
  });

  it('fires again on the same arm only once its pulse is half way along', () => {
    const triggers = createPulseTriggers();
    expect(fireLiftPulse(triggers, 'T3', 5, CUPS)).toBe(true);
    expect(fireLiftPulse(triggers, 'T3', 5.1, CUPS)).toBe(false);
    expect(triggers.times[ARM_IDS.indexOf('T3')]).toBe(5);
    expect(fireLiftPulse(triggers, 'T3', 5 + 0.5 / CUPS.speed + 0.01, CUPS)).toBe(true);
  });

  it('shows at most three arms pulsing, never one arm twice at once, in a six-orb hover sweep in 600 ms', () => {
    const triggers = createPulseTriggers();
    const choreography = new ArmLiftChoreography(() => 'T1');
    const fired: { arm: ArmId; at: number }[] = [];
    let mostPulsing = 0;
    // One orb every 100 ms from t = 20 s (the pulse clock is the frame clock, not the sweep's), sampled at 120 Hz.
    const start = 20;
    for (let ms = 0; ms <= 1400; ms += 1000 / 120) {
      const index = Math.min(5, Math.floor(ms / 100));
      const sweeping = ms <= 600;
      const arm = lift(index);
      if (sweeping && choreography.choose(index, ms, false, arm)) {
        const before = Array.from(triggers.times);
        if (fireLiftPulse(triggers, arm, start + ms / 1000, CUPS)) fired.push({ arm, at: ms });
        // A refused pulse changed nothing.
        else expect(Array.from(triggers.times)).toEqual(before);
      }
      const clock = start + ms / 1000;
      const pulsing = ARM_IDS.filter((_, k) => clock - triggers.times[k] >= 0 && (clock - triggers.times[k]) * CUPS.speed < 1 + CUPS.wavelength).length;
      mostPulsing = Math.max(mostPulsing, pulsing);
    }
    expect(MAX_LIFT_PULSES).toBe(3);
    expect(mostPulsing).toBe(3);
    // The first three orbs pulse; the later ones find three arms already pulsing and wait (no pile-up of bands).
    expect(fired.map(f => f.arm)).toEqual(['T1', 'T8', 'T2']);
  });

  it('never doubles a pulse on one arm: a second orb on a pulsing arm waits for the band to be half way', () => {
    const triggers = createPulseTriggers();
    // Orb 0 (the tip) and orb 8 (the mid slot) hang on T1: chosen 100 ms apart.
    expect(fireLiftPulse(triggers, 'T1', 3, CUPS)).toBe(true);
    expect(fireLiftPulse(triggers, 'T1', 3.1, CUPS)).toBe(false);
    expect(triggers.times[0]).toBe(3);
  });

  it("counts any pulse as busy, the appear's or the idle flourish's too", () => {
    const triggers = createPulseTriggers();
    for (const arm of ['T1', 'T8', 'T2'] as ArmId[]) firePulse(triggers, arm, 1, CUPS);
    expect(fireLiftPulse(triggers, 'T5', 1.2, CUPS)).toBe(false);
    // Once the band has run off an arm (1 + wavelength over speed), there is room again.
    expect(fireLiftPulse(triggers, 'T5', 1 + (1 + CUPS.wavelength) / CUPS.speed + 0.01, CUPS)).toBe(true);
  });

  it('a choice that is already lifted fires nothing, a new one fires', () => {
    const choreography = new ArmLiftChoreography(() => 'T1');
    expect(choreography.choose(2, 0, false, 'T2')).toBe(true);
    expect(choreography.choose(2, 16, false, 'T2')).toBe(false);
    expect(choreography.choose(3, 300, false, 'T7')).toBe(true);
    expect(choreography.choose(null, 700)).toBe(false);
    // Chosen again after being let go: a new lift.
    expect(choreography.choose(3, 800, false, 'T7')).toBe(true);
  });
});

describe('reduced motion', () => {
  it("lights every arm's cups for 0.3 s and no longer, and leaves the orbs present at once with no swing", () => {
    expect(PULSE_LIGHT.reduced).toEqual(expect.arrayContaining([...ARM_IDS]));
    expect(PULSE_LIGHT.reduced).toHaveLength(8);
    // The cup shader's reduced path is `reducedLevel`: lit for 0.3 s from the trigger.
    expect(reducedLevel(0)).toBe(1);
    expect(reducedLevel(0.3)).toBe(1);
    expect(reducedLevel(0.31)).toBe(0);
    const run = APPEARS.pulse.createRun(context);
    run.step({ exist: true, still: true, ready: true, dt: 0.016, count: SHOWN, length: 0 });
    expect(run.done).toBe(true);
    // Done: TechBubbles draws no appear frame, so each orb is at its stage's size.
    expect(pendantSwing([3, 0, 0], 1, restSwing(0), SWING, true).angle).toBe(0);
  });
});

describe("Nox's blow and Veyra's bloom stay as they were", () => {
  it('keeps their table entries, sheets and runs', () => {
    expect(APPEARS.blow.sheet).toBe('bubbleBlow');
    expect(APPEARS.bloom.sheet).toBe('bloom');
    expect(APPEARS.blow.origin).toBeTypeOf('function');
    // The bloom's run still lasts 1.2 s for sixteen with no reveal; the pulse's reveal is the swell's, never the bloom's clock.
    const bloom = APPEARS.bloom.createRun({ appear: { kind: 'bloom', duration: 1.2 }, placement: pendantFixture() });
    const frame = { exist: true, still: false, ready: true, dt: 0.6, count: 16, length: 1.2 };
    bloom.step(frame);
    bloom.step(frame);
    expect(bloom.done).toBe(false);
    bloom.step(frame);
    expect(bloom.done).toBe(true);
  });
});

describe('the wiring (the frame loops are not run here: the call sites are pinned on the source text)', () => {
  const source = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

  it("has TechBubbles fire the appear's pulses on the frame clock and grow the orbs by the swell's reveal, only for an appear that has them", () => {
    const bubbles = source('./TechBubbles.tsx');
    expect(bubbles).toContain('appear.cups');
    expect(bubbles).toMatch(/cups\.due\(run\.lit, blow\.seconds!, context\)/);
    expect(bubbles).toMatch(/firePulse\(instance\.pulse, arm, t, pulse\)/);
    expect(bubbles).toMatch(/revealSize\(s\.swellProgress, i, reveal, stageSize\)/);
    // Only the pulse appear reads the reveal as swell progress; the bloom's is seconds.
    expect(bubbles).toMatch(/artifacts\.appear\.kind === 'pulse'/);
    // Reduced motion lights the cups once instead of running them.
    expect(bubbles).toMatch(/s\.reducedMotion/);
  });

  it("has Octopus fire the lift pulse when a lift begins, never with motion off, and feed the swell's progress", () => {
    const octopus = source('../character/Octopus.tsx');
    expect(octopus).toMatch(/const lifting = armLift\.choreography\.choose\(/);
    expect(octopus).toMatch(/lifting && place && artifacts\.select\.kind === 'armLift' && artifacts\.select\.pulse && config\.suckers\.pulse && !reducedMotion && !freeze\) fireLiftPulse\(instance\.pulse, place\.slot\.arm, state\.clock\.elapsedTime/);
    expect(octopus).toMatch(/bubbleState\.swellProgress = Math\.min\(1, Math\.max\(0, sf\.morph\)\)/);
    expect(octopus).toMatch(/pulse=\{config\.suckers\.pulse\}/);
  });
});
