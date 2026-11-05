import { describe, expect, it } from 'vitest';
import { validateBundle, type WorldBundle } from '../../engine/types/bundle';
import { applyPalette, deltaE76, faceRuleHolds, getColour, lightnessSteps, setColour, SWATCHES } from './palettes';
import { toOklch } from './oklch';
import { PERSONALITIES } from './personalities';
import { SWATCH_COLOURS } from './swatchColours';
import { TEMPLATES } from './templates';
import { PALETTE_IDS, PERSONALITY_IDS, TEMPLATE_IDS, type CharacterConfig, type CreatorTemplate, type PaletteId } from './types';

const ARM_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];

const SHIPPED = ['nox', 'veyra', 'flux', 'aether', 'octoverse'];
const swatchIds = PALETTE_IDS.filter((id): id is Exclude<PaletteId, 'original'> => id !== 'original');

const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/** The smallest valid project: no technologies (a draft is allowed that). */
const MINIMAL_CONTENT: WorldBundle['content'] = {
  project: { id: 'u-test-project', name: 'Test', characterName: 'Test', characterEpithet: 'A test octopus', introduction: [] },
  technologies: [],
};

const bundleFor = (template: CreatorTemplate, character: CharacterConfig): WorldBundle => ({ ...template.bundle, id: 'u-test', character, content: MINIMAL_CONTENT });

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** Everything a palette must never touch: the face glow, eyes, mouth, blush (the whole face and its palette), and the cups. */
const untouched = (c: CharacterConfig) => ({
  face: c.face,
  facePalette: c.facePalette,
  glowRamp: c.glow.ramp,
  glowCore: c.glow.core,
  glowLight: c.glow.light,
  glowCentre: c.glow.center,
  suckers: c.suckers,
  suckerColours: { edge: c.palette.suckerEdge, body: c.palette.suckerBody, hot: c.palette.suckerHot, hollow: c.palette.suckerHollow, shadow: c.palette.suckerShadow, specular: c.palette.suckerSpecular },
  arms: c.arms,
  personality: c.personality,
});

describe('swatches', () => {
  it('are the eight P4 swatches of swatchColours.ts, with their pixels', () => {
    expect(Object.keys(SWATCHES)).toEqual(swatchIds);
    for (const id of swatchIds) {
      expect(SWATCHES[id].hex).toBe(SWATCH_COLOURS[id].hex);
      expect(SWATCHES[id].p4).toEqual(SWATCH_COLOURS[id].at);
    }
  });
});

describe('templates', () => {
  it('are the four worlds (never the host), each with slots that exist on its character', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual([...TEMPLATE_IDS].sort());
    for (const id of TEMPLATE_IDS) {
      const template = TEMPLATES[id];
      expect(template.id).toBe(id);
      expect(template.bundle).not.toHaveProperty('id');
      expect(template.bundle).not.toHaveProperty('content');
      expect(template.slots.length).toBeGreaterThanOrEqual(4);
      expect(new Set(template.slots).size).toBe(template.slots.length);
      for (const slot of template.slots) expect(getColour(template.bundle.character, slot), `${id} ${slot}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(template.slots).toContain(template.upperHead);
      expect(template.faceGlow).toMatch(/^#[0-9a-f]{6}$/i);
      // No slot is a face, cup or lighting colour.
      for (const slot of template.slots) expect(slot, `${id} ${slot}`).not.toMatch(/^(face|facePalette|suckers|lighting)\.|sucker|^glow\.(ramp|core|light)/);
    }
  });
});

describe('applyPalette', () => {
  it("'original' returns the configuration unchanged", () => {
    for (const id of TEMPLATE_IDS) {
      const character = TEMPLATES[id].bundle.character;
      expect(applyPalette(character, TEMPLATES[id], 'original')).toEqual(character);
    }
  });

  it('does not change its input', () => {
    for (const id of TEMPLATE_IDS) {
      const character = deepFreeze(structuredClone(TEMPLATES[id].bundle.character));
      expect(() => applyPalette(character, TEMPLATES[id], 'rose')).not.toThrow();
    }
  });

  it('is deterministic', () => {
    for (const id of TEMPLATE_IDS) {
      const character = TEMPLATES[id].bundle.character;
      expect(applyPalette(character, TEMPLATES[id], 'teal')).toEqual(applyPalette(character, TEMPLATES[id], 'teal'));
    }
  });

  describe.each(TEMPLATE_IDS)('%s', (id) => {
    const template = TEMPLATES[id];
    const original = template.bundle.character;

    it('holds the face rule in its own original colours', () => {
      expect(faceRuleHolds(original, template)).toBe(true);
    });

    it.each(PALETTE_IDS)('palette %s: face, eyes, mouth, blush, cups unchanged; face rule holds; slot hues on the swatch; validateBundle accepts', (palette) => {
      const result = applyPalette(original, template, palette);
      expect(untouched(result)).toEqual(untouched(original));
      expect(faceRuleHolds(result, template)).toBe(true);
      // The face glow is exactly the template's approved face glow.
      expect(getColour(result, template.faceGlowAt)).toBe(template.faceGlow);
      if (palette !== 'original') {
        const hue = toOklch(SWATCHES[palette].hex).h;
        for (const slot of template.slots) {
          const { c, h } = toOklch(getColour(result, slot));
          // An all but grey colour has no hue to speak of; none of the slots is that.
          expect(c, `${slot} chroma`).toBeGreaterThan(0.02);
          expect(hueDiff(h, hue), `${palette} ${slot}`).toBeLessThanOrEqual(3);
        }
      }
      expect(() => validateBundle(bundleFor(template, result), SHIPPED)).not.toThrow();
    });
  });

  it('only ever lowers lightness, by at most 15 steps of 0.02', () => {
    for (const id of TEMPLATE_IDS) {
      const template = TEMPLATES[id];
      for (const palette of swatchIds) {
        const result = applyPalette(template.bundle.character, template, palette);
        for (const slot of template.slots) {
          const before = toOklch(getColour(template.bundle.character, slot)).l;
          const after = toOklch(getColour(result, slot)).l;
          // Within the quantisation of 8-bit hex, a slot is at its own lightness or lower by at most 15 x 0.02.
          expect(after, `${id} ${palette} ${slot}`).toBeLessThanOrEqual(before + 0.02);
          expect(after, `${id} ${palette} ${slot}`).toBeGreaterThanOrEqual(before - 0.3 - 0.02);
        }
      }
    }
  });
});

describe('lowering lightness when a swatch hue breaks the face rule', () => {
  // The four real templates never need a step (their upper heads are dark enough in every hue), so the mechanism is proved on a
  // template whose upper head is a light colour: Aether with the lavender-pink rim (OKLCH l 84.6) standing in for the upper head.
  const aether = TEMPLATES.aether;
  const light: CreatorTemplate = { ...aether, upperHead: 'skin.surfaces.mantle.jelly.rim' };
  const original = aether.bundle.character;

  it('lowers every slot together until the rule holds, in steps of 0.02', () => {
    expect(faceRuleHolds(original, light)).toBe(false);
    for (const palette of swatchIds) {
      const steps = lightnessSteps(original, light, palette);
      expect(steps, palette).toBeGreaterThan(0);
      expect(steps, palette).toBeLessThanOrEqual(15);
      const result = applyPalette(original, light, palette);
      expect(faceRuleHolds(result, light), palette).toBe(true);
      // One step fewer would not have held, so the loop stopped at the first lightness that does.
      const head = toOklch(getColour(result, light.upperHead)).l;
      const was = toOklch(getColour(original, light.upperHead)).l;
      expect(head, palette).toBeLessThan(was);
      expect(Math.abs(was - head - steps * 0.02), palette).toBeLessThan(0.02);
    }
  });

  it('stops at 15 steps and leaves the rule failing (it never fakes it)', () => {
    // A face glow darker than any body: no lowering can open a gap of 30 above the upper head.
    const dark: CreatorTemplate = { ...aether, faceGlow: '#202020' };
    const config = setColour(original, aether.faceGlowAt, '#202020');
    expect(lightnessSteps(config, dark, 'rose')).toBe(16);
    expect(faceRuleHolds(applyPalette(config, dark, 'rose'), dark)).toBe(false);
  });
});

describe('faceRuleHolds', () => {
  const template = TEMPLATES.aether;
  const original = template.bundle.character;
  const withUpperHead = (hex: string): CharacterConfig => setColour(original, template.upperHead, hex);

  it('fails a body as light as the face (pink around a pink face)', () => {
    expect(faceRuleHolds(withUpperHead('#fdd2ec'), template)).toBe(false);
    expect(faceRuleHolds(withUpperHead('#f4b8e0'), template)).toBe(false);
  });

  it('measures CIE76 delta E >= 40 and an OKLCH lightness gap >= 30 (x100), both', () => {
    // Dark enough on both counts.
    expect(faceRuleHolds(withUpperHead('#3a1f8a'), template)).toBe(true);
    // A mid grey-violet: whether it passes is the two measures' joint answer.
    const grey = '#b0a0b8';
    const l = toOklch(grey).l * 100;
    const gap = toOklch(template.faceGlow).l * 100 - l;
    expect(faceRuleHolds(withUpperHead(grey), template)).toBe(gap >= 30 && deltaE76(template.faceGlow, grey) >= 40);
  });

  it('fails when the configuration changed the face glow', () => {
    const copy = structuredClone(original);
    copy.glow.ramp = copy.glow.ramp.map((stop, i, all) => (i === all.length - 1 ? ([stop[0], '#ffffff'] as const) : stop));
    expect(faceRuleHolds(copy, template)).toBe(false);
  });
});

describe('deltaE76', () => {
  it('is 0 for the same colour and 100 for black against white', () => {
    expect(deltaE76('#336699', '#336699')).toBeCloseTo(0, 6);
    expect(deltaE76('#000000', '#ffffff')).toBeCloseTo(100, 0);
  });
});

describe('every template x palette x personality (4 x 9 x 4 = 144, the 128 of the eight swatches included)', () => {
  it('yields a bundle that validates, keeps eight arms and the face rule', () => {
    let count = 0;
    let swatchCount = 0;
    for (const templateId of TEMPLATE_IDS) {
      const template = TEMPLATES[templateId];
      for (const palette of PALETTE_IDS) {
        for (const personality of PERSONALITY_IDS) {
          const character: CharacterConfig = { ...applyPalette(template.bundle.character, template, palette), personality: PERSONALITIES[personality] };
          const bundle = validateBundle(bundleFor(template, character), SHIPPED);
          const label = `${templateId} ${palette} ${personality}`;
          expect(bundle.character.arms.map((arm) => arm.id), label).toEqual(ARM_IDS);
          expect(Object.values(bundle.poses).every((pose) => Object.keys(pose.arms).length === 8), label).toBe(true);
          expect(faceRuleHolds(bundle.character, template), label).toBe(true);
          expect(bundle.character.personality, label).toEqual(PERSONALITIES[personality]);
          count += 1;
          if (palette !== 'original') swatchCount += 1;
        }
      }
    }
    expect(count).toBe(144);
    expect(swatchCount).toBe(128);
  });
});
